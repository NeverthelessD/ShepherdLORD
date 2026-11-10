#!/usr/bin/env bash
# 맥 빌드 서버에서: 빌드 → 시험 → 내려받기 zip
set -uo pipefail
cd "$(dirname "$0")/.."
OUT="ci-out"; rm -rf "$OUT"; mkdir -p "$OUT"
VER="$(tr -d '[:space:]' < app/VERSION)"
printf 'build=pending\nsmoke=pending\nversion=%s\n' "$VER" > "$OUT/status.txt"
if ! bash scripts/build-mac.sh build/mac > "$OUT/build.log" 2>&1; then
  printf 'build=fail\nsmoke=skip\nversion=%s\n' "$VER" > "$OUT/status.txt"; tail -40 "$OUT/build.log"; exit 1
fi
APP="build/mac/ShepherdLORD.app"
bash scripts/smoke-mac.sh "$APP" "$OUT"; smoke=$?
# 처음 설치용 zip: ShepherdLORD/ShepherdLORD.app + 사용 가이드
STAGE="build/stage/ShepherdLORD"; rm -rf build/stage; mkdir -p "$STAGE"
ditto "$APP" "$STAGE/ShepherdLORD.app"
cp "app/guide/ShepherdLORD-사용가이드-맥.png" "$STAGE/"
( cd build/stage && ditto -c -k --sequesterRsrc --keepParent ShepherdLORD "../../$OUT/ShepherdLORD-first-install.zip" )
( cd build/mac && ditto -c -k --sequesterRsrc --keepParent ShepherdLORD.app "../../$OUT/ShepherdLORD-mac-update.zip" )
sha=$(shasum -a 256 "$OUT/ShepherdLORD-mac-update.zip" | cut -d' ' -f1)
printf 'build=ok\nsmoke=%s\nversion=%s\nupdate_sha256=%s\n' "$([ $smoke = 0 ] && echo ok || echo fail)" "$VER" "$sha" > "$OUT/status.txt"
cat "$OUT/smoke-steps.txt" >> "$OUT/status.txt"
exit $smoke
