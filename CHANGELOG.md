## 1.5.58 — 26.11.2026

Kamera-Wand im Raster, Menue bleibt vollstaendig, Stillstands-Waechter.

- **Raster-Modus** ist der Standard der Wand: der Server (pc-papa) setzt alle
  Kameras per ffmpeg-xstack zu EINEM HLS-Stream zusammen (`/hls/wall/index.m3u8`).
  Der TV dekodiert einen Strom statt fuenf. Knopf „Raster (1 Stream)“ in der
  Wand, MENU schaltet ebenfalls um.
- **Nicht mehr stummschalten**: der Raster-Stream fuehrt einen 21,5-kHz-Ton
  (~-60 dB, unhoerbar). Nur mit laufendem Audiosignal haelt der Fernseher bzw.
  eine Soundbar am HDMI durch.
- **Stillstands-Waechter**: webOS bleibt nach einem Segment-Abriss gern mit
  readyState 4 auf der letzten Zeit stehen, ohne Fehler zu melden. Alle 8 s wird
  geprueft, nach zwei gleichen Zeitstaenden wird mit Cache-Buster neu geladen.
- **Menue bleibt vollstaendig** (1.5.57): Filme/Serien/Meine Liste verschwanden,
  sobald eine Quelle leer war (z. B. Jellyfin ohne Key) — die Quelle war dann in
  den Einstellungen nicht mehr erreichbar. Leere Ansichten zeigen jetzt einen
  Hinweis statt eines fehlenden Reiters.
- **Einstellungen scrollen** (1.5.56): bei laengerem Inhalt war der obere Teil
  abgeschnitten und per Fernbedienung nicht erreichbar (am LG gemessen).
- Zwischenversionen **1.5.53–1.5.55** waren Zwischenbauten derselben Aenderungen
  (Quellen-Schalter in der Wand, EPG-Knopf in der Senderliste, Scroll-Fix).

## 1.5.52 — 25.11.2026

Kamera-Wand und Quellen-Schalter.

- **Kamera-Wand** (Vollbild): Firmen-Kameras als Raster, Spalten 1–4 wählbar,
  Name klein auf dem Bild (kein Balken über dem Video), Zurück-Knopf und
  Zähler in der Kopfzeile außerhalb des Rasters.
- **Quellen-Schalter** in den Einstellungen („Kameras & freie Streams“):
  Firmen-Kameras (VLAN), freie Kameras, freie Streams — je AN/AUS. Die Flags
  greifen an der DATENQUELLE: abgeschaltet wird nicht geladen und nicht gescannt,
  Demo-Knopf und Wand-Knopf verschwinden mit.
- **Firmen-Kameras über das CamViewer-Backend**: `GET /api/cameras` liefert ein
  Objekt `{cameras:[…]}` (kein Array), der Producer wird je Kamera mit
  `/api/stream/<id>` angestoßen (idempotent), gespielt wird
  `<base>/hls/<id>/index.m3u8` — ffmpeg-HLS, weil der TV-Chromium go2rtc-HLS
  nicht parst (Anlauf ohne Keyframe, fatales fragmentParsingError).

## 1.5.51 — 24.11.2026

Kamera-Wiedergabe: `recoverMediaError` bei `MEDIA_ERROR`, um die Instanz zu
retten, bevor der Screen neu aufgebaut wird. Gegen go2rtc half das nicht
(Backend-Pfad kam in 1.5.52); der Handler bleibt als Schutz bei echten
Segmentfehlern.

## 1.5.50 — 24.11.2026

Jellyfin meldet sich beim Start selbst wieder an (`jfauto_user`/`jfauto_pw` mit
Guard in `init()`), wenn kein Token mehr im Speicher steht — Filme/Serien bleiben
nach einem harten Kill also da. Außerdem war `APP_VERSION` hardgecoded alt; die
Konstante wird ab jetzt bei jedem Release mitgezogen.

## 1.5.18 – 1.5.49

Diese Versionen wurden gebaut, ohne dass der Repository-Baum mitgezogen wurde
(die laufende Linie lag auf dem Entwicklungsrechner). Der Stand ist mit 1.5.52
vollständig im Repo. Schwerpunkte der Linie: Mehrsprachigkeit (74 Sprachdateien,
Sprachwahl in den Einstellungen), Demo-Modus mit öffentlich-rechtlichen Sendern,
Jellyfin als zweite VOD-Quelle, Kamera-Tab mit drei Server-Formaten, Splash-
Screen und die Store-Vorbereitung (Lizenzen im Auslieferpaket).

## 1.5.11 — 22.11.2026

CSS im TV-Chromium nachgerüstet.

- `inset` kennt der TV-Chromium ebenfalls nicht: das Hero-Bild
  schrumpfte auf 1280 px und das Verwaltungs-Overlay deckte nicht den
  ganzen Bildschirm (das war die „Liste mitten in den Gruppen" von
  1.5.1). Alle drei Stellen stehen jetzt auf top/left/right/bottom.

## 1.5.10 — 22.11.2026

Film-Detail als Hero (Wunsch: „Menu mit den Infos auf das große Bild").

- Das Detail zeigt das Bild jetzt groß im Hintergrund (16:9-Backdrop
  von TMDB, sonst das Cover), mit Verlauf nach unten und die Infos
  und Knöpfe darunter: Zurück, Abspielen, IMDb, Merken, Favorit.
- Steuerkreuz: Fokus startet auf „Abspielen", UP/DOWN durch die
  Knöpfe, BACK raus. Serien-Episoden und Knöpfe sind jetzt ebenfalls
  fokussierbar (fehlte tabindex — der Steuerkreuz-Fix aus der
  Einstellungs-Runde).
- Serien-Poster auf feste 300×450 Höhen (der Prozentbezug auf den
  breiten Container machte 2700 px hohe Poster).

## 1.5.8 — 22.11.2026

Cover-Raster bedienbar (webOS-Chromium-Kompatibilität).

- Der webOS-Chromium kennt CSS `aspect-ratio` nicht — das Poster
  kollabierte auf Höhe 0: Fokus und Klick landeten im Nichts,
  „kein Fokus, nicht bedienbar" auf jedem Cover.
- `.poster`/.detail-poster jetzt mit Höhen-Trick (padding-bottom
  150 %) und absoluten Bildern. Am Geräte gemessen: Zellenhöhe > 0,
  Fokus setzt, OK öffnet den Film.

## 1.5.9 — 22.11.2026

Der versteckte Re-Render-Lauf.

- Beim Öffnen eines Covers lief ein Raster-Render, während die
  Filmen-Seite verdeckt war — Null-Höhen-Zellen, die nach dem Rückweg
  blieben (Fokus/Klick tot).
- Versteckte Grids rendern jetzt nicht; beim Zurückkehren wird ein
  kollabiertes Raster (0-px-Zellen) erkannt und frisch aufgebaut.
  Am Gerät: Cover → OK (Detail) → BACK → Zellen 299 px, Fokus setzt.

## 1.5.7 — 22.11.2026

Filme und Serien steuerkreuzfest.

- In Filme/Serien kam das Steuerkreuz nicht aus der Tab-Zeile raus:
  die Kategorie-Zeilen sind Divs ohne tabindex — nie fokussierbar.
  Beide Render-Pfade setzen jetzt tabIndex 0 („Alle Filme", Gruppen-Zeilen).
- Wirkweise am Gerät/Harness: Tab DOWN → Kategorie, DOWN → nächste
  Kategorie, RIGHT → Streams (Poster-Raster), LEFT zurück.
- Tests N1–N20 grün, Basis-Suite grün.

## 1.5.6 — 22.11.2026

Einstellungen per Steuerkreuz bedienbar.

- Beim Öffnen der Einstellungen steht der Fokus sofort auf dem ersten
  Aktion-Knopf (Öffnen). DOWN/UP läuft durch alle Zeilen (Öffnen,
  Vorschaufenster, IMDb, PIN ...), OK löst aus, BACK verlässt.
- Tests N1–N19 grün, Geräte-Check (Initialfokus • outline solid) bestätigt.

## 1.5.5 — 22.11.2026

Sortier-Screen steuerkreuzfest + Topbar-Ring.

- **Hoch/Runter geht jetzt durch die Gruppen-Zeilen** (vorher sprang
  der Fokus nicht aus der obersten Zeile — genau dein „kam nicht
  durch die Gruppen"). UP aus der obersten Zeile führt in die
  Knopf-Zeile, DOWN wieder zurück in die Liste.
- **OK auf einer Gruppe markiert/abwählt sofort** (mit Speichern —
  nichts geht beim Zurückgehen verloren), Statuszeile meldet
  „Ein/Aus: <Gruppe> · gespeichert".
- Der RIGHT-Lauf in der Topbar-Zeile geht komplett: **Tabs … →
  Downloads | Einstellungen | Suchfeld**; im Suchfeld geleitet
  **RIGHT** zur Einstellungs-Zeile zurück, **LEFT** in die Tab-Zeile.
- Tests N1–N17 grün, Geräte-Check (Fokus solid, Zeilen-Schritte,
  Workflow) bestätigt.

## 1.5.4 — 22.11.2026

Fokus sichtbar, Navigation in Zonen, beide Workflows komplett.

- **Fokus überall sichtbar**: Fokussierte Gruppen-Zeilen, Knöpfe, Tabs
  und Kategorien zeigen einen Gold-Rahmen + Helltönung. Nach dem Öffnen
  des Gruppen-Screens steht der Fokus sofort auf der ersten Zeile
  (vorher leere Anzeige, „wo bin ich?“).
- **Navigation in Zonen**: Hoch/Runter springt Bereichswahl →
  Werkzeug-Knöpfe → Gruppenliste (nicht mehr linear durch alle
  Elemente). Links/Rechts bewegt INNERHALB der jeweiligen Zeile,
  am Zeilenrand bleibt der Fokus stehen.
- **„🚫 Alles ausblenden"**: Startet den inversen Workflow — alles
  ausgeblendet, die anzuzeigenden Gruppen markieren, BLAU wendet an.
- **🎯 Mehrere markieren startet mit dem Ist-Zustand**: nach GELB alles
  markiert (abwählen, was weg), nach 🚫 nichts markiert (markieren, was
  gezeigt wird). BLAU übernimmt beide Richtungen.
- Tasten-Legende unten aktualisiert.

## 1.5.3 — 22.11.2026

Rückmeldung umgesetzt: Der Gruppen-Screen ist jetzt voll nutzbar mit der
Original-Fernbedienung.

- **Bildschirmgröße & Scroll**: „Gruppen sortieren & ausblenden" fillt
  jetzt die volle Höhe — die Liste scrollt (Steuerkreuz), Titel,
  Bereichs-Wahl und Knöpfe stehen fest oben.
- **Tasten-Legende unten fest** (scrollt nicht mit): OK = Gruppe
  verwalten · GRÜN/ROT = hoch/runter · GELB alles markieren · BLAU nur
  markierte zeigen · BACK zurück. Änderungen werden sofort gespeichert.
- **Kein „OK halten" mehr nötig**: Die Original-Fernbedienung sendet
  beim Halten keine Tastenwiederholung — die Halten-Erkennung hätte
  dort nie funktioniert. Jetzt: **OK auf einer Gruppen-Zeile öffnet
  direkt das Verwaltungs-Menü** (ausblenden, umbenennen, sortieren).
  In den Seiten (Live/Filme/Serien) bleibt OK = Gruppe wählen.
- **„🎯 Mehrere markieren"** als eigener Knopf oben = der komplette
  Workflow (alles markiert starten → Abwählen was weg → „NUR
  MARKIERTE BEHALTEN" blendet den Rest aus) ohne Halten.
- GELB (alles markieren) und alle Workflow-Aktionen speichern sofort —
  „Zurück" verliert nichts mehr.
- Browser-Tests N1–N12 + Basis-Suite grün, Geräte-Checks bestätigt.

## 1.5.2 — 22.11.2026

Die MENÜ-Taste ist auf LG-Fernbedienungen vom System belegt (öffnet das
LG-Menü) — sie wird nicht mehr benutzt. Der komplette Gruppen-Weg läuft
jetzt zentral in den Einstellungen.

- **Einstellungen → „Gruppen sortieren & ausblenden"** = komplettes
  Sortier-Menü:
  - Drei **explizite** Sortier-Knöpfe mit aktiv-Markierung:
    **↕ Nummer / A–Z / ☰ Manuell** (kein Blind-Zyklus mehr).
  - **GRÜN/ROT** = markierte Gruppe hoch/runter (Modus „Manuell" wird
    beim Verschieben automatisch aktiv).
  - **OK HALTEN** auf einer Zeile = Einzeln-Menü (Umbenennen,
    Sortier-Zyklus, Alle markieren, Ausblenden).
  - **OK** = markieren/abwählen, GELB = alles markieren, BLAU =
    nur markierte zeigen.
  - Hilfetexte im Screen erklären alles, ohne die Menü-Taste.
- Die Gruppen-Zeilen (Live/Filme/Serien-Seiten) öffnen das
  Einzeln-Menü ebenfalls per OK-Halten; Zeiger-Langpress (550 ms)
  bleibt als Bonus.
- Alle Navigations-Tests (N1–N10) im Browser-Harness grün.

## 1.5.1 — 22.11.2026

Fernbedienungs-Debugging nach Smartyts Rückmeldung — das Steuerkreuz
arbeitet jetzt überall richtig, auch neben der Maus-Option.

- **Suchfeld-Falle behoben**: Das Suchfeld startet NICHT mehr durch die
  Pfeil-Navigation (Hoch/Runter aus der Tab-Zeile geht direkt in
  Senderliste bzw. Film-/Serien-Raster). Es aktiviert sich nur per
  Klick/Zeiger — und ist aus jedem Feld wieder heraus: **Back** verlässt
  es (Fokus zurück auf den aktiven Tab), Hoch/Runter ebenfalls (Fokus in
  die Tab-Zeile bzw. Liste), Links/Rechts bleibt Cursor. Kein Hängen
  mehr im Suchfeld.
- **Tab-Zeile links/rechts**: In der Kopfzeile verschieben
  Links/Rechts den Fokus INNERHALB der Tabs (Live → Filme → Serien → …),
  OK wechselt die Seite. Erst am Zeilenrand wandert der Fokus in die
  Spalten daneben. Die Topbar (Einstellungen/… ) verhält sich gleich.
- **Langer Druck klappt auf zwei Wegen**:
  - **OK halten** auf einer Gruppe (Fernbedienung): kurzer Druck wählt
    aus, Halten öffnet das Gruppen-Untermenü (Desktop-Präzedenz).
  - **Zeiger halten** (Magic-Remote-Maus): 550 ms auf einer Gruppe =
    Untermenü; der dann folgende Klick wird sauber unterdrückt.
- **Fehler im Gruppen-Menü behoben** (`cp is not defined`): Das
  Untermenü einer Gruppe blieb bei OK-Halte/Longpress/Menü-Taste leer;
  der Sortier-Zyklus Nummer/A–Z/Manuell ist jetzt auch dort sichtbar.
- Alle 7 Navigations-Tests im Browser-Harness grün
  (Down→Inhalt, Tab links/rechts, Suchfeld-Flucht, OK-Halten,
  Pointer-Langpress, Kurz-OK-Wahl, kein autofokus).

## 1.5.0 — 22.11.2026

Bedienung & Options-Ausbau nach der stabilen nativen Basis (1.4.0).

- **Gruppen-Verwaltung, zwei Wege (wie Desktop)**:
  - **Langdruck/Menü-Taste auf einer Gruppe** öffnet ihr Untermenü:
    „🎯 Mehrere markieren" startet mit **ALLES markiert** — abwählen,
    was nicht gezeigt werden soll, dann „🚫 Nur markierte behalten"
    blendet ALLEN Rest aus („Alle markieren"/„Aufheben"/Blöcke
    hoch/runter sind weiter da). Genau der geforderte Ablauf.
  - **Sortierung wie Desktop**: Zyklus **Nummer → A–Z → Manuell**
    (im Gruppen-Menü und in Einstellungen → Gruppen verwalten);
    manuelles ▲▼ verschiebt und schaltet automatisch auf „Manuell";
    die Such- und Kanalfilter der drei Modi folgen in Listen,
    Zählern und Suche.
  - Die **Suche durchsucht nur noch aktive Gruppen** (war schon so —
    jetzt verifiziert auf Live, Filme und Serien).
  - Einstellungen → Gruppen verwalten bleibt als Vollbild-Verwaltung;
    dort: GRÜN/ROT = Gruppe hoch/runter, GELB = alles markieren,
    BLAU = nur markierte zeigen, MENÜ auf Zeile = Einzeln-Menü.
- **Vorschaufenster**: Fokus ruht 900 ms auf einem Sender in der
  Live-Liste → kleines stilles Live-Bild rechts, darunter EPG
  (aktuelle Sendung + Restlaufzeit + Fortschrittsbalken). Fokus
  weiterwandern = neue Vorschau; Kategorien/Suche = Vorschau zu.
  Notbremse: 3 Fehlversuche → aus für die Sitzung, in den
  Einstellungen zuschaltbar/abschaltbar.
- **Merken (Watchlist)**: neuer Tab „Merken" mit Poster-Kacheln für
  Filme und Serien; im Detail „☆ Merken" / „✓ Gemerkt". Pro Profil
  gespeichert. Merk-Kachel öffnet das zugehörige Detail.
- **IMDb-/Trailer-Zusatzinfos**: Film-Detail lädt get_vod_info und
  zeigt IMDb-Wertung, Genre, Startdatum, Laufzeit als Chips plus
  „▶ Trailer" (YouTube-Einbettung; wenn ein Gerät den nicht rendert,
  bleibt es gefahrlos dunkel — zurück genügt). Serien-Detail zeigt die
  5-Sterne-Wertung. In den Einstellungen abschaltbar.
- **Transparentes OSD**: Titel + Uhrzeit + EPG-Zeile + Laufzeitbalken
  mit Endezeit und Restlaufzeit (Live: Fortschritt im laufenden
  Programm; VOD: Position von Gesamtzeit). Läuft im Sekundentakt mit.
- **Einstellungen aufgeräumt**: Puffer-Knopf entfernt (seit der native
  Wiedergabe steuert webOS den Puffer; die Stufen wirken nur noch im
  hls.js-Fallback), Bildschirmschoner/Wiedergabe/Speicher-Wächter zu
  einer kompakten „System"-Zeile zusammengefasst.

## 1.4.0 — 22.11.2026

Wiedergabe-Pipeline umgestellt nach der SIPTV-Analyse: **nativ zuerst**.

- **Native Hardware-Pipeline statt hls.js/MSE für HLS**: SIPTV spielt
  seine HLS-URLs direkt im `<video>`-Element; webOS 6.5 verarbeitet HLS
  über die LG-UMS-Pipeline in Hardware (Hol+Demux+Decode). Gemessen am
  OLED65C17LB mit derselben Line: **Bild nach ~1,3 s** statt ~4,8 s mit
  hls.js. Nebenher entfällt das JS-Transmuxing komplett — deutlich
  weniger CPU-Druck, kein Ruckeln, Heap bleibt flach.
- **v1.4.0-Reihenfolge**: `.m3u8` → nativ; wenn nativ 12 s ohne Bild
  bleibt oder fehlschlägt, fällt die App EINMAL pro Wiedergabe auf
  hls.js zurück (bisherige Puffer-Konfiguration greift dort weiter).
  VOD (`mp4`) spielt grundsätzlich nativ — damit funktioniert VOD auf
  dem TV erstmals wie üblich (vorher ging der mp4-Pfad durch hls.js).
- **Stillstands-Wächter** arbeitet weiter am Video-Element und
  reconnectet nativ wie mit hls.js; Zap-Prefetch und Sofort-Start-Cache
  aus 1.3.x bleiben.

## 1.3.1 — 22.11.2026

„SIPTV-Gefühl"-Paket: wahrgenommene Geschwindigkeit, gemessen am Gerät.

- **Sofort-Start aus Cache**: Senderliste, Kategorien und VOD-/Serien-
  Kategorien liegen in IndexedDB. Ab dem zweiten Start steht die
  Senderliste in deutlich unter einer Sekunde (im Test 0,2 s statt
  Ladebildschirm bis zur Netzantwort); das Netz frischt danach im
  Hintergrund auf und die Listen werden ohne Fokus-/Scroll-Verlust
  ausgetauscht. Schlaegt die Auffrischung fehl, bleibt der Cache-Stand
  sichtbar.
- **Zap-Prefetch**: Ruht der Fokus auf einem Sender, wird dessen
  Playlist angefordert und nach den ersten Bytes wieder abgebrochen —
  der Stream-Prozess beim Anbieter läuft dann bereits, das Bild
  erscheint beim Klick spürbar früher.
- **Weniger Ruckeln unter Last**: `capLevelOnFPS` — bricht die
  Dekodier-Geschwindigkeit ein, schaltet hls.js selbst auf eine
  leichtere Qualitätsstufe, statt mit voller Auflösung zu stottern.
- Hintergrund-Auffrischung wirft nie den sichtbaren Stand zurück in
  den Pairing-Screen (Fehler im Hintergrund wird still behandelt).

## 1.3.0 — 22.11.2026

Komplette Speicher- und Start-Überarbeitung für den LG OLED65C17LB
(webOS 6.5, Chrome 79, 2,6 GB RAM — davon dauerhaft unter 200 MB frei).

- **Senderliste virtualisiert**: vorher standen beim Start alle ~8.000
  Sender als DOM-Elemente im Speicher (~24.000 Knoten, ~103 MB JS-Heap,
  mehrsekundige Blockade). Jetzt liegen nur die sichtbaren Zeilen im DOM
  — die Liste startet mit ~2.000 Knoten. Scroll-Position und Fokus bleiben
  bei jedem Neu-Aufbau erhalten.
- **Filme-/Serien-Gitter virtualisiert**: statt bis zu ~29.000 Poster-
  Elementen auf einen Schlag werden nur die sichtbaren Reihen gebaut;
  Poster laden mit `loading="lazy"` erst, wenn sie wirklich auftauchen.
  Klicks laufen über einen zentralen Handler (keine Closures mehr pro
  Element).
- **EPG-Fenster begrenzt** (−6 h bis +30 h): das XMLTV-Vollprogramm über
  mehrere Tage erzeugte hunderttausende Objekte im Heap; Rohtext und
  XML-Dokument werden nach dem Parsen sofort für den Garbage Collector
  freigegeben.
- **Speicherwächter** (Hintergrund, alle 10 s): misst JS-Heap und DOM-
  Knotenzahl; ab 62 % bzw. 15.000 Knoten werden verdeckte Ansichten
  geleert, ab 82 % bzw. 40.000 Knoten wird zusätzlich das EPG-Datenobjekt
  verworfen (lädt nach 60 s still neu). Läuft ohne Unterbrechung — die
  Wiedergabe wird nie angefasst. Status in Einstellungen → Speicher-Wächter.
- **Wiedergabestart beschleunigt**: `startPosition: -1` springt sofort
  ans Live-Ende, Manifest/Level-Timeouts und Retries verkürzt (8 s/
  2–3 Versuche), Rückpuffer von 30 s auf 10 s gesenkt.
- **Puffer-Bug behoben**: `maxBufferLength`/`maxMaxBufferLength` standen
  zweimal in der hls.js-Konfiguration — die zweite Angabe (12/30 s) hat
  die Einstellung aus den Einstellungen still überschrieben. Der
  Puffer-Knopf wirkt jetzt tatsächlich; Standard-Puffer ist auf
  TV-Größe gesenkt (40 MB statt 60 MB, 20 s statt 30 s).

## 1.2.1 — 29.10.2026

**Stabile Player-ID (PLAYER-IDENTITY.md v1).** Neue Installationen leiten die
Player-ID deterministisch aus gerätestabilen Merkmalen ab (`nduid|model`,
SHA-256) statt sie zu würfeln; eine bereits gespeicherte ID bleibt
unangetastet. Hintergrund: die Panel-Line ist per AAD an die Player-ID
gebunden — eine verlorene ID bedeutet Neu-Einrichtung beim Nutzer.

## 1.2.0 — 27.10.2026

Nachgezogen auf den Stand von Android v0.8.31 und Desktop 2.0.0.

- **Stillstands-Wächter** für Live-TV: prüft im Sekundentakt, ob die
  Wiedergabeposition weiterläuft, und verbindet nach 3 s Stillstand neu.
  15 s Anlaufphase, damit der Puffer sich füllen kann; nie bei VOD und nie
  bei pausierter Wiedergabe.
- **Puffer einstellbar**: Automatik oder 3, 5, 8, 12, 20, 30 s. Wirkt auf
  `maxBufferLength`, `maxMaxBufferLength` und `liveSyncDurationCount` von hls.js.
- **Programmraster**: 6-Stunden-Fenster ab jetzt statt 24 Stunden, laufende
  Sendung hervorgehoben, Klick auf eine Sendung startet den Sender, Bildlauf
  springt auf die aktuelle Stunde.
- **Staffel abspielen**: Folgeschlange je Staffel, überspringt bereits zu Ende
  gesehene Folgen, Abspann-Hinweis 5 s vor Schluss (Zurück-Taste bricht ab).
- **IMDb- und Filmstarts-Verweis** im Film-Detail als QR-Code.
- **Mehrzeilen-Modus**: Gruppen aller aktiven Leitungen werden nach Namen
  zusammengefasst, gleiche Sendernamen erscheinen nur einmal.
- **Logo und Erscheinungsbild**: aktuelles Player-Logo als App-Icon und in der
  App; Fokusrahmen für die Fernbedienung, ruhigerer Hintergrund.
- **Behoben**: Die Serien-Detailansicht ließ sich nie öffnen — der Parameter
  von `openSeriesDetail` hieß selbst `show` und überdeckte damit die globale
  Funktion `show()` (TypeError). In v1.1.2 war jede Serie unerreichbar.
- **Behoben**: `build_ipk.sh` baut das Paket ohne ares-cli (ar-Archiv mit
  debian-binary, control.tar.gz, data.tar.gz).

## 1.1.2 — 17.10.2026
- Unlock-Fix (WebCrypto Promise-Kette in secDeriveKey), E2E verifiziert.

## 1.1.1
- QR-Code-Fix.

## 1.1.0
- Vollparität mit Android v0.8.6: Sicherheits-Passwort, Kategorie- und
  Kanalverwaltung, Elternschutz-PIN, Profile.

## 1.0.0
- Erste webOS-App: Pairing, Live-TV, VOD, EPG, Timeshift.
