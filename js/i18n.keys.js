/* =====================================================================
 *  Schlüssel-Layer (v1.5.29)
 *  Kein Text ist mehr der Schlüssel: der Code spricht nur noch Keys
 *  ("nav.live", "count.channels"). Der Key zeigt auf den deutschen Text,
 *  der wie bisher in den Sprachtabellen nachgeschlagen wird — dadurch
 *  bleiben alle vorhandenen Übersetzungen gültig.
 *
 *  Zusammengesetzte Sätze laufen über echte Templates mit {platzhaltern},
 *  damit die Wortstellung je Sprache stimmt.
 * ===================================================================== */
var I18N_KEYS = { "nav.live": "Live-TV", "nav.movies": "Filme", "nav.series": "Serien", "nav.watch": "Merken", "nav.guide": "Programm", "nav.cams": "Kameras", "nav.downloads": "Downloads", "nav.profile": "Profil", "nav.settings": "Einstellungen", "count.channels": "{n} Sender", "count.results": "{n} Treffer", "count.cams": "{n} Kameras", "count.groups_hidden": "Gruppen ausgeblendet: {n}", "count.selected": "Markiert: {n}", "mode.demo": "Demo-Modus (öffentlich-rechtlich)", "head.demo": "{n} Sender · Demo-Modus (öffentlich-rechtlich)",
 "hint.groups": "Gruppen verwalten & ausblenden: Einstellungen → Gruppen sortieren & ausblenden", "search.channels": "Sender suchen…", "search.movies": "Film suchen…", "search.series": "Serie suchen…", "msg.no_epg": "Keine EPG-Daten", "msg.loading_channels": "Lade Kanäle…", "msg.loading_content": "Lade Inhalte…", "msg.loading_movies": "Filme werden geladen…", "msg.loading_series": "Serien werden geladen…", "msg.load_failed": "Laden fehlgeschlagen.", "msg.network": "Netzwerkfehler", "msg.timeout": "Timeout", "msg.error": "Fehler:", "msg.unnamed": "Unbenannt", "msg.no_description": "Keine Beschreibung zu diesem Titel gefunden.", "msg.preview_na": "Vorschau hier nicht verfuegbar.", "msg.preview_prep": "Vorschau wird vorbereitet…", "msg.encrypted": "Zeile ist verschlüsselt", "msg.no_hls": "Dieses Gerät unterstützt kein HLS.", "msg.wrong_pin": "Falsche PIN", "msg.pin_short": "PIN muss mindestens 4 Ziffern haben", "msg.pin_mismatch": "PINs stimmen nicht überein", "msg.search_from_phone": "Suche vom Handy: {q}", "state.on": "Ein", "state.off": "Aus", "act.play": "Abspielen", "act.resume": "Fortsetzen", "act.from_start": "Von vorne", "act.cancel": "Abbrechen", "act.save": "Speichern", "act.open": "Öffnen", "act.toggle": "Umschalten", "act.back": "← Zurück", "act.check": "Prüfen — Playlist laden", "act.demo_start": "▶ Demo-Modus — öffentliche Sender", "set.language": "Sprache", "set.qr_input": "Eingabe am Handy (QR)", "set.parental": "Kindersicherung", "set.screensaver": "Bildschirmschoner", "set.preview": "Vorschaufenster", "set.imdb": "IMDb-/Trailer-Zusatzinfos", "pair.activate": "Player freischalten", "pair.player_id": "Deine Player-ID", "pair.password": "Dein Passwort", "pair.scan_qr": "QR mit dem Handy scannen", "pair.line": "Leitung", "cam.title": "Kameras", "cam.unreachable": "Stream nicht erreichbar" };

/* Templates je Sprache: I18N_TPL[key][lang] = "…{n}…" */
var I18N_TPL = {"count.channels": {"de": "{n} Sender", "en": "{n} channels", "es": "{n} canales", "fr": "{n} chaînes", "it": "{n} canali", "pt": "{n} canais", "pl": "{n} kanałów", "tr": "{n} kanal", "ar": "{n} قناة", "ckb": "{n} کەناڵ", "ru": "{n} каналов", "nl": "{n} zenders", "sv": "{n} kanaler", "da": "{n} kanaler", "fi": "{n} kanavaa", "cs": "{n} kanálů", "hu": "{n} csatorna", "ro": "{n} canale", "el": "{n} κανάλια", "uk": "{n} каналів", "fa": "{n} کانال", "ur": "{n} چینل"}, "count.results": {"de": "{n} Treffer", "en": "{n} results", "es": "{n} resultados", "fr": "{n} résultats", "it": "{n} risultati", "pt": "{n} resultados", "pl": "{n} wyników", "tr": "{n} sonuç", "ar": "{n} نتيجة", "ckb": "{n} ئەنجام", "ru": "{n} результатов"}, "count.cams": {"de": "{n} Kameras", "en": "{n} cameras", "es": "{n} cámaras", "fr": "{n} caméras", "it": "{n} telecamere", "pt": "{n} câmaras", "pl": "{n} kamer", "tr": "{n} kamera", "ar": "{n} كاميرا", "ckb": "{n} کامێرا", "ru": "{n} камер"}, "msg.search_from_phone": {"de": "Suche vom Handy: {q}", "en": "Search from phone: {q}", "es": "Búsqueda desde el móvil: {q}", "fr": "Recherche depuis le téléphone : {q}", "it": "Ricerca dal telefono: {q}", "pt": "Pesquisa do telemóvel: {q}", "pl": "Szukanie z telefonu: {q}", "tr": "Telefondan arama: {q}", "ar": "بحث من الهاتف: {q}", "ckb": "گەڕان لە مۆبایل: {q}"}, "head.demo": {"de": "{n} Sender · Demo-Modus (öffentlich-rechtlich)", "en": "{n} channels · demo mode (public broadcasters)", "ru": "{n} каналов · демо-режим (общественные каналы)", "nl": "{n} zenders · demomodus (publieke omroepen)", "sv": "{n} kanaler · demoläge (public service)", "da": "{n} kanaler · demotilstand (public service)", "nb": "{n} kanaler · demomodus (allmennkringkasting)", "fi": "{n} kanavaa · demotila (julkiset kanavat)", "cs": "{n} kanálů · demo režim (veřejnoprávní kanály)", "sk": "{n} kanálov · demo režim (verejnoprávne kanály)", "hu": "{n} csatorna · demó mód (közszolgálati csatornák)", "ro": "{n} canale · mod demo (canale publice)", "bg": "{n} канала · демо режим (обществени канали)", "hr": "{n} kanala · demo način (javni kanali)", "sr": "{n} канала · демо режим (јавни канали)", "sl": "{n} kanalov · demo način (javne postaje)", "el": "{n} κανάλια · λειτουργία επίδειξης (δημόσια κανάλια)", "uk": "{n} каналів · демо-режим (суспільні канали)", "fa": "{n} کانال · حالت نمایشی (کانال‌های عمومی)", "ur": "{n} چینل · ڈیمو موڈ (عوامی چینلز)", "pl": "{n} kanałów · tryb demo (kanały publiczne)", "tr": "{n} kanal · demo modu (kamu kanalları)", "es": "{n} canales · modo demo (canales públicos)", "fr": "{n} chaînes · mode démo (chaînes publiques)", "it": "{n} canali · modalità demo (canali pubblici)", "pt": "{n} canais · modo demo (canais públicos)", "ar": "{n} قناة · الوضع التجريبي (قنوات عامة)", "ckb": "{n} کەناڵ · دۆخی نموونە (کەناڵە گشتییەکان)"}};

/* Text zu einem Key in der aktuellen Sprache (ohne Platzhalter). */
function i18nKeyText(key, lang) {
    var de = I18N_KEYS[key];
    if (de === undefined) return key;          /* unbekannter Key: sichtbar machen */
    if (!lang || lang === "de") return de;
    /* Identisch mit dem deutschen Schlüssel = nicht übersetzt -> Englisch */
    var m = I18N[lang];
    if (m && m[de] !== undefined && m[de] !== de) return m[de];
    if (I18N.en && I18N.en[de] !== undefined && I18N.en[de] !== de) return I18N.en[de];
    return de;
}

/* Platzhalter {n}, {q} … einsetzen. */
function i18nFill(s, vars) {
    if (!vars) return s;
    return String(s).replace(/\{(\w+)\}/g, function (all, k) {
        return (vars[k] !== undefined && vars[k] !== null) ? String(vars[k]) : all;
    });
}

/* Der eine Aufruf, den der Code benutzt: T("key") oder T("key", {n: 77}). */
function Tk(key, vars) {
    var lang = (typeof state !== "undefined" && state && state.lang) || "de";
    var s;
    var tp = I18N_TPL[key];
    if (tp && tp[lang] !== undefined) s = tp[lang];
    else if (tp && tp.en !== undefined) s = tp.en;      /* nie ein roher Key im Bild */
    else if (tp && tp.de !== undefined) s = tp.de;
    else s = i18nKeyText(key, lang);
    return i18nFill(s, vars);
}
