using System;
using System.Diagnostics;
using System.Drawing;
using System.Windows.Forms;

namespace ShepherdLORD
{
    /// <summary>앱 정보 창 (확정 시안: 아이콘, 이름, 버전, 업데이트 확인, 진단 정보, made by)</summary>
    internal class AboutForm : Form
    {
        private readonly Label status;
        private readonly Button updateBtn;
        private Updater.Info pending;
        public event Action<Updater.Info> UpdateRequested;

        public AboutForm()
        {
            Text = "앱 정보";
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false; MinimizeBox = false; ShowInTaskbar = false;
            StartPosition = FormStartPosition.CenterParent;
            AutoScaleMode = AutoScaleMode.Dpi;
            Font = new Font("Malgun Gothic", 9.75f);
            BackColor = AppInfo.Surface; ForeColor = AppInfo.Text;
            ClientSize = new Size(380, 410);
            Icon = AppInfo.AppIcon;

            var pic = new PictureBox { Image = AppInfo.IconImage(88), SizeMode = PictureBoxSizeMode.Zoom, Size = new Size(88, 88), Location = new Point((380 - 88) / 2, 26) };
            var name = Centered("ShepherdLORD", new Font("Malgun Gothic", 15f, FontStyle.Bold), AppInfo.Text, 126, 34);
            var ver = Centered("영복교회 성도 돌봄 · 버전 " + AppInfo.VersionText, Font, AppInfo.Sub, 162, 24);
            var note = Centered("앱 안의 새 기능은 열 때마다 자동으로 반영돼요.", Font, AppInfo.Sub, 188, 24);
            status = Centered("", Font, AppInfo.Green, 216, 40);

            updateBtn = MakeButton("업데이트 확인", false);
            updateBtn.SetBounds(30, 268, 154, 40);
            updateBtn.Click += async (s, e) => await OnUpdateClick();
            var logBtn = MakeButton("진단 정보 보기", false);
            logBtn.SetBounds(196, 268, 154, 40);
            logBtn.Click += (s, e) => OpenLog();
            var ok = MakeButton("확인", true);
            ok.SetBounds(30, 318, 320, 42);
            ok.Click += (s, e) => Close();
            AcceptButton = ok; CancelButton = ok;

            var foot = Centered("made by. Nevertheless_D", new Font("Malgun Gothic", 8.25f), AppInfo.Sub, 374, 22);
            Controls.AddRange(new Control[] { pic, name, ver, note, status, updateBtn, logBtn, ok, foot });
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            Native.UseDarkTitleBar(Handle, AppInfo.IsDark);
        }

        private Label Centered(string text, Font font, Color color, int top, int height)
        {
            return new Label { Text = text, Font = font, ForeColor = color, BackColor = Color.Transparent, TextAlign = ContentAlignment.MiddleCenter, Bounds = new Rectangle(10, top, 360, height) };
        }

        private static Button MakeButton(string text, bool primary)
        {
            var b = new Button { Text = text, FlatStyle = FlatStyle.Flat, Cursor = Cursors.Hand, UseVisualStyleBackColor = false };
            b.FlatAppearance.BorderSize = primary ? 0 : 1;
            b.FlatAppearance.BorderColor = AppInfo.Line;
            b.BackColor = primary ? AppInfo.Green : AppInfo.Surface;
            b.ForeColor = primary ? AppInfo.OnGreen : AppInfo.Text;
            b.Font = new Font("Malgun Gothic", 10f, primary ? FontStyle.Bold : FontStyle.Regular);
            return b;
        }

        private async System.Threading.Tasks.Task OnUpdateClick()
        {
            if (pending != null) { UpdateRequested?.Invoke(pending); return; }
            updateBtn.Enabled = false;
            status.ForeColor = AppInfo.Sub;
            status.Text = "새 버전을 확인하는 중…";
            try
            {
                var info = await Updater.CheckAsync();
                if (Updater.IsNewer(info))
                {
                    pending = info;
                    status.ForeColor = AppInfo.Green;
                    status.Text = "새 버전 " + info.Version.ToString(3) + " 이 있어요.";
                    updateBtn.Text = "지금 업데이트";
                }
                else
                {
                    status.ForeColor = AppInfo.Green;
                    status.Text = "지금이 최신 버전이에요.";
                }
            }
            catch (Exception ex)
            {
                Log.Write("업데이트 확인 실패: " + ex.Message);
                status.ForeColor = AppInfo.Sub;
                status.Text = "확인하지 못했어요. 인터넷 연결을 확인해 주세요.";
            }
            finally { updateBtn.Enabled = true; }
        }

        public static void OpenLog()
        {
            try
            {
                Log.Write("진단 정보 열기 · 버전 " + AppInfo.VersionText + " · " + Environment.OSVersion + " · 64비트 " + Environment.Is64BitOperatingSystem);
                Process.Start(new ProcessStartInfo("notepad.exe", "\"" + AppInfo.LogPath + "\"") { UseShellExecute = true });
            }
            catch (Exception ex)
            {
                MessageBox.Show("진단 정보 파일을 열지 못했어요.\n" + AppInfo.LogPath + "\n\n" + ex.Message, AppInfo.WindowTitle);
            }
        }
    }
}
