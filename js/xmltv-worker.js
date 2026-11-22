/* XMLTV-Parser im Web Worker — haelt den Hauptthread der TV-App frei.
 *
 * Warum: parseXmltv() lief bisher synchron im Hauptthread. Bei grossen
 * Anbietern sind das 60–100 MB XML; DOMParser + Durchlauf blockierten die
 * Oberflaeche mehrere Sekunden (Fernbedienung tot, „ich muss immer einen
 * Augenblick warten"). Ein Worker hat einen eigenen Thread — waehrend er
 * parst, bleibt die App bedienbar.
 *
 * Im Worker gibt es KEIN DOMParser (Chrome 79), deshalb derselbe Regex-
 * Scanner, der in parseXmltv() schon als Fallback steckt.
 *
 * Nachricht rein:  { url, von, bis }
 * Nachricht raus:  { byId: {ch: [[start,stop,title],…]}, byName: {name:ch} }
 *              oder { error: "..." }
 */
self.onmessage = function (e) {
    var d = e.data || {};
    if (!d.url) { self.postMessage({ error: "keine url" }); return; }

    var xhr = new XMLHttpRequest();
    xhr.open("GET", d.url, true);
    xhr.timeout = 45000;
    xhr.onload = function () {
        if (xhr.status !== 200) { self.postMessage({ error: "HTTP " + xhr.status }); return; }
        try {
            var xml = xhr.responseText;
            var res = parseXmltv(xml, d.von, d.bis);
            xml = null;
            try { xhr.responseText = null; } catch (err) {}
            self.postMessage(res);
        } catch (err) {
            self.postMessage({ error: String(err && err.message || err) });
        }
    };
    xhr.onerror = function () { self.postMessage({ error: "Netzwerkfehler" }); };
    xhr.ontimeout = function () { self.postMessage({ error: "Zeitüberschreitung" }); };
    xhr.send();
};

function normName(n) {
    /* MUSS identisch zu normName() in app.js bleiben — sonst findet die
       Zuordnung display-name -> Kanal-ID die Sender nicht mehr. */
    return String(n || "").toLowerCase()
        .replace(/de\s*-\s*/g, "").replace(/de:/g, "").replace(/de-/g, "")
        .replace(/uhd/g, "").replace(/fhd/g, "").replace(/hd/g, "").replace(/4k/g, "")
        .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss")
        .replace(/\./g, "").replace(/:/g, "").replace(/\+/g, "").replace(/&/g, "")
        .replace(/\(/g, "").replace(/\)/g, "").replace(/!/g, "").replace(/ /g, "").trim();
}

function parseXmltvTime(s) {
    if (!s) return 0;
    var core = s.substring(0, 14);
    var tz = 0;
    if (s.indexOf("+") > 8) {
        var o = s.substring(s.lastIndexOf("+") + 1, s.lastIndexOf("+") + 5);
        tz = (parseInt(o.substring(0, 2), 10) * 3600 + parseInt(o.substring(2, 4), 10) * 60) * 1000;
    } else if (s.indexOf("-", 8) > 8) {
        var o2 = s.substring(s.lastIndexOf("-") + 1, s.lastIndexOf("-") + 5);
        tz = -(parseInt(o2.substring(0, 2), 10) * 3600 + parseInt(o2.substring(2, 4), 10) * 60) * 1000;
    }
    var y = +core.substring(0, 4), mo = +core.substring(4, 6) - 1, dd = +core.substring(6, 8);
    var h = +core.substring(8, 10), mi = +core.substring(10, 12), se = +core.substring(12, 14);
    if (!y || !core) return 0;
    return Date.UTC(y, mo, dd, h, mi, se) - tz;
}

function htmlDecode(s) {
    return String(s || "")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
        .replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function parseXmltv(xml, von, bis) {
    von = von || 0;
    bis = bis || Number.MAX_SAFE_INTEGER;
    var byId = {}, byName = {}, keys = [];

    var re = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/g, m;
    while ((m = re.exec(xml)) !== null) {
        var attrs = m[1];
        var chm = attrs.match(/channel="([^"]*)"/);
        if (!chm) continue;
        var start = parseXmltvTime((attrs.match(/start="([^"]*)"/) || [])[1]);
        if (!(start > 0)) continue;
        var stop = parseXmltvTime((attrs.match(/stop="([^"]*)"/) || [])[1]);
        if (stop && stop < von) continue;
        if (start > bis) continue;
        var body = m[2];
        var tm = body.match(/<title[^>]*>([\s\S]*?)<\/title>/);
        var ch = chm[1];
        var arr = byId[ch];
        if (!arr) { arr = byId[ch] = []; keys.push(ch); }
        arr.push([start, stop, htmlDecode(tm ? tm[1].trim() : "")]);
    }

    /* Kanaltabelle: display-name -> id (Zuordnung fuer Sender ohne epg_channel_id) */
    var cre = /<channel\b([^>]*)>([\s\S]*?)<\/channel>/g, c;
    while ((c = cre.exec(xml)) !== null) {
        var idm = c[1].match(/id="([^"]*)"/);
        if (!idm) continue;
        var dnm = c[2].match(/<display-name[^>]*>([\s\S]*?)<\/display-name>/);
        if (dnm) byName[normName(htmlDecode(dnm[1].trim()))] = idm[1];
    }

    /* Sortieren passiert noch im Worker — Hauptthread bekommt fertige Listen. */
    for (var i = 0; i < keys.length; i++) {
        byId[keys[i]].sort(function (a, b) { return a[0] - b[0]; });
    }
    return { byId: byId, byName: byName, anzahl: keys.length };
}
