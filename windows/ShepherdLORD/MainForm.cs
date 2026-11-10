using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace ShepherdLORD
{
    /// <summary>
    /// 앱 창. 웹앱(구글 시트와 연결된 성도 돌봄 화면)을 그대로 열어요.
    /// 로그인 정보는 앱 전용 폴더에 따로 보관해서, 브라우저에 구글 계정이 여러 개 있어도 문제없이 열려요.
    /// </summary>
    internal class MainForm : Form
    {
        private const int ID_RELOAD = 0x1001, ID_ABOUT = 0x1002, ID_UPDATE = 0x1003, ID_LOG = 0x1004;

        private readonly WebView2 web;
        private readonly Panel updateBar;
        private readonly Label updateText;
        private Updater.Info pendingUpdate;
        private readonly string smokeDir;
        private bool appRequested;
        private bool appShown;

        public MainForm(string smokeDir)
        {
            this.smokeDir = smokeDir;
            Text = AppInfo.WindowTitle;
            Icon = AppInfo.AppIcon;
            BackColor = AppInfo.Bg;
            MinimumSize = new Size(420, 560);
            AutoScaleMode = AutoScaleMode.Dpi;
            Font = new Font("Malgun Gothic", 9.75f);
            StartPosition = FormStartPosition.Manual;
            RestoreBounds_();

            web = new WebView2 { Dock = DockStyle.Fill, DefaultBackgroundColor = AppInfo.Bg };

            updateBar = new Panel { Dock = DockStyle.Top, Height = 46, BackColor = AppInfo.GreenBg, Visible = false, Padding = new Padding(14, 0, 8, 0) };
            updateText = new Label { Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleLeft, ForeColor = AppInfo.Text, Font = new Font("Malgun Gothic", 10f) };
            var later = BarButton("나중에", false); later.Click += (s, e) => updateBar.Visible = false;
            var now = BarButton("지금 업데이트", true); now.Click += async (s, e) => await DoUpdate(pendingUpdate);
            updateBar.Controls.Add(updateText); updateBar.Controls.Add(now); updateBar.Controls.Add(later);

            Controls.Add(web);
            Controls.Add(updateBar);
        }

        private static Button BarButton(string text, bool primary)
        {
            var b = new Button { Text = text, Dock = DockStyle.Right, Width = primary ? 130 : 84, FlatStyle = FlatStyle.Flat, Cursor = Cursors.Hand, UseVisualStyleBackColor = false };
            b.FlatAppearance.BorderSize = 0;
            b.BackColor = primary ? AppInfo.Green : AppInfo.GreenBg;
            b.ForeColor = primary ? AppInfo.OnGreen : AppInfo.Text;
            b.Font = new Font("Malgun Gothic", 9.75f, primary ? FontStyle.Bold : FontStyle.Regular);
            b.Margin = new Padding(4, 8, 4, 8);
            return b;
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            Native.UseDarkTitleBar(Handle, AppInfo.IsDark);
            var menu = Native.GetSystemMenu(Handle, false);
            Native.AppendMenu(menu, Native.MF_SEPARATOR, 0, null);
            Native.AppendMenu(menu, Native.MF_STRING, ID_RELOAD, "새로고침(&R)");
            Native.AppendMenu(menu, Native.MF_STRING, ID_UPDATE, "업데이트 확인(&U)");
            Native.AppendMenu(menu, Native.MF_STRING, ID_LOG, "진단 정보 보기(&D)");
            Native.AppendMenu(menu, Native.MF_STRING, ID_ABOUT, "앱 정보(&A)");
        }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == Native.WM_SYSCOMMAND)
            {
                switch (m.WParam.ToInt32())
                {
                    case ID_RELOAD: GoApp(); return;
                    case ID_ABOUT: ShowAbout(false); return;
                    case ID_UPDATE: ShowAbout(true); return;
                    case ID_LOG: AboutForm.OpenLog(); return;
                }
            }
            else if (m.Msg == Native.WM_SHOWME)
            {
                if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
                Show(); Activate(); Native.SetForegroundWindow(Handle);
                return;
            }
            base.WndProc(ref m);
        }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
        {
            if (keyData == Keys.F5 || keyData == (Keys.Control | Keys.R)) { GoApp(); return true; }
            if (keyData == Keys.F1) { ShowAbout(false); return true; }
            return base.ProcessCmdKey(ref msg, keyData);
        }

        protected override async void OnLoad(EventArgs e)
        {
            base.OnLoad(e);
            Log.Write("창 열림, 화면 엔진 준비 시작");
            try
            {
                var env = await CoreWebView2Environment.CreateAsync(null, AppInfo.WebDataDir);
                await web.EnsureCoreWebView2Async(env);
                Log.Write("화면 엔진 준비 완료: WebView2 " + env.BrowserVersionString);
            }
            catch (WebView2RuntimeNotFoundException ex)
            {
                Log.Write("WebView2 없음: " + ex.Message);
                if (smokeDir != null) { SmokeDone("fail: webview2 runtime missing"); return; }
                var r = MessageBox.Show(this,
                    "이 컴퓨터에 'Microsoft Edge WebView2'가 없어서 앱을 열 수 없어요.\n\n[확인]을 누르면 마이크로소프트 내려받기 페이지가 열려요. 설치한 뒤 앱을 다시 열어 주세요.",
                    AppInfo.WindowTitle, MessageBoxButtons.OKCancel, MessageBoxIcon.Information);
                if (r == DialogResult.OK) OpenExternal(AppInfo.WebView2DownloadUrl);
                Close();
                return;
            }
            catch (Exception ex)
            {
                Log.Write("화면 엔진 준비 실패: " + ex);
                if (smokeDir != null) { SmokeDone("fail: " + ex.Message); return; }
                MessageBox.Show(this, "앱 화면을 준비하지 못했어요.\n앱을 다시 열어 주세요. 계속되면 '진단 정보 보기' 파일을 관리자에게 보내 주세요.\n\n" + ex.Message, AppInfo.WindowTitle, MessageBoxButtons.OK, MessageBoxIcon.Warning);
                AboutForm.OpenLog();
                Close();
                return;
            }

            var core = web.CoreWebView2;
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.IsZoomControlEnabled = true;
            core.Settings.AreDefaultContextMenusEnabled = true;
            core.NewWindowRequested += (s, a) => { a.Handled = true; OpenExternal(a.Uri); };
            core.NavigationStarting += OnNavigationStarting;
            core.NavigationCompleted += OnNavigationCompleted;
            core.WebMessageReceived += (s, a) =>
            {
                string m = null;
                try { m = a.TryGetWebMessageAsString(); } catch { }
                if (m == "retry") { Log.Write("다시 시도 누름"); GoApp(); }
            };
            core.ProcessFailed += (s, a) => { Log.Write("화면 엔진 문제: " + a.ProcessFailedKind + " → 다시 열기"); BeginInvoke((Action)GoApp); };

            ShowLoading();
            if (smokeDir == null) _ = CheckUpdateQuietly();
            else _ = SmokeWatchdog();
        }

        private void ShowLoading()
        {
            appRequested = false; appShown = false;
            web.CoreWebView2.NavigateToString(Pages.Loading(AppInfo.IconDataUrl));
        }

        private void GoApp()
        {
            if (web.CoreWebView2 == null) return;
            appRequested = true; appShown = false;
            Log.Write("앱 주소 열기");
            web.CoreWebView2.Navigate(AppInfo.AppUrl);
        }

        private static bool IsAllowed(string uri)
        {
            if (string.IsNullOrEmpty(uri)) return true;
            if (uri.StartsWith("about:", StringComparison.OrdinalIgnoreCase) || uri.StartsWith("data:", StringComparison.OrdinalIgnoreCase)) return true;
            Uri u;
            if (!Uri.TryCreate(uri, UriKind.Absolute, out u)) return true;
            var h = u.Host.ToLowerInvariant();
            return h == "script.google.com" || h.EndsWith(".googleusercontent.com") || h == "accounts.google.com" || h == "www.google.com";
        }

        private void OnNavigationStarting(object sender, CoreWebView2NavigationStartingEventArgs e)
        {
            if (!IsAllowed(e.Uri))
            {
                e.Cancel = true;
                Log.Write("바깥 주소는 기본 브라우저로 열기: " + e.Uri);
                OpenExternal(e.Uri);
            }
        }

        private async void OnNavigationCompleted(object sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            var src = web.CoreWebView2.Source ?? "";
            if (!appRequested)
            {
                // 여는 중 화면이 그려졌어요 → 앱 주소로 넘어가요 (그동안 여는 중 화면이 보여요)
                if (smokeDir != null) await CaptureShot("loading.png");
                GoApp();
                return;
            }
            if (e.IsSuccess)
            {
                if (!appShown && src.StartsWith("http", StringComparison.OrdinalIgnoreCase))
                {
                    appShown = true;
                    Log.Write("앱 화면 열림");
                    if (smokeDir != null) await SmokeAfterApp();
                }
                return;
            }
            if (e.WebErrorStatus == CoreWebView2WebErrorStatus.OperationCanceled) return;
            Log.Write("앱을 열지 못함: " + e.WebErrorStatus + " (" + e.HttpStatusCode + ")");
            appRequested = true;
            web.CoreWebView2.NavigateToString(Pages.Offline("오류 코드: " + e.WebErrorStatus));
        }

        private async Task CheckUpdateQuietly()
        {
            try
            {
                await Task.Delay(4000);
                var info = await Updater.CheckAsync();
                if (Updater.IsNewer(info))
                {
                    pendingUpdate = info;
                    updateText.Text = "새 버전 " + info.Version.ToString(3) + " 이 나왔어요. 지금 바꾸면 앱이 잠깐 닫혔다가 다시 열려요.";
                    updateBar.Visible = true;
                }
            }
            catch (Exception ex) { Log.Write("자동 업데이트 확인 건너뜀: " + ex.Message); }
        }

        private void ShowAbout(bool checkNow)
        {
            using (var f = new AboutForm())
            {
                f.UpdateRequested += async info => { f.Close(); await DoUpdate(info); };
                if (checkNow) f.Shown += (s, e) => { foreach (Control c in f.Controls) if (c is Button b && b.Text == "업데이트 확인") { b.PerformClick(); break; } };
                f.ShowDialog(this);
            }
        }

        private async Task DoUpdate(Updater.Info info)
        {
            if (info == null) return;
            updateBar.Visible = true;
            updateText.Text = "새 버전을 내려받는 중이에요…";
            foreach (Control c in updateBar.Controls) if (c is Button) c.Enabled = false;
            try
            {
                await Updater.ApplyAsync(info);
                SaveBounds_();
                Application.Exit();
            }
            catch (Exception ex)
            {
                Log.Write("업데이트 실패: " + ex.Message);
                updateText.Text = "업데이트하지 못했어요. " + ex.Message;
                foreach (Control c in updateBar.Controls) if (c is Button) c.Enabled = true;
            }
        }

        private static void OpenExternal(string uri)
        {
            try
            {
                Uri u;
                if (Uri.TryCreate(uri, UriKind.Absolute, out u) && (u.Scheme == "https" || u.Scheme == "http" || u.Scheme == "mailto" || u.Scheme == "tel"))
                    Process.Start(new ProcessStartInfo(u.AbsoluteUri) { UseShellExecute = true });
            }
            catch (Exception ex) { Log.Write("바깥 주소 열기 실패: " + ex.Message); }
        }

        // ---------- 창 위치 기억 ----------
        private void RestoreBounds_()
        {
            Size = new Size(1120, 820);
            try
            {
                var p = File.ReadAllText(AppInfo.WindowStatePath).Split(',');
                var r = new Rectangle(int.Parse(p[0]), int.Parse(p[1]), int.Parse(p[2]), int.Parse(p[3]));
                if (Screen.AllScreens.Length > 0 && Array.Exists(Screen.AllScreens, s => s.WorkingArea.IntersectsWith(r)) && r.Width >= 420 && r.Height >= 560)
                {
                    Bounds = r;
                    if (p.Length > 4 && p[4] == "max") WindowState = FormWindowState.Maximized;
                    return;
                }
            }
            catch { }
            var wa = Screen.PrimaryScreen.WorkingArea;
            Size = new Size(Math.Min(1120, wa.Width - 40), Math.Min(820, wa.Height - 40));
            Location = new Point(wa.Left + (wa.Width - Width) / 2, wa.Top + (wa.Height - Height) / 2);
        }

        private void SaveBounds_()
        {
            try
            {
                var r = WindowState == FormWindowState.Normal ? Bounds : RestoreBounds;
                File.WriteAllText(AppInfo.WindowStatePath, r.X + "," + r.Y + "," + r.Width + "," + r.Height + (WindowState == FormWindowState.Maximized ? ",max" : ""));
            }
            catch { }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            SaveBounds_();
            Log.Write("앱 닫음");
            base.OnFormClosing(e);
        }

        // ---------- 빌드 서버 시험(--smoke 폴더) ----------
        private async Task CaptureShot(string file)
        {
            try
            {
                using (var fs = File.Create(Path.Combine(smokeDir, file)))
                    await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, fs);
                Log.Write("시험 캡처: " + file);
            }
            catch (Exception ex) { Log.Write("시험 캡처 실패 " + file + ": " + ex.Message); }
        }

        private async Task SmokeAfterApp()
        {
            await Task.Delay(9000);
            await CaptureShot("app.png");
            string title = "";
            try { title = (await web.CoreWebView2.ExecuteScriptAsync("document.title")).Trim('"'); } catch { }
            Log.Write("시험: 앱 제목 = " + title);
            web.CoreWebView2.NavigateToString(Pages.Offline("오류 코드: 시험 화면"));
            await Task.Delay(2500);
            await CaptureShot("offline.png");
            using (var f = new AboutForm())
            {
                f.Show(this);
                await Task.Delay(800);
                using (var bmp = new Bitmap(f.Width, f.Height))
                {
                    f.DrawToBitmap(bmp, new Rectangle(0, 0, f.Width, f.Height));
                    bmp.Save(Path.Combine(smokeDir, "about.png"), ImageFormat.Png);
                }
                f.Close();
            }
            using (var bmp = new Bitmap(Width, Height))
            {
                DrawToBitmap(bmp, new Rectangle(0, 0, Width, Height));
                bmp.Save(Path.Combine(smokeDir, "window.png"), ImageFormat.Png);
            }
            SmokeDone(title.Contains("성도 돌봄") ? "smoke=ok title=" + title : "smoke=fail title=" + title);
        }

        private async Task SmokeWatchdog()
        {
            await Task.Delay(120000);
            SmokeDone("smoke=fail timeout");
        }

        private bool smokeFinished;
        private void SmokeDone(string result)
        {
            if (smokeFinished) return;
            smokeFinished = true;
            Log.Write("시험 결과: " + result);
            try { File.WriteAllText(Path.Combine(smokeDir, "smoke.txt"), result); } catch { }
            Environment.ExitCode = result.StartsWith("smoke=ok") ? 0 : 1;
            BeginInvoke((Action)Close);
        }
    }
}
