"use strict";

/* =====================================================================
 *  Smartys IPTV — Player-Identität v1  (js/identity.js)
 *
 *  Implementiert die verbindliche Spezifikation PLAYER-IDENTITY.md
 *  (liegt im übergeordneten Ordner "Smartys Player/"). Diese Datei ist
 *  im Tizen- und im webOS-Repo IDENTISCH zu halten.
 *
 *  Ableitung (Spezifikation):
 *      digest = SHA-256( UTF-8("smartys-iptv-player-id-v1|" + seed) )
 *      b      = digest[0..5]
 *      b[0]   = (b[0] & 0xFC) | 0x02          // lokal administriert + Unicast
 *      id     = b als "XX:XX:XX:XX:XX:XX"     // UPPERCASE, Doppelpunkte
 *
 *  Auflösungsreihenfolge:
 *      1. vorhandene localStorage-"player_id" — unantastbar, NIE ändern
 *      2. Identitäts-Spiegel (Datei im App-Datenordner) — Gedächtnis, kein Cache
 *      3. Ableitung aus Hardware-Merkmalen (hw-v1), sofern ein geräteeindeutiges
 *         Merkmal (duid/nduid) lesbar ist
 *      4. Zufall (random) — sonst, wie bisher
 *
 *  Keine externen Abhängigkeiten: SHA-256 nutzt WebCrypto (crypto.subtle,
 *  in Tizen/webOS vorhanden), eingebettete reine-JS-Implementierung als
 *  Fallback. derivePlayerId liefert daher ein Promise (WebCrypto ist
 *  asynchron) — der Wert ist deterministisch und testbar.
 *
 *  ES5-only (alte TV-WebKit-Kerne): kein let/const/arrow/async.
 * ===================================================================== */

(function (root) {

    var NAMESPACE = "smartys-iptv-player-id-v1";
    var MIRROR_FILENAME = "smartys-identity.json";
    var TIZEN_MIRROR_PATH = "wgt-private/" + MIRROR_FILENAME;

    /* ------------------------------------------------------------------
     *  UTF-8-Kodierung (TextEncoder fehlt auf alten TV-WebKit-Kernen)
     * ------------------------------------------------------------------ */

    function utf8Encode(str) {
        var out = [], i, cp, lo;
        for (i = 0; i < str.length; i++) {
            cp = str.charCodeAt(i);
            if (cp >= 0xD800 && cp <= 0xDBFF && i + 1 < str.length) {
                lo = str.charCodeAt(i + 1);
                if (lo >= 0xDC00 && lo <= 0xDFFF) {
                    cp = 0x10000 + ((cp - 0xD800) << 10) + (lo - 0xDC00);
                    i++;
                }
            }
            if (cp < 0x80) {
                out.push(cp);
            } else if (cp < 0x800) {
                out.push(0xC0 | (cp >> 6), 0x80 | (cp & 0x3F));
            } else if (cp < 0x10000) {
                out.push(0xE0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
            } else {
                out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F),
                         0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
            }
        }
        return new Uint8Array(out);
    }

    /* ------------------------------------------------------------------
     *  SHA-256 — eingebettete reine-JS-Implementierung (FIPS 180-4).
     *  Nur Fallback, falls crypto.subtle fehlt; über tools/test_identity.js
     *  gegen node:crypto verifiziert.
     * ------------------------------------------------------------------ */

    var SHA256_K = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    function rotr(x, n) {
        return ((x >>> n) | (x << (32 - n))) >>> 0;
    }

    function sha256Embedded(bytes) {
        var h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a,
            h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
        var l = bytes.length;
        var blockCount = Math.ceil((l + 9) / 64);
        var padded = new Uint8Array(blockCount * 64);
        padded.set(bytes);
        padded[l] = 0x80;
        /* 64-Bit-Bitlänge big-endian (l < 2^53, daher exakt) */
        var hi = Math.floor(l / 0x20000000);                 /* l / 2^29  */
        var lo = (l - hi * 0x20000000) * 8;                  /* (l % 2^29) * 8 */
        padded[padded.length - 8] = (hi >>> 24) & 0xFF;
        padded[padded.length - 7] = (hi >>> 16) & 0xFF;
        padded[padded.length - 6] = (hi >>> 8) & 0xFF;
        padded[padded.length - 5] = hi & 0xFF;
        padded[padded.length - 4] = (lo >>> 24) & 0xFF;
        padded[padded.length - 3] = (lo >>> 16) & 0xFF;
        padded[padded.length - 2] = (lo >>> 8) & 0xFF;
        padded[padded.length - 1] = lo & 0xFF;

        var w = new Array(64);
        var a, b, c, d, e, f, g, hh, i, j, s0, s1, S0, S1, ch, maj, t1, t2;

        for (i = 0; i < padded.length; i += 64) {
            for (j = 0; j < 16; j++) {
                w[j] = ((padded[i + j * 4] << 24) | (padded[i + j * 4 + 1] << 16) |
                        (padded[i + j * 4 + 2] << 8) | padded[i + j * 4 + 3]) >>> 0;
            }
            for (j = 16; j < 64; j++) {
                s0 = (rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3)) >>> 0;
                s1 = (rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10)) >>> 0;
                w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
            }
            a = h0; b = h1; c = h2; d = h3; e = h4; f = h5; g = h6; hh = h7;
            for (j = 0; j < 64; j++) {
                S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
                ch = ((e & f) ^ (~e & g)) >>> 0;
                t1 = (hh + S1 + ch + SHA256_K[j] + w[j]) >>> 0;
                S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
                maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
                t2 = (S0 + maj) >>> 0;
                hh = g; g = f; f = e; e = (d + t1) >>> 0;
                d = c; c = b; b = a; a = (t1 + t2) >>> 0;
            }
            h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
            h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + hh) >>> 0;
        }

        var hs = [h0, h1, h2, h3, h4, h5, h6, h7];
        var out = new Uint8Array(32);
        for (i = 0; i < 8; i++) {
            out[i * 4] = (hs[i] >>> 24) & 0xFF;
            out[i * 4 + 1] = (hs[i] >>> 16) & 0xFF;
            out[i * 4 + 2] = (hs[i] >>> 8) & 0xFF;
            out[i * 4 + 3] = hs[i] & 0xFF;
        }
        return out;
    }

    var forceEmbedded = false; /* Test-Hook: tools/test_identity.js */

    function hasWebCrypto() {
        return !!(root.crypto && root.crypto.subtle && typeof root.crypto.subtle.digest === "function");
    }

    /* SHA-256(bytes) -> Promise<Uint8Array(32)> */
    function sha256(bytes) {
        if (!forceEmbedded && hasWebCrypto()) {
            return root.crypto.subtle.digest("SHA-256", bytes).then(function (buf) {
                return new Uint8Array(buf);
            });
        }
        return Promise.resolve(sha256Embedded(bytes));
    }

    /* ------------------------------------------------------------------
     *  derivePlayerId(seed) -> Promise<String>
     *  Reine Ableitung nach Spezifikation (Testvektor s. PLAYER-IDENTITY.md).
     * ------------------------------------------------------------------ */

    function derivePlayerId(seed) {
        var input = NAMESPACE + "|" + (seed == null ? "" : String(seed));
        return sha256(utf8Encode(input)).then(function (digest) {
            var b = digest.slice(0, 6);          /* Kopie — digest bleibt unangetastet */
            b[0] = (b[0] & 0xFC) | 0x02;
            var parts = [];
            for (var i = 0; i < 6; i++) {
                parts.push(("0" + b[i].toString(16).toUpperCase()).slice(-2));
            }
            return parts.join(":");
        });
    }

    /* ------------------------------------------------------------------
     *  Zufall (nur Stufe 4 — Verhalten wie bisherige App-Versionen)
     * ------------------------------------------------------------------ */

    function randomBytes(n) {
        var b = new Uint8Array(n), i;
        if (root.crypto && typeof root.crypto.getRandomValues === "function") {
            root.crypto.getRandomValues(b);
        } else {
            for (i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 256);
        }
        return b;
    }

    function randomPlayerId() {
        var b = randomBytes(6);
        b[0] = (b[0] & 0xFE) | 0x02; /* wie bisherige App-Versionen */
        var parts = [], i;
        for (i = 0; i < 6; i++) parts.push(("0" + b[i].toString(16).toUpperCase()).slice(-2));
        return parts.join(":");
    }

    function genPairingPw() {
        var CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
        var b = randomBytes(12), out = "", i;
        for (i = 0; i < 12; i++) out += CHARS[((b[i] % CHARS.length) + CHARS.length) % CHARS.length];
        return out;
    }

    /* ------------------------------------------------------------------
     *  Timeout-Wrapper: Plattform-APIs dürfen den App-Start nie blockieren.
     *  factory(done) startet die Arbeit, done(value) liefert sie ab.
     * ------------------------------------------------------------------ */

    function withTimeout(factory, ms, cb) {
        var finished = false;
        var timer = setTimeout(function () {
            if (!finished) { finished = true; cb(null); }
        }, ms);
        try {
            factory(function (value) {
                if (!finished) { finished = true; clearTimeout(timer); cb(value); }
            });
        } catch (e) {
            if (!finished) { finished = true; clearTimeout(timer); cb(null); }
        }
    }

    /* ------------------------------------------------------------------
     *  Hardware-Merkmale
     *
     *  Tizen : DUID   — webapis.productinfo.getDuid() (offiziell, synchron),
     *                   Fallback tizen.systeminfo.getPropertyValue("DUID")
     *          Modell — webapis.productinfo.getModel()
     *  webOS : nduid  — Luna-Settings-Dienst (PalmServiceBridge /
     *                   webOS.service.request), Fallback PalmSystem
     *          Modell — PalmSystem.deviceInfo.modelName
     *
     *  Fehlende Teile fallen WEG (kein leerer Anhang, sonst wäre die
     *  Ableitung nicht reproduzierbar). Feste Reihenfolge:
     *      Tizen:  "duid=<wert>|model=<wert>"
     *      webOS:  "nduid=<wert>|model=<wert>"
     * ------------------------------------------------------------------ */

    function detectPlatform() {
        if (typeof root.tizen !== "undefined" && root.tizen) return "tizen";
        if (typeof root.webapis !== "undefined" && root.webapis) return "tizen";
        if (typeof root.PalmSystem !== "undefined" && root.PalmSystem) return "webos";
        if (typeof root.PalmServiceBridge !== "undefined") return "webos";
        return "unknown"; /* Browser-Entwicklung/Emulator ohne Plattform-APIs */
    }

    function cleanId(v) {
        if (v == null) return null;
        var s = String(v);
        if (typeof v === "object") {
            s = String(v.duid || v.DUID || v.nduid || v.value || v.id || "");
        }
        s = s.replace(/^\s+|\s+$/g, "");
        return s ? s : null;
    }

    function tizenDuid(cb) {
        var pi = null;
        try { pi = (root.webapis && root.webapis.productinfo) || null; } catch (e) { pi = null; }
        try {
            if (pi && typeof pi.getDuid === "function") {
                var d = pi.getDuid();
                if (d) { cb(cleanId(d)); return; }
            }
        } catch (e) { /* Privileg/Plattform fehlt → nächste Quelle */ }
        withTimeout(function (done) {
            var si = null;
            try { si = (root.tizen && root.tizen.systeminfo) || null; } catch (e) { si = null; }
            if (si && typeof si.getPropertyValue === "function") {
                si.getPropertyValue("DUID",
                    function (v) { done(cleanId(v)); },
                    function () { done(null); });
                return;
            }
            done(null);
        }, 2500, cb);
    }

    function tizenModel() {
        try {
            if (root.webapis && root.webapis.productinfo &&
                typeof root.webapis.productinfo.getModel === "function") {
                return cleanId(root.webapis.productinfo.getModel());
            }
        } catch (e) { /* ohne Privileg: Weglassen */ }
        return null;
    }

    function webosDeviceInfo() {
        try {
            var di = root.PalmSystem && root.PalmSystem.deviceInfo;
            if (!di) return null;
            if (typeof di === "string") return JSON.parse(di);
            if (typeof di === "object") return di;
        } catch (e) { /* egal */ }
        return null;
    }

    function deepFindString(obj, key) {
        var seen = [];
        function walk(o) {
            var k, v, r;
            if (!o || typeof o !== "object") return null;
            for (k in o) {
                if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
                v = o[k];
                if (k === key && typeof v === "string" && v) return v;
                if (typeof v === "object" && v !== null && seen.indexOf(v) < 0) {
                    seen.push(v);
                    r = walk(v);
                    if (r) return r;
                }
            }
            return null;
        }
        return walk(obj);
    }

    /* Luna-Bus-Aufruf: webOSTV.js falls geladen, sonst nativer PalmServiceBridge. */
    function lunaCall(uri, method, params, timeoutMs, done) {
        withTimeout(function (finish) {
            try {
                if (root.webOS && root.webOS.service &&
                    typeof root.webOS.service.request === "function") {
                    root.webOS.service.request(uri, {
                        method: method,
                        parameters: params,
                        subscribe: false,
                        onSuccess: function (res) { finish(res || null); },
                        onFailure: function () { finish(null); }
                    });
                    return;
                }
                if (typeof root.PalmServiceBridge === "function") {
                    var bridge = new root.PalmServiceBridge();
                    bridge.onservicecallback = function (msg) {
                        var parsed = null;
                        try { parsed = (typeof msg === "string") ? JSON.parse(msg) : msg; } catch (e) { parsed = null; }
                        try { if (bridge.cancel) bridge.cancel(); } catch (e2) { /* egal */ }
                        finish(parsed);
                    };
                    bridge.call(uri + "/" + method, JSON.stringify(params));
                    return;
                }
            } catch (e) { /* Plattform-API nicht verfügbar */ }
            finish(null);
        }, timeoutMs, done);
    }

    function webosLegacyNduid() {
        var di;
        try {
            if (root.PalmSystem && root.PalmSystem.deviceUID) {
                return cleanId(root.PalmSystem.deviceUID);
            }
        } catch (e) { /* egal */ }
        di = webosDeviceInfo();
        return (di && deepFindString(di, "nduid")) || null;
    }

    function webosNduid(cb) {
        /* Bekannte Settings-Dienst-Varianten (LG-TV und webOS-OSE), Reihefolge fest. */
        var candidates = [
            { uri: "luna://com.webos.settingsservice", params: { keys: ["nduid"] } },
            { uri: "luna://com.webos.service.settings", params: { keys: ["nduid"] } },
            { uri: "luna://com.webos.service.settings", params: { category: "general", key: "nduid" } }
        ];
        (function next(i) {
            if (i >= candidates.length) { cb(webosLegacyNduid()); return; }
            lunaCall(candidates[i].uri, "getSystemSettings", candidates[i].params, 1500, function (res) {
                var v = res ? deepFindString(res, "nduid") : null;
                if (v) { cb(cleanId(v)); return; }
                next(i + 1);
            });
        })(0);
    }

    function webosModel() {
        var di = webosDeviceInfo();
        if (!di) return null;
        return cleanId(di.modelName || deepFindString(di, "modelName"));
    }

    /* deviceSeed() -> Promise<String> ("", wenn nichts lesbar) */
    function deviceSeed() {
        var plat = detectPlatform();
        if (plat === "tizen") {
            return new Promise(function (resolve) {
                tizenDuid(function (duid) {
                    var parts = [];
                    if (duid) parts.push("duid=" + duid);
                    var model = tizenModel();
                    if (model) parts.push("model=" + model);
                    resolve(parts.join("|"));
                });
            });
        }
        if (plat === "webos") {
            return new Promise(function (resolve) {
                webosNduid(function (nduid) {
                    var parts = [];
                    if (nduid) parts.push("nduid=" + nduid);
                    var model = webosModel();
                    if (model) parts.push("model=" + model);
                    resolve(parts.join("|"));
                });
            });
        }
        return Promise.resolve("");
    }

    /* Ein Seed ohne geräteeindeutiges Merkmal (duid/nduid) darf NICHT abgeleitet
     * werden: model-only kollidierte zwischen allen Geräten desselben Modells. */
    function seedHasUniquePart(seed) {
        return typeof seed === "string" &&
            (seed.indexOf("duid=") === 0 || seed.indexOf("|duid=") !== -1 ||
             seed.indexOf("nduid=") === 0 || seed.indexOf("|nduid=") !== -1);
    }

    /* ------------------------------------------------------------------
     *  Identitäts-Spiegel
     *  Tizen : tizen.filesystem, Datei im privaten App-Datenordner
     *         (wgt-private) — überlebt App-Update.
     *         Neue Pfad-API (openFile, seit Tizen 5.0) bevorzugt,
     *         Alt-API (resolve/openStream) als Fallback.
     *  webOS : Web-Apps haben KEINE Datei-API (kein Node, kein FS-Zugriff).
     *         Spiegel entfällt → nur localStorage (Einschränkung, siehe
     *         PLAYER-IDENTITY.md: webOS überlebt nur App-Update).
     * ------------------------------------------------------------------ */

    function mirrorSupported() {
        return detectPlatform() === "tizen";
    }

    function parseMirror(text) {
        if (!text) return null;
        try {
            var o = JSON.parse(text);
            if (o && typeof o === "object" && typeof o.player_id === "string" && o.player_id) {
                return {
                    player_id: o.player_id,
                    pairing_pw: (typeof o.pairing_pw === "string") ? o.pairing_pw : "",
                    player_id_source: (typeof o.player_id_source === "string") ? o.player_id_source : ""
                };
            }
        } catch (e) { /* korrupt/leer → wie nicht vorhanden */ }
        return null;
    }

    function tizenMirrorRead(done) {
        var fs = null;
        try { fs = (root.tizen && root.tizen.filesystem) || null; } catch (e) { fs = null; }
        if (!fs) { done(null); return; }
        try {
            if (typeof fs.openFile === "function") {
                var fh = fs.openFile(TIZEN_MIRROR_PATH, "r"); /* NotFoundError, wenn Datei fehlt */
                var text = fh.readString();
                try { fh.close(); } catch (e2) { /* egal */ }
                done(parseMirror(text));
                return;
            }
        } catch (e) { done(null); return; }
        try {
            fs.resolve(TIZEN_MIRROR_PATH, function (file) {
                try {
                    file.readAsText(function (text) { done(parseMirror(text)); },
                                    function () { done(null); });
                } catch (e2) { done(null); }
            }, function () { done(null); }, "r");
        } catch (e) { done(null); }
    }

    function tizenMirrorWrite(data, done) {
        var fs = null;
        try { fs = (root.tizen && root.tizen.filesystem) || null; } catch (e) { fs = null; }
        if (!fs) { done(false); return; }
        var json = JSON.stringify(data);
        try {
            if (typeof fs.openFile === "function") {
                var fh = fs.openFile(TIZEN_MIRROR_PATH, "w"); /* "w" legt die Datei an */
                fh.writeString(json);
                try { fh.close(); } catch (e2) { /* egal */ }
                done(true);
                return;
            }
        } catch (e) { done(false); return; }
        try {
            fs.resolve(TIZEN_MIRROR_PATH, function (file) {
                try {
                    file.openStream("w", function (stream) {
                        try {
                            stream.write(json);
                        } finally {
                            try { stream.close(); } catch (e2) { /* egal */ }
                        }
                        done(true);
                    }, function () { done(false); }, "UTF-8");
                } catch (e3) { done(false); }
            }, function () { done(false); }, "w");
        } catch (e) { done(false); }
    }

    function mirrorRead() {
        if (!mirrorSupported()) return Promise.resolve(null);
        return new Promise(function (resolve) {
            withTimeout(tizenMirrorRead, 2500, resolve);
        });
    }

    function mirrorWrite(data) {
        if (!mirrorSupported()) return Promise.resolve(false);
        return new Promise(function (resolve) {
            withTimeout(function (done) { tizenMirrorWrite(data, done); }, 2500, resolve);
        });
    }

    /* ------------------------------------------------------------------
     *  resolveIdentity({ get, set }) -> Promise<{playerId, pairingPw, source}>
     *
     *  get(key)/set(key, value) sind der localStorage-Adapter der App.
     *  Reihenfolge: gespeicherte ID (unantastbar) → Spiegel → Ableitung
     *  → Zufall. Danach Spiegel aktualisieren, außer dort steht bereits
     *  eine ANDERE ID (Spiegel = Gedächtnis, kein Cache).
     * ------------------------------------------------------------------ */

    function resolveIdentity(opts) {
        var get = function (k) { try { return opts.get(k); } catch (e) { return null; } };
        var set = function (k, v) { try { opts.set(k, v); } catch (e) { /* voll/gesperrt */ } };

        var existingId = get("player_id");

        var step;
        if (existingId) {
            /* Stufe 1: vorhandene ID — NIE ändern, auch player_id_source nicht anfassen */
            step = Promise.resolve({ id: existingId, source: get("player_id_source") || null, isNew: false });
        } else {
            step = mirrorRead().then(function (m) {
                if (m && m.player_id) {
                    /* Stufe 2: Spiegel übernehmen (inkl. Pairing-PW, wenn verloren) */
                    return { id: m.player_id, source: "mirror", isNew: true,
                             pwFromMirror: (!get("pairing_pw") && m.pairing_pw) ? m.pairing_pw : null };
                }
                return deviceSeed().then(function (seed) {
                    if (seedHasUniquePart(seed)) {
                        /* Stufe 3: deterministisch aus Hardware-Merkmalen */
                        return derivePlayerId(seed).then(function (id) {
                            return { id: id, source: "hw-v1", isNew: true };
                        });
                    }
                    /* Stufe 4: Zufall — wie bisherige App-Versionen */
                    return { id: randomPlayerId(), source: "random", isNew: true };
                });
            });
        }

        return step.then(function (r) {
            if (!get("player_id")) set("player_id", r.id);
            if (r.isNew && r.source) set("player_id_source", r.source);

            var pw = get("pairing_pw") || r.pwFromMirror || null;
            if (!pw) {
                pw = genPairingPw();
                set("pairing_pw", pw);
            } else if (r.pwFromMirror) {
                set("pairing_pw", pw);
            }

            /* Spiegel aktualisieren — außer dort steht eine ANDERE ID */
            return mirrorRead().then(function (m) {
                if (m && m.player_id && m.player_id !== r.id) {
                    return result();
                }
                var source = r.source || (get("player_id_source") || "");
                if (m && m.player_id === r.id && (m.pairing_pw || "") === pw &&
                    (m.player_id_source || "") === source) {
                    return result(); /* Spiegel ist bereits aktuell */
                }
                return mirrorWrite({
                    player_id: r.id,
                    pairing_pw: pw,
                    player_id_source: source
                }).then(result, result);

                function result() {
                    return { playerId: r.id, pairingPw: pw, source: source || "" };
                }
            });
        }).catch(function () {
            /* Sicherheitsnetz: Identität muss IMMER liefern — im Zweifel Zufall */
            var id = get("player_id") || randomPlayerId();
            var pw = get("pairing_pw") || genPairingPw();
            set("player_id", id);
            set("pairing_pw", pw);
            if (!get("player_id_source")) set("player_id_source", "random");
            return { playerId: id, pairingPw: pw, source: get("player_id_source") || "" };
        });
    }

    /* ------------------------------------------------------------------ */

    var SmartysIdentity = {
        derivePlayerId: derivePlayerId,
        deviceSeed: deviceSeed,
        resolveIdentity: resolveIdentity,
        /* Nur für tools/test_identity.js (offline verifizierbar): */
        _sha256Embedded: sha256Embedded,
        _utf8Encode: utf8Encode,
        _testForceEmbedded: function (on) { forceEmbedded = !!on; }
    };

    root.SmartysIdentity = SmartysIdentity;
    if (typeof module !== "undefined" && module.exports) module.exports = SmartysIdentity;

})(typeof window !== "undefined" ? window :
    typeof globalThis !== "undefined" ? globalThis :
    typeof global !== "undefined" ? global : this);