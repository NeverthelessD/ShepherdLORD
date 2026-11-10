#!/usr/bin/env bash
# 맥 앱 만들기: Swift 껍데기(app/shell/main.swift) → ShepherdLORD.app (Apple Silicon + Intel), ad-hoc 서명
# 사용: scripts/build-mac.sh [출력폴더] [버전(시험용, 비우면 app/VERSION)]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-build/mac}"
VER="${2:-$(tr -d '[:space:]' < app/VERSION)}"
APP="$OUT/ShepherdLORD.app"
rm -rf "$OUT"; mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
for arch in arm64 x86_64; do
  swiftc -O -target "$arch-apple-macos11.0" app/shell/main.swift -o "$OUT/ShepherdLORD-$arch" -framework AppKit -framework WebKit
done
lipo -create "$OUT/ShepherdLORD-arm64" "$OUT/ShepherdLORD-x86_64" -output "$APP/Contents/MacOS/ShepherdLORD"
rm -f "$OUT/ShepherdLORD-arm64" "$OUT/ShepherdLORD-x86_64"
iconutil -c icns app/icon/AppIcon.iconset -o "$APP/Contents/Resources/AppIcon.icns"
cp app/icon/icon-256.png "$APP/Contents/Resources/icon-256.png"
sed "s/__VERSION__/$VER/g" app/Info.plist > "$APP/Contents/Info.plist"
printf 'APPL????' > "$APP/Contents/PkgInfo"
codesign --force --deep -s - "$APP"
codesign --verify --deep --strict "$APP"
echo "built $APP ($VER)"
