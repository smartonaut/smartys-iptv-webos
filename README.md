# Smartys IPTV — LG webOS App

Native IPTV-App für LG Smart TVs (webOS) — Parität zu Android v0.8.31 und Desktop 2.0.0.

## Features

- Live-TV & EPG-Infobar (Sendezeit, Fortschrittsbalken, Videoformat)
- **Stillstands-Wächter**: merkt, wenn das Bild einfriert, und verbindet nach 3 s neu
- **Puffer einstellbar** (Automatik oder 3–30 s) — gegen Ruckeln auf schwachen Leitungen
- **Programmraster** mit 6-Stunden-Fenster; Klick auf eine Sendung startet den Sender
- **Staffel abspielen**: Folgeschlange mit Abspann-Hinweis statt stummem Sprung
- **Mehrzeilen-Modus**: Gruppen mehrerer Leitungen werden zusammengefasst
- **IMDb- und Filmstarts-Verweis** als QR-Code (der Fernseher kann keine Links öffnen)
- VOD: Filme & Serien mit Cover, Beschreibung und Trailer
- Suche, Multi-View (bis zu 4 Fenster), Aufnahme & Timeshift
- AES-256-verschlüsselte Lines (Panel-Entschlüsselung)
- Pairing per MAC + Passwort oder QR-Code aus dem Panel
- Abwärtskompatible webOS-APIs (läuft ab webOS 4.0, also auf Fernsehern ab 2018,
  bis webOS 25 — inklusive webOS 6.0 der 2021er-Modelle wie dem C1)

## Installation (Developer Mode)

1. Kostenloses LG-Developer-Konto auf <https://webostv.developer.lge.com/> anlegen
2. App „Developer Mode" aus dem LG Content Store installieren, mit dem Konto
   anmelden, „Dev Mode Status" = ON, danach „Key Server" = ON
3. `com.smartys.iptv_<version>_all.ipk` per `ares-install` oder webOS Dev Manager
   installieren (IP + Passcode stehen in der Developer-Mode-App)
4. Details: [INSTALLATION.md](INSTALLATION.md)

## Versionsstand

Aktuell: **v1.2.1** — siehe [Releases](../../releases).

## Lizenz

MIT — siehe [LICENSE](LICENSE).
