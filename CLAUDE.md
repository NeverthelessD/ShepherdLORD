# ShepherdLORD — Claude 작업 안내

먼저 `PROJECT_NOTES.md` 를 읽고, 작업이 끝날 때마다 그 파일을 업데이트할 것.

- 사용자(Nevertheless_D)는 프로그래머가 아니에요. 한국어로, 쉬운 말로 설명하고 터미널을 쓰라고 하지 않아요.
- 앱 제작 원칙은 road-mac-app 스킬을 따르되, 이 저장소는 **윈도우 앱 + 구글 Apps Script 웹앱** 이에요(맥 전용 규칙 제외).
- 디자인을 바꿀 때는 시안을 먼저 보여 주고 "확정" 뒤에 코드를 만들어요.
- 화면 · 업데이트 문구 · 가이드 이미지에 GitHub 이나 저장소 이름을 쓰지 않아요.
- 커밋 작성자: `Nevertheless_D <NeverthelessD@users.noreply.github.com>`.
- 접속 코드 숫자는 저장소에 쓰지 않아요(웹앱 setup 의 기본값 제외).

## 앱 빌드 · 내려받기 (맥 · 윈도우)
1. 버전 올리기: 맥은 `app/VERSION`, 윈도우는 `windows/ShepherdLORD/ShepherdLORD.csproj` 의 `<Version>`.
2. main 에 푸시하면 `build-mac.yml`(맥 빌드 서버: build-mac.sh + smoke-mac.sh) · `build-windows.yml`(윈도우 빌드 서버: ci-windows.ps1) 이 빌드 → 시험 → zip 을 만들어 `ci-results` 브랜치의 `mac/`, `windows/` 에 올려요. 맥 기계가 배정되지 않으면 워크플로 파일을 바꿔 다시 푸시.
3. `git fetch origin +refs/heads/ci-results:refs/remotes/origin/ci-results` 후 `git archive origin/ci-results | tar -x -C <폴더>` 로 풀어 각 `status.txt`(build=ok, smoke=ok, 맥은 launch·reopen·quit·after-force-quit·update-relaunch 모두 ok)와 `smoke/*.png` 화면을 확인해요. 맥 앱 정보 창은 `about-screen.png`(실제 화면 캡처)로 확인.
4. `scripts/publish-download.sh <결과 폴더>` → `download/ShepherdLORD.zip`(맥), `download/ShepherdLORD-Windows.zip`, `releases/latest.json`(맥) · `latest-windows.json` 최신판만 정리 → 커밋 · 푸시 → README 링크 둘 다 200 이고 내용이 같은지 확인.
- 시험에서 `pkill -f` 금지 → `pgrep -x` / `pkill -x`.

## 웹앱 바꿀 때
`webapp/Code.gs`, `webapp/Index.html` 을 고친 뒤, 사용자에게 Apps Script 에 붙여넣고 "새 버전"으로 배포하도록 안내해요. 윈도우 앱은 다시 받을 필요 없어요.
