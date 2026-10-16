"use strict";

/* =====================================================================
 *  Smartys M3U Player — webOS TV App
 *  v1.1.0 — Feature-Paritaet zur Android-App v0.8.6:
 *  - Sicherheits-Passwort ( verschluesselte M3U-Payload aus dem Panel,
 *    WebCrypto: PBKDF2-HMAC-SHA256 310k + AES-256-GCM, AAD
 *    "smartys-iptv-sec:"+PlayerID — identisch mit Android SecCrypto.kt)
 *  - Kategorie-Verwaltung: A→Z / Z→A, verschieben, umbenennen,
 *    ausblenden, Mehrfach-Markierung (MARKIERT = BEHALTEN)
 *  - Kanal-Verwaltung: FSK-18-PIN-Gate, sortieren, ausblenden
 *  - Elternschutz-PIN: Gate-Untertitel, PIN in Einstellungen entfernen
 *  - "Alle Kanäle" blendet ausgeblendete Kategorien aus (v0.8.5)
 *  - VOD: ausgeblendete Kategorien unter "Alle" gefiltert (v0.8.6)
 *  - Menu-Taste (keyCode 275 / webOSRemote) = Verwaltung öffnen
 *
 *  Feature-Paritaet zur Android-/Desktop-App:
 *  Pairing, Live-TV, VOD (Movies/Series), EPG-Grid, Catch-up/Timeshift,
 *  Kindersicherung (PIN), Profile, Favoriten, Fortsetzen, TMDB.
 *  Backend:  panel.smartys.tech  (Pairing + Provider + TMDB-Proxy)
 *  Xtream:   player_api.php des jeweiligen Providers
 *  Wiedergabe: hls.js (Fallback natives HLS auf WebKit-Engines)
 * ===================================================================== */

var PANEL = "https://panel.smartys.tech";
var APP_VERSION = "1.1.0";

var state = {
    playerId: null,
    pairingPw: null,
    token: null,
    providers: [],          // {server_url, username, password, label}
    categories: [],         // Live-TV Kategorien
    channels: [],           // Live-TV Kanäle
    selectedLiveCat: null,

    vodCategories: [], vodMovies: [],
    seriesCategories: [], seriesShows: [],

    selectedMovieCat: null,
    selectedSeriesCat: null,

    xmltv: null,            // {byId: {}, byName: {}, ready:false}
    epgShortCache: {},      // streamId -> [{title,start,end}]

    favorites: {},          // pro Profil
    resume: {},             // key -> position ms
    recent: [],             // zuletzt gesehen (streamIds)
    activeProfile: "default",

    currentView: "pairing",
    hls: null,
    currentPlayback: null,  // {url, title, kind, channelId}
    osdTimer: null,
};

/* =====================================================================
 *  Persistenz (localStorage, pro Profil für Nutzerdaten)
 * ===================================================================== */

function lsGet(key, def) {
    try { var v = localStorage.getItem(key); return v === null ? def : JSON.parse(v); }
    catch (e) { return def; }
}
function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
}
function lsDel(key) { try { localStorage.removeItem(key); } catch (e) {} }

function profileScope(base) { return base + "__" + state.activeProfile; }

function loadProfileState() {
    state.favorites = lsGet(profileScope("fav"), {});
    state.resume = lsGet(profileScope("resume"), {});
    state.recent = lsGet(profileScope("recent"), []);
}

/* =====================================================================
 *  Identität (Player-ID + Pairing-PW, wie Android)
 * ===================================================================== */

function randomBytes(n) {
    var b = new Uint8Array(n);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(b);
    else for (var i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 256);
    return b;
}
function genPlayerId() {
    var b = randomBytes(6);
    b[0] = (b[0] & 0xFE) | 0x02;
    var p = [];
    for (var i = 0; i < 6; i++) p.push(("0" + b[i].toString(16).toUpperCase()).slice(-2));
    return p.join(":");
}
function genPairingPw() {
    var CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    var b = randomBytes(12), out = "";
    for (var i = 0; i < 12; i++) out += CHARS[((b[i] % CHARS.length) + CHARS.length) % CHARS.length];
    return out;
}
function ensureIdentity() {
    var id = localStorage.getItem("player_id");
    var pw = localStorage.getItem("pairing_pw");
    if (!id) { id = genPlayerId(); localStorage.setItem("player_id", id); }
    if (!pw) { pw = genPairingPw(); localStorage.setItem("pairing_pw", pw); }
    state.playerId = id; state.pairingPw = pw;
}

/* =====================================================================
 *  HTTP
 * ===================================================================== */

function http(method, url, opts) {
    return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open(method, url, true);
        xhr.timeout = (opts && opts.timeout) || 15000;
        if (opts && opts.headers) for (var k in opts.headers) xhr.setRequestHeader(k, opts.headers[k]);
        xhr.onload = function () { resolve(xhr); };
        xhr.onerror = function () { reject(new Error("Netzwerkfehler")); };
        xhr.ontimeout = function () { reject(new Error("Timeout")); };
        xhr.send(opts ? opts.body : undefined);
    });
}
function httpPostForm(url, params) {
    var body = Object.keys(params).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]); }).join("&");
    return http("POST", url, { headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body });
}
function httpGetJson(url, headers) {
    return http("GET", url, { headers: headers }).then(function (xhr) {
        if (xhr.status !== 200) throw new Error("HTTP " + xhr.status);
        return JSON.parse(xhr.responseText);
    });
}

/* =====================================================================
 *  SecCrypto (WebCrypto) — Panel verschlüsselte M3U-Zeilen
 *  Vertrag = Android SecCrypto.kt + iptv-backend/app/crypto.py (bindend):
 *  - Key:  PBKDF2WithHmacSHA256, 256 Bit, Salt = b64("salt"),
 *          Iterationen aus der API-Antwort (Standard 310.000)
 *  - Ciph: AES-256-GCM, Token = b64(nonce[12] || ct+tag)
 *  - AAD:  "smartys-iptv-sec:" + PlayerID  (bindet an diesen Player)
 *  - Defekt/falsches Passwort → leerer String, NIE crashen
 * ===================================================================== */

var SEC_AAD_PREFIX = "smartys-iptv-sec:";
var SEC_WEB_CRYPTO = !!(window.crypto && crypto.subtle);

function secB64ToBytes(b64) {
    var bin = atob(b64), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}
function secDeriveKey(password, saltB64, iterations) {
    if (!SEC_WEB_CRYPTO) return Promise.reject(new Error("WebCrypto nicht verfügbar"));
    var baseKey = crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: secB64ToBytes(saltB64), iterations: iterations, hash: "SHA-256" },
        baseKey, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
}
function secDecryptField(key, tokenB64, playerId) {
    if (!tokenB64) return Promise.resolve("");
    var raw;
    try { raw = secB64ToBytes(tokenB64); } catch (e) { return Promise.resolve(""); }
    if (raw.length <= 12) return Promise.resolve("");
    return crypto.subtle.decrypt(
        { name: "AES-GCM", iv: raw.slice(0, 12), additionalData: new TextEncoder().encode(SEC_AAD_PREFIX + playerId) },
        key, raw.slice(12)
    ).then(function (buf) { return new TextDecoder().decode(buf); })
     .catch(function () { return ""; });
}

/* =====================================================================
 *  Backend (panel.smartys.tech): Pairing, Provider, TMDB
 * ===================================================================== */

function pair() {
    return httpPostForm(PANEL + "/api/v1/pair", { mac: state.playerId, password: state.pairingPw })
        .then(function (xhr) {
            if (xhr.status !== 200) throw new Error("Pairing fehlgeschlagen (HTTP " + xhr.status + ")");
            state.token = JSON.parse(xhr.responseText).token;
            return state.token;
        });
}
function fetchProviders() {
    return httpGetJson(PANEL + "/api/v1/providers", { "Authorization": "Bearer " + state.token })
        .then(function (body) {
            // Panel kann die M3U-Zeilen verschlüsselt liefern (Sicherheits-Passwort).
            if (body && body.encrypted) {
                var sec = {
                    salt: body.salt || "",
                    iterations: body.iterations || 310000,
                    providers: (body.providers || [])
                        .filter(function (p) { return p && p.cipher_server_url && p.cipher_username && p.cipher_password; })
                        .map(function (p) {
                            return { label: p.label || "", cipherServerUrl: p.cipher_server_url, cipherUsername: p.cipher_username, cipherPassword: p.cipher_password };
                        })
                };
                if (sec.providers.length === 0) throw new Error("EMPTY");
                state.pendingSec = sec;
                throw new Error("SEC"); // sentinel: Unlock-View anzeigen
            }
            state.providers = (body.providers || []).filter(function (p) { return p.active; });
            if (state.providers.length === 0) throw new Error("EMPTY");
            return state.providers;
        });
}

/* Sicherheits-Passwort: verschlüsselte Zeile entschlüsseln (wie Android
 * MainViewModel.unlockLine — Plaintext danach lokal persistieren, damit
 * der nächste Start ohne Passwort möglich ist). */
function unlockLine(password) {
    var sec = state.pendingSec;
    if (!sec || !sec.salt) return Promise.resolve(false);
    return secDeriveKey(password, sec.salt, sec.iterations).then(function (key) {
        var jobs = sec.providers.map(function (p) {
            return secDecryptField(key, p.cipherServerUrl, state.playerId)
                .then(function (url) {
                    return secDecryptField(key, p.cipherUsername, state.playerId).then(function (user) {
                        return secDecryptField(key, p.cipherPassword, state.playerId).then(function (pass) {
                            return { server_url: url, username: user, password: pass, label: p.label };
                        });
                    });
                });
        });
        return Promise.all(jobs);
    }).then(function (provs) {
        provs = (provs || []).filter(function (p) { return p.server_url && p.username && p.password; });
        if (provs.length === 0) return false;
        state.providers = provs;
        state.pendingSec = null;
        try { localStorage.setItem("providers_json", JSON.stringify(provs)); } catch (e) {}
        return true;
    }).catch(function () { return false; });
}

function showUnlock() {
    var msg = document.getElementById("unlock-msg");
    msg.textContent = "Diese Provider-Zeile ist verschlüsselt. Bitte Sicherheits-Passwort eingeben.";
    msg.className = "msg";
    var inp = document.getElementById("unlock-input");
    inp.value = "";
    show("view-unlock");
    try { inp.focus(); } catch (e) {}
}

function doUnlock() {
    var pw = document.getElementById("unlock-input").value;
    if (!pw) return;
    document.getElementById("unlock-msg").textContent = "Entschlüssele…";
    show("view-loading");
    unlockLine(pw).then(function (ok) {
        if (ok) {
            lsSet("providers_json", state.providers);
            if (state.token) lsSet("token", state.token);
            loadAll().then(function () { show("view-home"); });
        } else {
            showUnlock();
            var m = document.getElementById("unlock-msg");
            m.textContent = "❌ Passwort falsch — die Zeile bleibt verschlüsselt.";
            m.className = "msg error";
        }
    }).catch(function (e) {
        showUnlock();
        var m2 = document.getElementById("unlock-msg");
        m2.textContent = "Fehler: " + (e && e.message ? e.message : e);
        m2.className = "msg error";
    });
}
function fetchTmdbMovie(tmdbId) {
    return httpGetJson(PANEL + "/api/v1/tmdb/movie/" + encodeURIComponent(tmdbId)).catch(function () { return null; });
}

/* =====================================================================
 *  Xtream API
 * ===================================================================== */

function primaryProvider() { return state.providers[0]; }

function xtream(provider, action, extra) {
    var url = (provider.server_url || "").replace(/\/+$/, "") + "/player_api.php?username=" +
        encodeURIComponent(provider.username) + "&password=" + encodeURIComponent(provider.password) +
        "&action=" + action;
    if (extra) for (var k in extra) url += "&" + k + "=" + encodeURIComponent(extra[k]);
    return httpGetJson(url);
}

/* Stream-URLs (identisch zu CredStore.kt) */
function liveUrl(streamId) {
    var p = primaryProvider();
    return p.server_url.replace(/\/+$/, "") + "/live/" + encodeURIComponent(p.username) + "/" + encodeURIComponent(p.password) + "/" + streamId + ".m3u8";
}
function movieUrl(streamId, ext) {
    var p = primaryProvider();
    return p.server_url.replace(/\/+$/, "") + "/movie/" + encodeURIComponent(p.username) + "/" + encodeURIComponent(p.password) + "/" + streamId + "." + (ext || "mp4");
}
function seriesUrl(episodeId, ext) {
    var p = primaryProvider();
    return p.server_url.replace(/\/+$/, "") + "/series/" + encodeURIComponent(p.username) + "/" + encodeURIComponent(p.password) + "/" + episodeId + "." + (ext || "mp4");
}
function timeshiftUrl(streamId, startEpoch, durationHours) {
    var p = primaryProvider();
    return p.server_url.replace(/\/+$/, "") + "/timeshift/" + encodeURIComponent(p.username) + "/" + encodeURIComponent(p.password) + "/" + durationHours + "/" + startEpoch + "/" + streamId + ".m3u8";
}

/* =====================================================================
 *  View-Wechsel
 * ===================================================================== */

var VIEWS = ["view-pin", "view-profiles", "view-pairing", "view-unlock", "view-loading", "view-home",
             "view-movie-detail", "view-series-detail", "view-settings", "view-player"];

function show(id) {
    for (var i = 0; i < VIEWS.length; i++) {
        var el = document.getElementById(VIEWS[i]);
        if (VIEWS[i] === id) el.classList.remove("hidden"); else el.classList.add("hidden");
    }
    state.currentView = id;
}

function setPairMsg(text, cls) {
    var el = document.getElementById("pair-msg");
    el.textContent = text;
    el.className = "msg" + (cls ? " " + cls : "");
}

/* =====================================================================
 *  Kindersicherung (PIN, SHA-256)
 * ===================================================================== */

function sha256hex(str) {
    if (window.crypto && crypto.subtle) {
        return crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)).then(function (buf) {
            return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
        });
    }
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return Promise.resolve(("00000000" + (h >>> 0).toString(16)).slice(-8) + str.length);
}
function pinEnabled() { return lsGet("pin_enabled", false); }
function verifyPin(pin, cb) {
    var stored = lsGet("pin_hash", null);
    if (!stored) { cb(false); return; }
    sha256hex(pin).then(function (h) { cb(h === stored); });
}
function setPin(pin, cb) {
    sha256hex(pin).then(function (h) {
        lsSet("pin_hash", h); lsSet("pin_enabled", true); cb(true);
    });
}
function disablePin() { lsDel("pin_hash"); lsSet("pin_enabled", false); }

/* =====================================================================
 *  Profile
 * ===================================================================== */

function getProfiles() { return lsGet("profiles", []); }
function saveProfiles(list) { lsSet("profiles", list); }
function ensureDefaultProfile() {
    var list = getProfiles();
    if (list.length === 0) {
        list = [{ id: "default", name: "Standard", color: "#FFC94D" }];
        saveProfiles(list);
    }
    var active = lsGet("active_profile", null);
    if (!active || !list.some(function (p) { return p.id === active; })) {
        active = list[0].id;
        lsSet("active_profile", active);
    }
    state.activeProfile = active;
    loadProfileState();
    return active;
}

/* =====================================================================
 *  Katalog-Präferenzen (Parität Android CategoryPrefs/ChannelPrefs)
 *  Pro Profil + Scope (live/movies/series) in localStorage.
 * ===================================================================== */

function catK(scope, key) { return profileScope("cat_" + scope + "_" + key); }
function chK(key) { return profileScope("chl_" + key); }

function makeCatPrefs(scope) {
    var cp = {};
    cp.order = function () { return lsGet(catK(scope, "order"), []); };
    cp.hidden = function () { return lsGet(catK(scope, "hidden"), []); };
    cp.renames = function () { return lsGet(catK(scope, "rename"), {}); };
    cp.isHidden = function (catId) { return cp.hidden().indexOf(catId) >= 0; };
    cp.labelOf = function (cat) {
        var r = cp.renames();
        return (r[cat.category_id] && r[cat.category_id].trim()) ? r[cat.category_id] : (cat.category_name || "Unbenannt");
    };
    cp.hasCustom = function (catId) { return !!(cp.renames()[catId] && cp.renames()[catId].trim()); };
    cp.applyTo = function (cats) {
        var list = (cats || []).filter(function (c) { return !cp.isHidden(c.category_id); });
        var ord = cp.order();
        if (!ord.length) return list;
        var inOrd = [];
        for (var i = 0; i < ord.length; i++) {
            for (var j = 0; j < list.length; j++) if (list[j].category_id === ord[i]) { inOrd.push(list[j]); break; }
        }
        var rest = list.filter(function (c) { return ord.indexOf(c.category_id) < 0; });
        return inOrd.concat(rest);
    };
    cp.currentOrder = function (cats) {
        var ids = (cats || []).map(function (c) { return c.category_id; });
        var saved = cp.order().filter(function (id) { return ids.indexOf(id) >= 0; });
        return saved.concat(ids.filter(function (id) { return saved.indexOf(id) < 0; }));
    };
    cp.saveOrder = function (ids) { lsSet(catK(scope, "order"), ids); };
    cp.listSorted = function (cats, asc) {
        var list = (cats || []).slice().sort(function (a, b) {
            return cp.labelOf(a).localeCompare(cp.labelOf(b), "de");
        });
        if (!asc) list.reverse();
        cp.saveOrder(list.map(function (c) { return c.category_id; }));
    };
    cp.moveUp = function (catId, cats) {
        var list = cp.currentOrder(cats).slice();
        var i = list.indexOf(catId);
        if (i > 0) { list.splice(i, 1); list.splice(i - 1, 0, catId); cp.saveOrder(list); }
    };
    cp.moveDown = function (catId, cats) {
        var list = cp.currentOrder(cats).slice();
        var i = list.indexOf(catId);
        if (i >= 0 && i < list.length - 1) { list.splice(i, 1); list.splice(i + 1, 0, catId); cp.saveOrder(list); }
    };
    cp.setLabel = function (catId, label) {
        var r = cp.renames();
        if (label && label.trim()) r[catId] = label.trim();
        else delete r[catId];
        lsSet(catK(scope, "rename"), r);
    };
    cp.hideMany = function (ids) {
        var h = cp.hidden();
        (ids || []).forEach(function (id) { if (h.indexOf(id) < 0) h.push(id); });
        lsSet(catK(scope, "hidden"), h);
    };
    cp.unhideAll = function () { lsSet(catK(scope, "hidden"), []); };
    cp.resetAll = function () {
        lsDel(catK(scope, "order"));
        lsDel(catK(scope, "hidden"));
        lsDel(catK(scope, "rename"));
    };
    return cp;
}

function makeChanPrefs() {
    var cp = {};
    cp.hidden = function () { return lsGet(chK("hidden"), []); };
    cp.isHidden = function (id) { return cp.hidden().indexOf(id) >= 0; };
    cp.locked = function () { return lsGet(chK("locked"), []); };
    cp.isLocked = function (id) { return cp.locked().indexOf(id) >= 0; };
    cp.sortMode = function () { return lsGet(chK("sort"), "num"); };
    cp.setSortMode = function (m) { lsSet(chK("sort"), m); lsDel(chK("order")); };
    cp.orderIds = function () { return lsGet(chK("order"), []); };
    cp.apply = function (channels) {
        var list = (channels || []).slice();
        if (cp.sortMode() === "name") list.sort(function (a, b) { return (a.name || "").localeCompare(b.name || "", "de"); });
        var order = cp.orderIds();
        if (order.length > 0) {
            var map = {};
            list.forEach(function (c) { map[c.stream_id] = c; });
            var inOrder = order.map(function (id) { return map[id]; }).filter(function (c) { return c; });
            var seen = {};
            inOrder.forEach(function (c) { seen[c.stream_id] = true; });
            var rest = list.filter(function (c) { return !seen[c.stream_id]; });
            list = inOrder.concat(rest);
        }
        return list;
    };
    cp.currentOrder = function (channels) {
        var ids = (channels || []).map(function (c) { return c.stream_id; });
        var saved = cp.orderIds().filter(function (id) { return ids.indexOf(id) >= 0; });
        return saved.concat(ids.filter(function (id) { return saved.indexOf(id) < 0; }));
    };
    cp.saveOrder = function (ids) { lsSet(chK("order"), ids); };
    cp.moveUp = function (chId, channels) {
        var list = cp.currentOrder(channels).slice();
        var i = list.indexOf(chId);
        if (i > 0) { list.splice(i, 1); list.splice(i - 1, 0, chId); cp.saveOrder(list); }
    };
    cp.moveDown = function (chId, channels) {
        var list = cp.currentOrder(channels).slice();
        var i = list.indexOf(chId);
        if (i >= 0 && i < list.length - 1) { list.splice(i, 1); list.splice(i + 1, 0, chId); cp.saveOrder(list); }
    };
    cp.hideMany = function (ids) {
        var h = cp.hidden();
        (ids || []).forEach(function (id) { if (h.indexOf(id) < 0) h.push(id); });
        lsSet(chK("hidden"), h);
    };
    cp.unhideAll = function () { lsSet(chK("hidden"), []); };
    cp.setLocked = function (chId, on) {
        var l = cp.locked();
        var i = l.indexOf(chId);
        if (on && i < 0) l.push(chId);
        if (!on && i >= 0) l.splice(i, 1);
        lsSet(chK("locked"), l);
    };
    cp.resetAll = function () {
        lsDel(chK("hidden"));
        lsDel(chK("locked"));
        lsDel(chK("order"));
        lsDel(chK("sort"));
    };
    return cp;
}

/* =====================================================================
 *  Menu-Overlay (Menu-Taste: Verwaltung — Parität Android Sort/Mark-Dialog)
 * ===================================================================== */

var menuState = { scope: null, cat: null, ch: null, mode: 0, marked: [] };

function menuRefresh() {
    if (menuState.scope === "live") {
        makeCatPrefs("live").applyTo(state.categories);
        renderLiveCategories();
        renderLiveChannels();
    } else if (menuState.scope === "movies") renderMovies();
    else if (menuState.scope === "series") renderSeries();
}

function menuButton(label, cls, onclick) {
    var b = document.createElement("button");
    b.className = "menu-btn" + (cls ? " " + cls : "");
    b.textContent = label;
    b.onclick = onclick;
    return b;
}

function openOverlay(title, bodyHtml) {
    document.getElementById("menu-title").textContent = title;
    var body = document.getElementById("menu-body");
    body.innerHTML = bodyHtml || "";
    document.getElementById("menu-overlay").classList.remove("hidden");
}

function closeMenu() {
    document.getElementById("menu-overlay").classList.add("hidden");
    menuState = { scope: null, cat: null, ch: null, mode: 0, marked: [] };
}

function openCatMenu(scope, cat, mode) {
    menuState.scope = scope;
    menuState.cat = cat;
    menuState.mode = mode || 0;
    renderCatMenuMode();
}

function renderCatMenuMode() {
    var scope = menuState.scope;
    var cat = menuState.cat;
    var prefs = makeCatPrefs(scope);
    var all = makeCatPrefs(scope).applyTo; // placeholder
    var cats = scope === "live" ? state.categories : (scope === "movies" ? state.vodCategories : state.seriesCategories);
    var body = document.getElementById("menu-body");
    body.innerHTML = "";

    if (menuState.mode === 0) {
        var r = function (c) {
            var row = document.createElement("div");
            row.className = "menu-row";
            var vis = prefs.applyTo(cats).filter(function (c2) { return c2.category_id === cat.category_id; });
            var first = vis.length === 0 || vis[0].category_id === cat.category_id;
            var last = vis.length > 0 && vis[vis.length - 1].category_id === cat.category_id;
            var up = menuButton("▲ Nach oben", first ? "disabled" : "", function () { prefs.moveUp(cat.category_id, cats); menuRefresh(); openCatMenu(scope, cat, 0); });
            var down = menuButton("▼ Nach unten", last ? "disabled" : "", function () { prefs.moveDown(cat.category_id, cats); menuRefresh(); openCatMenu(scope, cat, 0); });
            row.appendChild(up); row.appendChild(down);
            body.appendChild(row);
            var r2 = document.createElement("div");
            r2.className = "menu-row";
            r2.appendChild(menuButton("✏️ Umbenennen", "", function () {
                menuState.mode = 2;
                renderCatRenameInput(scope, cat, prefs);
            }));
            if (prefs.hasCustom(cat.category_id)) {
                r2.appendChild(menuButton("🔁 Originalname zurücksetzen", "", function () { prefs.setLabel(cat.category_id, ""); menuRefresh(); openCatMenu(scope, cat, 0); }));
            }
            r2.appendChild(menuButton("🎯 Mehrere markieren", "", function () { menuState.marked = [cat.category_id]; openCatMenu(scope, cat, 1); }));
            body.appendChild(r2);
            var r3 = document.createElement("div");
            r3.className = "menu-row";
            r3.appendChild(menuButton("🚫 " + prefs.isHidden(cat.category_id) ? "👁 Wieder einblenden" : "🚫 Ausblenden", prefs.isHidden(cat.category_id) ? "" : "danger", function () {
                if (prefs.isHidden(cat.category_id)) prefs.hideMany([]);
                // toggle: einblenden = aus hidden entfernen
                var h = prefs.hidden().filter(function (id) { return id !== cat.category_id; });
                lsSet(catK(scope, "hidden"), h);
                menuRefresh();
                openCatMenu(scope, cat, 0);
            }));
            r3.appendChild(menuButton("👁 Alle wieder einblenden", "", function () { prefs.unhideAll(); menuRefresh(); openCatMenu(scope, cat, 0); }));
            body.appendChild(r3);
            body.appendChild(menuButton("♻️ Alles zurücksetzen (Sortierung + Namen + Hidden)", "danger", function () {
                prefs.resetAll();
                menuRefresh();
                openCatMenu(scope, cat, 0);
            }));
        };
        r(prefs);
    } else if (menuState.mode === 1) {
        // MARKIERUNG: Buttons OBEN/KLEIN, Liste DARUNTER, MARKIERT = BEHALTEN
        var top = document.createElement("div");
        top.className = "menu-topbtns";
        var marked = menuState.marked;
        var visibleList = prefs.applyTo(cats);
        top.appendChild(menuButton("✅ Alle markieren", "mini", function () {
            menuState.marked = visibleList.map(function (c) { return c.category_id; });
            renderCatMenuMode();
        }));
        top.appendChild(menuButton("⬜ Aufheben", "mini", function () { menuState.marked = []; renderCatMenuMode(); }));
        top.appendChild(menuButton("▲ Block oben", "mini", function () {
            var ids = [];
            var cur = prefs.currentOrder(cats).slice();
            cur.forEach(function (id) { if (marked.indexOf(id) >= 0) ids.push(id); });
            if (ids.length > 0) {
                var moved = cur.filter(function (id) { return ids.indexOf(id) < 0; });
                prefs.saveOrder(ids.concat(moved));
                menuRefresh(); renderCatMenuMode();
            }
        }));
        top.appendChild(menuButton("▼ Block unten", "mini", function () {
            var ids = [];
            var cur = prefs.currentOrder(cats).slice();
            cur.forEach(function (id) { if (marked.indexOf(id) >= 0) ids.push(id); });
            if (ids.length > 0) {
                var moved = cur.filter(function (id) { return ids.indexOf(id) < 0; });
                prefs.saveOrder(moved.concat(ids));
                menuRefresh(); renderCatMenuMode();
            }
        }));
        top.appendChild(menuButton("🚫 Nur markierte behalten", "mini danger", function () {
            prefs.unhideAll();
            prefs.hideMany(cur2 = prefs.currentOrder(cats).filter(function (id) { return menuState.marked.indexOf(id) < 0; }));
            menuRefresh(); renderCatMenuMode();
        }));
        top.appendChild(menuButton("🚫 Markierte ausblenden", "mini danger", function () {
            prefs.hideMany(menuState.marked);
            menuState.marked = [];
            menuRefresh(); renderCatMenuMode();
        }));
        top.appendChild(menuButton("✓ Fertig", "mini gold", function () { closeMenu(); }));
        body.appendChild(top);

        var counter = document.createElement("div");
        counter.className = "menu-counter";
        counter.textContent = menuState.marked.length + " von " + visibleList.length + " markiert  (MARKIERT = BEHALTEN)";
        body.appendChild(counter);

        var list = document.createElement("div");
        list.className = "menu-list";
        visibleList.forEach(function (c) {
            var row = document.createElement("div");
            row.className = "menu-item" + (menuState.marked.indexOf(c.category_id) >= 0 ? " marked" : "");
            row.textContent = (menuState.marked.indexOf(c.category_id) >= 0 ? "☑ " : "☐ ") + prefs.labelOf(c);
            row.onclick = function () {
                var i = menuState.marked.indexOf(c.category_id);
                if (i >= 0) menuState.marked.splice(i, 1); else menuState.marked.push(c.category_id);
                renderCatMenuMode();
            };
            list.appendChild(row);
        });
        body.appendChild(list);
    }
}

function renderCatRenameInput(scope, cat, prefs) {
    menuState.mode = 2;
    var body = document.getElementById("menu-body");
    body.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "menu-rename";
    var inp = document.createElement("input");
    inp.type = "text";
    inp.value = cat.category_name || "";
    inp.className = "menu-input";
    inp.placeholder = "Neuer Name…";
    wrap.appendChild(inp);
    var row = document.createElement("div");
    row.className = "menu-row";
    row.appendChild(menuButton("💾 Speichern", "gold", function () {
        prefs.setLabel(cat.category_id, inp.value);
        menuRefresh();
        openCatMenu(scope, cat, 0);
    }));
    row.appendChild(menuButton("✖ Abbrechen", "", function () { openCatMenu(scope, cat, 0); }));
    wrap.appendChild(row);
    body.appendChild(wrap);
    try { inp.focus(); } catch (e) {}
}

function openChanMenu(ch) {
    menuState.scope = "live";
    menuState.ch = ch;
    menuState.cat = null;
    var prefs = makeChanPrefs();
    var body = document.getElementById("menu-body");
    body.innerHTML = "";
    var pinOk = pinEnabled();
    if (!pinOk) {
        var note = document.createElement("div");
        note.className = "menu-note";
        note.textContent = "Hinweis: FSK-Sperre braucht eine PIN — zuerst in den Einstellungen PIN festlegen.";
        body.appendChild(note);
    }
    var r1 = document.createElement("div");
    r1.className = "menu-row";
    r1.appendChild(menuButton(prefs.isLocked(ch.stream_id) ? "🔓 FSK-Sperre aus" : "🔒 FSK-18 Sperre an", prefs.isLocked(ch.stream_id) ? "" : (pinOk ? "" : "disabled"), function () {
        prefs.setLocked(ch.stream_id, !prefs.isLocked(ch.stream_id));
        menuRefresh();
        openChanMenu(ch);
    }));
    body.appendChild(r1);
    var all = state.channels;
    var visible = prefs.apply(all).filter(function (c) { return !prefs.isHidden(c.stream_id); });
    var idx = -1;
    visible.forEach(function (c, i) { if (c.stream_id === ch.stream_id) idx = i; });
    var r2 = document.createElement("div");
    r2.className = "menu-row";
    r2.appendChild(menuButton("▲ Nach oben", idx <= 0 ? "disabled" : "", function () { prefs.moveUp(ch.stream_id, all); menuRefresh(); openChanMenu(ch); }));
    r2.appendChild(menuButton("▼ Nach unten", idx < 0 || idx >= visible.length - 1 ? "disabled" : "", function () { prefs.moveDown(ch.stream_id, all); menuRefresh(); openChanMenu(ch); }));
    body.appendChild(r2);
    var r3 = document.createElement("div");
    r3.className = "menu-row";
    r3.appendChild(menuButton("🚫 Kanal ausblenden", "danger", function () {
        prefs.hideMany([ch.stream_id]);
        menuRefresh();
        closeMenu();
    }));
    r3.appendChild(menuButton("👁 Alle Kanäle wieder einblenden", "", function () { prefs.unhideAll(); menuRefresh(); openChanMenu(ch); }));
    body.appendChild(r3);
    body.appendChild(menuButton("♻️ Alles zurücksetzen (Kanal-Einstellungen)", "danger", function () {
        prefs.resetAll();
        menuRefresh();
        openChanMenu(ch);
    }));
    var note2 = document.createElement("div");
    note2.className = "menu-note";
    note2.textContent = "Menu-Taste auf Kanal oder Kategorie = Verwaltung • Back schließt";
    body.appendChild(note2);
}

function pickCats(scope, cats) {
    menuState.scope = scope;
    var prefs = makeCatPrefs(scope);
    var body = document.getElementById("menu-body");
    openOverlayRaw("Kategorie wählen", scope);
    body.innerHTML = "";
    var note = document.createElement("div");
    note.className = "menu-note";
    note.textContent = "Menu-Taste auf einer Kategorie = direkt verwalten";
    body.appendChild(note);
    var list = document.createElement("div");
    list.className = "menu-list";
    prefs.applyTo(cats).forEach(function (c) {
        var row = document.createElement("div");
        row.className = "menu-item";
        row.setAttribute("data-cat-id", c.category_id);
        row.textContent = prefs.labelOf(c);
        row.onclick = function () { openCatMenu(scope, c, 0); };
        list.appendChild(row);
    });
    body.appendChild(list);
}

function openOverlayRaw(title, scope) {
    document.getElementById("menu-title").textContent = title;
    document.getElementById("menu-overlay").classList.remove("hidden");
}

function onMenuKey() {
    var overlay = document.getElementById("menu-overlay");
    if (overlay && !overlay.classList.contains("hidden")) { closeMenu(); return true; }
    if (state.currentView !== "view-home") return false;
    var tab = null;
    var tabEls = document.querySelectorAll(".tab");
    for (var i = 0; i < tabEls.length; i++) {
        if (tabEls[i].classList.contains("active")) { tab = tabEls[i].getAttribute("data-tab"); break; }
    }
    var scope = tab === "movies" ? "movies" : tab === "series" ? "series" : "live";
    if (scope === "live") {
        var chId = document.activeElement ? document.activeElement.getAttribute("data-ch-id") : null;
        if (chId) {
            for (var j = 0; j < state.channels.length; j++) {
                if (String(state.channels[j].stream_id) === chId) { openChanMenu(state.channels[j]); return true; }
            }
        }
        var catId = document.activeElement ? document.activeElement.getAttribute("data-cat-id") : null;
        if (catId) {
            for (var k = 0; k < state.categories.length; k++) {
                if (String(state.categories[k].category_id) === catId) { openCatMenu("live", state.categories[k], 0); return true; }
            }
        }
        pickCats("live", state.categories);
    } else {
        var cats = scope === "movies" ? state.vodCategories : state.seriesCategories;
        var vcatId = document.activeElement ? document.activeElement.getAttribute("data-cat-id") : null;
        if (vcatId) {
            for (var m = 0; m < cats.length; m++) {
                if (String(cats[m].category_id) === vcatId) { openCatMenu(scope, cats[m], 0); return true; }
            }
        }
        pickCats(scope, cats);
    }
    return true;
}

/* =====================================================================
 *  Flow: Start -> PIN -> Profil -> Pairing/Home
 * ===================================================================== */

function startFlow() {
    ensureIdentity();
    ensureDefaultProfile();

    if (pinEnabled()) {
        show("view-pin");
        renderPinGate();
    } else if (getProfiles().length > 1) {
        show("view-profiles");
        renderProfiles();
    } else {
        afterUnlock();
    }
}

function renderPairQr() {
    /* QR nach Android-Vorbild: https://panel.smartys.tech/pair?mac=<ID>&pw=<PW>
       (Smartphone öffnet den Link → Player im Panel koppeln) */
    var box = document.getElementById("pair-qr");
    if (!box || typeof qrcode !== "function") return;
    var url = PANEL + "/pair?mac=" + encodeURIComponent(state.playerId) +
              "&pw=" + encodeURIComponent(state.pairingPw);
    var qr = null, v;
    for (v = 1; v <= 40; v++) {
        try {
            var q = qrcode(v, "M"); /* ECC M */
            q.addData(url);
            q.make();
            qr = q;
            break;
        } catch (e) { /* Version zu klein → nächste */ }
    }
    if (!qr) { box.innerHTML = ""; return; }

    /* Primärweg: reine HTML-Tabelle (100 % WebKit-kompatibel — kein
       inline-SVG/innerHTML, das ältere webOS-Kerne verschlucken).
       Fallback: Inline-SVG mit festen px-Attributen. */
    var ok = false;
    try {
        var n = qr.getModuleCount(), cell = 6, r, c, tr, td;
        var tbl = document.createElement("table");
        tbl.style.borderCollapse = "collapse";
        tbl.style.margin = "0";
        tbl.style.padding = "0";
        for (r = 0; r < n; r++) {
            tr = document.createElement("tr");
            for (c = 0; c < n; c++) {
                td = document.createElement("td");
                td.style.width = cell + "px";
                td.style.height = cell + "px";
                td.style.border = "none";
                td.style.background = qr.isDark(r, c) ? "#0B0E14" : "#FFFFFF";
                tr.appendChild(td);
            }
            tbl.appendChild(tr);
        }
        box.innerHTML = "";
        box.appendChild(tbl);
        ok = true;
    } catch (e) { /* → SVG-Fallback */ }

    if (!ok) {
        try {
            box.innerHTML = qr.createSvgTag(6, 1, null, null);
        } catch (e2) { box.innerHTML = ""; }
    }
}

function afterUnlock() {
    var hasProviders = lsGet("providers_json", null);
    if (hasProviders) {
        state.providers = hasProviders;
        state.token = lsGet("token", null);
        loadAll();
    } else {
        document.getElementById("player-id").textContent = state.playerId;
        document.getElementById("pairing-pw").textContent = state.pairingPw;
        renderPairQr();
        show("view-pairing");
    }
}

/* =====================================================================
 *  PIN-Gate UI
 * ===================================================================== */

function renderPinGate() {
    var pad = document.getElementById("pin-pad");
    pad.innerHTML = "";
    var keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"];
    var input = "";
    var err = document.getElementById("pin-err");

    function drawDots() {
        var d = document.getElementById("pin-dots");
        d.innerHTML = "";
        for (var i = 0; i < 6; i++) {
            var dot = document.createElement("span");
            dot.className = "dot" + (i < input.length ? " filled" : "");
            d.appendChild(dot);
        }
    }
    function submit(pin) {
        verifyPin(pin, function (ok) {
            if (ok) { afterUnlock(); }
            else { input = ""; drawDots(); err.classList.remove("hidden"); }
        });
    }
    keys.forEach(function (key) {
        var b = document.createElement("button");
        b.className = "pin-key";
        b.textContent = key;
        b.onclick = function () {
            err.classList.add("hidden");
            if (key === "C") { input = ""; }
            else if (key === "⌫") { input = input.slice(0, -1); }
            else if (input.length < 6) { input += key; if (input.length === 6) submit(input); }
            drawDots();
        };
        pad.appendChild(b);
    });
    drawDots();
}

/* =====================================================================
 *  Profil-UI
 * ===================================================================== */

function renderProfiles() {
    var grid = document.getElementById("profile-grid");
    grid.innerHTML = "";
    var profiles = getProfiles();
    profiles.forEach(function (p) {
        var d = document.createElement("div");
        d.className = "profile-card";
        d.innerHTML = '<div class="profile-avatar" style="background:' + p.color + '">' +
            esc(p.name.charAt(0).toUpperCase()) + '</div><div class="profile-name">' + esc(p.name) + '</div>';
        d.onclick = function () {
            lsSet("active_profile", p.id);
            state.activeProfile = p.id;
            loadProfileState();
            afterUnlock();
        };
        grid.appendChild(d);
    });
    var add = document.createElement("div");
    add.className = "profile-card";
    add.innerHTML = '<div class="profile-avatar add">＋</div><div class="profile-name">Neues Profil</div>';
    add.onclick = function () {
        var name = prompt("Profilname:");
        if (name && name.trim()) {
            var list = getProfiles();
            var colors = ["#FFC94D", "#6FCF9F", "#6FB1FF", "#FF9B9B", "#B48CFF", "#4FD1C5"];
            list.push({ id: "p" + Date.now(), name: name.trim(), color: colors[list.length % colors.length] });
            saveProfiles(list);
            renderProfiles();
        }
    };
    grid.appendChild(add);
}

/* =====================================================================
 *  Pairing-Flow
 * ===================================================================== */

function doPair() {
    setPairMsg("Verbinde mit panel.smartys.tech…");
    show("view-loading");
    pair()
        .then(fetchProviders)
        .then(function () {
            lsSet("providers_json", state.providers);
            lsSet("token", state.token);
            return loadAll();
        })
        .then(function () { show("view-home"); })
        .catch(function (e) {
            if (e.message === "SEC") { showUnlock(); return; }
            show("view-pairing");
            document.getElementById("player-id").textContent = state.playerId;
            document.getElementById("pairing-pw").textContent = state.pairingPw;
            if (e.message === "EMPTY") setPairMsg("Noch keine Playlist hinterlegt. Auf der Website einrichten, dann erneut prüfen.", "error");
            else setPairMsg("Keine Verbindung: " + e.message, "error");
        });
}

/* =====================================================================
 *  Content laden
 * ===================================================================== */

function loadAll() {
    show("view-loading");
    document.querySelector("#view-loading .msg").textContent = "Lade Kanäle…";
    var p = primaryProvider();
    return xtream(p, "get_live_categories")
        .then(function (cats) {
            state.categories = cats || [];
            var catNames = {};
            state.categories.forEach(function (c) { catNames[c.category_id] = c.category_name; });
            return xtream(p, "get_live_streams").then(function (streams) {
                var all = (streams || []).filter(function (s) { return s.name.indexOf("####") < 0; });
                all.forEach(function (s) { s.categoryName = catNames[s.category_id] || ""; });
                all.sort(function (a, b) { return (a.num || 0) - (b.num || 0); });
                state.channels = all;
            });
        })
        .then(function () { return loadVod(); })
        .then(function () { return loadSeries(); })
        .then(function () { return loadXmltv(); })
        .then(function () {
            renderLiveCategories();
            renderLiveChannels();
            renderMovies();
            renderSeries();
            loadProfileState();
            show("view-home");
        })
        .catch(function (e) {
            show("view-pairing");
            setPairMsg("Laden fehlgeschlagen: " + e.message, "error");
        });
}

function loadVod() {
    var p = primaryProvider();
    return xtream(p, "get_vod_categories").then(function (cats) {
        state.vodCategories = cats || [];
        var catNames = {};
        state.vodCategories.forEach(function (c) { catNames[c.category_id] = c.category_name; });
        return xtream(p, "get_vod_streams").then(function (movies) {
            (movies || []).forEach(function (m) { m.categoryName = catNames[m.category_id] || ""; });
            state.vodMovies = movies || [];
        });
    });
}
function loadSeries() {
    var p = primaryProvider();
    return xtream(p, "get_series_categories").then(function (cats) {
        state.seriesCategories = cats || [];
        var catNames = {};
        state.seriesCategories.forEach(function (c) { catNames[c.category_id] = c.category_name; });
        return xtream(p, "get_series").then(function (shows) {
            (shows || []).forEach(function (s) { s.categoryName = catNames[s.category_id] || ""; });
            state.seriesShows = shows || [];
        });
    });
}

/* =====================================================================
 *  XMLTV EPG (Provider-xmltv.php)
 * ===================================================================== */

function loadXmltv() {
    var p = primaryProvider();
    var url = (p.server_url || "").replace(/\/+$/, "") + "/xmltv.php?username=" + encodeURIComponent(p.username) + "&password=" + encodeURIComponent(p.password);
    return http("GET", url, { timeout: 30000 }).then(function (xhr) {
        if (xhr.status !== 200) throw new Error("HTTP " + xhr.status);
        state.xmltv = parseXmltv(xhr.responseText);
    }).catch(function () {
        state.xmltv = { byId: {}, byName: {}, ready: false };
    });
}

function parseXmltv(xml) {
    var byId = {}, byName = {};
    var doc = (typeof DOMParser !== "undefined") ? new DOMParser().parseFromString(xml, "text/xml") : null;
    if (!doc || doc.getElementsByTagName("parsererror").length) {
        var progRe = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/g, m;
        while ((m = progRe.exec(xml)) !== null) {
            var attrs = m[1];
            var channel = (attrs.match(/channel="([^"]*)"/) || [])[1];
            var start = parseXmltvTime((attrs.match(/start="([^"]*)"/) || [])[1]);
            var stop = parseXmltvTime((attrs.match(/stop="([^"]*)"/) || [])[1]);
            var title = (m[2].match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || "";
            if (channel && start > 0) {
                (byId[channel] = byId[channel] || []).push({ start: start, stop: stop, title: htmlDecode(title.trim()) });
            }
        }
    } else {
        var progs = doc.getElementsByTagName("programme");
        for (var i = 0; i < progs.length; i++) {
            var el = progs[i];
            var channel = el.getAttribute("channel");
            var start = parseXmltvTime(el.getAttribute("start"));
            var stop = parseXmltvTime(el.getAttribute("stop"));
            var t = el.getElementsByTagName("title")[0];
            var title = t ? t.textContent : "";
            if (channel && start > 0) {
                (byId[channel] = byId[channel] || []).push({ start: start, stop: stop, title: title.trim() });
            }
        }
        var chans = doc.getElementsByTagName("channel");
        for (var j = 0; j < chans.length; j++) {
            var id = chans[j].getAttribute("id");
            var dn = chans[j].getElementsByTagName("display-name")[0];
            if (id && dn) byName[normName(dn.textContent)] = id;
        }
    }
    Object.keys(byId).forEach(function (k) { byId[k].sort(function (a, b) { return a.start - b.start; }); });
    return { byId: byId, byName: byName, ready: true };
}

function parseXmltvTime(s) {
    if (!s) return 0;
    var core = s.substring(0, 14);
    var tz = 0;
    if (s.indexOf("+") > 8) {
        var o = s.substring(s.lastIndexOf("+") + 1, s.lastIndexOf("+") + 5);
        tz = (parseInt(o.substring(0, 2)) * 3600 + parseInt(o.substring(2, 4)) * 60) * 1000;
    } else if (s.indexOf("-", 8) > 8) {
        var o2 = s.substring(s.lastIndexOf("-") + 1, s.lastIndexOf("-") + 5);
        tz = -(parseInt(o2.substring(0, 2)) * 3600 + parseInt(o2.substring(2, 4)) * 60) * 1000;
    }
    var y = +core.substring(0, 4), mo = +core.substring(4, 6) - 1, d = +core.substring(6, 8);
    var h = +core.substring(8, 10), mi = +core.substring(10, 12), se = +core.substring(12, 14);
    return Date.UTC(y, mo, d, h, mi, se) - tz;
}

function normName(n) {
    return (n || "").toLowerCase()
        .replace(/de\s*-\s*/g, "").replace(/de:/g, "").replace(/de-/g, "")
        .replace(/uhd/g, "").replace(/fhd/g, "").replace(/hd/g, "").replace(/4k/g, "")
        .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss")
        .replace(/\./g, "").replace(/:/g, "").replace(/\+/g, "").replace(/&/g, "")
        .replace(/\(/g, "").replace(/\)/g, "").replace(/!/g, "").replace(/ /g, "").trim();
}

function nowNext(ch) {
    var progs = state.xmltv ? state.xmltv.byId[ch.epg_channel_id] : null;
    if (!progs || progs.length === 0) {
        if (state.xmltv && !ch.epg_channel_id) {
            var id = state.xmltv.byName[normName(ch.name)];
            if (id) progs = state.xmltv.byId[id];
        }
    }
    if (!progs || progs.length === 0) return null;
    var now = Date.now();
    var cur = null;
    for (var i = 0; i < progs.length; i++) {
        if (progs[i].start <= now) cur = progs[i]; else break;
    }
    if (cur && cur.stop && cur.stop <= now) cur = null;
    var next = null;
    if (cur) {
        for (var j = 0; j < progs.length; j++) if (progs[j].start >= (cur.stop || cur.start)) { next = progs[j]; break; }
    } else {
        for (var k = 0; k < progs.length; k++) if (progs[k].start > now) { next = progs[k]; break; }
    }
    return { now: cur, next: next };
}

/* =====================================================================
 *  Live-TV Rendering
 * ===================================================================== */

function renderLiveCategories() {
    var el = document.getElementById("live-categories");
    el.innerHTML = "";
    var prefs = makeCatPrefs("live");
    var all = document.createElement("div");
    all.className = "cat" + (state.selectedLiveCat === null ? " active" : "");
    all.textContent = "Alle Kanäle";
    all.ondblclick = function () { pickCats("live", state.categories); };
    all.onclick = function () { state.selectedLiveCat = null; renderLiveCategories(); renderLiveChannels(); };
    el.appendChild(all);
    prefs.applyTo(state.categories).forEach(function (c) {
        var d = document.createElement("div");
        d.className = "cat" + (state.selectedLiveCat === c.category_id ? " active" : "");
        d.setAttribute("data-cat-id", c.category_id);
        d.textContent = prefs.labelOf(c);
        d.onclick = function () { state.selectedLiveCat = c.category_id; renderLiveCategories(); renderLiveChannels(); };
        d.ondblclick = function (ev) { ev.stopPropagation(); openCatMenu("live", c, 0); };
        el.appendChild(d);
    });
}

function renderLiveChannels() {
    var el = document.getElementById("live-channels");
    el.innerHTML = "";
    var prefs = makeChanPrefs();
    var catPrefs = makeCatPrefs("live");
    var visibleCatIds = catPrefs.applyTo(state.categories).map(function (c) { return c.category_id; });
    var shown = prefs.apply(state.channels);
    shown = shown.filter(function (c) { return !prefs.isHidden(c.stream_id); });
    if (state.selectedLiveCat !== null) shown = shown.filter(function (c) { return c.category_id === state.selectedLiveCat; });
    else shown = shown.filter(function (c) { return visibleCatIds.indexOf(c.category_id) >= 0; });
    shown.forEach(function (c) {
        var d = document.createElement("div");
        d.className = "ch";
        d.setAttribute("data-ch-id", c.stream_id);
        var nn = nowNext(c);
        var fav = state.favorites[c.stream_id] ? " ★" : "";
        var lock = prefs.isLocked(c.stream_id) ? " 🔒" : "";
        var num = c.num ? c.num + "  " : "";
        d.innerHTML = '<div class="ch-name">' + esc(num + c.name) + fav + lock + '</div>' +
            '<div class="ch-epg">' + (nn && nn.now ? epgLine(nn.now, nn.next) : "Keine EPG-Daten") + '</div>';
        d.onclick = function () { playLive(c); };
        d.ondblclick = function (ev) { ev.stopPropagation(); openChanMenu(c); };
        el.appendChild(d);
    });
}

function epgLine(now, next) {
    var s = "";
    if (now) s += '<span class="epg-now">' + hhmm(now.start) + " " + esc(now.title) + '</span>';
    if (next) s += ' <span class="epg-next">' + hhmm(next.start) + " " + esc(next.title) + '</span>';
    return s || "Keine EPG-Daten";
}

function hhmm(epoch) {
    var d = new Date(epoch);
    return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
}

/* =====================================================================
 *  VOD Rendering
 * ===================================================================== */

function renderMovies() {
    var cats = document.getElementById("movies-categories");
    cats.innerHTML = "";
    var all = document.createElement("div");
    all.className = "cat" + (state.selectedMovieCat === null ? " active" : "");
    all.textContent = "Alle Filme";
    all.onclick = function () { state.selectedMovieCat = null; renderMovies(); };
    cats.appendChild(all);
    var mprefs = makeCatPrefs("movies");
    mprefs.applyTo(state.vodCategories).forEach(function (c) {
        var d = document.createElement("div");
        d.className = "cat" + (state.selectedMovieCat === c.category_id ? " active" : "");
        d.setAttribute("data-mcat-id", c.category_id);
        d.textContent = mprefs.labelOf(c);
        d.onclick = function () { state.selectedMovieCat = c.category_id; renderMovies(); };
        d.ondblclick = function (ev) { ev.stopPropagation(); openCatMenu("movies", c, 0); };
        cats.appendChild(d);
    });

    var q = (document.getElementById("movies-search").value || "").toLowerCase();
    var visibleCatIds = mprefs.applyTo(state.vodCategories).map(function (c) { return c.category_id; });
    var shown = state.vodMovies;
    if (state.selectedMovieCat !== null) shown = shown.filter(function (m) { return m.category_id === state.selectedMovieCat; });
    else shown = shown.filter(function (m) { return visibleCatIds.indexOf(m.category_id) >= 0; });
    if (q) shown = shown.filter(function (m) { return (m.name || "").toLowerCase().indexOf(q) >= 0; });

    document.getElementById("movies-count").textContent = shown.length + " Filme";
    var grid = document.getElementById("movies-grid");
    grid.innerHTML = "";
    shown.forEach(function (m) {
        var d = document.createElement("div");
        d.className = "grid-item";
        var poster = m.stream_icon || m.direct_source || "";
        var rating = m.rating_5based && +m.rating_5based > 0 ? '★ ' + (+m.rating_5based).toFixed(1) : "";
        d.innerHTML = '<div class="poster">' + (poster ? '<img src="' + esc(poster) + '" onerror="this.style.display=\'none\'">' : '<div class="poster-empty">🎬</div>') +
            (rating ? '<span class="rating">' + rating + '</span>' : '') + '</div>' +
            '<div class="grid-title">' + esc(m.name) + '</div>';
        d.onclick = function () { openMovieDetail(m); };
        grid.appendChild(d);
    });
}

function renderSeries() {
    var cats = document.getElementById("series-categories");
    cats.innerHTML = "";
    var all = document.createElement("div");
    all.className = "cat" + (state.selectedSeriesCat === null ? " active" : "");
    all.textContent = "Alle Serien";
    all.onclick = function () { state.selectedSeriesCat = null; renderSeries(); };
    cats.appendChild(all);
    var sprefs = makeCatPrefs("series");
    sprefs.applyTo(state.seriesCategories).forEach(function (c) {
        var d = document.createElement("div");
        d.className = "cat" + (state.selectedSeriesCat === c.category_id ? " active" : "");
        d.setAttribute("data-scat-id", c.category_id);
        d.textContent = sprefs.labelOf(c);
        d.onclick = function () { state.selectedSeriesCat = c.category_id; renderSeries(); };
        d.ondblclick = function (ev) { ev.stopPropagation(); openCatMenu("series", c, 0); };
        cats.appendChild(d);
    });

    var q = (document.getElementById("series-search").value || "").toLowerCase();
    var visibleCatIds = sprefs.applyTo(state.seriesCategories).map(function (c) { return c.category_id; });
    var shown = state.seriesShows;
    if (state.selectedSeriesCat !== null) shown = shown.filter(function (s) { return s.category_id === state.selectedSeriesCat; });
    else shown = shown.filter(function (s) { return visibleCatIds.indexOf(s.category_id) >= 0; });
    if (q) shown = shown.filter(function (s) { return (s.name || "").toLowerCase().indexOf(q) >= 0; });

    document.getElementById("series-count").textContent = shown.length + " Serien";
    var grid = document.getElementById("series-grid");
    grid.innerHTML = "";
    shown.forEach(function (s) {
        var d = document.createElement("div");
        d.className = "grid-item";
        d.innerHTML = '<div class="poster">' + (s.cover ? '<img src="' + esc(s.cover) + '" onerror="this.style.display=\'none\'">' : '<div class="poster-empty">📺</div>') + '</div>' +
            '<div class="grid-title">' + esc(s.name) + '</div>';
        d.onclick = function () { openSeriesDetail(s); };
        grid.appendChild(d);
    });
}

/* =====================================================================
 *  Detailseiten
 * ===================================================================== */

function movieYear(m) {
    var mm = (m.name || "").match(/\((\d{4})\)/);
    return mm ? mm[1] : "";
}

function openMovieDetail(m) {
    show("view-movie-detail");
    var el = document.getElementById("movie-detail");
    var resumePos = state.resume["movie:" + m.stream_id] || 0;
    var canResume = resumePos > 30000;
    var rating = m.rating_5based && +m.rating_5based > 0 ? '★ ' + (+m.rating_5based).toFixed(1) : "";
    el.innerHTML = '<div class="detail-layout">' +
        '<div class="detail-poster">' + (m.stream_icon ? '<img src="' + esc(m.stream_icon) + '">' : '<div class="poster-empty">🎬</div>') + '</div>' +
        '<div class="detail-info">' +
        '<button class="btn-ghost" id="md-back">← Zurück</button>' +
        '<div class="detail-title">' + esc(m.name) + '</div>' +
        '<div class="detail-meta">' + [movieYear(m), m.categoryName, rating].filter(Boolean).join(' · ') + '</div>' +
        '<div class="detail-actions">' +
        '<button class="btn-primary" id="md-play">' + (canResume ? '▶ Fortsetzen' : '▶ Abspielen') + '</button>' +
        (canResume ? '<button class="btn-ghost" id="md-restart">↺ Von vorne</button>' : '') +
        (m.trailer ? '<button class="btn-ghost" id="md-trailer">▶ Trailer</button>' : '') +
        '<button class="btn-ghost" id="md-fav">' + (state.favorites["movie:" + m.stream_id] ? '★ Favorit' : '☆ Favorit') + '</button>' +
        '</div>' +
        '<div class="detail-desc" id="md-desc">Beschreibung wird geladen…</div>' +
        '</div></div>';

    document.getElementById("md-back").onclick = function () { show("view-home"); activateTab("movies"); };
    document.getElementById("md-play").onclick = function () {
        playVod(movieUrl(m.stream_id, m.container_extension || "mp4"), m.name, "vod:movie:" + m.stream_id, canResume ? resumePos : 0);
    };
    if (canResume) document.getElementById("md-restart").onclick = function () {
        delete state.resume["movie:" + m.stream_id]; lsSet(profileScope("resume"), state.resume);
        playVod(movieUrl(m.stream_id, m.container_extension || "mp4"), m.name, "vod:movie:" + m.stream_id, 0);
    };
    if (m.trailer) document.getElementById("md-trailer").onclick = function () {
        window.open("https://www.youtube.com/watch?v=" + m.trailer, "_blank");
    };
    document.getElementById("md-fav").onclick = function () {
        var k = "movie:" + m.stream_id;
        state.favorites[k] = !state.favorites[k];
        lsSet(profileScope("fav"), state.favorites);
        openMovieDetail(m);
    };

    if (m.tmdb) {
        fetchTmdbMovie(m.tmdb).then(function (meta) {
            if (meta && meta.overview) {
                var chips = [];
                if (meta.runtime) chips.push(meta.runtime + " Min");
                (meta.genres || []).slice(0, 3).forEach(function (g) { chips.push(g); });
                document.getElementById("md-desc").innerHTML =
                    (meta.tagline ? '<div class="tagline">' + esc(meta.tagline) + '</div>' : '') +
                    (chips.length ? '<div class="chips">' + chips.map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join("") + '</div>' : '') +
                    '<p>' + esc(meta.overview) + '</p>';
            } else {
                document.getElementById("md-desc").textContent = "Keine Beschreibung zu diesem Titel gefunden.";
            }
        });
    } else {
        document.getElementById("md-desc").textContent = "Dieser Anbieter liefert keine Inhaltsbeschreibung für diesen Titel.";
    }
}

function openSeriesDetail(show) {
    show("view-series-detail");
    var el = document.getElementById("series-detail");
    el.innerHTML = '<div class="detail-layout">' +
        '<div class="detail-poster">' + (show.cover ? '<img src="' + esc(show.cover) + '">' : '<div class="poster-empty">📺</div>') + '</div>' +
        '<div class="detail-info">' +
        '<button class="btn-ghost" id="sd-back">← Zurück</button>' +
        '<div class="detail-title">' + esc(show.name) + '</div>' +
        (show.genre ? '<div class="detail-meta">' + esc(show.genre) + '</div>' : '') +
        (show.plot ? '<div class="detail-desc"><p>' + esc(show.plot) + '</p></div>' : '') +
        '<div id="sd-seasons" class="seasons"></div>' +
        '</div></div>';

    document.getElementById("sd-back").onclick = function () { show("view-home"); activateTab("series"); };

    var p = primaryProvider();
    xtream(p, "get_series_info", { series_id: show.series_id }).then(function (info) {
        var episodes = (info && info.episodes) || {};
        var seasonKeys = Object.keys(episodes).sort(function (a, b) { return (parseInt(a) || 0) - (parseInt(b) || 0); });
        var box = document.getElementById("sd-seasons");
        box.innerHTML = "";
        seasonKeys.forEach(function (sk) {
            var season = document.createElement("div");
            season.className = "season";
            var eps = (episodes[sk] || []).sort(function (a, b) { return (parseInt(a.episode_num) || 999) - (parseInt(b.episode_num) || 999); });
            season.innerHTML = '<div class="season-title">Staffel ' + sk + '</div>';
            eps.forEach(function (ep) {
                var row = document.createElement("div");
                row.className = "episode";
                row.innerHTML = '<span class="ep-num">S' + sk + 'E' + (ep.episode_num || "-") + '</span>' +
                    '<span class="ep-title">' + esc(ep.title || ("Episode " + ep.episode_num)) + '</span><span class="ep-play">▶</span>';
                row.onclick = function () {
                    var ext = ep.container_extension || "mp4";
                    playVod(seriesUrl(ep.id, ext), (show.name + " S" + sk + "E" + ep.episode_num), "vod:series:" + ep.id, 0);
                };
                season.appendChild(row);
            });
            box.appendChild(season);
        });
    }).catch(function () {
        document.getElementById("sd-seasons").innerHTML = '<div class="msg error">Episoden konnten nicht geladen werden.</div>';
    });
}

/* =====================================================================
 *  EPG-Grid
 * ===================================================================== */

function renderEpg() {
    var el = document.getElementById("epg-grid");
    var now = Date.now();
    var dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    var dayEnd = dayStart.getTime() + 24 * 3600 * 1000;
    document.getElementById("epg-date").textContent = new Date(now).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" });

    if (!state.xmltv || !state.xmltv.ready) {
        el.innerHTML = '<div class="epg-empty">EPG-Daten werden geladen…</div>';
        return;
    }

    var PX_PER_HOUR = 120;
    var html = '<div class="epg-timebar" style="width:' + (24 * PX_PER_HOUR) + 'px">';
    for (var h = 0; h < 24; h++) html += '<span style="width:' + PX_PER_HOUR + 'px">' + ("0" + h).slice(-2) + ':00</span>';
    html += '</div>';

    var epgPrefs = makeChanPrefs();
    state.channels.forEach(function (ch) {
        if (epgPrefs.isHidden(ch.stream_id)) return;
        var progs = (state.xmltv.byId[ch.epg_channel_id] || []);
        if (progs.length === 0 && !ch.epg_channel_id) {
            var id = state.xmltv.byName[normName(ch.name)];
            if (id) progs = state.xmltv.byId[id] || [];
        }
        html += '<div class="epg-row"><div class="epg-chan">' + esc(ch.name) + '</div><div class="epg-progs">';
        progs.forEach(function (pr) {
            if (pr.stop <= dayStart || pr.start >= dayEnd) return;
            var offset = Math.max(0, (pr.start - dayStart) / 3600000 * PX_PER_HOUR);
            var dur = Math.max(30, ((pr.stop - pr.start) / 3600000 * PX_PER_HOUR));
            var isNow = pr.start <= now && pr.stop > now;
            html += '<div class="epg-prog' + (isNow ? " now" : "") + '" style="left:' + offset + 'px;width:' + dur + 'px">' +
                '<div class="epg-prog-time">' + hhmm(pr.start) + '–' + hhmm(pr.stop) + '</div>' +
                '<div class="epg-prog-title">' + esc(pr.title) + '</div></div>';
        });
        html += '</div></div>';
    });
    el.innerHTML = html;
}

/* =====================================================================
 *  Wiedergabe
 * ===================================================================== */

function playLive(ch) {
    var prefs = makeChanPrefs();
    if (prefs.isLocked(ch.stream_id)) {
        var needPin = !!(lsGet("pin_hash", null)) && lsGet("pin_enabled", false);
        if (needPin) {
            requestPin(ch, function (ok) { if (ok) playLiveNoGate(ch); });
            return;
        }
        document.getElementById("menu-title").textContent = "🔒 FSK-Sperre";
        var nb = document.getElementById("menu-body");
        nb.innerHTML = '<div class="menu-note">Dieser Kanal ist per FSK-Sperre gesperrt (PIN nicht festgelegt — in den Einstellungen PIN setzen, um die Sperre zu aktivieren).</div>';
        document.getElementById("menu-overlay").classList.remove("hidden");
        return;
    }
    playLiveNoGate(ch);
}

function playLiveNoGate(ch) {
    state.currentPlayback = { url: liveUrl(ch.stream_id), title: ch.name, kind: "live", channelId: ch.stream_id, channel: ch };
    startPlayback();
    markWatched(ch.stream_id);
}

function requestPin(ch, cb) {
    document.getElementById("menu-title").textContent = "🔒 " + (ch.name || "Kanal") + " — FSK-Sperre";
    var nb = document.getElementById("menu-body");
    nb.innerHTML = '<div class="menu-note">Bitte PIN eingeben:</div>';
    var row = document.createElement("div");
    row.className = "menu-row";
    var inp = document.createElement("input");
    inp.type = "password";
    inp.inputMode = "numeric";
    inp.autocomplete = "off";
    inp.className = "menu-input";
    inp.placeholder = "PIN…";
    var errEl = document.createElement("div");
    errEl.className = "menu-note err";
    errEl.textContent = "";
    var go = menuButton("Entsperren", "gold", function () {
        verifyPin(inp.value || "", function (ok) {
            if (ok) { closeMenu(); cb(true); }
            else { errEl.textContent = "Falsche PIN"; inp.value = ""; }
        });
    });
    var cancel = menuButton("Abbrechen", "", function () { closeMenu(); cb(false); });
    row.appendChild(inp);
    row.appendChild(go);
    row.appendChild(cancel);
    nb.appendChild(row);
    nb.appendChild(errEl);
    document.getElementById("menu-overlay").classList.remove("hidden");
    try { inp.focus(); } catch (e) {}
}

function playVod(url, title, key, startPosMs) {
    state.currentPlayback = { url: url, title: title, kind: "vod", channelId: key, startPosMs: startPosMs || 0 };
    startPlayback();
    markWatched(key);
}

function startPlayback() {
    var cb = state.currentPlayback;
    show("view-player");
    document.getElementById("player-title").textContent = cb.title;
    var video = document.getElementById("video");

    if (state.hls) { try { state.hls.destroy(); } catch (e) {} state.hls = null; }

    var url = cb.url;

    if (cb.kind === "vod" && cb.startPosMs > 0) {
        var doSeek = function () { video.currentTime = cb.startPosMs / 1000; };
        video.addEventListener("loadedmetadata", doSeek, { once: true });
    }

    if (window.Hls && Hls.isSupported()) {
        var hls = new Hls({ liveSyncDurationCount: 3, enableWorker: true });
        state.hls = hls;
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, function () { video.play().catch(function () {}); });
        hls.on(Hls.Events.ERROR, function (evt, data) {
            if (data.fatal) {
                if (cb.kind === "live") { hls.recoverMediaError(); }
                else { show("view-home"); }
            }
        });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
        video.play().catch(function () {});
    } else {
        alert("Dieses Gerät unterstützt kein HLS.");
        show("view-home");
        return;
    }

    if (cb.kind === "vod") {
        video.ontimeupdate = function () {
            if (video.currentTime > 5) {
                state.resume[cb.channelId] = Math.floor(video.currentTime * 1000);
                lsSet(profileScope("resume"), state.resume);
            }
        };
        video.onended = function () {
            delete state.resume[cb.channelId];
            lsSet(profileScope("resume"), state.resume);
        };
    }

    showOsd();
}

function showOsd() {
    var cb = state.currentPlayback;
    if (!cb) return;
    var osd = document.getElementById("osd");
    osd.classList.remove("hidden");
    document.getElementById("osd-title").textContent = cb.title;
    var nn = cb.kind === "live" && cb.channel ? nowNext(cb.channel) : null;
    document.getElementById("osd-epg").innerHTML = nn && nn.now ? epgLine(nn.now, nn.next) : "";
    clearTimeout(state.osdTimer);
    state.osdTimer = setTimeout(function () { osd.classList.add("hidden"); }, 5000);
}

function markWatched(id) {
    state.recent = [id].concat(state.recent.filter(function (x) { return x !== id; })).slice(0, 10);
    lsSet(profileScope("recent"), state.recent);
}

/* =====================================================================
 *  Tabs
 * ===================================================================== */

function activateTab(tab) {
    document.querySelectorAll(".tab").forEach(function (t) { t.classList.toggle("active", t.dataset.tab === tab); });
    var panes = ["live", "movies", "series", "epg", "downloads"];
    panes.forEach(function (p) {
        document.getElementById("pane-" + p).classList.toggle("hidden", p !== tab);
    });
    if (tab === "epg") renderEpg();
    if (tab === "downloads") renderDownloads();
}

/* =====================================================================
 *  Downloads (webOS: kein Offline-Speicher auf dem TV, nur Hinweis)
 * ===================================================================== */

function renderDownloads() {
    var el = document.getElementById("downloads-list");
    document.getElementById("downloads-count").textContent = "0 offline verfügbar";
    el.innerHTML = '<div class="dl-empty">📥<br><br>Downloads sind auf diesem Gerät nicht verfügbar.<br>' +
        'Der webOS-Player streamt direkt — kein Offline-Speicher auf dem TV.</div>';
}

/* =====================================================================
 *  Settings
 * ===================================================================== */

function renderSettings() {
    show("view-settings");
    var enabled = pinEnabled();
    document.getElementById("pin-status").textContent = enabled ? "An" : "Aus";
    document.getElementById("pin-status").style.color = enabled ? "#6FCF9F" : "#8FA3C8";
    document.getElementById("btn-pin-set").textContent = enabled ? "PIN ändern" : "PIN festlegen";
    document.getElementById("pin-form").classList.add("hidden");
    document.getElementById("pin-msg").textContent = "";
    document.getElementById("pin-input").value = "";
    document.getElementById("pin-confirm").value = "";
}

/* =====================================================================
 *  Helpers
 * ===================================================================== */

function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function htmlDecode(s) {
    return String(s).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");
}

/* =====================================================================
 *  Init
 * ===================================================================== */

function init() {
    ensureIdentity();

    document.getElementById("btn-pair").onclick = doPair;

    // v1.1.0: Sicherheits-PW Unlock
    document.getElementById("btn-unlock").onclick = doUnlock;
    document.getElementById("btn-unlock-back").onclick = function () { show("view-pairing"); };
    document.getElementById("unlock-input").addEventListener("keyup", function (e) {
        if (e.keyCode === 13 || e.keyCode === 14) doUnlock();
    });

    document.getElementById("btn-logout").onclick = function () {
        lsDel("providers_json"); lsDel("token");
        state.providers = []; state.token = null;
        show("view-pairing");
    };
    document.getElementById("btn-back").onclick = function () {
        stopPlayback();
        show("view-home");
    };
    document.getElementById("btn-settings").onclick = renderSettings;
    document.getElementById("btn-settings-back").onclick = function () { show("view-home"); };
    document.getElementById("btn-profile").onclick = function () { show("view-profiles"); renderProfiles(); };

    document.getElementById("btn-pin-set").onclick = function () {
        document.getElementById("pin-form").classList.toggle("hidden");
    };
    document.getElementById("btn-pin-cancel").onclick = function () {
        document.getElementById("pin-form").classList.add("hidden");
    };
    document.getElementById("btn-pin-save").onclick = function () {
        var a = document.getElementById("pin-input").value;
        var b = document.getElementById("pin-confirm").value;
        var msg = document.getElementById("pin-msg");
        if (a.length < 4) { msg.textContent = "PIN muss mindestens 4 Ziffern haben"; msg.className = "msg error"; return; }
        if (a !== b) { msg.textContent = "PINs stimmen nicht überein"; msg.className = "msg error"; return; }
        setPin(a, function () { msg.textContent = "PIN gesetzt"; msg.className = "msg ok"; renderSettings(); });
    };

    document.getElementById("movies-search").oninput = renderMovies;
    document.getElementById("series-search").oninput = renderSeries;

    document.querySelectorAll(".tab").forEach(function (t) {
        t.onclick = function () { activateTab(t.dataset.tab); };
    });

    // webOS-Fernbedienung: Back-Taste (10009/461/27) — Overlay wird zuerst geschlossen
    document.addEventListener("keydown", function (e) {
        var isBack = e.keyCode === 10009 || e.keyCode === 461 || e.keyCode === 27 ||
            (e.key === "Backspace" && state.currentView === "view-player");
        if (isBack) {
            if (document.getElementById("menu-overlay") && !document.getElementById("menu-overlay").classList.contains("hidden")) {
                closeMenu(); e.preventDefault(); return;
            }
            if (state.currentView === "view-unlock") {
                // Unlock-View: Back = kein Provider-Zugang → Pairing
                show("view-pairing");
                e.preventDefault();
                return;
            }
            if (state.currentView === "view-player") { stopPlayback(); show("view-home"); e.preventDefault(); }
            else if (state.currentView === "view-movie-detail" || state.currentView === "view-series-detail" || state.currentView === "view-settings") {
                show("view-home"); e.preventDefault();
            }
        }
    });

    // Menu-Taste (LG: 275 / webOS: 10248) → Verwaltuns-Overlay
    document.addEventListener("keydown", function (e) {
        if (e.keyCode === 275 || e.keyCode === 10248 || e.key === "ContextMenu") {
            var ok = false;
            try { ok = onMenuKey(); } catch (err) { ok = false; }
            if (ok) e.preventDefault();
        }
    });

    // OK-Taste im Player = OSD togglen
    document.addEventListener("keydown", function (e) {
        if (state.currentView === "view-player" && (e.keyCode === 13 || e.keyCode === 29443)) {
            var osd = document.getElementById("osd");
            if (osd.classList.contains("hidden")) showOsd(); else osd.classList.add("hidden");
        }
    });

    startFlow();
}

function stopPlayback() {
    if (state.hls) { try { state.hls.destroy(); } catch (e) {} state.hls = null; }
    var video = document.getElementById("video");
    video.pause();
    video.removeAttribute("src");
    video.load();
    state.currentPlayback = null;
}

document.addEventListener("DOMContentLoaded", init);
