# Changelog — Smartys Player (LG webOS)

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
