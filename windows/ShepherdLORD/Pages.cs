namespace ShepherdLORD
{
    /// <summary>앱 창 안에 잠깐 보이는 화면들 (여는 중, 인터넷 끊김). 확정 시안 그대로예요.</summary>
    internal static class Pages
    {
        private const string Css = @"
:root{--bg:#F6F4EF;--text:#1E2622;--sub:#5C6660;--green:#2E6B57;--on-green:#fff;--green-bg:#E3EFE8;--rose-bg:#F8E7E2;--rose-text:#8A3628}
@media (prefers-color-scheme: dark){:root{--bg:#121715;--text:#EAEFEC;--sub:#A3ADA8;--green:#7CC4A8;--on-green:#0F1F19;--green-bg:#1F3A30;--rose-bg:#3D2420;--rose-text:#F2BDB2}}
html,body{margin:0;height:100%;background:var(--bg);color:var(--text);font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;-webkit-user-select:none;user-select:none}
.c{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:24px;box-sizing:border-box}
.ic{width:88px;height:88px}
.s{font-size:14px;color:var(--sub);line-height:1.7;margin:0}
.t{font-family:'Gowun Batang','Batang','Nanum Myeongjo',serif;font-weight:700;font-size:30px;margin:0}
.bar{width:160px;height:4px;border-radius:2px;background:var(--green-bg);overflow:hidden;margin-top:6px}
.bar i{display:block;height:100%;width:40%;background:var(--green);border-radius:2px;animation:m 1.2s ease-in-out infinite}
@keyframes m{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}
.warn{width:72px;height:72px;border-radius:20px;background:var(--rose-bg);color:var(--rose-text);display:flex;align-items:center;justify-content:center}
.h{font-size:20px;font-weight:700;margin:4px 0 0}
button{margin-top:10px;min-height:44px;padding:0 22px;border:0;border-radius:12px;background:var(--green);color:var(--on-green);font:inherit;font-size:15px;font-weight:700;cursor:pointer}
.foot{position:fixed;bottom:14px;left:0;right:0;text-align:center;font-size:11px;color:var(--sub);letter-spacing:.3px}
";

        public static string Loading(string iconDataUrl)
        {
            return "<!DOCTYPE html><html lang='ko'><head><meta charset='utf-8'><style>" + Css + "</style></head><body><div class='c'>" +
                   "<img class='ic' alt='' src='" + iconDataUrl + "'>" +
                   "<p class='s'>영복교회</p><p class='t'>성도 돌봄</p>" +
                   "<div class='bar' aria-hidden='true'><i></i></div><p class='s' role='status'>여는 중이에요…</p>" +
                   "</div><p class='foot'>made by. Nevertheless_D</p></body></html>";
        }

        public static string Offline(string detail)
        {
            return "<!DOCTYPE html><html lang='ko'><head><meta charset='utf-8'><style>" + Css + "</style></head><body><div class='c'>" +
                   "<div class='warn' aria-hidden='true'><svg width='38' height='38' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round'><path d='M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0'/><path d='M3 3l18 18'/></svg></div>" +
                   "<p class='h'>인터넷에 연결되지 않았어요</p>" +
                   "<p class='s'>연결을 확인한 뒤 다시 시도해 주세요.<br>입력한 내용은 구글 시트에 안전하게 있어요.</p>" +
                   "<button type='button' id='retry'>다시 시도</button>" +
                   "<p class='s' style='font-size:11px;margin-top:8px'>" + System.Net.WebUtility.HtmlEncode(detail ?? "") + "</p>" +
                   "</div><p class='foot'>made by. Nevertheless_D</p>" +
                   "<script>document.getElementById('retry').addEventListener('click',function(){window.chrome.webview.postMessage('retry');});</script>" +
                   "</body></html>";
        }
    }
}
