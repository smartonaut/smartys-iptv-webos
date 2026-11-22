Smartys M3U Player — Installation auf LG TV (webOS)
====================================================

Voraussetzungen
---------------
- LG TV mit webOS (TV ist ~1 Jahr alt → webOS 24/25; die App nutzt
  abwärtskompatible APIs, läuft also auch auf älteren webOS-Versionen)
- Der TV und dieser Rechner müssen im selben Netz hängen
- Die App-Datei: **com.smartys.iptv_1.5.7_all.ipk**
  liegt unter ~/Projekte/Smartys Player/webOS/ (mit ./build_ipk.sh neu baubar)
  oder als Download: https://github.com/smartonaut/smartys-iptv-webos/releases/latest


Schritt 1 — LG Developer Mode einschalten (einmalig)
----------------------------------------------------
1. Kostenloses LG-Developer-Konto anlegen:
   - https://webostv.developer.lge.com/ öffnen (Portal: developer.lge.com)
   - "Sign In" → "Create Account", E-Mail bestätigen

2. Am TV: LG Content Store (heißt je nach Baujahr auch "Apps") öffnen,
   nach "Developer Mode" suchen und die App installieren.
   Einen Menüpunkt "LG Developer Mode" unter "Über diesen Fernseher" gibt es
   bei webOS 6 und neuer NICHT — das ist der häufigste Irrweg.

3. Die "Developer Mode"-App öffnen, mit dem LG-Konto anmelden und
   "Dev Mode Status" auf ON stellen. Der TV startet neu.

4. Nach dem Neustart die App wieder öffnen. Dort stehen die drei Dinge,
   die gleich wichtig sind:
     - IP-Adresse des Fernsehers
     - Passcode / Passphrase (6-stellig, z. B. "123456")
     - "Key Server" → muss zusätzlich auf ON stehen, sonst nimmt der TV
       keine Verbindung von außen an

   Der Developer Mode läuft 1.000 Stunden (bei älteren Geräten 50).
   Ist die Zeit abgelaufen, entfernt der TV die App wieder. Rechtzeitig in
   der App auf "Extend" drücken — nach Ablauf lässt sich nicht verlängern.
   Ein Konto darf immer nur auf EINEM Fernseher gleichzeitig angemeldet sein.


Schritt 2 — IP-Adresse des TVs herausfinden
-------------------------------------------
Am TV: Einstellungen → Allgemein → Netzwerk → Verbindungsstatus
Dort steht die IP, z. B. 192.0.2.12.


Schritt 3 — App installieren
----------------------------
Es gibt zwei Wege. Weg A (über das Netz, empfohlen) ist der schnellste.

WEG A — über das Netz vom Raider aus (empfohlen)
------------------------------------------------
Auf diesem Rechner liegt die ares-cli bereits im Projekt
(~/Projekte/Smartys Player/webOS/node_modules/.bin/, geprüft: Version 2.4.0),
aufgerufen wird sie über npx.

Zuerst den TV einmalig als Gerät registrieren:

    cd ~/Projekte/Smartys Player/webOS
    npx ares-setup-device -a tv -i '{"host":"<TV-IP>","port":"9922","username":"prisoner"}'

    (Port 9922 und Benutzer "prisoner" sind bei jedem LG-TV gleich.
     Ein "-p <Passcode>" gibt es bei ares-setup-device NICHT.)

Passcode abholen — es wird nach dem 6-stelligen Code vom TV gefragt:

    npx ares-novacom --device tv --getkey

Danach die App installieren:

    npx ares-install --device tv com.smartys.iptv_1.5.7_all.ipk

Fertig. Die App erscheint nach ein paar Sekunden auf dem Home-Bildschirm
unter dem Namen "Smartys M3U Player".

App später starten:

    npx ares-launch --device tv com.smartys.iptv

WEG B — webOS Dev Manager (Handy, kein Rechner nötig)
-----------------------------------------------------
1. App "webOS Dev Manager" auf dem Handy installieren.
2. Fernseher hinzufügen (IP + Passcode aus der Developer-Mode-App).
3. Die .ipk auswählen und installieren.

WICHTIG: Weder einen "Web Server"/"Upload" in der Developer-Mode-App noch eine
USB-Installation gibt es bei webOS 6 und neuer. Der USB-Stick wird am Fernseher
nicht als Installationsquelle angenommen — das ist eine Sperre von LG, kein
Fehler in der Anleitung. Es bleiben nur ares-cli (Weg A) und der Dev Manager.


Schritt 4 — App einrichten (Pairing)
------------------------------------
1. Die App "Smartys M3U Player" am TV starten.
2. Es erscheint der Freischalt-Bildschirm mit drei Dingen:
     - Player-ID (z. B. 02:AB:CD:EF:12:34)
     - Passwort (12 Zeichen)
     - QR-Code (weißes Feld, wie auf Android)
3A. QR-WEG (einfachste Variante): QR-Code mit dem Handy scannen → öffnet
    https://panel.smartys.tech/pair?mac=…&pw=… und koppelt den TV direkt.
    Danach Playlist im Panel hinterlegen und am TV auf
    „Prüfen — Playlist laden" klicken.
3B. Klassischer Weg: Am Computer https://panel.smartys.tech öffnen, mit
    Player-ID und Passwort anmelden, Playlist hinterlegen (Xtream-Zugangsdaten).
4. Zurück am TV auf „Prüfen — Playlist laden" klicken.
5. Die App lädt Kanäle, Filme und Serien und zeigt dann die Hauptansicht.


Hinweise
--------
- Der LG Developer Mode ist eine Entwickler-Sperre: installierte Sideload-Apps
  laufen nur, solange der Dev Mode aktiv ist. Wird er deaktiviert, verschwinden
  die Apps wieder. Für den dauerhaften Betrieb (z. B. im Büro) den Dev Mode
  einfach aktiv lassen.
- Die App nutzt dasselbe Backend wie die Android-/Desktop-Version
  (panel.smartys.tech). Einmal gepairt, gelten die Zugangsdaten wie überall.
- Sollte ein Kanal schwarz bleiben: Die App nutzt hls.js. Bei älteren webOS-
  Versionen greift automatisch natives HLS (Safari/WebKit).
- Welche Version installiert ist, steht in der App unter Einstellungen →
  Über (z. B. „Smartys Player 1.5.1 (webOS)“).
- Für einen Fernseher in einem anderen Haushalt ist der webOS Dev Manager
  (Weg B) der einfachste Weg: kein Rechner, keine ares-cli — nur Handy,
  IP und Passcode. Die .ipk vorher von der Release-Seite herunterladen.


v1.2.0 — Parität mit Android v0.8.31 und Desktop 2.0.0
------------------------------------------------------
- **Stillstands-Wächter für Live-TV**: prüft im Sekundentakt, ob die
  Wiedergabeposition weiterläuft, und verbindet nach 3 s Stillstand neu.
  15 s Anlaufphase (sonst Endlosschleife beim Puffern), nie bei VOD, nie
  bei pausierter Wiedergabe.
- **Puffer einstellbar** (Einstellungen → „Puffer ändern"): Automatik oder
  3/5/8/12/20/30 s. Wirkt auf die Pufferstrategie von hls.js.
- **Programmraster**: 6-Stunden-Fenster ab jetzt statt 24 Stunden,
  laufende Sendung hervorgehoben, Klick auf eine Sendung startet den Sender,
  Bildlauf springt auf die aktuelle Stunde.
- **Staffel abspielen**: Folgeschlange je Staffel, überspringt bereits zu
  Ende gesehene Folgen, Abspann-Hinweis 5 s vor Schluss (Zurück bricht ab).
- **IMDb- und Filmstarts-Verweis** im Film-Detail als QR-Code — ein Fernseher
  öffnet keine Links.
- **Mehrzeilen-Modus**: Gruppen aller aktiven Leitungen werden nach Namen
  zusammengefasst, gleiche Sendernamen erscheinen nur einmal.
- **Logo und Fokus**: aktuelles Player-Logo als App-Icon und in der App;
  goldene Fokusrahmen für die Fernbedienung.
- **Behoben**: die Serien-Detailansicht ließ sich seit 1.1.0 nie öffnen
  (Parameter `show` überdeckte die globale Funktion `show()`).
- **Weggelassen und warum**: 36 Sprachen (Sprache steht im Gerät), Aufnahme
  (kein beschreibbarer Speicher für Live-Mitschnitte), Offline-Downloads.

### Paket selbst bauen
    cd ~/Projekte/Smartys Player/webOS
    ./build_ipk.sh
Erzeugt com.smartys.iptv_<version>_all.ipk ohne ares-cli (ar-Archiv mit
debian-binary, control.tar.gz, data.tar.gz). Prüfen:
    ar t com.smartys.iptv_1.5.0_all.ipk          # genau drei Einträge
    tar tzf data.tar.gz | head                  # muss mit usr/ beginnen


v1.1.0 — Parität mit Android v0.8.x
------------------------------------
- **Sicherheits-Passwort**: Verschlüsselte Provider-Zeilen (PBKDF2 + AES-GCM,
  exakt wie Android). Passt das Passwort, werden die Zugangsdaten direkt im
  TV entschlüsselt und lokal gespeichert.
- **Menu-Taste auf der Fernbedienung**: Öffnet die Verwaltuns-Übersicht —
  Sortieren (A→Z / Z→A / nach oben-unten), Umbenennen, Ausblenden,
  „Nur markierte behalten", Zurücksetzen. Gilt für Live-Kategorien,
  Filme, Serien — alles pro Profil gespeichert.
- **Kanal-Menü** (Menu-Taste auf Kanal oder Doppelklick): FSK-Sperre
  (PIN), Reihenfolge, Ausblenden.
- **Markierungs-Workflow**: Buttons oben (klein), große Liste darunter —
  markiert = behalten, wie auf dem Cube.
- **FSK-18**: Geklöpte Kanäle werden erst nach PIN-Eingabe abgespielt
  (PIN = dieselbe wie der App-PIN in den Einstellungen).
- **Alle-Kategorie**: Ausgeblendete Kategorien/Gruppen werden unter
  „Alle Kanäle"/„Alle Filme"/„Alle Serien" automatisch ausgeblendet.
- **Fokus-Ring**: Goldener Rahmen um das aktuell fokussierte Element
  (Fernbedienung-Navigation).
- **Responsive**: Layout passt sich kleineren Auflösungen an (< 1280px).
- **QR-Code auf dem Start-Screen** (wie Android): Zentrierter weißer
  QR-Kasten unter Player-ID/Passwort — mit dem Handy scannen öffnet
  panel.smartys.tech/pair?… und koppelt den TV im Panel.
