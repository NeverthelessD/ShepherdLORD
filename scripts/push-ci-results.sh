#!/usr/bin/env bash
# 빌드 결과를 ci-results 브랜치의 <하위폴더>(windows 또는 mac)에 올려요. 다른 쪽 결과는 그대로 둬요.
# 사용: scripts/push-ci-results.sh <하위폴더> <결과폴더>   (GITHUB_TOKEN, GITHUB_REPOSITORY 필요)
set -euo pipefail
sub="$1"; src="$(cd "$2" && pwd)"
url="https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}"
work="$(mktemp -d)"
for attempt in 1 2 3 4 5; do
  rm -rf "$work/r"
  if git clone -q --depth 1 --branch ci-results "$url" "$work/r" 2>/dev/null; then :; else
    mkdir -p "$work/r" && git -C "$work/r" init -q && git -C "$work/r" checkout -q -b ci-results
  fi
  cd "$work/r"
  # 예전(폴더 없이 올리던) 윈도우 결과는 정리
  find . -maxdepth 1 -mindepth 1 ! -name .git ! -name windows ! -name mac -exec rm -rf {} +
  rm -rf "$sub"; mkdir -p "$sub"; cp -R "$src/." "$sub/"
  git add -A
  git -c user.name="Nevertheless_D" -c user.email="NeverthelessD@users.noreply.github.com" commit -qm "$sub ci ${GITHUB_SHA:-}" || true
  if git push -q "$url" HEAD:ci-results; then echo "pushed $sub"; exit 0; fi
  cd /; sleep $((attempt * 5))
done
exit 1
