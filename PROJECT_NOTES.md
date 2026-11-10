이 파일을 읽은 Claude는 작업이 끝날 때마다 이 파일을 업데이트할 것

# ShepherdLORD 프로젝트 노트

영복교회 성도 돌봄. 웹앱(구글 시트 + Apps Script)이 본체이고, 윈도우 앱은 그 웹앱을 여는 전용 창이에요.
웹앱의 자세한 기록(디자인, 권한, 데이터 칸, 변경 기록)은 `webapp/WEBAPP_NOTES.md` 에 있어요.

## 윈도우 앱 (2026-11-10 시작)
- C# WinForms + WebView2 (.NET Framework 4.8 · 윈도우 10/11 기본 포함). AnyCPU (x64 · arm64 · x86).
- 웹앱 주소는 `AppInfo.AppUrl`. 화면 데이터는 앱 전용 폴더 `%LOCALAPPDATA%\ShepherdLORD\WebView2` 에 따로 보관
  → 크롬에 구글 계정이 여러 개 있어도 "현재 파일을 열 수 없습니다" 가 나지 않음.
- 여는 중 화면 → 앱 주소. 실패하면 인터넷 끊김 화면(다시 시도). 바깥 주소는 기본 브라우저로.
- 창 왼쪽 위 아이콘(시스템 메뉴): 새로고침 · 업데이트 확인 · 진단 정보 보기 · 앱 정보. 단축키 F5 / F1.
- 하나만 실행(두 번째 실행 시 기존 창을 앞으로). 창 위치 기억(`window.txt`).
- 기록: `%LOCALAPPDATA%\ShepherdLORD\launcher.log`.
- 업데이트: 열고 4초 뒤 `releases/latest-windows.json` 확인 → 새 버전이면 위쪽 띠로 알림 → sha256 확인 후 파일 교체(.old 백업, 실패 시 되돌림) → 다시 열기. .old 는 다음 실행 때 지움.
- 빌드 서버 시험: `ShepherdLORD.exe --smoke <폴더>` 가 여는 중 · 앱 · 끊김 · 앱 정보 화면을 캡처하고 앱 제목("성도 돌봄") 확인.

## 확정 디자인 (2026-11-10)
- 아이콘: 언덕 위 어린양 + 햇살 해(작게, 오른쪽 위) + 흰 구름 두 개. 원본 `design/icon.svg`.
  색: 하늘 #CFE7DA, 앞 언덕 #2E6B57, 뒤 언덕 #7DB394, 해 #F6C95C/#F0B94A, 어린양 흰색 + #3A3A36.
- 창 제목 "영복교회 성도 돌봄", 앱 이름 ShepherdLORD. 다크 모드는 윈도우 설정 따름(제목 표시줄 포함).
- 여는 중: 아이콘 + "영복교회 / 성도 돌봄" + 진행 막대. 끊김: 장밋빛 와이파이 아이콘 + 다시 시도.
- 앱 정보: 아이콘, ShepherdLORD, 버전, 업데이트 확인, 진단 정보 보기, 확인, made by. Nevertheless_D.
- 색과 글꼴은 웹앱과 같음(초록 #2E6B57 / 다크 #7CC4A8, 바탕 #F6F4EF / #121715). 창 껍데기 글꼴은 맑은 고딕.

## 내려받기
- `download/ShepherdLORD-Windows.zip` (폴더 ShepherdLORD/ 안에 exe · dll · version.txt · 사용가이드.png) 최신판 1개만.
- README 맨 위 "윈도우 앱 받기" 링크는 버전이 바뀌어도 그대로.

## 기록
- 2026-11-10 v1.0.0 첫 빌드. 윈도우 빌드 서버(Windows NT 10.0.26100, WebView2 156)에서 시험 통과: 여는 중 → 실제 웹앱 열림(제목 "영복교회 성도 돌봄") → 끊김 화면 → 앱 정보. 내려받기 zip 약 0.8MB.
  웹앱 위쪽에 구글의 "This application was created by a Google Apps Script user" 안내 띠가 보임(구글이 넣는 것, X 로 닫을 수 있음).

## 할 일
- [ ] 실제 사용자 PC 에서 처음 실행(PC 보호 창), 사진 · 엑셀 올리기 파일 창 확인
