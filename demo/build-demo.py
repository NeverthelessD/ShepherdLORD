#!/usr/bin/env python3
"""체험판 한 장짜리 페이지 만들기: python3 demo/build-demo.py → demo/out/영복교회-체험판.html
실제 접속 코드는 넣지 않아요. 코드 입력 없이 바로 열려요(속으로 0000 으로 자동 로그인)."""
import os, re, sys
here = os.path.dirname(os.path.abspath(__file__))
web = os.path.join(here, '..', 'webapp')
idx = open(os.path.join(web, 'Index.html'), encoding='utf-8').read()
code = open(os.path.join(web, 'Code.gs'), encoding='utf-8').read()
gas = open(os.path.join(here, 'demo-gas.js'), encoding='utf-8').read()
seed = open(os.path.join(here, 'seed.js'), encoding='utf-8').read()

# 1) 서버 코드: 기본 접속 코드를 모두 0000 으로, 진짜 코드 숫자는 지움
code = re.sub(r"(\[SETTING_CODE_(?:MASTER|VIEW|NEW), )'\d+'", r"\1'0000'", code)
code = code.replace('0191 같은 코드를 숫자 191로', '0으로 시작하는 코드를 숫자로')
code = code.replace('</script>', '<\\/script>')

# 2) 화면: 문서 뼈대 태그를 빼고 제목을 붙임, 다크 모드 토큰을 테마 선택과 맞춤
idx = re.sub(r'<!DOCTYPE html>\s*<html[^>]*>\s*<head>\s*', '', idx, count=1)
idx = idx.replace('<base target="_top">\n', '')
idx = idx.replace('</head>\n<body>\n', '').replace('</body>\n</html>', '')
m = re.search(r'@media \(prefers-color-scheme: dark\)\{:root\{(.*?)\}\}', idx)
dark = m.group(1)
idx = idx.replace(m.group(0), '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){' + dark + ';color-scheme:dark}}\n:root[data-theme="dark"]{' + dark + ';color-scheme:dark}')
head = '<title>영복교회 성도 돌봄 체험판</title>\n'
boot = ('<script>\n' + gas + '\n</script>\n<script>\n' + code + '\n' + seed +
        '\nfunction demoToken(force) {\n  var t = null;\n  try { t = force ? null : localStorage.getItem("yb_token"); } catch (e) {}\n  if (t) { try { getData(t); return t; } catch (e) {} }\n  t = login("0000", "demo-viewer", "").token;\n  try { localStorage.setItem("yb_token", t); } catch (e) {}\n  return t;\n}\nsetup();\nif (window.__demoFresh) { seedDemo(); try { localStorage.removeItem("yb_token"); } catch (e) {} window.__demoSave(); }\n</script>\n')
# 3) 코드 없이 바로 열리게: 자동 로그인, 코드 추가·나가기 버튼 빼기
def must(a, b):
    global idx
    assert idx.count(a) == 1, a
    idx = idx.replace(a, b)
must("S.token = load('yb_token');", "S.token = demoToken();")
must("""    S.loginMsg = '로그인이 풀렸어요. 접속 코드가 바뀌었거나 오래 쓰지 않았을 수 있어요. 다시 입력해 주세요.';
    go('login');""", """    S.token = demoToken(true); store('yb_token', S.token);
    loadData(true).then(function () { go('home'); });""")
must("""<button type="button" class="chip plain" data-act="nav" data-to="login">+ 코드 추가</button>""", "")
must("""  parts.push('<div style="text-align:center"><button type="button" class="linkbtn" style="color:var(--sub)" data-act="logout">이 기기에서 나가기</button></div>');""", "")
k = '<div id="toast" role="status" aria-live="polite"></div>\n'
assert idx.count(k) == 1
idx = idx.replace(k, k + boot)
out = os.path.join(here, 'out'); os.makedirs(out, exist_ok=True)
dst = os.path.join(out, '영복교회-체험판.html')
open(dst, 'w', encoding='utf-8').write(head + idx)
bad = [c for c in ('0191', '7979', '1004') if c in head + idx]
if bad: sys.exit('real code number found in demo page: ' + ','.join(bad))
print(dst, len((head + idx).encode()) // 1024, 'KB')
