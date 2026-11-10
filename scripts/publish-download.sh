#!/usr/bin/env bash
# 빌드 서버 결과(ci-results 브랜치를 풀어 둔 폴더)를 download/ 와 releases/ 에 최신판 하나씩만 남기도록 정리해요.
# 사용: scripts/publish-download.sh <결과 폴더>   (안에 windows/ 와 mac/ 이 있으면 둘 다 처리)
set -euo pipefail
src="${1:?결과 폴더를 주세요}"
root="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$root/download" "$root/releases"
keep_dl=(); keep_rel=()

check_status() { # 폴더 버전
  grep -q '^build=ok' "$1/status.txt" || { echo "$1: build 실패"; exit 1; }
  grep -q '^smoke=ok' "$1/status.txt" || { echo "$1: smoke 실패"; exit 1; }
  grep -q "^version=$2\$" "$1/status.txt" || { echo "$1: 버전이 달라요 ($2)"; exit 1; }
  sha="$(grep -oP '(?<=^update_sha256=)[0-9a-f]{64}' "$1/status.txt")"
}

if [ -d "$src/windows" ]; then
  d="$src/windows"; ver="$(grep -m1 -oP '(?<=<Version>)[^<]+' "$root/windows/ShepherdLORD/ShepherdLORD.csproj")"
  check_status "$d" "$ver"
  [ "$(sha256sum "$d/ShepherdLORD-Windows-update.zip" | cut -d' ' -f1)" = "$sha" ] || { echo "windows sha256 불일치"; exit 1; }
  python3 - "$d/ShepherdLORD-Windows.zip" "$ver" <<'PY'
import sys, zipfile, unicodedata
z = zipfile.ZipFile(sys.argv[1]); names = [unicodedata.normalize('NFC', n.replace('\\', '/')) for n in z.namelist()]
assert 'ShepherdLORD/ShepherdLORD.exe' in names, names[:20]
assert any(n.endswith('사용가이드.png') for n in names), '가이드 이미지가 없어요'
v = z.read([n for n in z.namelist() if n.replace('\\','/').endswith('ShepherdLORD/version.txt')][0]).decode().strip()
assert v == sys.argv[2], (v, sys.argv[2]); print('windows zip ok', len(names), 'files, version', v)
PY
  cp "$d/ShepherdLORD-Windows.zip" "$root/download/ShepherdLORD-Windows.zip"
  cp "$d/ShepherdLORD-Windows-update.zip" "$root/releases/ShepherdLORD-Windows-update.zip"
  printf '{\n  "version": "%s",\n  "url": "https://raw.githubusercontent.com/NeverthelessD/ShepherdLORD/main/releases/ShepherdLORD-Windows-update.zip",\n  "sha256": "%s"\n}\n' "$ver" "$sha" > "$root/releases/latest-windows.json"
fi
keep_dl+=(ShepherdLORD-Windows.zip); keep_rel+=(ShepherdLORD-Windows-update.zip latest-windows.json)

if [ -d "$src/mac" ]; then
  d="$src/mac"; ver="$(tr -d '[:space:]' < "$root/app/VERSION")"
  check_status "$d" "$ver"
  [ "$(sha256sum "$d/ShepherdLORD-mac-update.zip" | cut -d' ' -f1)" = "$sha" ] || { echo "mac sha256 불일치"; exit 1; }
  python3 - "$d/ShepherdLORD-first-install.zip" "$ver" <<'PY'
import sys, zipfile, unicodedata, plistlib
z = zipfile.ZipFile(sys.argv[1])
def name(i):
    n = i.filename
    if not (i.flag_bits & 0x800):
        try: n = n.encode('cp437').decode('utf-8')
        except Exception: pass
    return unicodedata.normalize('NFC', n)
infos = {name(i): i for i in z.infolist()}
assert 'ShepherdLORD/ShepherdLORD.app/Contents/MacOS/ShepherdLORD' in infos, list(infos)[:20]
assert any(n.startswith('ShepherdLORD/') and n.endswith('사용가이드-맥.png') for n in infos), '가이드 이미지가 없어요'
v = plistlib.loads(z.read(infos['ShepherdLORD/ShepherdLORD.app/Contents/Info.plist']))['CFBundleShortVersionString']
assert v == sys.argv[2], (v, sys.argv[2]); print('mac zip ok', len(infos), 'entries, version', v)
PY
  cp "$d/ShepherdLORD-first-install.zip" "$root/download/ShepherdLORD.zip"
  cp "$d/ShepherdLORD-mac-update.zip" "$root/releases/ShepherdLORD-mac-update.zip"
  printf '{\n  "version": "%s",\n  "url": "https://raw.githubusercontent.com/NeverthelessD/ShepherdLORD/main/releases/ShepherdLORD-mac-update.zip",\n  "sha256": "%s"\n}\n' "$ver" "$sha" > "$root/releases/latest.json"
fi
[ -f "$root/download/ShepherdLORD.zip" ] && keep_dl+=(ShepherdLORD.zip) && keep_rel+=(ShepherdLORD-mac-update.zip latest.json)

for f in "$root"/download/*; do b="$(basename "$f")"; [[ " ${keep_dl[*]} " == *" $b "* ]] || rm -rf "$f"; done
for f in "$root"/releases/*; do b="$(basename "$f")"; [[ " ${keep_rel[*]} " == *" $b "* ]] || rm -rf "$f"; done
echo "정리 완료: download/ = $(ls "$root/download" | tr '\n' ' ')"
