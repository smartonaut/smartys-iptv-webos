"use strict";

/* =====================================================================
 *  Smartys M3U Player — webOS TV App
 *  Feature-Paritaet zur Android-/Desktop-App:
 *  Pairing, Live-TV, VOD (Filme/Serien), EPG-Grid, Catch-up/Timeshift,
 *  Kindersicherung (PIN), Profile, Favoriten, Fortsetzen, TMDB.
 *
 *  Backend:  panel.smartys.tech  (Pairing + Provider + TMDB-Proxy)
 *  Xtream:   player_api.php des jeweiligen Providers
 *  Wiedergabe: hls.js (Fallback natives HLS auf WebKit-Engines)
 * ===================================================================== */

var PANEL = "https://panel.smartys.tech";
var APP_VERSION = "1.0.0";

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
            state.providers = (body.providers || []).filter(function (p) { return p.active; });
            if (state.providers.length === 0) throw new Error("EMPTY");
            return state.providers;
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

var VIEWS = ["view-pin", "view-profiles", "view-pairing", "view-loading", "view-home",
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

function afterUnlock() {
    var hasProviders = lsGet("providers_json", null);
    if (hasProviders) {
        state.providers = hasProviders;
        state.token = lsGet("token", null);
        loadAll();
    } else {
        document.getElementById("player-id").textContent = state.playerId;
        document.getElementById("pairing-pw").textContent = state.pairingPw;
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
    var all = document.createElement("div");
    all.className = "cat" + (state.selectedLiveCat === null ? " active" : "");
    all.textContent = "Alle Kanäle";
    all.onclick = function () { state.selectedLiveCat = null; renderLiveCategories(); renderLiveChannels(); };
    el.appendChild(all);
    state.categories.forEach(function (c) {
        var d = document.createElement("div");
        d.className = "cat" + (state.selectedLiveCat === c.category_id ? " active" : "");
        d.textContent = c.category_name;
        d.onclick = function () { state.selectedLiveCat = c.category_id; renderLiveCategories(); renderLiveChannels(); };
        el.appendChild(d);
    });
}

function renderLiveChannels() {
    var el = document.getElementById("live-channels");
    el.innerHTML = "";
    var shown = state.channels;
    if (state.selectedLiveCat !== null) shown = shown.filter(function (c) { return c.category_id === state.selectedLiveCat; });
    shown.forEach(function (c) {
        var d = document.createElement("div");
        d.className = "ch";
        var nn = nowNext(c);
        var fav = state.favorites[c.stream_id] ? " ★" : "";
        var num = c.num ? c.num + "  " : "";
        d.innerHTML = '<div class="ch-name">' + esc(num + c.name) + fav + '</div>' +
            '<div class="ch-epg">' + (nn && nn.now ? epgLine(nn.now, nn.next) : "Keine EPG-Daten") + '</div>';
        d.onclick = function () { playLive(c); };
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
    state.vodCategories.forEach(function (c) {
        var d = document.createElement("div");
        d.className = "cat" + (state.selectedMovieCat === c.category_id ? " active" : "");
        d.textContent = c.category_name;
        d.onclick = function () { state.selectedMovieCat = c.category_id; renderMovies(); };
        cats.appendChild(d);
    });

    var q = (document.getElementById("movies-search").value || "").toLowerCase();
    var shown = state.vodMovies;
    if (state.selectedMovieCat !== null) shown = shown.filter(function (m) { return m.category_id === state.selectedMovieCat; });
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
    state.seriesCategories.forEach(function (c) {
        var d = document.createElement("div");
        d.className = "cat" + (state.selectedSeriesCat === c.category_id ? " active" : "");
        d.textContent = c.category_name;
        d.onclick = function () { state.selectedSeriesCat = c.category_id; renderSeries(); };
        cats.appendChild(d);
    });

    var q = (document.getElementById("series-search").value || "").toLowerCase();
    var shown = state.seriesShows;
    if (state.selectedSeriesCat !== null) shown = shown.filter(function (s) { return s.category_id === state.selectedSeriesCat; });
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

    state.channels.forEach(function (ch) {
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
    state.currentPlayback = { url: liveUrl(ch.stream_id), title: ch.name, kind: "live", channelId: ch.stream_id, channel: ch };
    startPlayback();
    markWatched(ch.stream_id);
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

    // webOS-Fernbedienung: Back-Taste (10009/461/27)
    document.addEventListener("keydown", function (e) {
        var isBack = e.keyCode === 10009 || e.keyCode === 461 || e.keyCode === 27 ||
            (e.key === "Backspace" && state.currentView === "view-player");
        if (isBack) {
            if (state.currentView === "view-player") { stopPlayback(); show("view-home"); e.preventDefault(); }
            else if (state.currentView === "view-movie-detail" || state.currentView === "view-series-detail" || state.currentView === "view-settings") {
                show("view-home"); e.preventDefault();
            }
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
