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
- Abwärtskompatible webOS-APIs (webOS 22+, läuft auch auf neueren)

## Installation (Developer Mode)

1. `Einstellungen → Allgemein → Über diesen Fernseher → LG Developer Mode = EIN`
2. App „Developer Mode" am TV anmelden (Konto von developers.lg.com)
3. `com.smartys.iptv_<version>_all.ipk` per Dev-Mode-App installieren
4. Details: [INSTALLATION.md](INSTALLATION.md)

## Versionsstand

Aktuell: **v1.2.0** — siehe [Releases](../../releases).

## Lizenz

MIT — siehe [LICENSE](LICENSE).
