/* =====================================================================
 *  Mehrsprachigkeit — je Sprache eine Datei (v1.5.34)
 *
 *  js/i18n/<code>.json  = eine Sprache (~12 KB), wird erst beim Wechsel geladen
 *  de = Quellsprache (deutsche Texte sind die Schlüssel), en = Rückfall inline
 *
 *  Beim Start werden nur ~13 KB geparst statt 500 KB. Nicht gebrauchte
 *  Sprachen kosten weder Startzeit noch Speicher, und im Paket lassen sich
 *  einzelne Sprachen später einfach weglassen.
 * ===================================================================== */
var I18N = { de: {} };

/* Verfügbare Sprachen — inline, damit der Sprachwähler ohne Datei-Zugriff steht */
var I18N_SPRACHEN = [{"code":"de","name":"Deutsch","rtl":false},{"code":"en","name":"English","rtl":false},{"code":"fr","name":"Français","rtl":false},{"code":"it","name":"Italiano","rtl":false},{"code":"es","name":"Español","rtl":false},{"code":"pt","name":"Português","rtl":false},{"code":"nl","name":"Nederlands","rtl":false},{"code":"ga","name":"Gaeilge","rtl":false},{"code":"mt","name":"Malti","rtl":false},{"code":"da","name":"Dansk","rtl":false},{"code":"sv","name":"Svenska","rtl":false},{"code":"nb","name":"Norsk","rtl":false},{"code":"fi","name":"Suomi","rtl":false},{"code":"is","name":"Íslenska","rtl":false},{"code":"et","name":"Eesti","rtl":false},{"code":"lv","name":"Latviešu","rtl":false},{"code":"lt","name":"Lietuvių","rtl":false},{"code":"pl","name":"Polski","rtl":false},{"code":"cs","name":"Čeština","rtl":false},{"code":"sk","name":"Slovenčina","rtl":false},{"code":"hu","name":"Magyar","rtl":false},{"code":"ro","name":"Română","rtl":false},{"code":"bg","name":"Български","rtl":false},{"code":"hr","name":"Hrvatski","rtl":false},{"code":"sr","name":"Srpski","rtl":false},{"code":"bs","name":"Bosanski","rtl":false},{"code":"sl","name":"Slovenščina","rtl":false},{"code":"mk","name":"Македонски","rtl":false},{"code":"sq","name":"Shqip","rtl":false},{"code":"el","name":"Ελληνικά","rtl":false},{"code":"ru","name":"Русский","rtl":false},{"code":"uk","name":"Українська","rtl":false},{"code":"be","name":"Беларуская","rtl":false},{"code":"tr","name":"Türkçe","rtl":false},{"code":"fa","name":"فارسی","rtl":true},{"code":"ur","name":"اردو","rtl":true},{"code":"ar","name":"العربية","rtl":true},{"code":"ckb","name":"کوردی","rtl":true}];

/* Rückfall inline: Deutsch/Englisch funktionieren auch ohne geladene Datei */
I18N.en = {"Kamera-Wand":"Camera wall","Kameras & freie Streams":"Cameras & free streams","Firmen-Kameras (VLAN)":"Company cameras (VLAN)","Firmen-Kameras":"Company cameras","Freie Kameras":"Free cameras","Freie Streams":"Free streams","Spalten":"Columns","Keine Firmen-Kameras gefunden.":"No company cameras found.","   — aktiv: {0}":"   — active: {0}","+ Profil hinzufügen":"+ Add profile","/ 10":"/ 10","16:9 erzwingen":"Force 16:9","4-stelliger PIN":"4-digit PIN","4:3 erzwingen":"Force 4:3","Abbrechen":"Cancel","Abspann erkannt — nächste Folge in 5 s":"Credits detected — next episode in 5 s","Alle Filme":"All movies","Alle Kanäle":"All channels","Alle Serien":"All series","Anklicken markiert. MARKIERT = BEHALTEN.":"Click to select. SELECTED = KEEP.","Anlegen":"Create","Auf Filmstarts suchen":"Search on Filmstarts","Aufnahme starten":"Start recording","Aufnahme-Daemon":"Recording daemon","Aufnahme-Verzeichnis":"Recording directory","Aufnahmen":"Recordings","Aufnahmepfad:":"Recording path:","Aufnehmen":"Record","Aus":"Off","Aus EPG aufnehmen":"Record from EPG","Auto erkennt das System selbst (z. B. Hybrid-Grafik → Software). Nur bei Problemen manuell wählen.":"Auto lets the system decide (e.g. hybrid graphics → software). Only change this on problems.","Beschreibung lädt…":"Loading description…","Bleibe bis zum Ende":"Staying until the end","Dauer (Minuten)":"Duration (minutes)","Deaktivieren":"Disable","Dein Passwort":"Your password","Deine Player-ID":"Your player ID","Demo starten — ohne Einrichtung":"Start demo — no setup needed","Diese Sendung aufnehmen?":"Record this show?","Download löschen?":"Delete download?","Downloads":"Downloads","EPG wird noch geladen.":"EPG is still loading.","Einstellungen":"Settings","Endlos (bis S)":"Endless (until S)","Entsperren — Playlist laden":"Unlock — load playlist","Erneut versuchen":"Try again","FSK18-PIN festlegen":"Set adult PIN","FSK18-PIN:":"Adult PIN:","Falsche PIN":"Wrong PIN","Falsches Passwort — bitte erneut versuchen.":"Wrong password — please try again.","Favoriten":"Favourites","Favoriten ({0})":"Favourites ({0})","Fehlgeschlagene löschen ({0})":"Delete failed ({0})","Fenster":"Window","Filme":"Movies","Füllen (zuschneiden)":"Fill (crop)","Geplante Aufnahmen":"Scheduled recordings","Heruntergeladene Filme & Episoden":"Downloaded movies & episodes","IMDb öffnen":"Open IMDb","Jetzt":"Now","Jetzt laden":"Load now","Kanal":"Channel","Kanal wählen":"Choose channel","Kanäle":"Channels","Kein Programm geladen.":"No programme loaded.","Keine Beschreibung verfügbar.":"No description available.","Keine Daten — verbinde neu":"No data — reconnecting","Keine EPG-Daten für diesen Kanal.":"No EPG data for this channel.","Keine Episoden gefunden":"No episodes found","Keine Filme in dieser Kategorie":"No movies in this category","Keine Lines geladen — oben „Lines vom Panel neu laden“.":"No lines loaded — use “Reload lines from panel” above.","Keine Programmdaten":"No programme data","Keine Serien in dieser Kategorie":"No series in this category","Keine geplanten Aufnahmen.":"No scheduled recordings.","Keine laufenden/zukünftigen Sendungen.":"No current or upcoming shows.","Kindersicherung":"Parental lock","Lade…":"Loading…","Laufende Sendung":"Current show","Lines entschlüsseln":"Decrypt lines","Live-TV":"Live TV","Live-TV-Pause (Timeshift)":"Live TV pause (timeshift)","Löschen":"Delete","Manueller Aufnahme-Timer":"Manual recording timer","Manueller Timer":"Manual timer","Minute":"Minute","Multi-View — Kanäle wählen (max. 4)":"Multi-view — choose channels (max. 4)","Name":"Name","Neues Profil":"New profile","Noch keine Downloads.\nFilme und Serien-Episoden kannst du in den jeweiligen Bereichen herunterladen.":"No downloads yet.\nDownload movies and episodes from their sections.","Noch keine Downloads. Filme lädst du über den ⬇-Button auf der Detailseite.":"No downloads yet. Download movies with the ⬇ button on the detail page.","Nr. {0}":"No. {0}","OK":"OK","Offline-Downloads":"Offline downloads","Original":"Original","PIN festlegen":"Set PIN","Pfad speichern":"Save path","Player":"Player","Player freischalten":"Activate player","Profile":"Profiles","Programm":"Guide","Prüfen — Playlist laden":"Check — load playlist","QR-Code mit dem Handy scannen":"Scan the QR code with your phone","Schließen":"Close","Sender, Filme oder Serien suchen …":"Search channels, movies or series …","Serien":"Series","Sicherheits-Passwort":"Security password","Smartys IPTV":"Smartys IPTV","Smartys Player":"Smartys Player","Sortieren: A–Z":"Sort: A–Z","Sortieren: Manuell":"Sort: Manual","Sortieren: Nummer":"Sort: Number","Speicher":"Storage","Speichern":"Save","Sprache":"Language","Stream antwortet nicht — Zurück und Kanal neu wählen":"Stream not responding — go back and pick the channel again","Stream-Puffer":"Stream buffer","Stunde":"Hour","Suche":"Search","Titel (optional)":"Title (optional)","Verbinde…":"Connecting…","Verwaltung":"Management","Verzeichnis für den Timeshift-Puffer":"Timeshift buffer directory","Video-Decoding":"Video decoding","Von vorne abspielen":"Play from start","Welche Line aus dem Panel nutzt dieses Profil?":"Which panel line does this profile use?","Wenig Platz — alte Downloads löschen.":"Low space — delete old downloads.","Wie soll aufgenommen werden?":"How should it be recorded?","Zielordner für geplante Aufnahmen":"Target folder for scheduled recordings","Zurück":"Back","Zurück zur Einrichtung":"Back to setup","aktiv":"active","aktiv — Stream wird auf die Platte gepuffert":"active — stream is buffered to disk","aus":"off","bleiben":"stay","gesetzt":"set","lade Lines …":"loading lines …","nicht gesetzt":"not set","{0} Kanäle":"{0} channels","{0} Sender · {1} Stunden":"{0} channels · {1} hours","←":"←","← Zurück":"← Back","■ Stopp":"■ Stop","▦ Multi-View":"▦ Multi-view","▲":"▲","▶":"▶","▶ Download fortsetzen":"▶ Resume download","▶ Erste Episode abspielen":"▶ Play first episode","▶ Trailer ansehen":"▶ Watch trailer","▼":"▼","● Aufnahme läuft":"● Recording","★":"★","⚙ {0} ausgeblendet — alle einblenden":"⚙ {0} hidden — show all","⚠":"⚠","⚠ Download fehlgeschlagen — erneut versuchen":"⚠ Download failed — try again","✓":"✓","✕":"✕","⬇":"⬇","⬇ Herunterladen":"⬇ Download","⬇ Staffel laden ({0})":"⬇ Download season ({0})","🎯 Gruppen markieren":"🎯 Select groups","📺 Programm":"📺 Programme","🔄 Lines vom Panel neu laden":"🔄 Reload lines from panel","🔍":"🔍","🔒 ":"🔒 ","🗑":"🗑","Deutschland":"Germany","Österreich":"Austria","Schweiz":"Switzerland","Frankreich":"France","Spanien":"Spain","Portugal":"Portugal","Italien":"Italy","Griechenland":"Greece","Kroatien":"Croatia","Rumänien":"Romania","Dänemark":"Denmark","Schweden":"Sweden","Norwegen":"Norway","Finnland":"Finland","Polen":"Poland","Niederlande":"Netherlands","Türkei":"Türkiye","Russland":"Russia","Vereinigte Staaten":"United States","Kanada":"Canada","Mexiko":"Mexico","Brasilien":"Brazil","Japan":"Japan","China":"China","Hongkong":"Hong Kong","Taiwan":"Taiwan","Südkorea":"South Korea","Singapur":"Singapore","Malaysia":"Malaysia","Indonesien":"Indonesia","Philippinen":"Philippines","Vietnam":"Vietnam","Indien":"India","Australien":"Australia","Neuseeland":"New Zealand","Südafrika":"South Africa","Israel":"Israel","Katar":"Qatar","Vereinigte Arabische Emirate":"United Arab Emirates","Europa (international)":"Europe (international)","Irland":"Ireland","Merken":"Watchlist","Meine Liste":"My list","Profil":"Profile","Über":"About","System":"System","Alle":"All","Programmübersicht":"TV guide","Film":"Movie","Serie":"Series","Staffel":"Season","Episode":"Episode","Nummer":"Number","Standard":"Default","Manuell":"Manual","Öffnen":"Open","Umschalten":"Toggle","Abspielen":"Play","Fortsetzen":"Resume","Von vorne":"From the start","Abmelden":"Sign out","Entsperren":"Unlock","Entschlüsseln":"Decrypt","Entschlüssele…":"Decrypting…","Als Favorit":"Add to watchlist","Favorit entfernen":"Remove from watchlist","Nach oben":"Up","Nach unten":"Down","Nach oben/unten":"Up/down","Zurueck":"Back","← Zurück zu Pairing":"← Back to pairing","▶ Demo-Modus — öffentliche Sender":"▶ Demo mode — public broadcasters","Staffel abspielen":"Play season","Staffel laden":"Load season","PIN ändern":"Change PIN","PIN entfernen":"Remove PIN","PIN eingeben":"Enter PIN","PIN gesetzt":"PIN set","Neuer Name…":"New name…","Kategorie umbenennen":"Rename category","Kategorie verwalten":"Manage category","Kategorie wählen":"Choose category","Alles einblenden":"Show all","Alle einblenden":"Show all","Alles ausblenden":"Hide all","Gruppen sortieren & ausblenden":"Sort & hide groups","Gruppen sortieren &amp; ausblenden":"Sort &amp; hide groups","Nur markierte zeigen":"Show only selected","Mehrere markieren":"Select multiple","✓ Alle markieren":"✓ Select all","🎯 Mehrere markieren":"🎯 Select multiple","🚫 Alles ausblenden":"🚫 Hide all","☰ Manuell":"☰ Manual","Ein":"On","Keine EPG-Daten":"No guide data","Lade Kanäle…":"Loading channels…","Lade Inhalte…":"Loading content…","Filme werden geladen…":"Loading movies…","Serien werden geladen…":"Loading series…","Laden fehlgeschlagen.":"Loading failed.","Laden fehlgeschlagen:":"Loading failed:","Netzwerkfehler":"Network error","Timeout":"Timeout","Fehler:":"Error:","PIN muss mindestens 4 Ziffern haben":"PIN needs at least 4 digits","PINs stimmen nicht überein":"PINs do not match","Passwort falsch":"Wrong password","Unbenannt":"Unnamed","Keine Verbindung:":"No connection:","Verbinde mit panel.smartys.tech…":"Connecting to panel.smartys.tech…","Dieses Gerät unterstützt kein HLS.":"This device does not support HLS.","WebCrypto nicht verfügbar":"WebCrypto not available","Worker ohne Daten":"Worker returned no data","Zeile ist verschlüsselt":"Channel is encrypted","Vorschau hier nicht verfuegbar.":"Preview not available here.","Vorschau wird vorbereitet…":"Preparing preview…","Bild bleibt dunkel? Zurück drücken — QR-Code zum Handy!":"Picture stays black? Press back — QR code for your phone!","Dieser Anbieter liefert keine Inhaltsbeschreibung für diesen Titel.":"This provider has no description for this title.","Keine Beschreibung zu diesem Titel gefunden.":"No description found for this title.","Gruppen ausgeblendet:":"Groups hidden:","Markiert:":"Selected:","Jetzt im Tab Merken":"Now in your watchlist","Favoriten & Fortsetzen sind pro Profil getrennt":"Watchlist & resume are per profile","Wer schaut?":"Who is watching?","Profilname:":"Profile name:","Melde dich mit Player-ID und Passwort an":"Sign in with player ID and password","QR mit dem Handy scannen":"Scan with your phone","Andere Leitung":"Other line","Leitung":"Line","Hinterlege dort deine Playlist — dann hier „Prüfen“":"Store your playlist there — then press Check here","Sicherheits-Passwort eingeben, um die Kanäle einzulesen.":"Enter the security password to load the channels.","Bildschirmschoner":"Screen saver","Vorschaufenster":"Preview window","IMDb-/Trailer-Zusatzinfos":"IMDb/trailer extras","Eingabe am Handy (QR)":"Phone input (QR)","Am Handy öffnen — Suchbegriffe, Playlist- und EPG-Adressen tippen:":"Open on your phone — type search terms, playlist and EPG addresses:","Keine Netzwerkadresse — Server läuft nur im Heimnetz":"No network address — server runs on your home network only","Suche vom Handy:":"Search from phone:","EPG-Adresse gespeichert":"EPG address saved","Playlist-Adresse übernommen — Einstellungen → Leitung":"Playlist address stored — Settings → Line","Deine Merkliste":"Your watchlist","Wächter":"Watchdog","Sender":"channels","Treffer":"results","Demo-Modus (öffentlich-rechtlich)":"demo mode (public broadcasters)","Sender suchen…":"Search channels…","Film suchen…":"Search movies…","Serie suchen…":"Search series…","Gruppen verwalten & ausblenden: Einstellungen → Gruppen sortieren & ausblenden":"Manage & hide groups: Settings → Sort & hide groups","Kameras":"Cameras","Kamera-Server (Smartys CamViewer)":"Camera server (Smartys CamViewer)","Jellyfin-Server":"Jellyfin server","Suchen":"Scan","Anmelden":"Sign in","Einrichten":"Set up","Status":"Status","Server":"Server","Benutzer":"User"};

var I18N_LAEDT = {};   /* code -> Promise */
var I18N_FEHLT = {};   /* code -> true, wenn die Datei fehlt */

/* Ein Eintrag, der identisch mit dem deutschen Schlüssel ist, gilt als
   "nicht übersetzt" — dann wird Englisch genommen statt Deutsch. */
function i18nWert(map, key, de) {
    if (!map) return undefined;
    var v = map[key];
    if (v === undefined || v === null || v === "") return undefined;
    if (de !== undefined && v === de) return undefined;
    return v;
}

function i18nDatei(code) { return "js/i18n/" + code; }   /* Endung wird angehängt */

function i18nLaden(code) {
    if (!code || code === "de" || code === "en") return Promise.resolve(true);
    if (I18N[code]) return Promise.resolve(true);
    if (I18N_FEHLT[code]) return Promise.resolve(false);
    if (I18N_LAEDT[code]) return I18N_LAEDT[code];

    /* Weg 1: script-Tag — funktioniert auch, wenn die App aus file:// läuft
       (dort blockt Chromium XMLHttpRequest auf lokale Dateien). */
    I18N_LAEDT[code] = new Promise(function (res) {
        var fertig = false;
        function abschluss(ok) {
            if (fertig) return;
            fertig = true;
            delete I18N_LAEDT[code];
            if (!ok) I18N_FEHLT[code] = true;
            res(ok);
        }
        try {
            var s = document.createElement("script");
            s.src = i18nDatei(code) + ".js";
            s.onload = function () { abschluss(!!I18N[code]); };
            s.onerror = function () {
                /* Weg 2: XMLHttpRequest (falls die Datei nur als JSON vorliegt) */
                try {
                    var x = new XMLHttpRequest();
                    x.open("GET", i18nDatei(code) + ".json", true);
                    x.timeout = 5000;
                    x.onload = function () {
                        if (x.status === 200) {
                            try { I18N[code] = JSON.parse(x.responseText); return abschluss(true); } catch (e) {}
                        }
                        abschluss(false);
                    };
                    x.onerror = function () { abschluss(false); };
                    x.ontimeout = function () { abschluss(false); };
                    x.send();
                } catch (e) { abschluss(false); }
            };
            document.head.appendChild(s);
        } catch (e) { abschluss(false); }
    });
    return I18N_LAEDT[code];
}

/* Zuletzt gewählte Sprache schon beim Start holen (nicht blockierend) */
function i18nVorladen() {
    if (typeof state !== "undefined" && state.lang && state.lang !== "de") i18nLaden(state.lang);
}

function i18nKnoten(el, lang) {
    if (!el || !el.getAttribute) return;
    /* Neuer Weg: expliziter Key am Element (sprachfreies Markup). */
    var key = el.getAttribute ? el.getAttribute("data-i18n") : null;
    if (key && typeof Tk === "function") {
        var txt = Tk(key);
        if ((el.textContent || "").trim() !== txt) el.textContent = txt;
        return;
    }
    var de = el.getAttribute("data-i18n-de");
    var ist = (el.textContent || "").trim();
    if (!de && lang !== "de") de = ist;
    if (!de) return;
    var map = I18N[lang];
    var ziel = (lang === "de") ? de
        : (i18nWert(map, de, de) || i18nWert(I18N.en, de, de) || null);
    if (!ziel) {
        if (lang === "de" && el.getAttribute("data-i18n-de")) {
            el.textContent = de;
            el.removeAttribute("data-i18n-de");
        }
        return;
    }
    if (!el.getAttribute("data-i18n-de")) el.setAttribute("data-i18n-de", de);
    if (ist !== ziel) el.textContent = ziel;
}

/* Attribute (placeholder/title/aria-label) mituebersetzen. */
function i18nAttr(el, attr, lang) {
    if (!el || !el.getAttribute) return;
    var keyAttr = el.getAttribute ? el.getAttribute("data-i18n-" + attr) : null;
    if (keyAttr && typeof Tk === "function") {
        var txt = Tk(keyAttr);
        if ((el.getAttribute(attr) || "") !== txt) el.setAttribute(attr, txt);
        return;
    }
    var key = el.getAttribute("data-i18n-" + attr);
    var ist = el.getAttribute(attr) || "";
    if (!key && lang !== "de") key = ist.trim();
    if (!key) return;
    var map = I18N[lang];
    var ziel = (lang === "de") ? key : (i18nWert(map, key, key) || i18nWert(I18N.en, key, key) || null);
    if (!ziel) return;
    if (!el.getAttribute("data-i18n-" + attr)) el.setAttribute("data-i18n-" + attr, key);
    if (ist.trim() !== ziel) el.setAttribute(attr, ziel);
}

function i18nApply() {
    var lang = state.lang || "de";
    var root = document.body;
    if (!root) return;
    /* Textknoten */
    var el = root.querySelectorAll("*");
    for (var i = 0; i < el.length; i++) {
        var e = el[i];
        var tag = e.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "CANVAS") continue;
        if (e.children.length === 0) i18nKnoten(e, lang);
        i18nAttr(e, "placeholder", lang);
        i18nAttr(e, "title", lang);
        i18nAttr(e, "aria-label", lang);
    }
}

/* Kurzform fuer dynamisch zusammengesetzte Texte. */
function T(s) {
    var m = I18N[state.lang || "de"];
    var v = i18nWert(m, s, s); if (v) return v;
    var ve = i18nWert(I18N.en, s, s); if (ve) return ve;
    if (I18N.en && I18N.en[s]) return I18N.en[s];   /* nie Deutsch in einer fremden Oberflaeche */
    return s;
}

/* Anzeigename einer Sprache — wird von renderSettings fuer die Statuszeile
   gebraucht. Fehlte hier: der Aufruf warf "i18nName is not defined" und
   brach renderSettings mitten in der Liste ab (alle Felder darunter blieben
   leer). */
function i18nName(code) {
    for (var i = 0; i < I18N_SPRACHEN.length; i++) {
        if (I18N_SPRACHEN[i].code === code) return I18N_SPRACHEN[i].name;
    }
    return code || "";
}

/* Ist die Sprache von rechts nach links? (Arabisch, Kurdisch-Sorani, Farsi, Urdu) */
function i18nRtl(code) {
    for (var i = 0; i < I18N_SPRACHEN.length; i++) {
        if (I18N_SPRACHEN[i].code === code) return !!I18N_SPRACHEN[i].rtl;
    }
    return false;
}

/* Spiegelt die Oberflaeche: dir=rtl am Dokument + Klasse fuer CSS-Sonderfaelle. */
function i18nRichtung(code) {
    var rtl = i18nRtl(code);
    var h = document.documentElement;
    try {
        h.setAttribute("dir", rtl ? "rtl" : "ltr");
        h.setAttribute("lang", code);
        if (rtl) h.classList.add("rtl"); else h.classList.remove("rtl");
        if (document.body) {
            if (rtl) document.body.classList.add("rtl"); else document.body.classList.remove("rtl");
        }
    } catch (e) {}
    return rtl;
}

function i18nSetzen(code) {
    /* Sprache liegt als eigene Datei vor -> erst laden, dann anwenden. */
    function anwenden() {
        state.lang = code;
        lsSet("lang", code);
        i18nRichtung(code);
        i18nApply();
        try { i18nNachziehen(); } catch (e) {}
    }
    function i18nNachziehen() {
        if (typeof renderLiveCategories === "function") renderLiveCategories();
        if (typeof renderLiveChannels === "function") renderLiveChannels();
        if (typeof renderSettings === "function" && state.currentView === "view-settings") renderSettings();
    }
    if (code === "de" || code === "en" || I18N[code]) { anwenden(); return Promise.resolve(true); }
    return i18nLaden(code).then(function (ok) {
        if (!ok) code = "en";
        anwenden();
        return ok;
    });
}

