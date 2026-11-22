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
 *  - Gruppe verwalten: OK HALTEN auf Gruppe/Sender, oder
 *    Einstellungen -> "Gruppen sortieren & ausblenden". Die
 *    MENUE-Taste ist am TV vom LG-Systemmenue belegt (key 275
 *    kommt dort nicht mehr an) und wird nicht mehr benutzt.
 *
 *  v1.2.0 — Nachziehen auf den Stand von Android v0.8.31 und Desktop 2.0.0:
 *  - Stillstands-Waechter fuer Live-TV (1-s-Takt, 15 s Anlauf, 3 s Stillstand
 *    -> Neuverbindung; nie bei VOD, nie bei pausierter Wiedergabe)
 *  - Puffer/Cache einstellbar (Auto oder 3-60 s), wirkt auf hls.js
 *  - Programm raster: 6-Stunden-Fenster ab jetzt, Klick startet den Sender
 *  - Staffel-Schlange: "Staffel abspielen", naechste Folge automatisch,
 *    Abspann-Hinweis 5 s vor Schluss
 *  - IMDb-/Filmstarts-Verweis als QR (Fernseher kann keine Links oeffnen)
 *  - Mehrzeilen-Modus: Kategorien nach Namen zusammengefasst
 *
 *  v1.3.0 — TV-Tuning fuer OLED65C17LB (webOS 6.5, Chrome 79, 2,6 GB RAM,
 *           davon dauerhaft < 200 MB frei, JS-Heap-Limit 747 MB):
 *  - Senderliste virtualisiert: vorher 8.017 DOM-Elemente (~24.000 Knoten),
 *     jetzt nur die sichtbaren Zeilen im DOM
 *  - Film-/Serien-Gitter virtualisiert: vorher bis zu 29.000 Poster-Elemente
 *     auf einen Schlag, jetzt zeilenweise nur der sichtbare Bereich
 *  - XMLTV-EPG-Fenster: nur -6 h bis +30 h behalten, Rohtext nach dem
 *     Parsen sofort fuer den GC freigeben
 *  - hls.js-Puffer-Bug behoben: maxBufferLength wurde vom eigenen
 *     Konfig-Objekt UEBERSCHRIEBEN (Einstellung wirkte nie); Puffer-
 *     Standard auf TV-Groesse abgesenkt (40 MB statt 60)
 *  - Speicherwaechter im Hintergrund (10-s-Takt): misst den JS-Heap,
 *     ab 62 % weiche Bereinigung (inaktive Ansichten leeren), ab 82 %
 *     kritisch (EPG-Daten verwerfen, laden bei Bedarf neu). Laueft ohne
 *     Unterbrechung der Wiedergabe; Zaehler in den Einstellungen sichtbar.
 *  - Bild-Start verschaerft: startPosition:-1 holt das Live-Ende sofort,
 *     kuerzere Manifest-Timeouts und Retries
 *  - Poster-Bilder mit loading="lazy" + decoding="async"
 *  v1.3.1 — SIPTV-Gefuehl-Paket:
 *  - Sofort-Start: Senderliste aus IndexedDB-Cache (2. Start in ~0,2 s),
 *    Netz frischt im Hintergrund nach, Listen wechseln lautlos
 *  - Zap-Prefetch: Fokus auf Sender waermt die Playlist beim Anbieter an,
 *    Bild erscheint beim Klick frueher
 *  - capLevelOnFPS: bei Rechendruck selbst auf leichtere Stufe schalten
 *    statt zu stottern
 *
 *  v1.4.0 — Wiedergabe-Pipeline nach SIPTV-Analyse: nativ zuerst.
 *  HLS laeuft direkt im <video>-Element ueber die LG-UMS-Hardware-
 *  Pipeline (Bild nach ~1,3 s statt 4,8 s, kein JS-Transmuxing).
 *  hls.js bleibt Fallback, VOD (mp4) spielt ab jetzt ebenfalls nativ.
 *
 *  v1.5.0 — Options- & Bedienungsausbau:
 *  - Gruppen-Verwaltung (Vollbild): alles markieren, Gewuenschtes
 *    auswaehlen, "Nur markierte zeigen" blendet den Rest aus; A-Z; fuer
 *    Live-TV, Filme und Serien
 *  - Vorschaufenster in der Senderliste: stilles Live-Bild + EPG mit
 *    Restlaufzeit und Fortschrittsbalken; abschaltbar
 *  - Merken (Watchlist) fuer Filme und Serien, eigener Tab
 *  - IMDb-Wertung/Genre/Laufzeit/Trailer im Film-Detail, Sterne im
 *    Serien-Detail; abschaltbar
 *  - Transparentes OSD: Titel, Uhrzeit, EPG, Laufzeitbalken mit Rest
 *  - Einstellungen aufgeraeumt (Puffer-Knopf raus), Systemstatus kompakt
 *
 *  Feature-Paritaet zur Android-/Desktop-App:
 *  Pairing, Live-TV, VOD (Movies/Series), EPG-Grid, Catch-up/Timeshift,
 *  Kindersicherung (PIN), Profile, Favoriten, Fortsetzen, TMDB.
 *  Backend:  panel.smartys.tech  (Pairing + Provider + TMDB-Proxy)
 *  Xtream:   player_api.php des jeweiligen Providers
 *  Wiedergabe: hls.js (Fallback natives HLS auf WebKit-Engines)
 * ===================================================================== */

var PANEL = "https://panel.smartys.tech";
var FAV_CAT = "__fav__";   /* Sonderwert fuer den Favoriten-Eintrag */
var APP_VERSION = "1.5.9";

var state = {
    playerId: null,
    pairingPw: null,
    token: null,
    providers: [],          // {server_url, username, password, label}
    categories: [],         // Live-TV Kategorien
    channels: [],           // Live-TV Kanäle
    selectedLiveCat: null,

    vodCategories: [], vodMovies: [], vodLoading: false, seriesLoading: false,
    seriesCategories: [], seriesShows: [],

    selectedMovieCat: null,
    selectedSeriesCat: null,

    xmltv: null,            // {byId: {}, byName: {}, ready:false}
    epgShortCache: {},      // streamId -> [{title,start,end}]

    favorites: {},          // pro Profil
    liveQuery: "",          // Suchtext in der Senderliste
    resume: {},             // key -> position ms
    recent: [],             // zuletzt gesehen (streamIds)
    activeProfile: "default",

    currentView: "pairing",
    hls: null,
    currentPlayback: null,  // {url, title, kind, channelId}
    osdTimer: null,

    /* v1.2.0 */
    wd: { active: false, timer: null, lastPos: -1, stillMs: 0, startedAt: 0, reconnects: 0 },
    queue: [],              // Folgen-Schlange ("Staffel abspielen")
    queueIdx: -1,
    creditsShown: false,    // Abspann-Hinweis schon gezeigt?

    /* v1.3.0 */
    visibleChans: [],       // Senderliste: gefilterte Daten (Renderquelle)
    chansIdx: {},           // stream_id(String) -> Index in visibleChans
    visibleMovies: [],      // Filme: gefilterte Daten
    visibleSeries: [],      // Serien: gefilterte Daten
    memguard: { timer: null, bereinigungen: 0, stufe: "" },

    /* v1.5.0 */
    watch: {},                  // Merkenliste: key -> Merkposten (pro Profil)
    pv: { timer: null, tick: null, sid: null, fails: 0 },   // Vorschaufenster
    osdTicker: null,
    gScope: "live",             // Gruppen-Verwaltung: active Zeile
    grpMarks: {},               // category_id(String) -> markiert
    trailerFrom: "view-movie-detail",
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
    state.watch = lsGet(profileScope("watch"), {});
    state.resume = lsGet(profileScope("resume"), {});
    state.recent = lsGet(profileScope("recent"), []);
}

/* =====================================================================
 *  Identität: stabile Player-ID (js/identity.js, PLAYER-IDENTITY.md)
 *  - vorhandene localStorage-ID bleibt unangetastet
 *  - sonst: Spiegel → Ableitung aus nduid+Modell → Zufall
 *  - EINMAL pro App-Start: Guard stellt sicher, dass parallele Aufrufe
 *    sich dasselbe Promise teilen (die Plattform-APIs sind asynchron —
 *    ohne Guard könnten zwei Initialisierungen zwei IDs erzeugen)
 * ===================================================================== */

var identityPromise = null;

function ensureIdentity() {
    if (!identityPromise) {
        identityPromise = SmartysIdentity.resolveIdentity({
            get: function (k) { return localStorage.getItem(k); },
            set: function (k, v) { localStorage.setItem(k, v); }
        }).then(function (res) {
            state.playerId = res.playerId;
            state.pairingPw = res.pairingPw;
        });
    }
    return identityPromise;
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
    // FIX v1.1.2: importKey liefert EIN PROMISE — muss gekettet werden,
    // sonst erhält deriveKey ein Promise statt CryptoKey und jeder
    // Unlock-Versuch schlägt fehl ("Passwort falsch", Passwort korrekt).
    return crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"])
        .then(function (baseKey) {
            return crypto.subtle.deriveKey(
                { name: "PBKDF2", salt: secB64ToBytes(saltB64), iterations: iterations, hash: "SHA-256" },
                baseKey, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
        });
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
    // Entschlüsselung bindet an die Player-ID (AAD) — erst warten, bis sie feststeht
    ensureIdentity().then(_doUnlock);
}

function _doUnlock() {
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

/* Welche Leitung ist aktiv? Nur diese wird geladen. Umgeschaltet wird in
   den Einstellungen; erst dann wird die andere Leitung nachgeladen. */
function activeLineIdx() {
    var list = state.providers || [];
    var i = parseInt(lsGet("active_line", 0), 10);
    if (isNaN(i) || i < 0 || i >= list.length) i = 0;
    return i;
}
function primaryProvider() {
    var list = state.providers || [];
    return list[activeLineIdx()] || list[0];
}

function xtream(provider, action, extra) {
    var url = (provider.server_url || "").replace(/\/+$/, "") + "/player_api.php?username=" +
        encodeURIComponent(provider.username) + "&password=" + encodeURIComponent(provider.password) +
        "&action=" + action;
    if (extra) for (var k in extra) url += "&" + k + "=" + encodeURIComponent(extra[k]);
    return httpGetJson(url);
}

/* Stream-URLs (identisch zu CredStore.kt) */
function providerAt(pi) {
    var list = state.providers || [];
    return list[pi] || list[0];
}
function liveUrl(streamId, pi) {
    var p = providerAt(pi);
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
             "view-movie-detail", "view-series-detail", "view-settings", "view-player",
             "view-groups", "view-trailer"];

function show(id) {
    for (var i = 0; i < VIEWS.length; i++) {
        var el = document.getElementById(VIEWS[i]);
        if (VIEWS[i] === id) el.classList.remove("hidden"); else el.classList.add("hidden");
    }
    state.currentView = id;
    /* Vorschaufenster haengt an der Live-Ansicht - ausserhalb schliessen */
    if (id !== "view-home") pvStop();
    /* Hintergrund-Bereinigung kann Listen geleert haben - beim Anzeigen
       der Hauptansicht zuerst dafuer sorgen, dass alles wieder steht. */
    if (id === "view-home") {
        try { homeViewsFrisch(); } catch (e) {}
    }
    /* Beim Wechsel auf eine Liste den Fokus setzen, sonst steht die
       Fernbedienung im Nichts und das erste Steuerkreuz-Ereignis geht
       ins Leere. Kurz verzoegert, weil renderLiveCategories() erst nach
       show() laeuft und die Elemente dann noch nicht existieren. */
    if (id === "view-home") {
        setTimeout(function () {
            if (!document.activeElement || document.activeElement === document.body) {
                try { window.ersterFokus && window.ersterFokus(); } catch (e) {}
            }
        }, 120);
    }
    /* 1.5.6: Einstellungen bekommt beim Öffnen sofort Fokus auf den
       ersten Aktion-Knopf (Öffnen), damit das Steuerkreuz ab dem
       ersten Druck funktioniert und der Nutzer sieht, wo er ist. */
    if (id === "view-settings") {
        setTimeout(function () {
            if (state.currentView !== "view-settings") return;
            var s0 = fokusListe("settings");
            if (!s0.length) return;
            var start = null;
            for (var i = 0; i < s0.length; i++) {
                if (s0[i].closest(".settings-body")) { start = s0[i]; break; }
            }
            fokusSetzen(start || s0[0]);
        }, 140);
    }
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

/* =====================================================================
 *  Bildschirmschoner blockieren
 *
 *  webOS startet den Screensaver nach kurzer Inaktivitaet (~2 min auf
 *  OLED) - beim Durchblaettern der Senderliste sieht der Nutzer also
 *  ploetzlich den Bildschirmschoner statt seiner App. Ein Vollbild-Video
 *  haelt ihn fern, eine Liste nicht.
 *
 *  Zwei Ebenen:
 *  1) appinfo.json "screenSaverProperties": {"preferredType": 2} hebt den
 *     Timeout offiziell auf 30 Minuten (und dimmt nur den OSD-Bereich).
 *  2) Der tvpower-Dienst fragt vor dem Start per
 *     registerScreenSaverRequest an; wer mit ack:false antwortet, haelt ihn
 *     ganz auf. WebOSServiceBridge ist auf webOS 6 die einzige Bruecke -
 *     webOS.service.request existiert dort nicht (typeof webOS ===
 *     "undefined"), palmServiceBridge ebenfalls nicht.
 * ===================================================================== */
state.screensaver = { registriert: false, blockiert: 0 };

function screenSaverWaechter() {
    if (typeof WebOSServiceBridge === "undefined") return false;
    try {
        var bridge = new WebOSServiceBridge();
        bridge.onservicecallback = function (msg) {
            var m;
            try { m = JSON.parse(msg); } catch (e) { return; }
            if (!m || m.returnValue !== true || !m.timestamp) return;
            state.screensaver.blockiert++;
            try {
                bridge.call("luna://com.webos.service.tvpower/power/responseScreenSaverRequest",
                    JSON.stringify({
                        clientName: "com.smartys.iptv",
                        ack: false,              /* false = nicht starten */
                        timestamp: m.timestamp
                    }));
            } catch (e) {}
        };
        bridge.call("luna://com.webos.service.tvpower/power/registerScreenSaverRequest",
            JSON.stringify({ subscribe: true, clientName: "com.smartys.iptv" }));
        state.screensaver.registriert = true;
        return true;
    } catch (e) {
        return false;
    }
}

function catK(scope, key) { return profileScope("cat_" + scope + "_" + key); }
function chK(key) { return profileScope("chl_" + key); }

function makeCatPrefs(scope) {
    var cp = {};
    cp.order = function () { return lsGet(catK(scope, "order"), []); };
    cp.hidden = function () { return lsGet(catK(scope, "hidden"), []); };
    cp.renames = function () { return lsGet(catK(scope, "rename"), {}); };
    /* Sortiermodus wie in der Desktop-App: Nummer ("num", Playlist-Reihenfolge)
       -> A-Z ("name") -> Manuell ("manual", gespeicherte Reihenfolge).
       Default: "manual", sobald eine gespeicherte Reihenfolge existiert,
       sonst "num" - damit aeltere Installationen nicht umspringen. */
    cp.setSortMode = function (m) { lsSet(catK(scope, "sortmodus"), m); };
    cp.sortMode = function () {
        var m = lsGet(catK(scope, "sortmodus"), "");
        if (m) return m;
        return cp.order().length ? "manual" : "num";
    };
    /* Typen normalisieren: category_id kommt als Number aus der Xtream-API,
       data-cat-id liefert einen String. ohne String() findet indexOf nichts
       und das Ausblenden wirkt um eine Aktion versetzt. */
    cp.isHidden = function (catId) { return cp.hidden().map(String).indexOf(String(catId)) >= 0; };
    cp.labelOf = function (cat) {
        var r = cp.renames();
        return (r[cat.category_id] && r[cat.category_id].trim()) ? r[cat.category_id] : (cat.category_name || "Unbenannt");
    };
    cp.hasCustom = function (catId) { return !!(cp.renames()[catId] && cp.renames()[catId].trim()); };
    cp.applyTo = function (cats) {
        var list = (cats || []).filter(function (c) { return !cp.isHidden(c.category_id); });
        var modus = cp.sortMode();
        if (modus === "name") {
            list.sort(function (a, b) { return cp.labelOf(a).localeCompare(cp.labelOf(b), "de"); });
            return list;
        }
        if (modus === "num") return list;
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
        cp.setSortMode("name");
        /* Reihenfolge-Daten bleiben unangetastet: Ruecksprung auf
           "Manuell" zeigt sie unverzogen weiter an. */
    };
    /* Manuelles Verschieben schaltet auf Modus "manual" um (Desktop-Praezedenz) */
    cp.moveUp = function (catId, cats) {
        var list = cp.currentOrder(cats).slice();
        var i = list.indexOf(catId);
        if (i > 0) { list.splice(i, 1); list.splice(i - 1, 0, catId); cp.saveOrder(list); cp.setSortMode("manual"); }
    };
    cp.moveDown = function (catId, cats) {
        var list = cp.currentOrder(cats).slice();
        var i = list.indexOf(catId);
        if (i >= 0 && i < list.length - 1) { list.splice(i, 1); list.splice(i + 1, 0, catId); cp.saveOrder(list); cp.setSortMode("manual"); }
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
    cp.setHidden = function (catId, aus) {
        var h = cp.hidden().map(String);
        var id = String(catId);
        var i = h.indexOf(id);
        if (aus && i < 0) h.push(id);
        else if (!aus && i >= 0) h.splice(i, 1);
        lsSet(catK(scope, "hidden"), h);
    };
    cp.toggle = function (catId) { cp.setHidden(catId, !cp.isHidden(catId)); };
    cp.allHidden = function (cats) {
        return (cats || []).length > 0 && (cats || []).every(function (c) { return cp.isHidden(c.category_id); });
    };
    /* Bei ueber 100 Kategorien ist schrittweises Verschieben unbrauchbar -
       damit springt eine Gruppe direkt an den Anfang oder ans Ende. */
    cp.moveTop = function (catId, cats) {
        var id = String(catId);
        var list = cp.currentOrder(cats).filter(function (x) { return String(x) !== id; });
        list.unshift(id);
        cp.saveOrder(list);
    };
    cp.moveBottom = function (catId, cats) {
        var id = String(catId);
        var list = cp.currentOrder(cats).filter(function (x) { return String(x) !== id; });
        list.push(id);
        cp.saveOrder(list);
    };
    cp.setAllHidden = function (cats, aus) {
        lsSet(catK(scope, "hidden"), aus ? (cats || []).map(function (c) { return c.category_id; }) : []);
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
    b.setAttribute("data-btn", label);
    b.onclick = function () {
        /* Viele Menue-Aktionen bauen das Menue neu auf (renderCatMenuMode
           setzt #menu-body per innerHTML zurueck). Dabei wurde jedes Mal
           der Fokus auf BODY geworfen - bei 112 Kategorien hiess das nach
           jedem Verschieben wieder von vorn scrollen. Jetzt wird die
           Beschriftung gemerkt und nach dem Neuaufbau derselbe Button
           erneut fokussiert. */
        menuState.lastBtn = label;
        onclick();
        setTimeout(function () { fokusMenuBtn(menuState.lastBtn); }, 0);
    };
    return b;
}

window.fokusMenuBtn = function (label) {
    var ov = document.getElementById("menu-overlay");
    if (!ov || ov.classList.contains("hidden")) return false;
    var buttons = document.querySelectorAll("#menu-body .menu-btn");
    var i;
    if (label) {
        for (i = 0; i < buttons.length; i++) {
            if (!buttons[i].disabled && (buttons[i].textContent || "").indexOf(label) >= 0) {
                try { buttons[i].focus(); } catch (e) {}
                if (buttons[i].scrollIntoView) { try { buttons[i].scrollIntoView({ block: "nearest" }); } catch (e) {} }
                return true;
            }
        }
        /* Beschriftung wechselt (z.B. "Als Favorit" -> "Favorit entfernen"):
           ueber das Praefix suchen. */
        var kurz = (label || "").replace(/^[^A-Za-zÄÖÜäöüß]+/, "").split(" ")[0];
        if (kurz) {
            for (i = 0; i < buttons.length; i++) {
                if (!buttons[i].disabled && (buttons[i].textContent || "").indexOf(kurz) >= 0) {
                    try { buttons[i].focus(); } catch (e) {}
                    return true;
                }
            }
        }
    }
    /* Fallback: erster aktiver Button, damit der Fokus nicht auf BODY faellt */
    for (i = 0; i < buttons.length; i++) {
        if (!buttons[i].disabled) { try { buttons[i].focus(); } catch (e) {} return true; }
    }
    return false;
};

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
    /* openOverlayRaw() fehlte hier. renderCatMenuMode() baut das Menue nur
       in #menu-body - das Overlay blieb display:none, alle Buttons hatten
       width/height 0 und waren damit nicht fokussierbar. Aufgehen konnte
       das Menue nur, wenn pickCats() vorher das Overlay geoeffnet hatte;
       "Nach oben/unten" war per Fernbedienung unerreichbar. */
    openOverlayRaw("Kategorie verwalten", scope);
    renderCatMenuMode();
    setTimeout(function () { fokusMenuBtn("Nach oben"); }, 0);
}

function renderCatMenuMode() {
    var scope = menuState.scope;
    var cat = menuState.cat;
    var prefs = makeCatPrefs(scope);
    var all = makeCatPrefs(scope).applyTo; // placeholder
    var cats = scope === "live" ? state.categories : (scope === "movies" ? state.vodCategories : state.seriesCategories);
    var body = document.getElementById("menu-body");
    body.innerHTML = "";
    var titelEl = document.getElementById("menu-title");
    if (titelEl) {
        titelEl.textContent = menuState.mode === 2 ? "Kategorie umbenennen"
            : (menuState.mode === 1 ? "Mehrere markieren" : "Kategorie verwalten");
    }

    if (menuState.mode === 0) {
        var r = function (c) {
            var row = document.createElement("div");
            row.className = "menu-row";
            var modi = ["num", "name", "manual"];
            var modusLabel = { num: "Nummer", name: "A–Z", manual: "Manuell" };
            row.appendChild(menuButton(" → Sortierung: " + modusLabel[prefs.sortMode()], "mini", function () {
                var i = modi.indexOf(prefs.sortMode());
                prefs.setSortMode(modi[(i + 1) % modi.length]);
                menuRefresh();
                renderCatMenuMode();
            }));
            body.appendChild(row);
            var vis = prefs.applyTo(cats).filter(function (c2) { return c2.category_id === cat.category_id; });
            var first = vis.length === 0 || vis[0].category_id === cat.category_id;
            var last = vis.length > 0 && vis[vis.length - 1].category_id === cat.category_id;
            var up = menuButton("▲ Nach oben", first ? "disabled" : "", function () { prefs.moveUp(cat.category_id, cats); menuRefresh(); openCatMenu(scope, cat, 0); });
            var down = menuButton("▼ Nach unten", last ? "disabled" : "", function () { prefs.moveDown(cat.category_id, cats); menuRefresh(); openCatMenu(scope, cat, 0); });
            var top = menuButton("⤒ Anfang", first ? "disabled" : "", function () { prefs.moveTop(cat.category_id, cats); menuRefresh(); openCatMenu(scope, cat, 0); });
            var bot = menuButton("⤓ Ende", last ? "disabled" : "", function () { prefs.moveBottom(cat.category_id, cats); menuRefresh(); openCatMenu(scope, cat, 0); });
            row.appendChild(up); row.appendChild(down); row.appendChild(top); row.appendChild(bot);
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
            r2.appendChild(menuButton("🎯 Mehrere markieren", "", function () {
                /* Workflow des Nutzers wie auf dem Desktop: beim Eintritt
                   ALLES markiert; abwaehlen, was weg; "Nur markierte
                   behalten" blendet den Rest komplett aus. */
                menuState.marked = prefs.applyTo(cats).map(function (c2) { return c2.category_id; });
                openCatMenu(scope, cat, 1);
            }));
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
        /* Komplette Liste (auch ausgeblendete), im aktiven Sortiermodus */
        var alle = function (list, p2) {
            var kopie = list.slice();
            if (p2.sortMode() === "name") kopie.sort(function (a2, b2) { return p2.labelOf(a2).localeCompare(p2.labelOf(b2), "de"); });
            var ord = p2.currentOrder(list);
            var sortiert = [];
            ord.forEach(function (id) { for (var q = 0; q < kopie.length; q++) if (String(kopie[q].category_id) === String(id)) { sortiert.push(kopie[q]); kopie.splice(q, 1); break; } });
            return sortiert.concat(kopie);
        };
        var visibleList = alle(cats, prefs);
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
            prefs.hideMany(prefs.currentOrder(cats).filter(function (id) { return menuState.marked.indexOf(id) < 0; }));
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
        counter.textContent = "Markiert: " + menuState.marked.length + " von " + visibleList.length +
            " - OK waehlt an/ab, NUR MARKIERTE BEHALTEN blendet alle anderen aus";
        body.appendChild(counter);

        var list = document.createElement("div");
        list.className = "menu-list";
        visibleList.forEach(function (c) {
            var row = document.createElement("div");
            row.className = "menu-item" + (menuState.marked.indexOf(c.category_id) >= 0 ? " marked" : "");
            row.tabIndex = 0;                                  /* fokussierbar per Steuerkreuz */
            row.setAttribute("data-cat-id", c.category_id);    /* OK-Handling + Tests */
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
    var rFav = document.createElement("div");
    rFav.className = "menu-row";
    var istFav = !!state.favorites[ch.stream_id];
    rFav.appendChild(menuButton(istFav ? "★ Favorit entfernen" : "☆ Als Favorit merken", "", function () {
        if (istFav) delete state.favorites[ch.stream_id];
        else state.favorites[ch.stream_id] = true;
        lsSet(profileScope("fav"), state.favorites);
        menuRefresh();
        renderLiveChannels();
        openChanMenu(ch);
    }));
    body.appendChild(rFav);
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
    note2.textContent = "Gruppen verwalten: Einstellungen > Gruppen sortieren & ausblenden · Back schließt";
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
    note.textContent = "GELB ein/ausblenden · BLAU alle ein/ausblenden · OK = Menü der Kategorie";
    body.appendChild(note);
    var list = document.createElement("div");
    list.className = "menu-list";
    /* WICHTIG: hier ALLE Kategorien zeigen, nicht prefs.applyTo(cats).
       applyTo filtert ausgeblendete heraus - die waren damit fuer immer
       unsichtbar und liessen sich nie wieder einblenden. */
    (cats || []).forEach(function (c) {
        var row = document.createElement("div");
        var versteckt = prefs.isHidden(c.category_id);
        row.className = "menu-item cat-row" + (versteckt ? " cat-off" : "");
        row.setAttribute("data-cat-id", c.category_id);
        row.tabIndex = 0;
        row.textContent = (versteckt ? "○  " : "●  ") + prefs.labelOf(c);
        row.onclick = function () { openCatMenu(scope, c, 0); };
        list.appendChild(row);
    });
    body.appendChild(list);
}

function openOverlayRaw(title, scope) {
    document.getElementById("menu-title").textContent = title;
    document.getElementById("menu-overlay").classList.remove("hidden");
    pvStop();
    trailerQuell();
}

function trailerQuell() {
    var f = document.getElementById("trailer-frame");
    if (f && state.currentView !== "view-trailer") f.src = "";
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
    /* Identität steht bereits fest — init() lässt startFlow erst nach
     * ensureIdentity() laufen; die Pairing-Anzeige braucht state.playerId. */
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
        /* v1.3.1: erst der Cache (UI steht SOFORT), dann frischt das
           Netz im Hintergrund nach. Fuehlt sich an wie SIPTV: Liste ist
           beim zweiten Start ohne Ladebildschirm da. */
        cacheLaden().then(function (ausCache) {
            if (ausCache) {
                show("view-home");
                /* EPG ruhig hinterher, damit die Zeilen nachtragen */
                setTimeout(function () {
                    if (!state.xmltv) {
                        loadXmltv().then(function () {
                            if (state.tab === "epg") renderEpg();
                            if (state.currentView === "view-home" &&
                                (!state.tab || state.tab === "live")) renderLiveChannels();
                        }).catch(function () {});
                    }
                }, 1500);
                loadAll(true);
                return;
            }
            loadAll();
        }).catch(function () { loadAll(); });
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
    // Identität kann (Neuinstallation) noch asynchron in Ermittlung sein
    ensureIdentity().then(_doPair);
}

function _doPair() {
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

function loadAll(hintergrund) {
    if (!hintergrund) {
        show("view-loading");
        document.querySelector("#view-loading .msg").textContent = "Lade Kanäle…";
    }

    /* Mehrzeilen-Modus: alle aktiven Provider abfragen. Gruppen werden nach
       Namen zusammengefasst (wie Desktop 1.5.39), damit eine Gruppe nicht
       doppelt in der Seitenleiste steht. Gleiche Sendernamen aus zwei
       Leitungen erscheinen nur einmal. */
    /* Nur die AKTIVE Leitung laden. Vorher liefen alle im Panel
       hinterlegten Leitungen durch - bei vier Leitungen mit je ~21.000
       Sendern waren das 62 s Ladezeit und ein Vielfaches an Speicher,
       den der Fernseher nicht hat. Die aktive Leitung ist die erste
       aktive in state.providers (siehe primaryProvider). */
    var provs = [primaryProvider()];
    var msgEl = document.querySelector("#view-loading .msg");
    var fertig = 0;
    /* Sequenziell, aber jede Leitung wird SOFORT eingearbeitet:
       - parallel (4 x 21.000 Sender gleichzeitig) hat den TV ueberlastet:
         alle vier Anfragen hingen, nach 174 s noch kein Ergebnis
       - alles erst sammeln und am Ende verarbeiten kostet zusaetzlich
         ~80.000 Rohobjekte im Speicher, den der Fernseher nicht hat
       Dedupliziert wird beim Einlesen, die Rohantwort ist gleich danach
       wieder frei. */
    var gesehen = {}, canon = [];
    var namen = {}, all = [];
    var catNames = {};

    function ladeProv(pr, pi) {
        return xtream(pr, "get_live_categories").then(function (cl) {
            (cl || []).forEach(function (c) {
                var key = (c.category_name || "").trim().toLowerCase();
                if (!key || gesehen[key]) return;
                gesehen[key] = true;
                canon.push({ category_id: c.category_id, category_name: c.category_name });
                catNames[c.category_id] = c.category_name;
            });
            return xtream(pr, "get_live_streams").then(function (sl) {
                (sl || []).forEach(function (st) {
                    if ((st.name || "").indexOf("####") >= 0) return;
                    var key = (st.name || "").trim().toLowerCase();
                    if (namen[key]) return;
                    namen[key] = true;
                    st.__pi = pi;
                    st.categoryName = catNames[st.category_id] || "";
                    all.push(st);
                });
                fertig++;
                if (msgEl) {
                    msgEl.textContent = provs.length > 1
                        ? "Lade Kanäle… (" + fertig + " von " + provs.length + " Leitungen)"
                        : "Lade Kanäle… " + all.length + " Sender";
                }
            });
        });
    }

    var kette = Promise.resolve();
    provs.forEach(function (pr, pi) {
        kette = kette.then(function () { return ladeProv(pr, pi); });
    });
    kette = kette.then(function () {
        state.categories = canon;
        all.sort(function (a, b) { return (a.num || 0) - (b.num || 0); });
        state.channels = all;
    });
    return kette.then(function () {
            renderLiveCategories();
            renderLiveChannels();
            loadProfileState();
            cacheSpeichern();       /* v1.3.1: naechster Start steht sofort */
            if (!hintergrund) show("view-home");

            /* EPG im Hintergrund nachziehen — nur wenn es noch fehlt. */
            setTimeout(function () {
                if (!state.xmltv) {
                    loadXmltv().then(function () {
                        /* state.tab ist beim Live-Start null (nicht "live") —
                           vorher blieben die Zeilen nach dem EPG-Laden auf
                           "Keine EPG-Daten" stehen, bis irgendwer neu renderte. */
                        if (state.tab === "epg") renderEpg();
                        else if (state.currentView === "view-home" &&
                                 (!state.tab || state.tab === "live")) renderLiveChannels();
                    }).catch(function () {});
                }
            }, 1500);
        }).catch(function (e) {
            /* Hintergrund-Auffrischung darf niemals den gecachten,
               sichtbaren Stand wegwerfen. */
            if (hintergrund) return;
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

/* v1.5.7: XMLTV-Parse aus dem Hauptthread ausgelagert.
   Vorher lief parseXmltv() synchron ueber 60–100 MB XML — die
   Fernbedienung war in dieser Zeit tot ("ich muss immer einen Augenblick
   warten"). Jetzt holt und parst ein Web Worker; der Hauptthread bekommt
   nur die fertige, gefilterte Struktur. */

function xmltvAusWorker(payload) {
    var byId = {}, src = payload.byId || {};
    for (var ch in src) {
        if (!Object.prototype.hasOwnProperty.call(src, ch)) continue;
        var a = src[ch], list = new Array(a.length);
        for (var i = 0; i < a.length; i++) {
            list[i] = { start: a[i][0], stop: a[i][1], title: a[i][2] };
        }
        byId[ch] = list;
    }
    return { byId: byId, byName: payload.byName || {}, ready: true, geladenUm: Date.now() };
}

/* Alter Weg (synchron) — bleibt als Rueckfallebene, falls ein Geraet keine
   Worker erlaubt oder der Worker nicht startet. */
function xmltvKlassisch(url) {
    return http("GET", url, { timeout: 30000 }).then(function (xhr) {
        if (xhr.status !== 200) throw new Error("HTTP " + xhr.status);
        state.xmltv = parseXmltv(xhr.responseText);
        /* Der Rohtext (bei grossen Anbietern 60-100 MB) bleibt sonst als
           xhr.responseText im Speicher haengen. Explizit freigeben. */
        try { xhr.responseText = null; } catch (e) {}
    }).catch(function () {
        state.xmltv = { byId: {}, byName: {}, ready: false };
    });
}

function loadXmltv() {
    var p = primaryProvider();
    var url = (p.server_url || "").replace(/\/+$/, "") + "/xmltv.php?username=" + encodeURIComponent(p.username) + "&password=" + encodeURIComponent(p.password);
    if (typeof Worker === "undefined") return xmltvKlassisch(url);

    var jetzt = Date.now();
    return new Promise(function (resolve, reject) {
        var w = null;
        try { w = new Worker("js/xmltv-worker.js"); } catch (e) { w = null; }
        if (!w) { xmltvKlassisch(url).then(resolve, reject); return; }

        var fertig = false;
        function aufraeumen() { try { w.terminate(); } catch (e) {} }
        var notTimer = setTimeout(function () {
            if (fertig) return;
            fertig = true; aufraeumen();
            /* Worker haengt (alter Kern / kein Thread): synchron nachziehen,
               damit der Nutzer trotzdem EPG bekommt. */
            xmltvKlassisch(url).then(resolve, reject);
        }, 60000);

        w.onmessage = function (ev) {
            if (fertig) return;
            fertig = true;
            clearTimeout(notTimer); aufraeumen();
            var d = ev.data || {};
            if (d.error || !d.byId) { reject(new Error(d.error || "Worker ohne Daten")); return; }
            state.xmltv = xmltvAusWorker(d);
            resolve();
        };
        w.onerror = function () {
            if (fertig) return;
            fertig = true;
            clearTimeout(notTimer); aufraeumen();
            xmltvKlassisch(url).then(resolve, reject);
        };
        w.postMessage({ url: url, von: jetzt - EPG_VON_MS, bis: jetzt + EPG_BIS_MS });
    });
}

/* EPG-Fenster: was wirklich gezeigt wird. Das Raster zeigt -0,5 h..+6 h,
   OSD das laufende Programm. Alles ausserhalb weglassen haelt den Heap
   klein - ein Voll-EPG ueber mehrere Tage erzeugt sonst hunderttausende
   Objekte, die nie jemand sieht. */
var EPG_VON_MS = 6 * 3600000;    /* Vergangenheit */
var EPG_BIS_MS = 30 * 3600000;   /* Zukunft */

function parseXmltv(xml) {
    var byId = {}, byName = {};
    var jetzt = Date.now();
    var von = jetzt - EPG_VON_MS, bis = jetzt + EPG_BIS_MS;
    function behalte(pr) { return (!pr.stop || pr.stop >= von) && pr.start <= bis; }
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
                var pr0 = { start: start, stop: stop, title: htmlDecode(title.trim()) };
                if (behalte(pr0)) (byId[channel] = byId[channel] || []).push(pr0);
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
                var pr1 = { start: start, stop: stop, title: title.trim() };
                if (behalte(pr1)) (byId[channel] = byId[channel] || []).push(pr1);
            }
        }
        var chans = doc.getElementsByTagName("channel");
        for (var j = 0; j < chans.length; j++) {
            var id = chans[j].getAttribute("id");
            var dn = chans[j].getElementsByTagName("display-name")[0];
            if (id && dn) byName[normName(dn.textContent)] = id;
        }
        /* Das geparste XML-Dokument ist hier aus der Closure-Pflicht: */
        doc = null;
    }
    Object.keys(byId).forEach(function (k) { byId[k].sort(function (a, b) { return a.start - b.start; }); });
    return { byId: byId, byName: byName, ready: true, geladenUm: Date.now() };
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

/* v1.5.7: Nach der Gruppenauswahl gehoert der Fokus in die SENDERLISTE.
   Vorher baute renderLiveCategories() die Seitenleiste neu, das fokussierte
   Element verschwand, document.activeElement fiel auf BODY — und die
   naechste Pfeiltaste landete ueber ersterFokus() wieder im Tab "Live-TV".
   Genau das hat Smarty als "Cursor springt nach oben" gemeldet. */
function fokusErstenSender() {
    setTimeout(function () {
        var el = document.getElementById("live-channels");
        if (!el) return;
        var a = document.activeElement;
        /* Nicht klauben, wenn der Fokus schon sinnvoll in der Liste steht. */
        if (a && a !== document.body && a.closest && a.closest("#live-channels")) return;
        el.scrollTop = 0;
        if (el.onscroll) { try { el.onscroll(); } catch (e) {} }
        var erstes = el.querySelector(".ch");
        if (erstes) fokusSetzen(erstes);
    }, 0);
}

function renderLiveCategories() {
    var el = document.getElementById("live-categories");
    el.innerHTML = "";
    var prefs = makeCatPrefs("live");
    var all = document.createElement("div");
    all.className = "cat" + (state.selectedLiveCat === null ? " active" : "");
    all.textContent = "Alle Kanäle";
    all.ondblclick = function () { pickCats("live", state.categories); };
    all.onclick = function () {
        state.selectedLiveCat = null;
        renderLiveCategories(); renderLiveChannels();
        fokusErstenSender();
    };
    /* tabIndex: ohne das ist ein <div> fuer das Steuerkreuz unsichtbar.
       webOS springt mit den Pfeiltasten nur zwischen fokussierbaren
       Elementen - die 370 Kategorien waren bis hierher unerreichbar. */
    all.tabIndex = 0;
    el.appendChild(all);
    /* Favoriten als eigener Eintrag ganz oben - nur wenn es welche gibt. */
    var favAnzahl = Object.keys(state.favorites || {}).filter(function (k) { return state.favorites[k]; }).length;
    if (favAnzahl > 0) {
        var favEl = document.createElement("div");
        favEl.className = "cat" + (state.selectedLiveCat === FAV_CAT ? " active" : "");
        favEl.textContent = "★ Favoriten (" + favAnzahl + ")";
        favEl.tabIndex = 0;
        favEl.onclick = function () {
            state.selectedLiveCat = (state.selectedLiveCat === FAV_CAT) ? null : FAV_CAT;
            renderLiveCategories();
            renderLiveChannels();
            fokusErstenSender();
        };
        el.appendChild(favEl);
    }
    catHinweisZeile(el);
    prefs.applyTo(state.categories).forEach(function (c) {
        var d = document.createElement("div");
        d.className = "cat" + (state.selectedLiveCat === c.category_id ? " active" : "");
        d.setAttribute("data-cat-id", c.category_id);
        d.textContent = prefs.labelOf(c);
        d.onclick = function () {
            if (window.__lpFlag) return;
            state.selectedLiveCat = c.category_id;
            renderLiveCategories(); renderLiveChannels();
            fokusErstenSender();
        };
        d.ondblclick = function (ev) { ev.stopPropagation(); openCatMenu("live", c, 0); };
        d.tabIndex = 0;
        el.appendChild(d);
    });
}

/* =====================================================================
 *  Senderliste — VIRTUALISIERT (v1.3.0)
 *
 *  Vor v1.3.0 renderte diese Funktion ALLE Sender in den DOM: 8.017 Zeilen
 *  mit je zwei Kindern = ~24.000 Knoten, 103 MB JS-Heap direkt nach dem
 *  Start, und der Hauptthread stand beim Aufbau mehrere Sekunden still.
 *  Genau dasselbe Problem hatte das EPG-Raster schon (9,5 s Blockade) -
 *  die Loesung ist auch hier dieselbe: feste Zeilenhoehe, Behaelter auf
 *  voller Hoehe, Zeilen absolut positioniert und nur der sichtbare Bereich
 *  (+Puffer) liegt wirklich im DOM. Die Daten bleiben in state.visibleChans,
 *  die Vertikal-Navigation laeuft ueber den Index in diesem Array (siehe
 *  navChans), nicht ueber die DOM-Reihenfolge.
 * ===================================================================== */

var CH_ZEILEN_H = 74;   /* muss zu .channellist .ch { height } im CSS passen */

function computeVisibleChannels() {
    var prefs = makeChanPrefs();
    var catPrefs = makeCatPrefs("live");
    var visibleCatIds = catPrefs.applyTo(state.categories).map(function (c) { return c.category_id; });
    var shown = prefs.apply(state.channels);
    shown = shown.filter(function (c) { return !prefs.isHidden(c.stream_id); });
    if (state.selectedLiveCat === FAV_CAT) {
        shown = shown.filter(function (c) { return !!state.favorites[c.stream_id]; });
    } else if (state.selectedLiveCat !== null) {
        shown = shown.filter(function (c) { return c.category_id === state.selectedLiveCat; });
    } else {
        shown = shown.filter(function (c) { return visibleCatIds.indexOf(c.category_id) >= 0; });
    }
    /* Suche: wirkt auf Name UND Kategoriename, damit "Sport" auch die
       Sender der Sport-Gruppen findet. */
    var q = (state.liveQuery || "").trim().toLowerCase();
    if (q) {
        shown = shown.filter(function (c) {
            return (c.name || "").toLowerCase().indexOf(q) >= 0 ||
                   (c.categoryName || "").toLowerCase().indexOf(q) >= 0;
        });
    }
    state.visibleChans = shown;
    var idx = {};
    for (var i = 0; i < shown.length; i++) idx[String(shown[i].stream_id)] = i;
    state.chansIdx = idx;
    return shown;
}

function catHinweisZeile(el) {
    var h = document.createElement("div");
    h.className = "cat-hint";
    h.textContent = "Gruppen verwalten & ausblenden: Einstellungen → Gruppen sortieren & ausblenden";
    el.appendChild(h);
}

function renderLiveChannels() {
    var el = document.getElementById("live-channels");
    var prefs = makeChanPrefs();

    /* Aktiven Sender UND Scrollposition VOR dem Neuaufbau merken: ein
       Neu-Rendern (Menue-Aktion, Suche, Kategoriewechsel) darf den Nutzer
       nicht an den Listenanfang schleudern. */
    var vorherScroll = el.scrollTop;
    var vorherSid = null;
    var a0 = document.activeElement;
    if (a0 && a0.getAttribute && el.contains(a0)) vorherSid = a0.getAttribute("data-ch-id");

    var shown = computeVisibleChannels();
    var cnt = document.getElementById("live-count");
    if (cnt) cnt.textContent = (state.liveQuery || "").trim() ? (shown.length + " Treffer") : (shown.length + " Sender");

    el.innerHTML = "";
    var behaelter = document.createElement("div");
    behaelter.className = "chans-virt";
    behaelter.style.height = (shown.length * CH_ZEILEN_H) + "px";
    el.appendChild(behaelter);

    var letzteVon = -2, letzteBis = -2;

    function zeichneBereich() {
        var oben = el.scrollTop;
        var hoehe = el.clientHeight || 800;
        var von = Math.max(0, Math.floor(oben / CH_ZEILEN_H) - 3);
        var bis = Math.min(shown.length, von + Math.ceil(hoehe / CH_ZEILEN_H) + 7);
        if (von === letzteVon && bis === letzteBis) return;
        letzteVon = von; letzteBis = bis;
        var aktivSid = null;
        var a1 = document.activeElement;
        if (a1 && a1.getAttribute) aktivSid = a1.getAttribute("data-ch-id");
        var stueck = [];
        for (var z = von; z < bis; z++) {
            var c = shown[z];
            var nn = nowNext(c);
            var fav = state.favorites[c.stream_id] ? " ★" : "";
            var lock = prefs.isLocked(c.stream_id) ? " 🔒" : "";
            var num = c.num ? c.num + "  " : "";
            stueck.push('<div class="ch" tabindex="0" data-ch-id="' + esc(c.stream_id) + '"' +
                ' style="position:absolute;top:' + (z * CH_ZEILEN_H) + 'px;left:0;right:8px">' +
                '<div class="ch-name">' + esc(num + c.name) + fav + lock + '</div>' +
                '<div class="ch-epg">' + (nn && nn.now ? epgLine(nn.now, nn.next) : "Keine EPG-Daten") + '</div></div>');
        }
        behaelter.innerHTML = stueck.join("");
        if (aktivSid) {
            var wieder = behaelter.querySelector('.ch[data-ch-id="' + aktivSid + '"]');
            if (wieder) { try { wieder.focus(); } catch (e) {} }
        }
    }

    el.onscroll = zeichneBereich;
    /* EIN Klick-Handler auf der Liste statt tausender Closures einzelner
       Zeilen - spart Speicher und Aufbaukosten. */
    el.onclick = function (ev) {
        var ziel = ev.target;
        while (ziel && ziel !== el && !(ziel.classList && ziel.classList.contains("ch"))) {
            ziel = ziel.parentNode;
        }
        if (!ziel || ziel === el) return;
        var ch2 = state.visibleChans[state.chansIdx[String(ziel.getAttribute("data-ch-id"))]];
        if (ch2) playLive(ch2);
    };
    el.ondblclick = function (ev) {
        var ziel = ev.target;
        while (ziel && ziel !== el && !(ziel.classList && ziel.classList.contains("ch"))) {
            ziel = ziel.parentNode;
        }
        if (!ziel || ziel === el) return;
        ev.stopPropagation();
        var ch2 = state.visibleChans[state.chansIdx[String(ziel.getAttribute("data-ch-id"))]];
        if (ch2) openChanMenu(ch2);
    };
    /* Zap-Prefetch + Vorschau: Fokus ruht kurz auf einem Sender ->
       Playlist anwaermen, nach 900 ms kleines Live-Bild im Vorschaukasten */
    el.onfocusin = function (ev) {
        var ziel = ev.target;
        if (ziel && ziel.classList && ziel.classList.contains("ch")) {
            var sid = ziel.getAttribute("data-ch-id");
            if (sid) {
                zapPrefetch(sid);
                pvPlan(sid);
            }
        } else {
            pvStop();   /* Fokus wandert in Suche/Kategorien: Vorschau zu */
        }
    };

    /* Scrollposition restaurieren, dann zeichnen - und zwar BEVOR
       scrollTop gesetzt wird nichts gerendert, weil onscroll drosselt. */
    el.scrollTop = vorherScroll;
    zeichneBereich();

    if (vorherSid && state.chansIdx[String(vorherSid)] !== undefined) {
        var f = behaelter.querySelector('.ch[data-ch-id="' + vorherSid + '"]');
        if (f) { try { f.focus(); } catch (e) {} }
    }
}

/* Vertikal-Navigation der Senderliste ueber den Daten-Index - analog
   navEpg(). DOM-basiert wuerde an der Grenze des gerenderten Fensters
   enden, weil weiter entfernte Zeilen gar nicht existieren. */
function navChans(delta) {
    var el = document.getElementById("live-channels");
    var liste = state.visibleChans;
    if (!liste || !liste.length) return false;
    var a = document.activeElement;
    var sid = a && a.getAttribute ? a.getAttribute("data-ch-id") : null;
    var idx = (sid !== null && sid !== undefined && state.chansIdx[String(sid)] !== undefined)
        ? state.chansIdx[String(sid)] : -1;
    if (idx < 0) {
        /* Fokus steht ausserhalb (z.B. Neuaufbau): wieder reinholen. */
        var neu = el.querySelector(".ch");
        if (neu) { fokusSetzen(neu); }
        return true;
    }
    var ziel = idx + delta;
    if (ziel < 0) {
        /* Oberhalb des ersten Senders: Liste nach oben verlassen
           (Suchfeld, sonst Kategorien). */
        var sn = fokusListe("search");
        if (sn.length) { fokusSetzen(sn[0]); return true; }
        var cl = fokusListe("cats");
        if (cl.length) { fokusSetzen(cl[cl.length - 1]); return true; }
        return true;
    }
    if (ziel >= liste.length) return true;   /* unterer Rand: halten */
    var zielTop = ziel * CH_ZEILEN_H;
    var oben = el.scrollTop, hoehe = el.clientHeight || 800;
    if (zielTop < oben) el.scrollTop = zielTop;
    else if (zielTop + CH_ZEILEN_H > oben + hoehe) el.scrollTop = zielTop + CH_ZEILEN_H - hoehe;
    if (el.onscroll) el.onscroll();
    var w = el.querySelector('.ch[data-ch-id="' + liste[ziel].stream_id + '"]');
    if (w) fokusSetzen(w);
    return true;
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

/* =====================================================================
 *  VOD-Gitter — VIRTUALISIERT (v1.3.0)
 *
 *  renderMovies()/renderSeries() bauten bisher pro Titel ein grid-item -
 *  bei 29.000 Filmen waren das sofort ~90.000 Knoten plus ebenso viele
 *  Closures. Das hat den Tab-Wechsel zu einer Vollblockade gemacht und
 *  tausende Poster-Downloads ausgeloest. Jetzt: nur sichtbare Reihen im
 *  DOM, Klick ueber Delegation, Poster mit loading="lazy".
 *  Die Geometrie liegt in state.gridMeta[scope].
 * ===================================================================== */

state.gridMeta = {};

function gridGeom(el, n) {
    var breite = el.clientWidth || (window.innerWidth - 348);
    var ZELLEN_W = 180;                 /* ~ .grid minmax(160px,1fr) + gap */
    var cols = Math.max(3, Math.floor((breite - 16) / ZELLEN_W));
    var cellW = Math.floor(breite / cols);
    var itemW = cellW - 16;
    var itemH = Math.round(itemW * 1.5) + 52;   /* Poster 2:3 + Titel */
    var cellH = itemH + 16;
    return { cols: cols, cellW: cellW, itemW: itemW, cellH: cellH, rows: Math.ceil(n / cols) };
}

function renderGridVirt(el, daten, scope, itemHtml) {
    /* itemHtml(item, globalIndex) -> string; globalIndex = Position in daten */
    /* VERSTECKTES Grid hat kein Layout - Zellen wuerden 0 px
       hoch gerendert und blieben nach dem Rueckweg fuer immer kollabiert
       (kein Fokus, kein Tap - "auf einem cover keine focus"). Solche
       Runs werden uebersprungen; homeViewsFrisch/activateTab re-rendern
       sobald sichtbar. */
    if (el.clientWidth === 0) { state.gridMeta[scope] = null; el.onscroll = null; return; }
    var meta = gridGeom(el, daten.length);
    state.gridMeta[scope] = meta;
    var vorherScroll = el.scrollTop;
    var vorherGi = null;
    var a0 = document.activeElement;
    if (a0 && a0.getAttribute && el.contains(a0)) vorherGi = a0.getAttribute("data-gi");

    el.innerHTML = "";
    var behaelter = document.createElement("div");
    behaelter.className = "grid-virt";
    behaelter.style.height = (meta.rows * meta.cellH) + "px";
    el.appendChild(behaelter);

    var letzteVon = -2, letzteBis = -2;
    function zeichneBereich() {
        var oben = el.scrollTop;
        var hoehe = el.clientHeight || 700;
        var reiheVon = Math.max(0, Math.floor(oben / meta.cellH) - 1);
        var reiheBis = Math.min(meta.rows, reiheVon + Math.ceil(hoehe / meta.cellH) + 2);
        var von = reiheVon * meta.cols;
        var bis = Math.min(daten.length, reiheBis * meta.cols);
        if (von === letzteVon && bis === letzteBis) return;
        letzteVon = von; letzteBis = bis;
        var aktivGi = null;
        var a1 = document.activeElement;
        if (a1 && a1.getAttribute) aktivGi = a1.getAttribute("data-gi");
        var stueck = [];
        for (var z = von; z < bis; z++) {
            var reihe = Math.floor(z / meta.cols);
            var spalte = z % meta.cols;
            stueck.push('<div class="grid-item" tabindex="0" data-gi="' + z + '"' +
                ' style="position:absolute;top:' + (reihe * meta.cellH) + 'px;left:' + (spalte * meta.cellW + 8) + 'px;width:' + meta.itemW + 'px">' +
                itemHtml(daten[z], z) + '</div>');
        }
        behaelter.innerHTML = stueck.join("");
        if (aktivGi) {
            var wieder = behaelter.querySelector('.grid-item[data-gi="' + aktivGi + '"]');
            if (wieder) { try { wieder.focus(); } catch (e) {} }
        }
    }

    el.onscroll = zeichneBereich;
    el.onclick = function (ev) {
        var ziel = ev.target;
        while (ziel && ziel !== el && !(ziel.classList && ziel.classList.contains("grid-item"))) {
            ziel = ziel.parentNode;
        }
        if (!ziel || ziel === el) return;
        var gi = parseInt(ziel.getAttribute("data-gi"), 10);
        var item = daten[gi];
        if (!item) return;
        if (scope === "movies") openMovieDetail(item); else openSeriesDetail(item);
    };
    el.scrollTop = vorherScroll;
    zeichneBereich();
    if (vorherGi !== null && vorherGi < daten.length) {
        var f = behaelter.querySelector('.grid-item[data-gi="' + vorherGi + '"]');
        if (f) { try { f.focus(); } catch (e) {} }
    }
}

/* 2D-Navigation im Gitter ueber den Daten-Index. Links/rechts in der
   Reihe, hoch/runter um eine Spaltenzahl. Am linken Rand geht es in die
   Kategorie-Spalte, am oberen Rand ins Suchfeld - wie bei den Sendern. */
function navGrid(scope, delta, vertikal) {
    var el = document.getElementById(scope === "movies" ? "movies-grid" : "series-grid");
    var daten = scope === "movies" ? state.visibleMovies : state.visibleSeries;
    if (!daten || !daten.length) return false;
    var meta = state.gridMeta[scope] || gridGeom(el, daten.length);
    var a = document.activeElement;
    var gi = a && a.getAttribute ? parseInt(a.getAttribute("data-gi") || "-1", 10) : -1;
    if (isNaN(gi) || gi < 0) {
        var neu = el.querySelector(".grid-item");
        if (neu) { fokusSetzen(neu); }
        return true;
    }
    var reihe = Math.floor(gi / meta.cols), spalte = gi % meta.cols;
    var ziel = gi;
    if (!vertikal) {
        if (delta < 0 && spalte === 0) {
            /* linker Rand: zur Kategorie-Spalte */
            var cl = fokusListe("vcats");
            if (cl.length) { fokusSetzen(cl[0]); return true; }
            return true;
        }
        ziel = gi + delta;
        if (ziel < 0 || ziel >= daten.length || Math.floor(ziel / meta.cols) !== reihe) return true;
    } else {
        ziel = gi + delta * meta.cols;
        if (ziel < 0) {
            var sn = fokusListe("search");
            if (sn.length) { fokusSetzen(sn[0]); return true; }
            return true;
        }
        if (ziel >= daten.length) return true;
    }
    var zielTop = Math.floor(ziel / meta.cols) * meta.cellH;
    var oben = el.scrollTop, hoehe = el.clientHeight || 700;
    if (zielTop < oben) el.scrollTop = zielTop;
    else if (zielTop + meta.cellH > oben + hoehe) el.scrollTop = zielTop + meta.cellH - hoehe;
    if (el.onscroll) el.onscroll();
    var w = el.querySelector('.grid-item[data-gi="' + ziel + '"]');
    if (w) fokusSetzen(w);
    return true;
}

function renderMovies() {
    var cats = document.getElementById("movies-categories");
    cats.innerHTML = "";
    var all = document.createElement("div");
    all.className = "cat" + (state.selectedMovieCat === null ? " active" : "");
    all.tabIndex = 0;   /* 1.5.7: sonst ist die Kategorie per Steuerkreuz nie fokusierbar */
    all.textContent = "Alle Filme";
    all.onclick = function () { state.selectedMovieCat = null; renderMovies(); };
    cats.appendChild(all);
    var mprefs = makeCatPrefs("movies");
    mprefs.applyTo(state.vodCategories).forEach(function (c) {
        var d = document.createElement("div");
        d.className = "cat" + (state.selectedMovieCat === c.category_id ? " active" : "");
        d.tabIndex = 0;   /* 1.5.7: Fokus-Spieler */
        d.setAttribute("data-mcat-id", c.category_id);
        d.textContent = mprefs.labelOf(c);
        d.onclick = function () { if (window.__lpFlag) return; state.selectedMovieCat = c.category_id; renderMovies(); };
        d.ondblclick = function (ev) { ev.stopPropagation(); openCatMenu("movies", c, 0); };
        cats.appendChild(d);
    });
    catHinweisZeile(cats);

    var q = (document.getElementById("movies-search").value || "").toLowerCase();
    var visibleCatIds = mprefs.applyTo(state.vodCategories).map(function (c) { return c.category_id; });
    var shown = state.vodMovies;
    if (state.selectedMovieCat !== null) shown = shown.filter(function (m) { return m.category_id === state.selectedMovieCat; });
    else shown = shown.filter(function (m) { return visibleCatIds.indexOf(m.category_id) >= 0; });
    if (q) shown = shown.filter(function (m) { return (m.name || "").toLowerCase().indexOf(q) >= 0; });
    state.visibleMovies = shown;

    document.getElementById("movies-count").textContent = shown.length + " Filme";
    renderGridVirt(document.getElementById("movies-grid"), shown, "movies", function (m) {
        var poster = m.stream_icon || m.direct_source || "";
        var rating = m.rating_5based && +m.rating_5based > 0 ? '★ ' + (+m.rating_5based).toFixed(1) : "";
        return '<div class="poster">' + (poster ? '<img src="' + esc(poster) + '" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">' : '<div class="poster-empty">🎬</div>') +
            (rating ? '<span class="rating">' + rating + '</span>' : '') + '</div>' +
            '<div class="grid-title">' + esc(m.name) + '</div>';
    });
}

function renderSeries() {
    var cats = document.getElementById("series-categories");
    cats.innerHTML = "";
    var all = document.createElement("div");
    all.className = "cat" + (state.selectedSeriesCat === null ? " active" : "");
    all.tabIndex = 0;   /* 1.5.7: sonst ist die Kategorie per Steuerkreuz nie fokusierbar */
    all.textContent = "Alle Serien";
    all.onclick = function () { state.selectedSeriesCat = null; renderSeries(); };
    cats.appendChild(all);
    var sprefs = makeCatPrefs("series");
    sprefs.applyTo(state.seriesCategories).forEach(function (c) {
        var d = document.createElement("div");
        d.className = "cat" + (state.selectedSeriesCat === c.category_id ? " active" : "");
        d.tabIndex = 0;   /* 1.5.7: Fokus-Spieler */
        d.setAttribute("data-scat-id", c.category_id);
        d.textContent = sprefs.labelOf(c);
        d.onclick = function () { if (window.__lpFlag) return; state.selectedSeriesCat = c.category_id; renderSeries(); };
        d.ondblclick = function (ev) { ev.stopPropagation(); openCatMenu("series", c, 0); };
        cats.appendChild(d);
    });
    catHinweisZeile(cats);

    var q = (document.getElementById("series-search").value || "").toLowerCase();
    var visibleCatIds = sprefs.applyTo(state.seriesCategories).map(function (c) { return c.category_id; });
    var shown = state.seriesShows;
    if (state.selectedSeriesCat !== null) shown = shown.filter(function (s) { return s.category_id === state.selectedSeriesCat; });
    else shown = shown.filter(function (s) { return visibleCatIds.indexOf(s.category_id) >= 0; });
    if (q) shown = shown.filter(function (s) { return (s.name || "").toLowerCase().indexOf(q) >= 0; });
    state.visibleSeries = shown;

    document.getElementById("series-count").textContent = shown.length + " Serien";
    renderGridVirt(document.getElementById("series-grid"), shown, "series", function (s) {
        return '<div class="poster">' + (s.cover ? '<img src="' + esc(s.cover) + '" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">' : '<div class="poster-empty">📺</div>') + '</div>' +
            '<div class="grid-title">' + esc(s.name) + '</div>';
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
        '<div class="detail-poster">' + (m.stream_icon ? '<img src="' + esc(m.stream_icon) + '" loading="lazy" decoding="async">' : '<div class="poster-empty">🎬</div>') + '</div>' +
        '<div class="detail-info">' +
        '<button class="btn-ghost" id="md-back">← Zurück</button>' +
        '<div class="detail-title">' + esc(m.name) + '</div>' +
        '<div class="detail-meta">' + [movieYear(m), m.categoryName, rating].filter(Boolean).join(' · ') + '</div>' +
        '<div class="detail-actions">' +
        '<button class="btn-primary" id="md-play">' + (canResume ? '▶ Fortsetzen' : '▶ Abspielen') + '</button>' +
        (canResume ? '<button class="btn-ghost" id="md-restart">↺ Von vorne</button>' : '') +
        '<button class="btn-ghost" id="md-trailer" style="display:none">▶ Trailer</button>' +
        '<button class="btn-ghost" id="md-imdb">IMDb</button>' +
        '<button class="btn-ghost" id="md-fs">Filmstarts</button>' +
        '<button class="btn-ghost" id="md-watch">' + (watchHas("movie", m.stream_id) ? '✓ Gemerkt' : '☆ Merken') + '</button>' +
        '<button class="btn-ghost" id="md-fav">' + (state.favorites["movie:" + m.stream_id] ? '★ Favorit' : '☆ Favorit') + '</button>' +
        '</div>' +
        '<div class="chips" id="md-info"></div>' +
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
    /* Nur Verweise, kein Scraping (filmstarts.de sperrt /suchen/ per robots.txt) */
    document.getElementById("md-imdb").onclick = function () {
        var imdbId = this.getAttribute("data-imdb-id");
        if (imdbId) {
            showQrOverlay("IMDb — " + m.name, "https://www.imdb.com/title/" + imdbId + "/");
        } else {
            var q = encodeURIComponent(m.name + (movieYear(m) ? " " + movieYear(m) : ""));
            showQrOverlay("IMDb — " + m.name, "https://www.imdb.com/find/?q=" + q);
        }
    };
    document.getElementById("md-fs").onclick = function () {
        showQrOverlay("Filmstarts — " + m.name, "https://www.filmstarts.de/suche/?q=" + encodeURIComponent(m.name));
    };
    document.getElementById("md-watch").onclick = function () {
        watchToggle("movie", m);
        this.textContent = watchHas("movie", m.stream_id) ? '✓ Gemerkt' : '☆ Merken';
    };
    document.getElementById("md-trailer").onclick = function () {
        openTrailer(this.getAttribute("data-yt") || m.trailer, "movies");
    };
    document.getElementById("md-fav").onclick = function () {
        var k = "movie:" + m.stream_id;
        state.favorites[k] = !state.favorites[k];
        lsSet(profileScope("fav"), state.favorites);
        openMovieDetail(m);
    };

    /* IMDb-/Trailer-Zusatzinfos aus der Provider-Quelle (get_vod_info) -
       abschaltbar in den Einstellungen */
    if (lsGet("imdbinfo", "ein") === "ein") {
        (function () {
            var p2 = primaryProvider();
            xtream(p2, "get_vod_info", { stream_id: m.stream_id }).then(function (antw) {
                var box = document.getElementById("md-info");
                var trailerKopf = document.getElementById("md-trailer");
                var info = antw && antw.info ? antw.info : (antw && antw.movie_data ? antw.movie_data : null);
                if (!box) return;
                if (!info) { box.innerHTML = ""; return; }
                var teile = [];
                if (info.rating && +info.rating > 0) teile.push('<span class="chip chip-imdb">IMDb ' + esc(String(info.rating)) + '</span>');
                if (info.genre) teile.push('<span class="chip">' + esc(String(info.genre).split(",")[0]) + '</span>');
                if (info.releasedate && info.releasedate !== "n/a") teile.push('<span class="chip">' + esc(info.releasedate) + '</span>');
                else if (info.year) teile.push('<span class="chip">' + esc(info.year) + '</span>');
                if (info.duration) {
                    var dM = parseInt(info.duration, 10);
                    if (dM > 0) teile.push('<span class="chip">' + Math.floor(dM / 60) + " h " + (dM % 60) + " min</span>");
                }
                box.innerHTML = teile.join("");
                var yt = info.youtube_trailer;
                if (yt && trailerKopf) {
                    trailerKopf.style.display = "";
                    trailerKopf.setAttribute("data-yt", yt);
                }
                /* get_vod_info liefert oft auch die echte Handlung */
                var desc = document.getElementById("md-desc");
                if (desc && info.movie_plot && !desc.dataset.filled) {
                    desc.innerHTML = '<p>' + esc(String(info.movie_plot)) + '</p>';
                    desc.dataset.filled = "1";
                }
            }).catch(function () {});
        })();
    }

    if (m.tmdb) {
        fetchTmdbMovie(m.tmdb).then(function (meta) {
            if (meta && meta.overview) {
                var chips = [];
                var infoBox = document.getElementById("md-info");
                /* Bewertung: Provider-Wertung (get_vod_info) hat Vorrang,
                   sonst TMDB-Bewertung (vote_average, 10er-Skala) */
                if (infoBox && infoBox.innerHTML === "" && +meta.vote_average > 0) {
                    infoBox.innerHTML = '<span class="chip chip-imdb">★ ' + (+meta.vote_average).toFixed(1) + '</span>' +
                        '<span class="chip">' + esc((meta.genres || []).map(function (g) { return g.name || g; })[0] || "") + '</span>' +
                        (meta.runtime ? '<span class="chip">' + meta.runtime + ' min</span>' : "") +
                        '<span class="chip">TMDB</span>';
                    if (meta.imdb_id) {
                        var impBtn = document.getElementById("md-imdb");
                        if (impBtn) impBtn.setAttribute("data-imdb-id", meta.imdb_id);
                    }
                }
                if (meta.runtime) chips.push(meta.runtime + " Min");
                (meta.genres || []).slice(0, 3).forEach(function (g) { chips.push(g.name || g); });
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

function openSeriesDetail(serie) {
    show("view-series-detail");
    var el = document.getElementById("series-detail");
    el.innerHTML = '<div class="detail-layout">' +
        '<div class="detail-poster">' + (serie.cover ? '<img src="' + esc(serie.cover) + '" loading="lazy" decoding="async">' : '<div class="poster-empty">📺</div>') + '</div>' +
        '<div class="detail-info">' +
        '<button class="btn-ghost" id="sd-back">← Zurück</button>' +
        '<div class="detail-title">' + esc(serie.name) + '</div>' +
        (serie.genre ? '<div class="detail-meta">' + esc(serie.genre) + (serie.rating_5based && +serie.rating_5based > 0 ? ' · ★ ' + (+serie.rating_5based).toFixed(1) : '') + '</div>' : '') +
        (serie.plot ? '<div class="detail-desc"><p>' + esc(serie.plot) + '</p></div>' : '') +
        '<div class="detail-actions">' +
        '<button class="btn-ghost" id="sd-watch">' + (watchHas("series", serie.series_id) ? '✓ Gemerkt' : '☆ Merken') + '</button>' +
        '<span class="watch-sub" id="sd-watch-hint"></span>' +
        '</div>' +
        '<div id="sd-seasons" class="seasons"></div>' +
        '</div></div>';

    document.getElementById("sd-back").onclick = function () { show("view-home"); activateTab("series"); };
    document.getElementById("sd-watch").onclick = function () {
        var dran = watchToggle("series", serie);
        this.textContent = dran ? '✓ Gemerkt' : '☆ Merken';
        var hint = document.getElementById("sd-watch-hint");
        if (hint) hint.textContent = dran ? "Jetzt im Tab Merken" : "";
    };

    var p = primaryProvider();
    xtream(p, "get_series_info", { series_id: serie.series_id }).then(function (info) {
        var episodes = (info && info.episodes) || {};
        var seasonKeys = Object.keys(episodes).sort(function (a, b) { return (parseInt(a) || 0) - (parseInt(b) || 0); });
        var box = document.getElementById("sd-seasons");
        box.innerHTML = "";
        seasonKeys.forEach(function (sk) {
            var season = document.createElement("div");
            season.className = "season";
            var eps = (episodes[sk] || []).sort(function (a, b) { return (parseInt(a.episode_num) || 999) - (parseInt(b.episode_num) || 999); });
            season.innerHTML = '<div class="season-title"><span>Staffel ' + sk + '</span>' +
                '<button class="btn-primary small season-play">▶ Staffel abspielen</button></div>';
            eps.forEach(function (ep) {
                var row = document.createElement("div");
                row.className = "episode";
                row.innerHTML = '<span class="ep-num">S' + sk + 'E' + (ep.episode_num || "-") + '</span>' +
                    '<span class="ep-title">' + esc(ep.title || ("Episode " + ep.episode_num)) + '</span><span class="ep-play">▶</span>';
                row.onclick = function () {
                    var ext = ep.container_extension || "mp4";
                    playVod(seriesUrl(ep.id, ext), (serie.name + " S" + sk + "E" + ep.episode_num), "vod:series:" + ep.id, 0);
                };
                season.appendChild(row);
            });
            var sb = season.querySelector(".season-play");
            if (sb) sb.onclick = function () { startSeason(serie, sk, eps); };
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

    /* 6-Stunden-Fenster ab jetzt (wie Desktop 2.0.0), in halben Stunden
       gerastert, damit die Zeitachse lesbar bleibt. */
    var PX_PER_HOUR = 220;
    var FENSTER_H = 6;
    var jetztD = new Date(now);
    var startSlot = new Date(now);
    startSlot.setMinutes(jetztD.getMinutes() < 30 ? 0 : 30, 0, 0);
    var fensterStart = startSlot.getTime() - 30 * 60000;
    var fensterEnde = fensterStart + FENSTER_H * 3600000;

    var html = '<div class="epg-timebar" style="width:' + (FENSTER_H * PX_PER_HOUR) + 'px">';
    for (var h = 0; h < FENSTER_H; h++) {
        var t = new Date(fensterStart + h * 3600000);
        html += '<span style="width:' + PX_PER_HOUR + 'px">' +
            ("0" + t.getHours()).slice(-2) + ':' + ("0" + t.getMinutes()).slice(-2) + '</span>';
    }
    html += '</div>';

    var epgPrefs = makeChanPrefs();
    /* Nur Sender aus den SICHTBAREN Kategorien und nur solche, die im
       Fenster wirklich Programme haben. Vorher rendete das Raster alle
       8017 Sender: 6079 davon ohne jede EPG-Zuordnung ergaben leere
       Zeilen, das Ergebnis war 513.148 px hoch. */
    var epgVisCats = makeCatPrefs("live").applyTo(state.categories).map(function (c) { return c.category_id; });

    /* Sender-Map einmal bauen. Der alte Klick-Handler suchte bei JEDEM
       Klick linear durch alle 8017 Sender - bei 11.967 Sendungsbloecken. */
    if (!state.streamMap || state.streamMap.__n !== state.channels.length) {
        var m = { __n: state.channels.length };
        for (var si = 0; si < state.channels.length; si++) {
            m[String(state.channels[si].stream_id)] = state.channels[si];
        }
        state.streamMap = m;
    }

    /* Virtualisiert: im DOM stehen nur die sichtbaren Zeilen.
       Zwei Messungen am Geraet haben das entschieden:
       - ein einziges innerHTML mit 11.967 Bloecken blockierte 9,5 s
       - Haeppchen per setTimeout kamen nicht voran (68 Zeilen nach 6 s),
         weil webOS setTimeout drosselt
       Bei 1950 Zeilen x 64 px sind nur ~14 gleichzeitig sichtbar. Also
       wird die Senderliste nur VORBEREITET (billig) und beim Scrollen und
       Fokussieren werden die sichtbaren Zeilen gebaut. */
    el.innerHTML = "";
    var kopf = document.createElement("div");
    kopf.className = "epg-timebar-wrap";
    kopf.innerHTML = html;
    el.appendChild(kopf);

    var behaelter = document.createElement("div");
    behaelter.className = "epg-rows";
    el.appendChild(behaelter);

    var ZEILEN_H = 64;
    var sichtbare = [];
    for (var ci = 0; ci < state.channels.length; ci++) {
        var ch = state.channels[ci];
        if (epgPrefs.isHidden(ch.stream_id)) continue;
        if (epgVisCats.indexOf(ch.category_id) < 0) continue;
        var progs = (state.xmltv.byId[ch.epg_channel_id] || []);
        if (progs.length === 0 && !ch.epg_channel_id) {
            var bid = state.xmltv.byName[normName(ch.name)];
            if (bid) progs = state.xmltv.byId[bid] || [];
        }
        var eintraege = [];
        for (var pi2 = 0; pi2 < progs.length; pi2++) {
            var pr = progs[pi2];
            if (pr.stop <= fensterStart || pr.start >= fensterEnde) continue;
            eintraege.push(pr);
        }
        if (eintraege.length === 0) continue;
        sichtbare.push({ ch: ch, progs: eintraege });
    }

    state.epgRows = sichtbare;      /* fuer navEpg() */
    var zaehler = document.getElementById("epg-count");
    if (zaehler) zaehler.textContent = sichtbare.length + " Sender mit Programm";
    behaelter.style.height = (sichtbare.length * ZEILEN_H) + "px";

    var letzteVon = -1, letzteBis = -1;

    function zeileHtml(eintrag, index) {
        var ch = eintrag.ch;
        var teile = [];
        for (var k = 0; k < eintrag.progs.length; k++) {
            var pr = eintrag.progs[k];
            var von = Math.max(pr.start, fensterStart), bis = Math.min(pr.stop, fensterEnde);
            var offset = (von - fensterStart) / 3600000 * PX_PER_HOUR;
            var dur = Math.max(40, (bis - von) / 3600000 * PX_PER_HOUR);
            var isNow = pr.start <= now && pr.stop > now;
            teile.push('<div class="epg-prog' + (isNow ? " now" : "") + '" tabindex="0"' +
                ' data-sid="' + esc(ch.stream_id) + '" data-pi="' + (ch.__pi || 0) + '"' +
                ' style="left:' + offset + 'px;width:' + dur + 'px">' +
                '<div class="epg-prog-time">' + hhmm(pr.start) + '&ndash;' + hhmm(pr.stop) + '</div>' +
                '<div class="epg-prog-title">' + esc(pr.title) + '</div></div>');
        }
        return '<div class="epg-row" style="position:absolute;top:' + (index * ZEILEN_H) + 'px;left:0;right:0">' +
            '<div class="epg-chan">' + esc(ch.name) + '</div><div class="epg-progs">' + teile.join("") + '</div></div>';
    }

    function zeichneBereich() {
        var oben = el.scrollTop;
        var hoehe = el.clientHeight || 900;
        var von = Math.max(0, Math.floor(oben / ZEILEN_H) - 3);
        var bis = Math.min(sichtbare.length, von + Math.ceil(hoehe / ZEILEN_H) + 7);
        if (von === letzteVon && bis === letzteBis) return;
        letzteVon = von; letzteBis = bis;
        /* WICHTIG: die Position des Fokus VOR dem innerHTML merken. Wird
           eine Sendung fokussiert, scrollt der Browser sie in den Blick -
           das feuert scroll, ruft zeichneBereich() und innerHTML zerstoert
           genau das Element, das gerade den Fokus bekommen hat. Danach war
           activeElement BODY und die Fernbedienung lief wieder in die Tabs.
           Mit gemerktem sid wird derselbe Block nach dem Neuaufbau erneut
           fokussiert, ohne erneutes Scrollen. */
        var aktivSid = null;
        var a0 = document.activeElement;
        if (a0 && a0.getAttribute) aktivSid = a0.getAttribute("data-sid");
        var stueck = [];
        for (var z = von; z < bis; z++) stueck.push(zeileHtml(sichtbare[z], z));
        behaelter.innerHTML = stueck.join("");
        if (aktivSid) {
            var wieder = behaelter.querySelector('.epg-prog[data-sid="' + aktivSid + '"]');
            if (wieder) { try { wieder.focus(); } catch (e) {} }
        }
    }

    el.onscroll = function () { zeichneBereich(); };
    zeichneBereich();

    /* Ein Handler fuer alle Sendungen statt 11.967 einzelner. */
    el.onclick = function (ev) {
        var ziel = ev.target;
        while (ziel && ziel !== el && !(ziel.classList && ziel.classList.contains("epg-prog"))) {
            ziel = ziel.parentNode;
        }
        if (!ziel || ziel === el) return;
        var sid = ziel.getAttribute("data-sid");
        var ch2 = state.streamMap ? state.streamMap[String(sid)] : null;
        if (ch2) playLive(ch2);
    };

    /* Bildlauf auf die laufende Stunde, damit man nicht suchen muss. */
    var scroller = el.parentElement;
    if (scroller) {
        try { scroller.scrollLeft = Math.max(0, ((now - fensterStart) / 3600000) * PX_PER_HOUR - 260); } catch (e) {}
    }
}

/* =====================================================================
 *  Wiedergabe
 * ===================================================================== */

function playLive(ch) {
    pvStop();
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
    zapPrefetchAbort();   /* laufenden Warm-Up-Request sauber schliessen */
    state.currentPlayback = { url: liveUrl(ch.stream_id, ch.__pi || 0), title: ch.name, kind: "live", channelId: ch.stream_id, channel: ch };
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

/* Puffer/Cache (Paritaet zu Desktop AppSettings.cacheSeconds: Standard 3 s,
   0 = Automatik). Auf einem Fernseher entscheidet der Puffer zwischen
   ruhigem Bild und Ruckeln — deshalb einstellbar statt fest verdrahtet. */
function cacheSeconds() {
    var v = lsGet("cache_seconds", "3");
    if (v === "auto" || v === 0 || v === "0" || v === null) return 0;
    var n = parseInt(v, 10);
    if (isNaN(n)) return 3;
    return Math.max(0, Math.min(60, n));
}

function hlsConfig(kind) {
    var cs = cacheSeconds();
    /* Der Fernseher hat rund 500 MB nutzbar (frei+cache) und der JS-Heap
       endet bei 747 MB - die hls.js-Werkseinstellung (60 MB maxBufferSize,
       30 s Puffer) plus App-Heap plus DOM uebersteigt das schnell. Kleiner
       dimensionieren; der Puffer-Knopf in den Einstellungen skaliert.
       WICHTIG: maxBufferLength/maxMaxBufferLength duerfen hier nur EINMAL
       vorkommen - das Objektliteral hatte beide Keys doppelt, der zweite
       Wert (12/30) hat die Einstellung still ueberschrieben. */
    return {
        enableWorker: true,
        lowLatencyMode: false,
        /* Ruckeln zuerst an der Qualitaet abfangen statt am Bild: wenn die
           Dekodier-FPS einbricht, steuert hls.js selbst auf eine leichtere
           Stufe herunter - auf dem 2021er-TV ist das der Unterschied
           zwischen 'laeuft' und 'klebt'. */
        capLevelOnFPS: true,
        backBufferLength: 10,                       /* Live braucht keinen Rueckpuffer */
        maxBufferSize: (cs > 0 ? Math.max(12, cs * 4) : 40) * 1000 * 1000,
        maxBufferLength: cs > 0 ? Math.max(6, Math.round(cs * 1.5)) : 20,
        maxMaxBufferLength: cs > 0 ? Math.max(12, cs * 3) : 40,
        /* Der Panel-Server liefert eine WACHSENDE Playlist, deren
           MEDIA-SEQUENCE immer 0 bleibt. hls.js haelt das fuer eine
           Event-Playlist und spielt ab Segment 0 - dessen Hash ist aber
           laengst abgelaufen (403). Deshalb: nur ein Segment Abstand zum
           Live-Ende, und startPosition:-1 springt sofort dorthin (siehe
           startPlayback). */
        liveSyncDurationCount: 1,
        liveMaxLatencyDurationCount: 4,
        /* Schneller ans Bild: Manifest/Level schneller aufgeben und frueher
           neu versuchen, statt bis zu 20 s auf Default-Timeouts zu warten. */
        manifestLoadingTimeOut: 8000,
        manifestLoadingMaxRetry: 2,
        manifestLoadingRetryDelay: 400,
        levelLoadingTimeOut: 8000,
        levelLoadingMaxRetry: 3,
        levelLoadingRetryDelay: 500,
        fragLoadingTimeOut: 15000,
        fragLoadingMaxRetry: 4,
        fragLoadingRetryDelay: 500
    };
}

/* ---------------------------------------------------------------------
 *  Stillstands-Waechter (Paritaet zu Android RobustLivePlayer und dem
 *  Desktop-Player, dort 3 s).
 *
 *  Bei einem haengenden Stream kommt KEIN Player-Fehler — der Decoder
 *  steht einfach, das Bild friert ein. Ohne diesen Waechter bleibt das so,
 *  bis der Nutzer den Sender wechselt. Der Waechter prueft im Sekundentakt,
 *  ob die Wiedergabeposition weiterlaeuft.
 * ------------------------------------------------------------------- */

function startWatchdog() {
    stopWatchdog();
    state.wd.active = true;
    state.wd.lastPos = -1;
    state.wd.stillMs = 0;
    state.wd.startedAt = Date.now();
    state.wd.timer = setInterval(wdTick, 1000);
}

function stopWatchdog() {
    state.wd.active = false;
    if (state.wd.timer) { clearInterval(state.wd.timer); state.wd.timer = null; }
}

function wdTick() {
    var cb = state.currentPlayback;
    if (!state.wd.active || !cb || cb.kind !== "live") { stopWatchdog(); return; }
    var video = document.getElementById("video");
    if (!video || video.paused || video.ended) { state.wd.stillMs = 0; return; }
    /* Anlaufphase: der Puffer muss sich erst fuellen. */
    if (Date.now() - state.wd.startedAt < 15000) { state.wd.lastPos = video.currentTime; return; }

    var pos = video.currentTime;
    if (pos === state.wd.lastPos && pos > 0) {
        state.wd.stillMs += 1000;
        if (state.wd.stillMs >= 3000) {
            state.wd.stillMs = 0;
            wdReconnect();
        }
    } else {
        state.wd.stillMs = 0;
        state.wd.lastPos = pos;
    }
}

function wdReconnect() {
    var cb = state.currentPlayback;
    if (!cb) return;
    state.wd.reconnects++;
    state.wd.startedAt = Date.now();
    var video = document.getElementById("video");
    if (state.hls) {
        try { state.hls.destroy(); } catch (e) {}
        state.hls = null;
    }
    if (state.engine === "native") {
        /* Native Pipeline: Quelle neu setzen, LG-UMS baut sie frisch auf. */
        video.pause();
        video.removeAttribute("src");
        try { video.load(); } catch (e) {}
        video.src = cb.url;
        var p = video.play(); if (p && p.catch) p.catch(function () {});
        return;
    }
    var cfg = hlsConfig(cb.kind);
    cfg.startPosition = -1;                 /* sofort ans Live-Ende */
    var hls = new Hls(cfg);
    state.hls = hls;
    hls.loadSource(cb.url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, function () {
        try { hls.startLoad(-1); } catch (e) {}
        video.play().catch(function () {});
    });
    hls.on(Hls.Events.ERROR, function (evt, data) {
        if (data && data.fatal && cb.kind === "live") {
            try { data.type === Hls.ErrorTypes.NETWORK_ERROR ? hls.startLoad(-1) : hls.recoverMediaError(); } catch (e) {}
        }
    });
}

/* =====================================================================
 *  Wiedergabe-Pipeline (v1.4.0) — NATIV zuerst, hls.js als Fallback
 *
 *  SIPTV-Analyse (Homebrew-IPK siptv_3.0.3): die spielen HLS direkt im
 *  <video>-Element. webOS 6.5 packt HLS nativ (LG-UMS-Pipeline in
 *  Hardware). Auf diesem Fernseher bedeutet das, gemessen: Bild nach
 *  ~1,3 s statt ~4,8 s, kein JS-Transmuxing -> kein CPU-Druck -> kein
 *  Ruckeln, Heap bleibt flach.
 *  hls.js bleibt als Fallback, falls eine Playlist nativ scheitert.
 * ===================================================================== */

function kannNativHls() {
    try {
        var v = document.createElement("video");
        return !!(v.canPlayType("application/vnd.apple.mpegurl") || v.canPlayType("application/x-mpegURL"));
    } catch (e) { return false; }
}

function playNativ(url, cb, video, aufHls) {
    state.engine = "native";
    video.src = url;
    try { video.load && video.load(); } catch (e) {}
    var p = video.play(); if (p && p.catch) p.catch(function () {});
    if (!aufHls) return;
    /* Wenn nativ in 12 s kein Bild kommt oder ein Fehler auftaucht,
       steigen wir auf hls.js um - einmal pro Wiedergabe. */
    var erledigt = false;
    var t0 = Date.now();
    function wechsel() {
        if (erledigt) return;
        erledigt = true;
        video.pause();
        video.removeAttribute("src");
        try { video.load(); } catch (e) {}
        aufHls();
    }
    function fehlerFuer() { if (!erledigt && video.readyState < 2) wechsel(); }
    video.addEventListener("error", fehlerFuer);
    var iv = setInterval(function () {
        if (erledigt) { clearInterval(iv); video.removeEventListener("error", fehlerFuer); return; }
        if (video.readyState >= 2 || video.currentTime > 0.05) {
            /* nativ laeuft - Fallback bleibt aus */
            erledigt = true;
            clearInterval(iv);
            video.removeEventListener("error", fehlerFuer);
            return;
        }
        if (Date.now() - t0 > 12000) { clearInterval(iv); wechsel(); }
    }, 1000);
}

function playHlsJs(url, cb, video) {
    state.engine = "hlsjs";
    var cfg = hlsConfig(cb.kind);
    if (cb.kind === "live") cfg.startPosition = -1;
    else if (cb.startPosMs > 0) cfg.startPosition = cb.startPosMs / 1000 - 0.5;
    var hls = new Hls(cfg);
    state.hls = hls;
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, function () {
        /* Bild muss SOFORT kommen: startLoad(-1) laedt das letzte
           Segment der Playlist, statt vorne anzufangen und auf drei
           Segmente zu warten; zusaetzlich zieht startPosition:-1 in
           der Konfig direkt ans Live-Ende. Der Rest wird im
           Hintergrund geholt. */
        if (cb.kind === "live") { try { hls.startLoad(-1); } catch (e) {} }
        video.play().catch(function () {});
    });
    /* Bei wachsender Playlist ohne Sequenz-Fortschreibung rutscht die
       Live-Position weg. Wer mehr als 12 s hinterherhaengt, wird
       zurueckgeholt - sonst laeuft der Puffer gegen abgelaufene
       Segmente und das Bild steht. */
    hls.on(Hls.Events.LEVEL_UPDATED, function (evt, data) {
        if (cb.kind !== "live" || !data.details || !data.details.live) return;
        var ziel = hls.liveSyncPosition;
        if (ziel !== null && ziel !== undefined && video.currentTime < ziel - 12) {
            video.currentTime = ziel;
        }
    });
    hls.on(Hls.Events.ERROR, function (evt, data) {
        if (data.fatal) {
            if (cb.kind === "live") {
                if (data.type === Hls.ErrorTypes.NETWORK_ERROR) { hls.startLoad(-1); }
                else { hls.recoverMediaError(); }
            }
            else { show("view-home"); }
        }
    });
}

function startPlayback() {
    var cb = state.currentPlayback;
    show("view-player");
    document.getElementById("player-title").textContent = cb.title;
    var video = document.getElementById("video");

    if (state.hls) { try { state.hls.destroy(); } catch (e) {} state.hls = null; }
    /* Vorheriges natives Setup sauber ausraeumen */
    video.pause();
    video.removeAttribute("src");
    try { video.load(); } catch (e) {}

    var url = cb.url;

    if (cb.kind === "vod" && cb.startPosMs > 0) {
        var doSeek = function () { video.currentTime = cb.startPosMs / 1000; };
        video.addEventListener("loadedmetadata", doSeek, { once: true });
    }

    var istHls = /\.m3u8(\?|$)/.test(url);
    if (istHls && kannNativHls()) {
        playNativ(url, cb, video, function () { playHlsJs(url, cb, video); });
    } else if (istHls && window.Hls && Hls.isSupported()) {
        playHlsJs(url, cb, video);
    } else if (!istHls) {
        /* VOD: mp4 direkt in die Hardware-Pipeline */
        playNativ(url, cb, video, null);
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
            /* Abspann-Rueckfrage: 5 s vor Schluss fragen, statt stumm zur
               naechsten Folge zu springen. Zurueck-Taste bricht ab. */
            if (state.queue.length > 0 && state.queueIdx + 1 < state.queue.length &&
                video.duration > 60 && (video.duration - video.currentTime) <= 5 &&
                !state.creditsShown) {
                state.creditsShown = true;
                showCreditsHint();
            }
        };
        video.onended = function () {
            delete state.resume[cb.channelId];
            lsSet(profileScope("resume"), state.resume);
            playNextInQueue();
        };
    }

    showOsd();
    state.creditsShown = false;
    if (cb.kind === "live") startWatchdog(); else stopWatchdog();
}

/* ---------------------------------------------------------------------
 *  OSD (v1.5.0): transparent, mit Uhrzeit, EPG-Zeile, Laufzeitbalken.
 *  Live: Fortschritt im AKTUELLEN PROGRAMM, Endezeit + Rest.
 *  VOD: Position/Gesamtlaenge + Rest.
 * ------------------------------------------------------------------- */

function fmtRestMs(endMs) {
    var s = Math.max(0, Math.round((endMs - Date.now()) / 1000));
    if (s < 90) return s + " s";
    var m = Math.round(s / 60);
    if (m < 90) return m + " Min";
    return (Math.round(m / 30) / 2).toFixed(1).replace(".0", "") + " Std";
}

function fmtMs(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return (h ? h + ":" + ("0" + m).slice(-2) : String(m)) + ":" + ("0" + r).slice(-2);
}

function osdZu() {
    clearTimeout(state.osdTimer);
    clearTimeout(state.osdTicker);
    state.osdTicker = null;
    var osd = document.getElementById("osd");
    if (osd) osd.classList.add("hidden");
}

function updateOsdData() {
    var cb = state.currentPlayback;
    if (!cb) return osdZu();
    var video = document.getElementById("video");
    var bar = document.getElementById("osd-bar");
    var prog = document.getElementById("osd-progress");
    var links = document.getElementById("osd-elapsed");
    var rechts = document.getElementById("osd-remain");
    document.getElementById("osd-clock").textContent = new Date().toTimeString().slice(0, 5);

    if (cb.kind === "live") {
        var nn = cb.channel ? nowNext(cb.channel) : null;
        document.getElementById("osd-epg").innerHTML = (nn && nn.now) ? epgLine(nn.now, nn.next) : "";
        if (nn && nn.now && nn.now.stop > nn.now.start) {
            bar.classList.remove("hidden");
            var teil = (Date.now() - nn.now.start) / (nn.now.stop - nn.now.start);
            prog.style.width = Math.min(100, Math.max(0, Math.round(teil * 100))) + "%";
            links.textContent = hhmm(nn.now.start) + " – " + hhmm(nn.now.stop);
            rechts.textContent = "noch " + fmtRestMs(nn.now.stop);
        } else {
            bar.classList.add("hidden");
            links.textContent = "LIVE";
            rechts.textContent = "";
        }
    } else {
        var d = video.duration || 0, t = video.currentTime || 0;
        document.getElementById("osd-epg").innerHTML = "";
        if (d > 0) {
            bar.classList.remove("hidden");
            prog.style.width = Math.min(100, Math.round(t / d * 100)) + "%";
            links.textContent = fmtMs(t * 1000) + " von " + fmtMs(d * 1000);
            rechts.textContent = "-" + fmtMs((d - t) * 1000);
        } else {
            bar.classList.add("hidden");
            links.textContent = fmtMs(t * 1000);
            rechts.textContent = "";
        }
    }
}

function showOsd() {
    var cb = state.currentPlayback;
    if (!cb) return;
    var osd = document.getElementById("osd");
    osd.classList.remove("hidden");
    document.getElementById("osd-title").textContent = cb.title;
    clearTimeout(state.osdTimer);
    clearTimeout(state.osdTicker);
    updateOsdData();
    /* Balken laeuft im Sekundentakt mit, auch wenn nichts passiert */
    state.osdTicker = setTimeout(function tick() {
        var osd2 = document.getElementById("osd");
        if (!osd2 || osd2.classList.contains("hidden")) { state.osdTicker = null; return; }
        updateOsdData();
        state.osdTicker = setTimeout(tick, 1000);
    }, 1000);
    state.osdTimer = setTimeout(osdZu, 8000);
}

/* ---------------------------------------------------------------------
 *  Staffel-Schlange (Paritaet zu Desktop "Staffel laden")
 *  Der Fernseher hat keinen Offline-Speicher — statt herunterzuladen wird
 *  die Staffel als Schlange abgespielt: eine Folge endet, die naechste
 *  startet. Bereits zu Ende gesehene Folgen werden uebersprungen.
 * ------------------------------------------------------------------- */

function startSeason(show, seasonKey, episodes) {
    var liste = (episodes || []).slice().sort(function (a, b) {
        return (parseInt(a.episode_num) || 999) - (parseInt(b.episode_num) || 999);
    });
    if (liste.length === 0) return;
    state.queue = liste.map(function (ep) {
        return {
            id: ep.id,
            ext: ep.container_extension || "mp4",
            num: ep.episode_num,
            season: seasonKey,
            title: show.name + " S" + seasonKey + "E" + (ep.episode_num || "?")
        };
    });
    /* Erste noch nicht zu Ende gesehene Folge */
    var start = 0;
    for (var i = 0; i < state.queue.length; i++) {
        var item = state.queue[i];
        var gesehen = state.resume["vod:series:" + item.id] || 0;
        if (gesehen < 60000) { start = i; break; }
    }
    state.queueIdx = start;
    playQueueItem();
}

function playQueueItem() {
    var item = state.queue[state.queueIdx];
    if (!item) { state.queue = []; state.queueIdx = -1; show("view-home"); return; }
    var pos = state.resume["vod:series:" + item.id] || 0;
    if (pos < 30000) pos = 0;
    playVod(seriesUrl(item.id, item.ext), item.title, "vod:series:" + item.id, pos);
}

function playNextInQueue() {
    if (state.queue.length === 0 || state.queueIdx + 1 >= state.queue.length) {
        state.queue = [];
        state.queueIdx = -1;
        return;
    }
    state.queueIdx++;
    playQueueItem();
}

function showCreditsHint() {
    var hint = document.getElementById("credits-hint");
    if (!hint) {
        hint = document.createElement("div");
        hint.id = "credits-hint";
        hint.className = "credits-hint";
        document.getElementById("view-player").appendChild(hint);
    }
    var item = state.queue[state.queueIdx + 1];
    hint.innerHTML = 'Naechste Folge: <b>' + esc(item ? item.title : "") + '</b><br>' +
        '<span class="credits-sub">Zurueck-Taste bricht ab</span>';
    hint.classList.remove("hidden");
    setTimeout(function () { hint.classList.add("hidden"); }, 5000);
}

/* ---------------------------------------------------------------------
 *  QR-Overlay: der Fernseher kann keine Links oeffnen. Verweise auf
 *  IMDb / Filmstarts werden als QR-Code gezeigt und mit dem Handy gescannt.
 * ------------------------------------------------------------------- */

function showQrOverlay(titel, url) {
    document.getElementById("menu-title").textContent = titel;
    var body = document.getElementById("menu-body");
    body.innerHTML = '<div class="qr-box menu-qr" id="menu-qr-box"></div>' +
        '<div class="menu-note">' + esc(url) + '</div>';
    document.getElementById("menu-overlay").classList.remove("hidden");
    var box = document.getElementById("menu-qr-box");
    if (typeof qrcode !== "function") { box.textContent = url; return; }
    for (var v = 1; v <= 40; v++) {
        try {
            var q = qrcode(v, "M");
            q.addData(url); q.make();
            var n = q.getModuleCount(), cell = 5, tbl = document.createElement("table");
            tbl.style.borderCollapse = "collapse";
            for (var r2 = 0; r2 < n; r2++) {
                var tr = document.createElement("tr");
                for (var c = 0; c < n; c++) {
                    var td = document.createElement("td");
                    td.style.width = cell + "px"; td.style.height = cell + "px";
                    td.style.border = "none";
                    td.style.background = q.isDark(r2, c) ? "#0B0E14" : "#FFFFFF";
                    tr.appendChild(td);
                }
                tbl.appendChild(tr);
            }
            box.innerHTML = ""; box.appendChild(tbl);
            return;
        } catch (e) { /* naechste Version */ }
    }
    box.textContent = url;
}

function markWatched(id) {
    state.recent = [id].concat(state.recent.filter(function (x) { return x !== id; })).slice(0, 10);
    lsSet(profileScope("recent"), state.recent);
}

/* =====================================================================
 *  MERKEN — Watchlist (v1.5.0)
 *
 *  Filme und Serien, die interessieren, landen auf der Merkenliste.
 *  Pro Profil gespeichert. OK in einer Merk-Kachel oeffnet das Detail.
 * ===================================================================== */

function watchHas(kind, id) {
    return !!state.watch[kind + ":" + id];
}

function watchToggle(kind, obj) {
    var key = kind + ":" + (obj.stream_id || obj.series_id);
    if (state.watch[key]) {
        delete state.watch[key];
        lsSet(profileScope("watch"), state.watch);
        return false;
    }
    state.watch[key] = {
        t: kind,
        name: obj.name,
        stream_id: obj.stream_id || 0,
        series_id: obj.series_id || 0,
        container_extension: obj.container_extension || "mp4",
        stream_icon: obj.stream_icon || obj.cover || "",
        category_name: obj.category_name || obj.genre || "",
        rating_5based: obj.rating_5based || 0,
        added: Date.now()
    };
    lsSet(profileScope("watch"), state.watch);
    return true;
}

function renderWatch() {
    var grid = document.getElementById("watch-grid");
    var anz = Object.keys(state.watch).length;
    document.getElementById("watch-count").textContent = anz ? anz + " gemerkt" : "Deine Merkliste";
    grid.innerHTML = "";
    var eintraege = Object.keys(state.watch).map(function (k) { return state.watch[k]; });
    eintraege.sort(function (a, b) { return (b.added || 0) - (a.added || 0); });
    if (!eintraege.length) {
        var leer = document.createElement("div");
        leer.className = "watch-leer";
        leer.textContent = "Noch nichts gemerkt — im Film- oder Serien-Detail auf ☆ Merken druecken.";
        grid.appendChild(leer);
        return;
    }
    eintraege.forEach(function (it) {
        var el = document.createElement("div");
        var poster = it.stream_icon || "";
        el.className = "grid-item";
        el.tabIndex = 0;
        el.innerHTML = '<div class="poster">' + (poster ? '<img src="' + esc(poster) + '" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">' : '<div class="poster-empty">' + (it.t === "series" ? "📺" : "🎬") + '</div>') + '</div>' +
            '<div class="grid-title">' + esc(it.name) + '</div>' +
            '<div class="watch-badge">' + (it.t === "series" ? "Serie" : "Film") + '</div>';
        var objekt = it;
        if (it.t === "movie") {
            var m2 = null;
            for (var i = 0; i < state.vodMovies.length; i++) {
                if (String(state.vodMovies[i].stream_id) === String(it.stream_id)) { m2 = state.vodMovies[i]; break; }
            }
            if (m2) objekt = m2;
        }
        el.onclick = function () {
            if (objekt.t === "series") openSeriesDetail(objekt);
            else openMovieDetail(objekt);
        };
        grid.appendChild(el);
    });
}

/* =====================================================================
 *  VORSCHAUfenster (v1.5.0)
 *
 *  Fokus ruht 900 ms auf einem Sender -> kleines stilles Bild + die
 *  EPG-Zeile des laufenden Programms darunter, mit Fortschrittsbalken.
 *  Zwei Dekoder gehen auf diesem Geraet (Hardware-UMS-Pipeline);
 *  bleibt das Vorschaubild 6 Sekunden leer oder zeigt Fehler, greift
 *  eine Notbremse (3 x probieren, dann fuer die Sitzung aus).
 * ===================================================================== */

var PV_DWELL_MS = 900;
var PV_TIMEOUT_MS = 6000;

function vorschauEin() { return lsGet("vorschau", "ein") === "ein"; }

function pvPlan(sid) {
    if (!vorschauEin() || state.pv.fails >= 3) { pvStop(); return; }
    if (state.currentView !== "view-home" || state.tab !== "live") { pvStop(); return; }
    if (state.pv.sid === sid) return;   /* ruht schon - nichts neu */
    pvStop();
    state.pv.sid = sid;
    state.pv.timer = setTimeout(function () { pvStart(sid); }, PV_DWELL_MS);
}

function pvStart(sid) {
    var box = document.getElementById("preview-box");
    var v = document.getElementById("pv-video");
    var ch = state.visibleChans[state.chansIdx[String(sid)]];
    if (!box || !v || !ch) { pvStop(); return; }
    box.classList.remove("hidden");
    document.getElementById("pv-title").textContent = ch.name || "";
    document.getElementById("pv-epg").textContent = "Vorschau wird vorbereitet…";
    document.getElementById("pv-progress").style.width = "0%";
    v.src = liveUrl(ch.stream_id, primaryProvider());
    v.muted = true;
    var p = v.play(); if (p && p.catch) p.catch(function () {});
    var t0 = Date.now();
    clearInterval(state.pv.tick);
    state.pv.tick = setInterval(function () {
        var v2 = document.getElementById("pv-video");
        if (!v2 || state.pv.sid !== sid) { clearInterval(state.pv.tick); return; }
        var nn = nowNext(ch);
        var el = document.getElementById("pv-epg");
        var pr = document.getElementById("pv-progress");
        if (nn && nn.now) {
            el.textContent = hhmm(nn.now.start) + " " + nn.now.title + " · noch " + fmtRestMs(nn.now.stop);
            if (nn.now.stop > nn.now.start) {
                pr.style.width = Math.min(100, Math.max(0, Math.round((Date.now() - nn.now.start) / (nn.now.stop - nn.now.start) * 100))) + "%";
            }
        } else {
            el.textContent = "Keine EPG-Daten";
        }
        if (Date.now() - t0 > PV_TIMEOUT_MS && v2.readyState < 2) {
            clearInterval(state.pv.tick);
            state.pv.fails++;
            if (el) el.textContent = "Vorschau hier nicht verfuegbar.";
            pvHalt();
            state.pv.sid = null;
        }
    }, 800);
}

function pvHalt() {
    var v = document.getElementById("pv-video");
    if (!v) return;
    v.pause();
    v.removeAttribute("src");
    try { v.load(); } catch (e) {}
}

function pvStop() {
    clearTimeout(state.pv.timer);
    clearInterval(state.pv.tick);
    state.pv.timer = null;
    state.pv.tick = null;
    state.pv.sid = null;
    pvHalt();
    var box = document.getElementById("preview-box");
    if (box) box.classList.add("hidden");
}

/* Video-Fehler in der Vorschau: sofortige Notbremse */
function pvFehlerInit() {
    var v = document.getElementById("pv-video");
    if (!v) return;
    v.addEventListener("error", function () {
        if (!state.pv.sid) return;
        state.pv.fails++;
        var el = document.getElementById("pv-epg");
        if (el) el.textContent = "Vorschau hier nicht verfuegbar.";
        clearInterval(state.pv.tick);
        pvHalt();
        state.pv.sid = null;
        setTimeout(function () { if (!state.pv.sid) pvStop(); }, 1500);
    });
    v.addEventListener("playing", function () { state.pv.fails = 0; });
}

/* =====================================================================
 *  GRUPPEN-VERWALTUNG (v1.5.0)
 *
 *  Vollbild-Verwaltung: alle Gruppen markiert; mit OK wird abgewaehlt,
 *  was weg soll; "Nur markierte zeigen" blendet ALLEN Rest aus — genau
 *  der Workflow: alles markieren, nur Gewolltes auswaehlen, dann alles
 *  Unerwuenschte ausblenden. Pro Bereich (Live/Filme/Serien), gleiche
 *  Speicher wie die bisherige Farb-Tasten-Verwaltung.
 * ===================================================================== */

function gSourceCats(scope) {
    scope = scope || state.gScope;
    return scope === "movies" ? state.vodCategories
        : scope === "series" ? state.seriesCategories
        : state.categories;
}

function openGroups(scope) {
    state.gScope = scope || "live";
    show("view-groups");
    renderGroups();
    /* Fokus SOFORT auf eine Gruppen-Zeile: ohne diesen Schritt bleibt
       activeElement BODY - kein Fokus-Marker sichtbar, die erste
       Pfeiltaste springt in die Knopf-Zeile (Smarty: "focus fehlt
       komplett, ich weiss nicht wo ich bin"). */
    fokusSetzen(document.querySelector("#grp-list .grp-row"));
}

function renderGroups() {
    var scope = state.gScope;
    document.querySelectorAll("#grp-scopes .grp-nav").forEach(function (b) {
        b.classList.toggle("active", b.getAttribute("data-scope") === scope);
    });
    var prefs = makeCatPrefs(scope);
    /* Aktiven Sortiermodus an den Knöpfen markieren */
    var modus = prefs.sortMode();
    var kMap = { num: "btn-grp-num", name: "btn-grp-name", manual: "btn-grp-man" };
    ["btn-grp-num", "btn-grp-name", "btn-grp-man"].forEach(function (bid) {
        var b = document.getElementById(bid);
        if (b) b.classList.toggle("active", kMap[modus] === bid);
    });
    var cats = gSourceCats(scope);
    var list = document.getElementById("grp-list");
    list.innerHTML = "";

    /* Filme/Serien werden nachgeladen, wenn die Verwaltung vorher noch nie
       geoeffnet war (dort ist der Ladevorgang tab-gekoppelt). */
    if (!cats.length && scope !== "live" && !(scope === "movies" ? state.vodLoading : state.seriesLoading)) {
        var statusZeile = document.createElement("div");
        statusZeile.className = "grp-hint";
        statusZeile.textContent = scope === "movies" ? "Filme werden geladen…" : "Serien werden geladen…";
        list.appendChild(statusZeile);
        var loader = scope === "movies" ? loadVod() : loadSeries();
        loader.then(function () {
            if (scope === "movies") { state.vodLoading = false; renderMovies(); }
            else { state.seriesLoading = false; renderSeries(); }
            if (state.currentView === "view-groups" && state.gScope === scope) renderGroups();
        }).catch(function () {
            if (scope === "movies") state.vodLoading = false; else state.seriesLoading = false;
            statusZeile.textContent = "Laden fehlgeschlagen.";
        });
        return;
    }

    state.grpMarks = {};
    cats.forEach(function (c) {
        state.grpMarks[String(c.category_id)] = !prefs.isHidden(c.category_id);
    });

    /* Zeilen im AKTIVEN Sortiermodus zeigen (wie die echten Listen) */
    var zeilen = cats.slice();
    var m = prefs.sortMode();
    if (m === "name") {
        zeilen.sort(function (a, b) { return (a.category_name || "").localeCompare(b.category_name || "", "de"); });
    } else if (m === "manual") {
        var ord = prefs.currentOrder(cats);
        var sortiert = [];
        ord.forEach(function (id) {
            for (var q = 0; q < zeilen.length; q++) {
                if (String(zeilen[q].category_id) === String(id)) { sortiert.push(zeilen[q]); zeilen.splice(q, 1); break; }
            }
        });
        zeilen = sortiert.concat(zeilen);
    }

    var zaehler = null;
    if (scope === "live") {
        zaehler = {};
        state.channels.forEach(function (ch) {
            var k = String(ch.category_id);
            zaehler[k] = (zaehler[k] || 0) + 1;
        });
    }

    cats.forEach(function (c) {
        var id = String(c.category_id);
        /* 1.5.5: OK/Klick auf der Zeile MARKIERT direkt (und speichert
           sofort) - das erwartete Verhalten. Verwalten (Umbenennen,
           Reihenfolge-Menue) bleibt im Mehrfach-Workflow bzw. ueber
           Zeiger-Halten/Halten-FBs in den Seiten-Kategorien. */
        var row = document.createElement("div");
        row.className = "grp-row grp-nav" + (state.grpMarks[id] ? "" : " grp-off");
        row.tabIndex = 0;
        row.setAttribute("data-gid", id);
        var anzahl = zaehler ? " · " + (zaehler[id] || 0) + " Sender" : "";
        row.setAttribute("data-row-name", c.category_name || "Unbenannt");
        var name = c.category_name || "Unbenannt";
        row.textContent = (state.grpMarks[id] ? "●  " : "○  ") + name + anzahl;
        row.onclick = function () {
            var jetzt = !state.grpMarks[id];
            state.grpMarks[id] = jetzt;
            prefs.setHidden(id, !jetzt);   /* sofort speichern - "Zurueck" verliert nichts */
            row.className = "grp-row grp-nav" + (jetzt ? "" : " grp-off");
            row.textContent = (jetzt ? "●  " : "○  ") + name + anzahl;
            grpStatusZeile((jetzt ? "Ein" : "Aus") + ": " + name + " · gespeichert");
        };
        list.appendChild(row);
    });
}

function grpAllesAusblenden() {
    /* Startpunkt des inversen Workflows: ALLES ausblenden, dann die
       anzuzeigenden Gruppen markieren, BLAU (nur markierte zeigen). */
    var scope = state.gScope;
    var prefs = makeCatPrefs(scope);
    prefs.setAllHidden(gSourceCats(scope), true);   /* sofort speichern */
    Object.keys(state.grpMarks).forEach(function (k) { state.grpMarks[k] = false; });
    document.querySelectorAll("#grp-list .grp-row").forEach(function (row) {
        state.grpMarks[row.getAttribute("data-gid")] = false;
        row.className = "grp-row grp-nav grp-off";
        row.textContent = "○  " + (row.getAttribute("data-row-name") || "");
    });
    grpStatusZeile("Alle Gruppen ausgeblendet. Gruppen markieren, BLAU = nur markierte zeigen.");
    fokusSetzen(document.querySelector("#grp-list .grp-row"));
}
function grpStatusZeile(text) {
    var alt = document.querySelector("#grp-list .grp-hint.grp-status");
    if (alt) alt.remove();
    var h = document.createElement("div");
    h.className = "grp-hint grp-status";
    h.textContent = text;
    document.getElementById("grp-list").prepend(h);
}
function grpAnwenden() {
    var scope = state.gScope;
    var cats = gSourceCats(scope);
    var prefs = makeCatPrefs(scope);
    var behalten = 0;
    cats.forEach(function (c) {
        var id = String(c.category_id);
        prefs.setHidden(c.category_id, !state.grpMarks[id]);
        if (state.grpMarks[id]) behalten++;
    });
    if (scope === "live") { renderLiveCategories(); renderLiveChannels(); }
    else if (scope === "movies") renderMovies();
    else renderSeries();
    var hinweis = document.createElement("div");
    hinweis.className = "grp-hint";
    hinweis.textContent = behalten + " Gruppen sichtbar, " + (cats.length - behalten) + " ausgeblendet.";
    document.getElementById("grp-list").prepend(hinweis);
    var erste = document.querySelector("#grp-list .grp-row");
    if (erste) fokusSetzen(erste);
}

function grpAllesMarkieren() {
    var scope = state.gScope;
    var prefs = makeCatPrefs(scope);
    prefs.setAllHidden(gSourceCats(scope), false);   /* sofort speichern */
    Object.keys(state.grpMarks).forEach(function (k) { state.grpMarks[k] = true; });
    document.querySelectorAll("#grp-list .grp-row").forEach(function (row) {
        var id = row.getAttribute("data-gid");
        state.grpMarks[id] = true;
        row.className = "grp-row grp-nav";
        var name = row.getAttribute("data-row-name") || "";
        row.textContent = "●  " + name;
    });
}

function grpAlleEinblenden() {
    var scope = state.gScope;
    var prefs = makeCatPrefs(scope);
    var cats = gSourceCats(scope);
    cats.forEach(function (c) { prefs.setHidden(c.category_id, false); });
    if (scope === "live") { renderLiveCategories(); renderLiveChannels(); }
    else if (scope === "movies") renderMovies();
    else renderSeries();
    renderGroups();
}

function grpSortieren() {
    /* Re-Render im AKTUELL gespeicherten Sortiermodus. Der Modus selbst
       wird von den drei Buttons (Nummer/A-Z/Manuell) gesetzt. */
    var scope = state.gScope;
    if (scope === "live") { renderLiveCategories(); renderLiveChannels(); }
    else if (scope === "movies") renderMovies();
    else renderSeries();
    renderGroups();
    fokusSetzen(document.querySelector("#grp-list .grp-row"));
}

/* =====================================================================
 *  TRAILER (v1.5.0)
 *
 *  youtube_trailer kommt aus get_vod_info. Der Versuch laeuft als
 *  YouTube-iFrame; rendert das Geraet den nicht, bleibt der Hinweis
 *  auf den QR-Fallback. Zurueck-Taste schliesst.
 * ===================================================================== */

function openTrailer(ytId, zurueckTab) {
    state.trailerBack = zurueckTab || "movies";
    /* Detailansicht merken: Zurueck fuehrt ins Detail zurueck, nicht zur Liste */
    state.trailerFrom = (state.currentView === "view-series-detail") ? "view-series-detail" : "view-movie-detail";
    show("view-trailer");
    var frame = document.getElementById("trailer-frame");
    var id = String(ytId).replace(/^.*[?&]v=/, "").replace(/^.*youtu\.be\//, "").replace(/[&].*$/, "");
    frame.src = "https://www.youtube.com/embed/" + id + "?autoplay=1&rel=0";
    document.getElementById("btn-trailer-back").onclick = function () {
        frame.src = "";
        show(state.trailerFrom);
    };
    document.getElementById("trailer-hint").textContent = "Bild bleibt dunkel? Zurück drücken — QR-Code zum Handy!";
}

/* =====================================================================
 *  Tabs
 * ===================================================================== */

function activateTab(tab) {
    document.querySelectorAll(".tab").forEach(function (t) { t.classList.toggle("active", t.dataset.tab === tab); });
    var panes = ["live", "movies", "series", "watch", "epg", "downloads"];
    panes.forEach(function (p) {
        document.getElementById("pane-" + p).classList.toggle("hidden", p !== tab);
    });
    pvStop();
    state.tab = tab;
    /* WICHTIG: state.vodMovies startet als [] - und ![] ist in JS false.
       Die Bedingung "!state.vodMovies" war deshalb nie erfuellt und
       loadVod() wurde beim Tab-Wechsel NIE gerufen: Filme und Serien
       blieben auf dem Fernseher dauerhaft leer. Auf Laenge pruefen. */
    if (tab === "movies" && (!state.vodMovies || state.vodMovies.length === 0) && !state.vodLoading) {
        state.vodLoading = true;
        document.getElementById("movies-count").textContent = "Filme werden geladen…";
        loadVod().then(function () {
            state.vodLoading = false;
            renderMovies();
        }).catch(function (e) {
            state.vodLoading = false;
            document.getElementById("movies-count").textContent = "Fehler: " + e.message;
        });
    }
    if (tab === "watch") {
        /* Merken braucht unter Umstaenden die VOD-Daten (Poster-Feinsicht) */
        if ((!state.vodMovies || state.vodMovies.length === 0) && !state.vodLoading) {
            state.vodLoading = true;
            loadVod().then(function () { state.vodLoading = false; if (state.tab === "watch") renderWatch(); })
                .catch(function () { state.vodLoading = false; if (state.tab === "watch") renderWatch(); });
        }
        renderWatch();
    }
    if (tab === "series" && (!state.seriesShows || state.seriesShows.length === 0) && !state.seriesLoading) {
        state.seriesLoading = true;
        document.getElementById("series-count").textContent = "Serien werden geladen…";
        loadSeries().then(function () {
            state.seriesLoading = false;
            renderSeries();
        }).catch(function (e) {
            state.seriesLoading = false;
            var el2 = document.getElementById("series-count");
            if (el2) el2.textContent = "Fehler: " + e.message;
        });
    }
    if (tab === "epg") {
        if (state.xmltv) { renderEpg(); }
        else {
            document.getElementById("epg-grid").innerHTML = '<div class="epg-empty">EPG-Daten werden geladen…</div>';
            loadXmltv().then(renderEpg).catch(function () { renderEpg(); });
        }
    }
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

    /* v1.5.0: Gruppen, Vorschau, IMDb + komprimierter Systemstatus */
    var pvEl = document.getElementById("pv-status");
    if (pvEl) {
        pvEl.textContent = vorschauEin() ? "Ein" : "Aus";
        pvEl.style.color = vorschauEin() ? "#6FCF9F" : "#8FA3C8";
    }
    var imEl = document.getElementById("imdb-status");
    if (imEl) {
        imEl.textContent = lsGet("imdbinfo", "ein") === "ein" ? "Ein" : "Aus";
        imEl.style.color = lsGet("imdbinfo", "ein") === "ein" ? "#6FCF9F" : "#8FA3C8";
    }
    var grEl = document.getElementById("groups-status");
    if (grEl) {
        var liveHidden = lsGet(catK("live", "hidden"), []).length;
        var movHidden = lsGet(catK("movies", "hidden"), []).length;
        var serHidden = lsGet(catK("series", "hidden"), []).length;
        grEl.textContent = liveHidden + movHidden + serHidden ? "Gruppen ausgeblendet: " + (liveHidden + movHidden + serHidden) : "keine ausgeblendet";
    }
    var wdEl = document.getElementById("sys-status");
    if (wdEl) {
        var mg = state.memguard;
        wdEl.textContent = "Wächter " + state.wd.reconnects + "× · Speicher " +
            (mg.timer ? "aktiv" : "aus") + " · " + mg.bereinigungen + "× aufgeräumt";
    }
    var prof = state.activeProfile || "default";
    document.getElementById("about-status").textContent =
        "Smartys Player " + APP_VERSION + " (webOS) · Profil " + prof;

    /* Leitung: nur die aktive wird geladen */
    var provs = state.providers || [];
    var li = activeLineIdx();
    var ssEl = document.getElementById("screensaver-status");
    if (ssEl) {
        ssEl.textContent = state.screensaver.registriert
            ? ("blockiert · " + state.screensaver.blockiert + "× abgefangen")
            : "nicht aktiv";
        ssEl.style.color = state.screensaver.registriert ? "#6FCF9F" : "#8FA3C8";
    }
    var lineEl = document.getElementById("line-status");
    var lineBtn = document.getElementById("btn-line");
    if (lineEl) {
        if (provs.length <= 1) {
            lineEl.textContent = provs.length ? (provs[0].label || provs[0].username) : "keine";
            if (lineBtn) lineBtn.classList.add("hidden");
        } else {
            var p0 = provs[li] || {};
            lineEl.textContent = (p0.label || p0.username || "?") + "  (" + (li + 1) + " von " + provs.length + ")";
            if (lineBtn) lineBtn.classList.remove("hidden");
        }
    }
}

/* Puffer-Regler: seit 1.4.0 spielt die native UMS-Pipeline die Live-Streams.
   Die Stufen sind nur noch fuer den hls.js-Fallback wirksam und sind
   bewusst NICHT mehr als Einstellungs-Knopf sichtbar. */

/* =====================================================================
 *  Speicherwaechter (v1.3.0)
 *
 *  Auf dem OLED65C17LB werden Apps bei knappem Speicher vom System
 *  beendet — der Nutzer sieht dann einfach wieder das TV-Bild, ohne
 *  Fehlermeldung. Also selber aufraeumen, BEVOR das System zuschlaegt.
 *
 *  Messkanaele (ein System-API ist mit einer Web-App nicht erreichbar):
 *  1) performance.memory: JS-Heap gegen sein Limit (747 MB)
 *  2) DOM-Knotenzahl: die native Seite des Speichers, die der Heap nicht
 *     sieht (Bilder, Layout-Objekte)
 *
 *  Alle 10 Sekunden, Hintergrund, ohne Unterbrechung. Die Wiedergabe
 *  (video/hls) wird NIE angefasst. Geraeumt wird: DOM nicht sichtbarer
 *  Ansichten (Daten bleiben, Beim-Betreten-Neu-Rendern laeuft ueber
 *  show() -> homeViewsFrisch()), Detail-HTML der verdeckten Detailseiten.
 *  Kritisch zusaetzlich: das EPG-Datenobjekt verwerfen - es ist der
 *  groesste Heap-Block und laedt sich verzoegert von allein neu.
 * ===================================================================== */

var MEM_WEICH_PCT = 62;      /* Heap-Anteil: sanfte Bereinigung */
var MEM_KRITISCH_PCT = 82;   /* harte Bereinigung */
var MEM_WEICH_NODES = 15000;
var MEM_KRITISCH_NODES = 40000;

function heapQuotePct() {
    return (window.performance && performance.memory && performance.memory.jsHeapSizeLimit)
        ? Math.round(performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit * 100)
        : -1;
}

function memCleanup(stufe) {
    var tab = state.tab || "live";
    var imPlayer = state.currentView === "view-player";
    var zuHause = state.currentView === "view-home";

    /* DOM der VERDECKTEN Ansichten leeren. Die aktive Ansicht bleibt
       stehen, damit der Nutzer nichts bemerkt. */
    if (!zuHause || tab !== "live") {
        var lc = document.getElementById("live-channels");
        if (lc) lc.innerHTML = "";
        var lk = document.getElementById("live-categories");
        if (lk && !zuHause) lk.innerHTML = "";
    }
    if (!zuHause || tab !== "movies") {
        var mg = document.getElementById("movies-grid");
        if (mg) mg.innerHTML = "";
    }
    if (!zuHause || tab !== "series") {
        var sg = document.getElementById("series-grid");
        if (sg) sg.innerHTML = "";
    }
    if (!zuHause || tab !== "epg") {
        var eg = document.getElementById("epg-grid");
        if (eg) eg.innerHTML = "";
    }
    /* Detailansichten: enthalten grosse Poster; nur leeren, wenn verdeckt */
    if (state.currentView !== "view-movie-detail") {
        var md = document.getElementById("movie-detail");
        if (md) md.innerHTML = "";
    }
    if (state.currentView !== "view-series-detail") {
        var sd = document.getElementById("series-detail");
        if (sd) sd.innerHTML = "";
    }
    /* Verdecktes Menue-Overlay */
    var ov = document.getElementById("menu-overlay");
    if (ov && ov.classList.contains("hidden")) {
        var mb = document.getElementById("menu-body");
        if (mb) mb.innerHTML = "";
    }

    if (stufe >= 2) {
        /* EPG verwerfen (groesster Datenblock). Im Player loescht das
           nur das OSD-Material; das Bild laeuft weiter. Nach einer
           Beruhigungsphase laedt es der Timer unten still neu. */
        state.xmltv = null;
        state.epgRows = null;
        var mg = state.memguard;
        if (mg.reloadTimer) clearTimeout(mg.reloadTimer);
        mg.reloadTimer = setTimeout(function () {
            if (!state.xmltv) loadXmltv().then(function () {
                if (state.tab === "epg" && state.currentView === "view-home") renderEpg();
            }).catch(function () {});
        }, 60000);
    }

    state.memguard.bereinigungen++;
    state.memguard.stufe = stufe;
    var mg2 = state.memguard;
    mg2.letztePct = heapQuotePct();
    mg2.letzteNodes = document.querySelectorAll("*").length;
    mg2.letzte = Date.now();
}

function memguardTick() {
    var pct = heapQuotePct();
    var nodes = -1;
    try { nodes = document.querySelectorAll("*").length; } catch (e) {}
    var mg = state.memguard;
    mg.letztePct = pct;
    mg.letzteNodes = nodes;

    var kritisch = (pct >= 0 && pct >= MEM_KRITISCH_PCT) || (nodes > 0 && nodes > MEM_KRITISCH_NODES);
    var weich = (pct >= 0 && pct >= MEM_WEICH_PCT) || (nodes > 0 && nodes > MEM_WEICH_NODES);
    if (kritisch) memCleanup(2);
    else if (weich) memCleanup(1);
}

/* Nach dem Zurueckkehren auf die Hauptansicht sicherstellen, dass die
   Listen nach einer Hintergrund-Bereinigung wieder da stehen. Die
   Render-Funktionen sind virtualisiert und billiger geworden (je ~20
   DOM-Zeilen), deshalb geht das bedenkenlos bei jedem Wechsel. */
function homeViewsFrisch() {
    if (state.channels && state.channels.length) {
        var lc = document.getElementById("live-channels");
        if (!lc || lc.childElementCount === 0) renderLiveChannels();
        var lk = document.getElementById("live-categories");
        if (!lk || lk.childElementCount === 0) renderLiveCategories();
    }
    var tab = state.tab;
    if (tab === "movies" && state.vodMovies && state.vodMovies.length) {
        var mg = document.getElementById("movies-grid");
        /* Zellen-Render waehrend Verdeckung, wenn Zellen existieren aber 0 px hoch
           sind (Render-Lauf waehrend die Seite versteckt war). */
        var mZ = mg ? mg.querySelector(".grid-item") : null;
        if (!mg || !mg.childElementCount || !mZ || mZ.offsetHeight === 0) renderMovies();
    }
    if (tab === "series" && state.seriesShows && state.seriesShows.length) {
        var sg = document.getElementById("series-grid");
        /* wie movies - 0-px-Zellen erkennen und neu rendern. */
        var sZ = sg ? sg.querySelector(".grid-item") : null;
        if (!sg || !sg.childElementCount || !sZ || sZ.offsetHeight === 0) renderSeries();
    }
    if (tab === "epg") {
        var eg = document.getElementById("epg-grid");
        var leer = !eg || eg.childElementCount === 0;
        if (state.xmltv) { if (leer) renderEpg(); }
        else if (leer) {
            eg.innerHTML = '<div class="epg-empty">EPG-Daten werden geladen…</div>';
            loadXmltv().then(renderEpg).catch(function () { renderEpg(); });
        }
    }
}

function memGuardStart() {
    if (state.memguard.timer) return;
    state.memguard.timer = setInterval(memguardTick, 10000);
}

/* =====================================================================
 *  Sofort-Start-Cache (v1.3.1) — IndexedDB
 *
 *  SIPTV-Gefuehl: Beim zweiten Start ist die Senderliste SOFORT da. Wir
 *  tun genau das: nach jedem erfolgreichen Laden landen Sender und
 *  Kategorien in IndexedDB. Beim Start steht die UI aus dem Cache,
 *  das Netz frischt im Hintergrund nach; gerenderte Listen werden
 *  lautlos neu gezeichnet (Fokus und Scrollposition bleiben erhalten).
 * ===================================================================== */

function idbKasse() {
    return new Promise(function (res, rej) {
        var rq = indexedDB.open("smartys-cache", 1);
        rq.onupgradeneeded = function () { rq.result.createObjectStore("kv"); };
        rq.onsuccess = function () { res(rq.result); };
        rq.onerror = function () { rej(rq.error); };
    });
}
function idbSet(key, wert) {
    return idbKasse().then(function (db) {
        return new Promise(function (res, rej) {
            var tx = db.transaction("kv", "readwrite");
            tx.objectStore("kv").put(wert, key);
            tx.oncomplete = res;
            tx.onerror = function () { rej(tx.error); };
        });
    }).catch(function () {});
}
function idbHolen(key) {
    return idbKasse().then(function (db) {
        return new Promise(function (res, rej) {
            var rq = db.transaction("kv").objectStore("kv").get(key);
            rq.onsuccess = function () { res(rq.result || null); };
            rq.onerror = function () { rej(rq.error); };
        });
    }).catch(function () { return null; });
}

function cacheKey() {
    var p = primaryProvider();
    return "lines|" + (p ? (p.server_url || "") + "|" + p.username : "none");
}

function cacheSpeichern() {
    try {
        idbSet(cacheKey(), {
            at: Date.now(),
            channels: state.channels,
            categories: state.categories,
            vodCategories: state.vodCategories,
            seriesCategories: state.seriesCategories
        });
    } catch (e) {}
}

/* UI aus dem Cache fuellen. true = gueltige Daten lagen vor. */
function cacheLaden() {
    return idbHolen(cacheKey()).then(function (c) {
        if (!c || !c.channels || !c.channels.length) return false;
        state.channels = c.channels;
        state.categories = c.categories || [];
        state.vodCategories = c.vodCategories || [];
        state.seriesCategories = c.seriesCategories || [];
        var cnt = document.getElementById("live-count");
        if (cnt) cnt.textContent = state.channels.length + " Sender";
        renderLiveCategories();
        renderLiveChannels();
        return true;
    });
}

/* =====================================================================
 *  Zap-Prefetch (v1.3.1)
 *
 *  Wenn der Fokus auf einem Sender ruht (der Finger schwebt kurz ueber
 *  OK), holen wir die erste Playlist schon an. Der Anbieter startet
 *  seinen Stream-Prozess und der TCP-Weg ist warm - beim Klick ist das
 *  Bild dann deutlich frueher da. Abbruch nach den ersten Bytes, damit
 *  kein echter Datenstrom laeuft.
 * ===================================================================== */

var zapVor = { timer: null, xhr: null, sid: null };

function zapPrefetchAbort() {
    if (zapVor.timer) { clearTimeout(zapVor.timer); zapVor.timer = null; }
    if (zapVor.xhr) { try { zapVor.xhr.abort(); } catch (e) {} zapVor.xhr = null; }
}

function zapPrefetch(sid) {
    var idx = state.chansIdx[String(sid)];
    if (idx === undefined) return;
    var ch = state.visibleChans[idx];
    if (!ch || zapVor.sid === String(sid)) return;
    zapPrefetchAbort();
    zapVor.timer = setTimeout(function () {
        zapVor.timer = null;
        zapVor.sid = String(sid);
        var x = new XMLHttpRequest();
        zapVor.xhr = x;
        x.onprogress = function () {
            if (x.responseText && x.responseText.length > 300) {
                try { x.abort(); } catch (e) {}
                zapVor.xhr = null;
            }
        };
        /* Nach 6 s aufraeumen, auch wenn der Server schlaeft. */
        setTimeout(function () {
            if (zapVor.xhr === x) { try { x.abort(); } catch (e) {} zapVor.xhr = null; }
        }, 6000);
        try { x.open("GET", liveUrl(ch.stream_id, ch.__pi || 0)); x.send(); } catch (e) {}
    }, 220);
}

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
    /* Identität EINMAL asynchron ermitteln (Plattform-APIs) — der komplette
     * App-Start (startFlow und damit alle Views) hängt daran, damit Pairing-
     * Anzeige/QR und die AAD-gebundene Entschlüsselung nie eine leere ID sehen. */
    ensureIdentity().then(startFlow);

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
    screenSaverWaechter();
    document.getElementById("btn-settings").onclick = renderSettings;
    document.getElementById("btn-settings-back").onclick = function () { show("view-home"); };
    memGuardStart();
    var btnLine = document.getElementById("btn-line");
    if (btnLine) {
        btnLine.onclick = function () {
            var provs = state.providers || [];
            if (provs.length < 2) return;
            lsSet("active_line", (activeLineIdx() + 1) % provs.length);
            renderSettings();
            loadAll();     /* erst jetzt wird die andere Leitung geladen */
        };
    }
    document.getElementById("btn-profile").onclick = function () { show("view-profiles"); renderProfiles(); };

    /* v1.5.0: Gruppen, Vorschau, IMDb-Zusatzinfos */
    document.getElementById("btn-groups").onclick = function () { openGroups("live"); };
    document.getElementById("btn-groups-back").onclick = function () { renderSettings(); };
    document.getElementById("btn-pv").onclick = function () {
        lsSet("vorschau", vorschauEin() ? "aus" : "ein");
        if (!vorschauEin()) pvStop();
        renderSettings();
    };
    document.getElementById("btn-imdb").onclick = function () {
        lsSet("imdbinfo", lsGet("imdbinfo", "ein") === "ein" ? "aus" : "ein");
        renderSettings();
    };
    document.getElementById("btn-grp-all").onclick = grpAllesMarkieren;
    document.getElementById("btn-grp-apply").onclick = grpAnwenden;
    document.getElementById("btn-grp-hideall").onclick = grpAllesAusblenden;
    document.getElementById("btn-grp-multi").onclick = function () {
        /* Startet mit dem IST-Zustand: nach "Alles ausblenden" nichts
           markiert (Gruppen markieren = die zeigen), nach GELB alles
           markiert (abwaehlen was weg). BLAU wendet an. */
        var prefs = makeCatPrefs(state.gScope);
        var cs = gSourceCats(state.gScope);
        menuState.marked = cs.filter(function (c) { return !prefs.isHidden(c.category_id); })
            .map(function (c) { return c.category_id; });
        openCatMenu(state.gScope, cs[0], 1);
    };
    document.getElementById("btn-grp-show").onclick = grpAlleEinblenden;
    document.getElementById("btn-grp-num").onclick = function () {
        makeCatPrefs(state.gScope).setSortMode("num"); grpSortieren();
    };
    document.getElementById("btn-grp-name").onclick = function () {
        makeCatPrefs(state.gScope).setSortMode("name"); grpSortieren();
    };   /* A–Z */
    document.getElementById("btn-grp-man").onclick = function () {
        makeCatPrefs(state.gScope).setSortMode("manual"); grpSortieren();
    };
    document.querySelectorAll("#grp-scopes .grp-nav").forEach(function (b) {
        b.onclick = function () { openGroups(b.getAttribute("data-scope")); };
    });
    pvFehlerInit();

    /* Gruppen-Navigation: Hoch/Runter ueber Zonen (globaler
       Handler kennt bislang nur die Home-Ansichten). */
    window.grpZonen = function () {
        var vis = function (sel) {
            return Array.prototype.slice.call(document.querySelectorAll(sel)).filter(function (e) {
                return e.offsetParent !== null;
            });
        };
        return [
            vis("#grp-scopes .grp-nav"),
            vis("#grp-actions .grp-nav"),
            vis("#grp-list .grp-row")
        ];
    };
    /* VERTIKAL in der Gruppen-Verwaltung: Zonen-Reihenfolge
       Bereiche -> Werkzeug-Knoepfe -> Gruppenliste. IN der Liste bewegt
       Hoch/Runter die Zeilen (das war kaputt: vor 1.5.5 hielt der Fokus
       bei jeder Aktion in der obersten Zeile - genau "kann mit dem
       Steuerkreuz nicht durch die Gruppen gehen"). UP aus der
       Listen-Oberzeile ueber in die Knopf-Reihe. */
    window.navGrp = function (delta) {
        var z = grpZonen();
        var ae = document.activeElement;
        var zi = -1, pos = -1;
        for (var q = 0; q < z.length; q++) {
            var i = z[q].indexOf(ae);
            if (i >= 0) { zi = q; pos = i; break; }
        }
        if (zi < 0) { fokusSetzen(z[2][0] || z[1][0] || z[0][0]); return true; }
        if (zi === 2) {
            var nRow = pos + delta;
            if (nRow >= 0 && nRow < z[2].length) { fokusSetzen(z[2][nRow]); return true; }
            if (nRow < 0 && z[1].length) { fokusSetzen(z[1][0]); return true; }
            return true;
        }
        var ziel = z[zi + delta];
        if (ziel && ziel.length) { fokusSetzen(ziel[pos < ziel.length ? pos : 0]); return true; }
        if (zi === 1 && delta > 0 && z[2].length) { fokusSetzen(z[2][0]); return true; }
        return true;
    };

    /* 1.5.6: EINSTELLUNGEN — die Ansicht hatte bislang weder
       Initialfokus noch Hoch/Runter (LEFT/RIGHT war bewusst still). Der
       Nutzer stand im Nichts ("keine fokus ... kann es nicht bedienen").
       navSettings läuft die aktionierbaren Elemente (Öffnen/Umschalten/
       Zurück/PIN) linear im DOM ab, scrollIntoView inklusive. */
    window.navSettings = function (delta) {
        var rows = fokusListe("settings");
        if (!rows.length) return true;
        var i = rows.indexOf(document.activeElement);
        if (i < 0) { fokusSetzen(rows[0]); return true; }
        var n = i + delta;
        if (n >= 0 && n < rows.length) fokusSetzen(rows[n]);
        return true;
    };
    /* HORIZONTAL: innerhalb der Knopf-Zeilen (Scopes, Werkzeuge); in der
       Gruppenliste ist links/rechts untaetig - die Liste ist einspaltig
       und der Fokus haengt sonst falsch weiter. */
    window.navGrpX = function (delta) {
        var z = grpZonen();
        var ae = document.activeElement;
        for (var q = 0; q < z.length; q++) {
            var i = z[q].indexOf(ae);
            if (i < 0) continue;
            if (q === 2) return true;   /* Gruppenliste: einspaltig */
            var n = i + delta;
            if (n >= 0 && n < z[q].length) fokusSetzen(z[q][n]);
            return true;
        }
        return true;
    };


    /* Farbtasten + Menü-Taste in der GRUPPEN-Verwaltung (view-groups):
       GELB alles markieren, BLAU nur markierte zeigen, GRÜN/ROT
       Gruppe hoch/runter (Modus "manual"), MENÜ = Einzeln-Menü
       (Umbenennen, Sortier-Zyklus, Einzeln ausblenden). */
    document.addEventListener("keydown", function (e) {
        if (state.currentView !== "view-groups") return;
        var row = document.activeElement && document.activeElement.classList &&
            document.activeElement.classList.contains("grp-row") ? document.activeElement : null;
        var scope = state.gScope;
        var prefs = makeCatPrefs(scope);
        var cats = gSourceCats(scope);
        if (e.keyCode === 405) { e.preventDefault(); grpAllesMarkieren(); return; }
        if (e.keyCode === 406) { e.preventDefault(); grpAnwenden(); return; }
        if (row) {
            var gid = row.getAttribute("data-gid");
            var catObj = null;
            for (var z = 0; z < cats.length; z++) if (String(cats[z].category_id) === String(gid)) { catObj = cats[z]; break; }
            if (!catObj) return;
            if (e.keyCode === 409) { e.preventDefault(); prefs.moveUp(catObj.category_id, cats); renderGroups(); }
            else if (e.keyCode === 403) { e.preventDefault(); prefs.moveDown(catObj.category_id, cats); renderGroups(); }
            else if (e.keyCode === 13 || e.keyCode === 29443) {
                /* 1.5.5: OK = markieren/abwaehlen (sofort gespeichert).
                   Kein Halten, kein Menue - die Original-Fernbedienung
                   sendet kein key-repeat, und Verwalten laeuft ueber
                   Mehrfach-Markieren bzw. den Workflow-Knoepfen. */
                if (e.repeat) { e.preventDefault(); return; }
                e.preventDefault();
                row.click();
            }
        }
    }, true);

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

    var liveSearch = document.getElementById("live-search");
    if (liveSearch) {
        liveSearch.oninput = function () {
            state.liveQuery = this.value;
            renderLiveChannels();
        };
    }
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
            else if (state.currentView === "view-trailer") {
                document.getElementById("trailer-frame").src = "";
                show(state.trailerFrom || "view-home");
                e.preventDefault();
            }
            else if (state.currentView === "view-groups") { renderSettings(); e.preventDefault(); }
            else if (state.currentView === "view-movie-detail" || state.currentView === "view-series-detail" || state.currentView === "view-settings") {
                show("view-home"); e.preventDefault();
            }
        }
    });

    // Menu-Taste (LG: 275 / webOS: 10248) → Verwaltuns-Overlay
    document.addEventListener("keydown", function (e) {
        if (e.keyCode === 275 || e.keyCode === 10248 || e.keyCode === 1536 ||
            e.key === "ContextMenu" || e.key === "Unidentified" ||
            e.key === "Info" || e.key === "Settings") {
            var ok = false;
            try { ok = onMenuKey(); } catch (err) { ok = false; }
            if (ok) e.preventDefault();
        }
    });

    /* =================================================================
     *  Farbtasten in der Kategorie-Verwaltung
     *
     *  GELB schaltet die Kategorie unter dem Fokus ein/aus, BLAU schaltet
     *  alle auf einmal. Beides baute die Liste vorher NICHT neu auf, und
     *  pickCats zeigte nur die sichtbaren Kategorien - eine ausgeblendete
     *  war damit fuer immer weg. Jetzt bleibt sie sichtbar (○) und der
     *  Fokus bleibt auf der Zeile stehen, statt nach oben zu springen.
     * ================================================================= */
    window.fokusAufCat = function (catId) {
        if (!catId) return;
        var el = document.querySelector('#menu-body [data-cat-id="' + catId + '"]');
        if (el) {
            try { el.focus(); } catch (e) {}
            if (el.scrollIntoView) { try { el.scrollIntoView({ block: "nearest" }); } catch (e) {} }
        }
    };

    document.addEventListener("keydown", function (e) {
        var overlay = document.getElementById("menu-overlay");
        if (!overlay || overlay.classList.contains("hidden")) return;
        var scope = menuState.scope;
        if (scope !== "live" && scope !== "movies" && scope !== "series") return;
        if (e.keyCode !== 405 && e.keyCode !== 406) return;   /* GELB / BLAU */

        var cats = scope === "live" ? state.categories
            : (scope === "movies" ? state.vodCategories : state.seriesCategories);
        var prefs = makeCatPrefs(scope);
        var el = document.activeElement;
        var catId = el ? el.getAttribute("data-cat-id") : null;

        if (e.keyCode === 405) {
            if (!catId) return;
            e.preventDefault();
            prefs.toggle(catId);
        } else {
            e.preventDefault();
            prefs.setAllHidden(cats, !prefs.allHidden(cats));
        }
        menuRefresh();
        pickCats(scope, cats);
        window.fokusAufCat(catId);
    }, true);

    /* =================================================================
     *  Fernbedienungs-Navigation
     *
     *  webOS bewegt den Fokus NICHT selbst. Am Geraet gemessen: das
     *  Steuerkreuz liefert keydown 38/40, aber document.activeElement
     *  bleibt auf BODY. Ohne eigenes Fokus-Management ist die App nur
     *  mit der Maus der Magic Remote bedienbar - genau das war der
     *  Zustand bis 1.2.5.
     *
     *  Hoch/Runter laeuft in der aktuellen Spalte, Links/Rechts wechselt
     *  die Spalte (Tabs -> Kategorien -> Sender). Bei 370 Kategorien waere
     *  eine reine DOM-Reihenfolge unbrauchbar.
     * ================================================================= */
    window.fokusGruppe = function (el) {
        if (!el || el === document.body) return null;
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return "search";
        if (el.closest(".menu-overlay:not(.hidden)")) return "menu";
        if (el.closest(".tabs")) return "tabs";
        if (el.closest(".topbar-right")) return "topbar";
        if (el.closest("#live-categories")) return "cats";
        if (el.closest("#live-channels")) return "chans";
        if (el.closest(".sidebar")) return "vcats";
        if (el.closest(".grid")) return "grid";
        if (el.closest("#epg-grid")) return "epg";
        return null;
    }

    window.fokusListe = function (gruppe) {
        var sel = {
            tabs: ".tabs .tab",
            search: ".pane:not(.hidden) .search",
            topbar: ".topbar-right button",
            cats: "#live-categories .cat",
            chans: "#live-channels .ch",
            vcats: ".pane:not(.hidden) .sidebar .cat",
            grid: ".pane:not(.hidden) .grid-item",
            epg: "#epg-grid .epg-prog",
            settings: "#view-settings .btn-ghost:not(.hidden), #view-settings .btn-primary:not(.hidden), #view-settings .settings-btn:not(.hidden)",
            menu: ".menu-overlay:not(.hidden) .menu-btn, .menu-overlay:not(.hidden) .menu-item, .menu-overlay:not(.hidden) input"
        }[gruppe];
        if (!sel) return [];
        return Array.prototype.slice.call(document.querySelectorAll(sel)).filter(function (e) {
            return e.offsetParent !== null;
        });
    }

    window.fokusSetzen = function (el) {
        if (!el) return false;
        try { el.focus(); } catch (e) { return false; }
        if (el.scrollIntoView) { try { el.scrollIntoView({ block: "nearest" }); } catch (e) {} }
        return true;
    }

    window.ersterFokus = function () {
        var kandidaten = ["tabs", "cats", "chans", "vcats", "grid", "epg"];
        for (var i = 0; i < kandidaten.length; i++) {
            var l = fokusListe(kandidaten[i]);
            if (l.length) return fokusSetzen(l[0]);
        }
        return false;
    }

    window.navVertikal = function (delta) {
        if (state.currentView === "view-groups") return navGrp(delta);
        if (state.currentView === "view-settings") return navSettings(delta);   /* 1.5.6 */
        var gruppe0 = fokusGruppe(document.activeElement);
        if (gruppe0 === "epg") return navEpg(delta, true);
        /* 1.5.1: TAB-Zeile / TOPLAST ist horizontal organisiert.
           Hoch/Runter fuehrt sofort in den INHALT (bzw. von der Topbar
           runter in die Tabs) statt zusaetzlich durch die Tab-Zeile zu
           wandern - genau das, was Smarty vermisst hat. */
        if (gruppe0 === "tabs" || gruppe0 === "topbar") {
            if (gruppe0 === "topbar" && delta < 0) delta = -1;
            var ziel0 = gruppe0 === "topbar" ? "tabs"
                : (state.tab === "live" || !state.tab) ? "cats" : "vcats";
            var l0 = fokusListe(ziel0);
            if (l0.length) { fokusSetzen(delta < 0 && gruppe0 === "topbar" ? l0[0] : l0[0]); return true; }
            return true;
        }
        if (gruppe0 === "chans") return navChans(delta);
        if (gruppe0 === "grid") return navGrid(state.tab === "series" ? "series" : "movies", delta, true);
        var el = document.activeElement;
        var gruppe = fokusGruppe(el);
        if (!gruppe) return ersterFokus() || true;   /* true = Taste verbraucht */
        var liste = fokusListe(gruppe);
        if (!liste.length) return false;
        var i = liste.indexOf(el);
        if (i < 0) { fokusSetzen(delta > 0 ? liste[0] : liste[liste.length - 1]); return true; }
        var ziel = i + delta;
        if (ziel < 0 || ziel >= liste.length) {
            /* Am Rand der Spalte: in die naechste Zeile wechseln.
               WICHTIG (1.5.1): das Suchfeld ist Absicht NICHT mehr Teil der
               Pfeil-Kette. Es liess sich per Hoch/Runter nicht mehr verlassen
               (Inputs frassen die Pfeiltasten) und Smarty sass fest.
               Das Suchfeld erreicht man NUR noch per Klick/Zeiger - und es
               hat einen eigenen Escape (Back/Hoch/Runter, siehe unten). */
            var senkrecht = {
                topbar: "tabs",
                tabs: (state.tab === "live" || !state.tab) ? "chans" : "grid",
                cats: "tabs",
                vcats: "tabs"
            };
            var ng = senkrecht[gruppe];
            if (ng) {
                var nl = fokusListe(ng);
                if (nl.length) {
                    fokusSetzen(delta > 0 ? nl[0] : nl[nl.length - 1]);
                    return true;
                }
            }
            return true;
        }
        fokusSetzen(liste[ziel]);
        return true;
    }

    /* Eigene Navigation im Programm-Raster.
       Die gewoehnliche Spalten-Navigation springt linear durch die Liste
       aller Sendungen - im EPG ist das unbrauchbar: rechts/links muss
       innerhalb der Zeile wandern, hoch/runter in die Nachbarzeile bei
       aehnlicher Uhrzeit. Ausserdem fehlte "epg" in der Gruppen-Reihenfolge,
       sodass jede Pfeiltaste auf ersterFokus() (die Tabs) zurueckfiel. */
    function navEpg(delta, vertikal) {
        var a = document.activeElement;
        if (!a || !a.classList || !a.classList.contains("epg-prog")) return false;
        var zeile = a.closest ? a.closest(".epg-row") : null;
        if (!zeile) return false;
        var el = document.getElementById("epg-grid");

        if (!vertikal) {
            var progs = zeile.querySelectorAll(".epg-prog");
            var i = Array.prototype.indexOf.call(progs, a);
            var ziel = i + delta;
            if (ziel >= 0 && ziel < progs.length) { fokusSetzen(progs[ziel]); }
            return true;      /* am Zeilenrand: halten, nicht in die Tabs */
        }

        /* Vertikal: eine Zeile weiter, Sendung mit aehnlicher Startzeit.
           Ueber den Zeilenindex rechnen, nicht ueber scrollTop: nach dem
           Scrollen rendert zeichneBereich() neu und stellt die ALTE Sendung
           per data-sid wieder her - eine Suche nach "aehnliches left" fand
           dann genau diese alte Sendung und der Fokus blieb stehen. */
        var ZEILEN_H = 64;
        var reihen = state.epgRows || [];
        if (!reihen.length) return true;
        var idx = Math.round((parseFloat(zeile.style.top) || 0) / ZEILEN_H);
        var zielIdx = idx + delta;
        if (zielIdx < 0 || zielIdx >= reihen.length) return true;   /* Rand: halten */

        /* Zielzeile in den Blick bringen */
        var zielTop = zielIdx * ZEILEN_H;
        var sichtOben = el.scrollTop;
        var sichtHoehe = el.clientHeight || 900;
        if (zielTop < sichtOben + ZEILEN_H) {
            el.scrollTop = Math.max(0, zielTop - ZEILEN_H);
        } else if (zielTop > sichtOben + sichtHoehe - 2 * ZEILEN_H) {
            el.scrollTop = zielTop - sichtHoehe + 2 * ZEILEN_H;
        }
        if (el.onscroll) el.onscroll();

        /* In der Zielzeile die Sendung mit der aehnlichsten Startzeit */
        var links = parseFloat(a.style.left) || 0;
        var zielZeile = null;
        var zeilen = el.querySelectorAll(".epg-row");
        for (var z = 0; z < zeilen.length; z++) {
            if (Math.abs((parseFloat(zeilen[z].style.top) || 0) - zielTop) < 1) { zielZeile = zeilen[z]; break; }
        }
        if (!zielZeile) return true;
        var kandidaten = zielZeile.querySelectorAll(".epg-prog");
        var best = null, bestDiff = Infinity;
        for (var k = 0; k < kandidaten.length; k++) {
            var l2 = parseFloat(kandidaten[k].style.left) || 0;
            var diff = Math.abs(l2 - links);
            if (diff < bestDiff) { bestDiff = diff; best = kandidaten[k]; }
        }
        if (best) { try { best.focus(); } catch (e) {} }
        return true;
    }

    window.navHorizontal = function (delta) {
        var gruppe0 = fokusGruppe(document.activeElement);
        if (gruppe0 === "epg") return navEpg(delta, false);
        /* 1.5.1: In der TAB-Zeile muss links/rechts die TABS wechseln
           (Seitenwechsel am Steuerkreuz), nicht in die Spalten springen.
           Erst am Zeilenrand wandert der Fokus in die Spalten daneben. */
        if (gruppe0 === "tabs") {
            var tl = fokusListe("tabs");
            var ti = tl.indexOf(document.activeElement);
            var tz = ti + delta;
            if (tz >= 0 && tz < tl.length) { fokusSetzen(tl[tz]); return true; }
            if (delta > 0) {
                /* 1.5.5: rechts hinter dem letzten Tab liegen die
                   Einstellungs-Buttons (Downloads | Einstellungen) - der
                   RIGHT-Lauf durchquert jetzt die komplette Topbar-Zeile
                   statt in die Gruppen-Spalte abzuknicken. */
                var tb = fokusListe("topbar");
                if (tb.length) { fokusSetzen(tb[0]); return true; }
                return true;
            }
            var sp = (state.tab === "live" || !state.tab) ? "cats" : "vcats";
            var l0 = fokusListe(sp);
            if (l0.length) { fokusSetzen(l0[0]); return true; }
            return true;
        }
        if (gruppe0 === "topbar") {
            var bl = fokusListe("topbar");
            var bi = bl.indexOf(document.activeElement);
            var bz = bi + delta;
            if (bz >= 0 && bz < bl.length) { fokusSetzen(bl[bz]); return true; }
            if (delta > 0) {
                /* rechts am Rand: in das Suchfeld des aktiven Pane */
                var sf = document.querySelector(".pane:not(.hidden) .search");
                if (sf) { fokusSetzen(sf); return true; }
                return true;
            }
            var t0 = fokusListe("tabs");
            if (t0.length) { fokusSetzen(t0[t0.length - 1]); return true; }
            return true;
        }
        /* Gruppen-Verwaltung / Einstellungen: links/rechts keine
           Spaltenwechsel - die Pfeiltasten dort sind untaetig, alles
           laeuft hoch/runter. */
        if (state.currentView === "view-groups") return navGrpX(delta);   /* 1.5.4 */
        if (state.currentView === "view-settings") return true;
        if (gruppe0 === "grid") return navGrid(state.tab === "series" ? "series" : "movies", delta, false);
        var el = document.activeElement;
        var gruppe = fokusGruppe(el);
        var reihenfolge = gruppe === "menu" ? ["menu"]
            : (state.tab === "live" || !state.tab) ? ["tabs", "cats", "chans"]
            : ["tabs", "vcats", "grid"];
        if (gruppe === "topbar") reihenfolge = ["tabs", "topbar"];
        if (!gruppe) return ersterFokus() || true;
        var pos = reihenfolge.indexOf(gruppe);
        if (pos < 0) return ersterFokus() || true;
        for (var schritt = 1; schritt < reihenfolge.length; schritt++) {
            var p = pos + delta * schritt;
            if (p < 0 || p >= reihenfolge.length) break;
            var l = fokusListe(reihenfolge[p]);
            if (l.length) { fokusSetzen(l[0]); return true; }
        }
        return true;
    }

    document.addEventListener("keydown", function (e) {
        if (state.currentView === "view-player") return;   /* im Player nicht eingreifen */
        /* In einem Eingabefeld gehoeren die Pfeiltasten dem Text bzw. der
           Bildschirmtastatur, nicht der Navigation. */
        var ae = document.activeElement;
        if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) return;
        var k = e.keyCode;
        if (k === 38) { if (navVertikal(-1)) e.preventDefault(); }
        else if (k === 40) { if (navVertikal(1)) e.preventDefault(); }
        else if (k === 37) { if (navHorizontal(-1)) e.preventDefault(); }
        else if (k === 39) { if (navHorizontal(1)) e.preventDefault(); }
    }, true);

    /* =================================================================
     *  1.5.1 FLUCHT AUS EINGABEFELDERN
     *  In einem Input frassen Pfeiltasten nur den Cursor, und Back tat
     *  nichts - Smarty sass im Suchfeld fest. Jetzt gilt in JEDEM Feld
     *  (Suche, Umbenennen, PIN in den Einstellungen; NICHT PIN-Gate):
     *  Back/Taste = Feld verlassen + aktiven Tab fokussieren,
     *  Hoch/Runter = Feld verlassen + in die Tab-Zeile bzw. Liste.
     *  Links/Rechts bleibt beim Text-Cursor.
     * ================================================================= */
    document.addEventListener("keydown", function (e) {
        var ae = document.activeElement;
        if (!ae || (ae.tagName !== "INPUT" && ae.tagName !== "TEXTAREA")) return;
        if (state.currentView === "view-unlock") return;   /* PIN-Gate: Feld behaelt Fokus */
        var k = e.keyCode;
        var isBack = k === 10009 || k === 461 || k === 27;
        /* 1.5.5: RECHTS im Suchfeld geht raus zu den Einstellungs-
           Buttons (Downloads | Einstellungen | Suchfeld Ring der
           Topbar-Zeile). Links/Up/Back/Down wie bisher raus. */
        if (k === 39 && ae.classList && ae.classList.contains("search")) {
            e.preventDefault();
            e.stopPropagation();
            ae.blur();
            var tbr = fokusListe("topbar");
            if (tbr.length) fokusSetzen(tbr[0]);
            return;
        }
        if (k !== 38 && k !== 40 && !isBack) return;
        e.preventDefault();
        e.stopPropagation();
        ae.blur();
        if (state.currentView === "view-groups") { fokusSetzen(document.querySelector("#grp-list .grp-row")); return; }
        if (state.currentView === "view-settings") {
            var sv = fokusListe("settings");
            if (sv.length) fokusSetzen(sv[0]);
            return;
        }
        if (isBack || k === 38) {
            var t = document.querySelector(".tabs .tab.active") || document.querySelector(".tabs .tab");
            fokusSetzen(t);
        } else {
            var ziel = (state.tab === "live" || !state.tab) ? "chans" : "grid";
            var l = fokusListe(ziel);
            if (l.length) fokusSetzen(l[0]);
        }
    }, true);

    /* Menue-Buttons: Enter explizit behandeln und die Propagierung
       stoppen. Auf einem <button> feuert Enter nativ ein click(), aber
       weitere keydown-Handler (Player-OSD, Menue-Taste) liefen ebenfalls
       und setzten menuState zurueck - danach war menuState.cat null und
       "Nach unten" tat nichts mehr. */
    document.addEventListener("keydown", function (e) {
        if (e.keyCode !== 13 && e.keyCode !== 29443) return;
        var el = document.activeElement;
        if (!el || !el.classList || !el.classList.contains("menu-btn")) return;
        if (el.disabled) { e.preventDefault(); e.stopPropagation(); return; }
        e.preventDefault();
        e.stopPropagation();
        el.click();
    }, true);

    /* Enter/OK auf einem fokussierten <div>: der Browser klickt nur
       echte Buttons und Links. Kategorien und Sender sind divs, also
       muss der Klick hier ausgeloest werden.
       1.5.1 LANGE DRUCK: OK HALTEN (key-repeat) auf einer GRUPPE oeffnet
       das Untermenue (Desktop-Praezedenz: kurzer Druck = anwaehlen,
       langer Druck = verwalten/ausblenden). Nur das ERSTE keydown
       aktivieren, repeats fuehren ins Menue statt Klick-Reihen. */
    document.addEventListener("keydown", function (e) {
        if (e.keyCode !== 13 && e.keyCode !== 29443) return;
        var el = document.activeElement;
        if (!el) return;
        /* innerhalb des Gruppen-Menues gilt OK direkt (markieren, Buttons);
           das Halten-Menue nur in den SEITEN-Kategorien. Original-FBs
           senden kein repeat: dort bleibt OK = waehlen, das Menue kommt
           aus Einstellungen bzw. Zeiger-Langpress. */
        if (el.closest && el.closest("#menu-body")) { el.click(); return; }
        if (el.classList.contains("cat")) {
            if (e.repeat) { katMenueVonEl(el); return; }
            e.preventDefault();
            e.stopPropagation();
            el.click();
            return;
        }
        if (el.classList.contains("ch") || el.classList.contains("grid-item")) {
            e.preventDefault();
            el.click();
        }
    });
    /* Pointer-Variante: Zeiger 550 ms auf einer Gruppe halten = Menue;
       der dann folgende Klick wird unterdrueckt (__lpFlag). */
    document.addEventListener("pointerdown", function (ev) {
        if (state.currentView !== "view-home") return;
        var c = ev.target && ev.target.closest ? ev.target.closest(".cat") : null;
        if (!c) return;
        window.__lpKat = c;
        window.__lpTimer = setTimeout(function () {
            window.__lpFlag = true;
            katMenueVonEl(window.__lpKat);
            setTimeout(function () { window.__lpFlag = false; }, 400);
        }, 550);
    }, true);
    function lpAbbrechen() {
        clearTimeout(window.__lpTimer);
        /* Nach einem Longpress den folgenden Klick abfangen: das Flag
           bleibt bis kurz nach dem pointerup-Click stehen. */
        if (window.__lpFlag) {
            setTimeout(function () { window.__lpFlag = false; }, 350);
        }
    }
    document.addEventListener("pointerup", lpAbbrechen, true);
    document.addEventListener("pointercancel", lpAbbrechen, true);
    document.addEventListener("pointermove", function (ev) {
        if (ev.movementX || ev.movementY) lpAbbrechen();
    }, true);

    /* Gruppen-Untermenue von einem Kategorie-Element aus oeffnen
       (live: data-cat-id in #live-categories; filme/serien: data-mcat-id /
       data-scat-id in der Sidebar). */
    window.katMenueVonEl = function (el) {
        if (!el || !el.getAttribute) return;
        var catId = el.getAttribute("data-cat-id") || el.getAttribute("data-mcat-id") || el.getAttribute("data-scat-id");
        if (!catId) return;
        var scope = el.closest("#live-categories") ? "live" :
            el.getAttribute("data-mcat-id") ? "movies" : "series";
        var cats = scope === "live" ? state.categories :
            scope === "movies" ? state.vodCategories : state.seriesCategories;
        for (var i = 0; i < cats.length; i++) {
            if (String(cats[i].category_id) === String(catId)) { openCatMenu(scope, cats[i], 0); return; }
        }
    };

    // OK-Taste im Player = OSD togglen
    document.addEventListener("keydown", function (e) {
        /* Enter auf einer fokussierten EPG-Sendung startet den Sender.
           tabIndex allein reicht nicht: ein <div> loest bei Enter keinen
           Klick aus. */
        if (e.keyCode === 13 || e.keyCode === 29443) {
            var ael = document.activeElement;
            if (ael && ael.classList && ael.classList.contains("epg-prog")) {
                e.preventDefault();
                e.stopPropagation();
                ael.click();
                return;
            }
        }
        if (state.currentView === "view-player" && (e.keyCode === 13 || e.keyCode === 29443)) {
            var osd = document.getElementById("osd");
            if (osd.classList.contains("hidden")) showOsd(); else osd.classList.add("hidden");
        }
    });

    /* startFlow() läuft oben über ensureIdentity().then(startFlow) */
}

function stopPlayback() {
    stopWatchdog();
    osdZu();
    state.queue = [];
    state.queueIdx = -1;
    state.creditsShown = false;
    var hint = document.getElementById("credits-hint");
    if (hint) hint.classList.add("hidden");
    if (state.hls) { try { state.hls.destroy(); } catch (e) {} state.hls = null; }
    var video = document.getElementById("video");
    video.pause();
    video.removeAttribute("src");
    video.load();
    state.currentPlayback = null;
}

document.addEventListener("DOMContentLoaded", init);
