#!/usr/bin/env bash
# 맥 앱 시험: 화면 캡처 · 켜기 · Dock 다시 열기 · 종료 · 강제 종료 뒤 다시 켜기 · 업데이트 뒤 다시 열기
# 사용: scripts/smoke-mac.sh <ShepherdLORD.app> <결과폴더>
set -uo pipefail
APP="$1"; OUT="$2"; mkdir -p "$OUT/smoke"
LOG="$HOME/Library/Application Support/ShepherdLORD/launcher.log"
res() { echo "$1" >> "$OUT/smoke-steps.txt"; echo "$1"; }
fail=0
count() { pgrep -x ShepherdLORD | wc -l | tr -d ' '; }

# 1) 화면 캡처 + 앱 제목 확인
"$APP/Contents/MacOS/ShepherdLORD" --smoke "$OUT/smoke" &
pid=$!; shot=0
for i in $(seq 1 300); do
  kill -0 $pid 2>/dev/null || break
  if [ $shot = 0 ] && [ -f "$OUT/smoke/about-open" ]; then screencapture -x "$OUT/smoke/about-screen.png" 2>/dev/null; shot=1; fi
  sleep 0.5
done; kill $pid 2>/dev/null
if grep -q '^smoke=ok' "$OUT/smoke/smoke.txt" 2>/dev/null; then res "screens=ok $(cat "$OUT/smoke/smoke.txt")"; else res "screens=fail $(cat "$OUT/smoke/smoke.txt" 2>/dev/null)"; fail=1; fi

# 2) 켜기
open "$APP"; sleep 8
[ "$(count)" = "1" ] && res "launch=ok" || { res "launch=fail count=$(count)"; fail=1; }
# 3) Dock 다시 열기(이미 켜져 있을 때 다시 열면 하나만)
open "$APP"; sleep 3
[ "$(count)" = "1" ] && res "reopen=ok" || { res "reopen=fail count=$(count)"; fail=1; }
grep -q "Dock 에서 다시 열기" "$LOG" && res "reopen-handler=ok" || res "reopen-handler=skip"
# 4) 종료(⌘Q 와 같은 종료 요청)
osascript -e 'tell application "ShepherdLORD" to quit' >/dev/null 2>&1 || kill -TERM $(pgrep -x ShepherdLORD) 2>/dev/null
for i in $(seq 1 10); do [ "$(count)" = "0" ] && break; sleep 1; done
[ "$(count)" = "0" ] && res "quit=ok" || { res "quit=fail"; fail=1; kill -9 $(pgrep -x ShepherdLORD) 2>/dev/null; }
# 5) 강제 종료 뒤 다시 켜기
open "$APP"; sleep 6; kill -9 $(pgrep -x ShepherdLORD) 2>/dev/null; sleep 2
open "$APP"; sleep 6
[ "$(count)" = "1" ] && res "after-force-quit=ok" || { res "after-force-quit=fail"; fail=1; }
kill -TERM $(pgrep -x ShepherdLORD) 2>/dev/null; sleep 2

# 6) 업데이트 → 다시 열기: 9.9.9 가짜 새 버전을 만들어 지금 앱을 바꾸고 다시 열리는지
T="$(mktemp -d)"; mkdir -p "$T/inst" "$T/out"
ditto "$APP" "$T/inst/ShepherdLORD.app"
bash "$(dirname "$0")/build-mac.sh" "$T/new" 9.9.9 >/dev/null
( cd "$T/new" && ditto -c -k --sequesterRsrc --keepParent ShepherdLORD.app "$T/update.zip" )
sha=$(shasum -a 256 "$T/update.zip" | cut -d' ' -f1)
printf '{"version":"9.9.9","url":"file://%s","sha256":"%s"}' "$T/update.zip" "$sha" > "$T/latest.json"
SHEPHERD_LATEST_URL="file://$T/latest.json" "$T/inst/ShepherdLORD.app/Contents/MacOS/ShepherdLORD" --smoke-update "$T/out" &
for i in $(seq 1 60); do [ -f "$T/out/relaunched.txt" ] && break; sleep 1; done
got="$(cat "$T/out/relaunched.txt" 2>/dev/null)"
inst_ver=$(defaults read "$T/inst/ShepherdLORD.app/Contents/Info.plist" CFBundleShortVersionString 2>/dev/null)
if [ "$got" = "relaunched version=9.9.9" ] && [ "$inst_ver" = "9.9.9" ] && [ -d "$HOME/Library/Application Support/ShepherdLORD/backup/ShepherdLORD.app" ]; then
  res "update-relaunch=ok"; else res "update-relaunch=fail got=[$got] installed=$inst_ver"; fail=1; fi
pkill -x ShepherdLORD 2>/dev/null
cp "$LOG" "$OUT/launcher.log" 2>/dev/null
exit $fail
