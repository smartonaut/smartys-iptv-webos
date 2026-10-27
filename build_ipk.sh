#!/usr/bin/env bash
# Baut das webOS-Paket (.ipk) ohne ares-cli.
#
# Das Format ist ein ar-Archiv mit drei Mitgliedern in fester Reihenfolge:
#   debian-binary, control.tar.gz, data.tar.gz
# Inhalt unter usr/palm/applications/<id>/ (die App) und
# usr/palm/packages/<id>/packageinfo.json (Paket-Metadaten).
#
# Aufruf:  ./build_ipk.sh
set -euo pipefail

cd "$(dirname "$0")"

ID=$(python3 -c "import json;print(json.load(open('appinfo.json'))['id'])")
VERSION=$(python3 -c "import json;print(json.load(open('appinfo.json'))['version'])")
IPK="$(pwd)/${ID}_${VERSION}_all.ipk"
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

APP="$STAGE/usr/palm/applications/$ID"
PKG="$STAGE/usr/palm/packages/$ID"
mkdir -p "$APP" "$PKG"

# App-Dateien (ohne Entwicklungs-Kram)
cp -r index.html css js img appinfo.json "$APP"/
[ -f icon.png ] && cp icon.png "$APP"/
[ -f icon-large.png ] && cp icon-large.png "$APP"/
[ -f LICENSE ] && cp LICENSE "$APP"/
rm -rf "$APP/js/node_modules" 2>/dev/null || true

cat > "$PKG/packageinfo.json" <<EOF
{
  "id": "$ID",
  "version": "$VERSION",
  "app": "$ID"
}
EOF

CTRL="$STAGE/control"
mkdir -p "$CTRL"
SIZE=$(du -sk "$STAGE/usr" | cut -f1)
cat > "$CTRL/control" <<EOF
Package: $ID
Version: $VERSION
Section: misc
Priority: optional
Architecture: all
Installed-Size: $SIZE
Maintainer: Smartys <info@smartys.tech>
Description: Smartys Player — IPTV fuer LG webOS (Live-TV, VOD, EPG)
webOS-Package-Format-Version: 2
webOS-Packager-Version: x.y.x
EOF

( cd "$STAGE" && tar czf "$STAGE/data.tar.gz" usr )   # Pfade müssen usr/palm/... sein
( cd "$CTRL" && tar czf "$STAGE/control.tar.gz" control )
printf '2.0\n' > "$STAGE/debian-binary"

rm -f "$IPK"
( cd "$STAGE" && ar rc "$IPK" debian-binary control.tar.gz data.tar.gz )

echo "fertig: $(basename "$IPK") ($(stat -c%s "$IPK") Bytes, Version $VERSION)"
echo "Installation: luna-send -i 'luna://com.webos.appInstallService/dev/install' '{\"id\":\"com.unknown.appinstall\",\"ipkUrl\":\"<pfad>\",\"subscribe\":true}'"
