#!/usr/bin/env bash
# 빌드 서버 결과(ci-results)를 download/ 와 releases/ 에 최신판 하나만 남기도록 정리해요.
# 사용: scripts/publish-download.sh <ci-results 를 풀어 둔 폴더>
set -euo pipefail
src="${1:?ci-results 폴더를 주세요}"
root="$(cd "$(dirname "$0")/.." && pwd)"
ver="$(grep -m1 -oP '(?<=<Version>)[^<]+' "$root/windows/ShepherdLORD/ShepherdLORD.csproj")"
grep -q '^build=ok' "$src/status.txt" || { echo "build 실패"; exit 1; }
grep -q '^smoke=ok' "$src/status.txt" || { echo "smoke 실패"; exit 1; }
grep -q "^version=$ver" "$src/status.txt" || { echo "버전이 달라요: $ver"; exit 1; }
sha="$(grep -oP '(?<=^update_sha256=)[0-9a-f]{64}' "$src/status.txt")"
[ "$(sha256sum "$src/ShepherdLORD-Windows-update.zip" | cut -d' ' -f1)" = "$sha" ] || { echo "sha256 불일치"; exit 1; }
python3 - "$src/ShepherdLORD-Windows.zip" "$ver" <<'PY'
import sys, zipfile, unicodedata
z = zipfile.ZipFile(sys.argv[1]); names = [unicodedata.normalize('NFC', n.replace('\\', '/')) for n in z.namelist()]
assert 'ShepherdLORD/ShepherdLORD.exe' in names, names[:20]
assert any(n.endswith('사용가이드.png') for n in names), '가이드 이미지가 없어요'
v = z.read([n for n in z.namelist() if n.replace('\\','/').endswith('ShepherdLORD/version.txt')][0]).decode().strip()
assert v == sys.argv[2], (v, sys.argv[2])
print('zip ok', len(names), 'files, version', v)
PY
mkdir -p "$root/download" "$root/releases"
find "$root/download" -mindepth 1 ! -name 'ShepherdLORD-Windows.zip' -delete
find "$root/releases" -mindepth 1 ! -name 'ShepherdLORD-Windows-update.zip' ! -name 'latest-windows.json' -delete
cp "$src/ShepherdLORD-Windows.zip" "$root/download/ShepherdLORD-Windows.zip"
cp "$src/ShepherdLORD-Windows-update.zip" "$root/releases/ShepherdLORD-Windows-update.zip"
cat > "$root/releases/latest-windows.json" <<JSON
{
  "version": "$ver",
  "url": "https://raw.githubusercontent.com/NeverthelessD/ShepherdLORD/main/releases/ShepherdLORD-Windows-update.zip",
  "sha256": "$sha"
}
JSON
echo "download/ShepherdLORD-Windows.zip, releases/ 정리 완료 (버전 $ver)"
