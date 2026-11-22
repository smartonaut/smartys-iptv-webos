# Changelog — Smartys Player (LG webOS)

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
