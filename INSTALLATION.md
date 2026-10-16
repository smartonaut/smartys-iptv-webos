Smartys M3U Player — Installation auf LG TV (webOS)
====================================================

Voraussetzungen
---------------
- LG TV mit webOS (TV ist ~1 Jahr alt → webOS 24/25; die App nutzt
  abwärtskompatible APIs, läuft also auch auf älteren webOS-Versionen)
- Der TV und der Rechner (Raider, 192.168.1.238) müssen im selben Netz hängen
- Die App-Datei: com.smartys.iptv_1.1.0_all.ipk
  liegt auf dem Raider unter: /home/smarty/Projekte/Smartys Player/webOS/


Schritt 1 — LG Developer Mode einschalten (einmalig)
----------------------------------------------------
1. Am TV die Fernbedienung nehmen und zu:
   Einstellungen (Zahnrad) → Alle Einstellungen → Allgemein →
   Über diesen Fernseher

2. Den Menüpunkt "LG Developer Mode" anklicken und auf EIN schalten.

3. Wenn der TV nach einem Konto fragt:
   - Am Computer die Seite https://developers.lg.com/ öffnen
   - Oben rechts auf "Sign In" klicken und ein kostenloses LG-Developer-Konto
     erstellen (oder mit einem bestehenden LG-Konto anmelden).

4. Nach dem Einschalten startet der TV neu.
   Nach dem Neustart liegt auf dem Home-Bildschirm eine App mit dem Namen
   "Developer Mode".

5. Diese "Developer Mode"-App öffnen und ANMELDEN (mit dem LG-Developer-Konto).
   Danach zeigt die App dauerhaft den Status an — dort stehen zwei Dinge,
   die gleich wichtig sind:
     - Der "Passphrase"/Passcode (6-stellig, z. B. "123456")
     - Der Hinweis, dass der TV unter einer IP im Netz erreichbar ist

   Diese App MUSS am Ende wieder geöffnet bleiben bzw. der Dev Mode aktiv sein,
   sonst läuft die installierte App nach 48 Stunden ab (Sicherheits-Sperre).


Schritt 2 — IP-Adresse des TVs herausfinden
-------------------------------------------
Am TV: Einstellungen → Allgemein → Netzwerk → Verbindungsstatus
Dort steht die IP, z. B. 192.168.1.50.


Schritt 3 — App installieren
----------------------------
Es gibt zwei Wege. Weg A (über das Netz, empfohlen) ist der schnellste.

WEG A — über das Netz vom Raider aus (empfohlen)
------------------------------------------------
Auf dem Raider (dieser Rechner) ist die ares-cli schon installiert
(unter ~/Projekte/Smartys Player/webOS/node_modules/.bin/).

Zuerst den TV einmalig als Gerät registrieren:

    cd ~/Projekte/Smartys Player/webOS
    npx ares-setup-device -a <TV-IP> -p "<Passcode>"

    (Passcode = die 6-stellige Zahl aus der Developer-Mode-App)

Danach die App installieren:

    npx ares-install --device <TV-IP> com.smartys.iptv_1.1.0_all.ipk

Fertig. Die App erscheint nach ein paar Sekunden auf dem Home-Bildschirm
unter dem Namen "Smartys M3U Player".

App später starten:

    npx ares-launch --device <TV-IP> com.smartys.iptv

WEG B — über die Developer-Mode-App per Web-Server
--------------------------------------------------
1. Am TV die "Developer Mode"-App öffnen.
2. In der App den Punkt "Web Server" / "Upload" anklicken — die App zeigt dann
   eine Adresse im Browser an, z. B. http://<TV-IP>:80  (oder einen Link).
3. Diese Adresse am Computer im Browser öffnen.
4. Dort die Datei com.smartys.iptv_1.1.0_all.ipk hochladen.
5. Die App wird direkt installiert und erscheint auf dem Home-Bildschirm.

WEG C — über USB-Stick (wenn kein Netz zwischen Rechner und TV)
---------------------------------------------------------------
1. Die .ipk auf einen USB-Stick kopieren.
2. Stick in den TV stecken.
3. Developer-Mode-App öffnen → "USB" / "Install from USB" wählen.
4. Die Datei auswählen und installieren.


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
- Für den Freund-TV ist WEG C (USB-Stick) der einfachste Weg: .ipk vom
  Raider herunterladen (oder von smartys.tech), auf einen FAT32/NTFS-Stick
  kopieren, TV stecken und in der Developer-Mode-App installieren.


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
