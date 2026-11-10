# ShepherdLORD — Claude 작업 안내

먼저 `PROJECT_NOTES.md` 를 읽고, 작업이 끝날 때마다 그 파일을 업데이트할 것.

- 사용자(Nevertheless_D)는 프로그래머가 아니에요. 한국어로, 쉬운 말로 설명하고 터미널을 쓰라고 하지 않아요.
- 앱 제작 원칙은 road-mac-app 스킬을 따르되, 이 저장소는 **윈도우 앱 + 구글 Apps Script 웹앱** 이에요(맥 전용 규칙 제외).
- 디자인을 바꿀 때는 시안을 먼저 보여 주고 "확정" 뒤에 코드를 만들어요.
- 화면 · 업데이트 문구 · 가이드 이미지에 GitHub 이나 저장소 이름을 쓰지 않아요.
- 커밋 작성자: `Nevertheless_D <NeverthelessD@users.noreply.github.com>`.
- 접속 코드 숫자는 저장소에 쓰지 않아요(웹앱 setup 의 기본값 제외).

## 윈도우 앱 빌드 · 내려받기
1. `windows/ShepherdLORD/ShepherdLORD.csproj` 의 `<Version>` 을 올려요.
2. main 에 푸시하면 `.github/workflows/build-windows.yml` 이 윈도우 빌드 서버에서 빌드 → `--smoke` 실행 시험 → zip 을 만들고 `ci-results` 브랜치에 올려요.
3. `git fetch origin +refs/heads/ci-results:refs/remotes/origin/ci-results` 후 결과 폴더를 풀어 `status.txt` 의 build=ok, smoke=ok 와 `smoke/*.png` 화면을 확인해요.
4. `scripts/publish-download.sh <결과 폴더>` → `download/ShepherdLORD-Windows.zip`, `releases/latest-windows.json` 정리 → 커밋 · 푸시 → README 링크가 200 인지 확인.

## 웹앱 바꿀 때
`webapp/Code.gs`, `webapp/Index.html` 을 고친 뒤, 사용자에게 Apps Script 에 붙여넣고 "새 버전"으로 배포하도록 안내해요. 윈도우 앱은 다시 받을 필요 없어요.
