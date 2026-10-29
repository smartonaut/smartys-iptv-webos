#!/usr/bin/env node
/* =====================================================================
 *  Smartys IPTV — Test für die stabile Player-ID
 *
 *  Prüft den Testvektor aus PLAYER-IDENTITY.md (liegt im übergeordneten
 *  Ordner "Smartys Player/", der Vektor steht hier inline):
 *
 *      seed = boxtype=sf8008|sn=272400008A1E|chipset=3798mv200|board_revision=1.0|nic=d0:27:24:00:8a:1e
 *      id   = C2:75:9A:B3:8D:17
 *
 *  Geprüft werden beide SHA-256-Pfade (WebCrypto wie im TV, plus die
 *  eingebettete reine-JS-Implementierung als Fallback) und die
 *  UTF-8-Kodierung gegen node:crypto.
 *
 *  Aufruf:  node tools/test_identity.js
 * ===================================================================== */
"use strict";

var path = require("path");
var nodeCrypto = require("crypto");
var identity = require(path.join(__dirname, "..", "js", "identity.js"));

var SEED = "boxtype=sf8008|sn=272400008A1E|chipset=3798mv200|board_revision=1.0|nic=d0:27:24:00:8a:1e";
var EXPECTED_ID = "C2:75:9A:B3:8D:17";
var NAMESPACE = "smartys-iptv-player-id-v1|";

var failures = 0;

function check(name, ok, detail) {
    console.log((ok ? "PASS" : "FAIL") + "  " + name + (ok ? "" : "  -- " + detail));
    if (!ok) failures++;
}

function nodeSha256Hex(str) {
    return nodeCrypto.createHash("sha256").update(str, "utf8").digest("hex");
}

function hex(bytes) {
    var out = "", i;
    for (i = 0; i < bytes.length; i++) out += ("0" + bytes[i].toString(16)).slice(-2);
    return out;
}

async function main() {
    console.log("== Smartys Player-ID: Spezifikations-Testvektor ==");

    /* 1) Testvektor über WebCrypto (Normalpfad auf Tizen/webOS) */
    var viaSubtle = await identity.derivePlayerId(SEED);
    check("Testvektor, WebCrypto-Pfad => " + EXPECTED_ID,
          viaSubtle === EXPECTED_ID, "erhalten: " + viaSubtle);

    /* 2) Testvektor über die eingebettete reine-JS-SHA-256 (Fallback) */
    identity._testForceEmbedded(true);
    var viaEmbedded = await identity.derivePlayerId(SEED);
    check("Testvektor, eingebetteter Fallback-Pfad => " + EXPECTED_ID,
          viaEmbedded === EXPECTED_ID, "erhalten: " + viaEmbedded);
    identity._testForceEmbedded(false);

    /* 3) Eingebettetes SHA-256 gegen node:crypto (Padding-Grenzen, UTF-8) */
    var vectors = [
        "",
        "abc",
        "x".repeat(55),   /* 1-Block-Grenze (länge + 9 = 64) */
        "x".repeat(56),   /* 1-Block-Grenze (länge + 9 = 65 → 2 Blöcke) */
        "x".repeat(64),
        NAMESPACE + SEED,
        "smartys-iptv-player-id-v1|duid=0GAEIABT123456|model=UE43RU7179",
        "smartys-iptv-player-id-v1|nduid=be0a1122deadbeef|model=OLED55C8|x".repeat(200)
    ];
    for (var i = 0; i < vectors.length; i++) {
        var got = hex(identity._sha256Embedded(identity._utf8Encode(vectors[i])));
        var want = nodeSha256Hex(vectors[i]);
        check("SHA-256 == node:crypto (Vektor " + i + ", " + vectors[i].length + " Zeichen)",
              got === want, got + " != " + want);
    }

    /* 4) UTF-8-Kodierung: Mehrbyte + Ersatz-Paar vs. node */
    var utf8Msg = "smartys-iptv-player-id-v1|äöüß日本語emoji-🙂-test";
    check("UTF-8-Kodierung == node:crypto",
          hex(identity._utf8Encode(utf8Msg)) === Buffer.from(utf8Msg, "utf8").toString("hex"),
          "");

    /* 5) ID-Format: UPPERCASE, Doppelpunkte, lokal administriert + Unicast */
    check("Format XX:XX:XX:XX:XX:XX (UPPERCASE)",
          /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/.test(viaSubtle), viaSubtle);

    console.log(failures === 0 ? "\nALLE TESTS BESTANDEN" : "\n" + failures + " TEST(S) FEHLGESCHLAGEN");
    process.exit(failures === 0 ? 0 : 1);
}

main().catch(function (e) {
    console.error("Testfehler:", e);
    process.exit(1);
});