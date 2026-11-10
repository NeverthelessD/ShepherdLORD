using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Windows.Forms;

namespace ShepherdLORD
{
    internal static class Program
    {
        [STAThread]
        private static int Main(string[] args)
        {
            Log.Init();
            Log.Write("앱 시작 · 버전 " + AppInfo.VersionText + " · " + Environment.OSVersion + " · 인수 " + string.Join(" ", args));

            string smokeDir = null;
            var i = Array.IndexOf(args, "--smoke");
            if (i >= 0)
            {
                smokeDir = i + 1 < args.Length ? args[i + 1] : Path.Combine(Path.GetTempPath(), "ShepherdLORD-smoke");
                Directory.CreateDirectory(smokeDir);
            }

            bool created;
            using (var mutex = new Mutex(true, "ShepherdLORD_YeongBok_SingleInstance", out created))
            {
                if (!created && smokeDir == null)
                {
                    // 이미 열려 있으면 그 창을 앞으로 가져와요
                    Log.Write("이미 열려 있어서 기존 창을 앞으로");
                    Native.PostMessage(Native.HWND_BROADCAST, Native.WM_SHOWME, IntPtr.Zero, IntPtr.Zero);
                    return 0;
                }

                if (!args.Contains("--relaunched")) Updater.CleanupOld();
                else { Thread.Sleep(800); Updater.CleanupOld(); }

                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.ThreadException += (s, e) => Fail(e.Exception);
                AppDomain.CurrentDomain.UnhandledException += (s, e) => Fail(e.ExceptionObject as Exception);
                Application.Run(new MainForm(smokeDir));
                return Environment.ExitCode;
            }
        }

        private static void Fail(Exception ex)
        {
            Log.Write("예상하지 못한 문제: " + ex);
            try
            {
                MessageBox.Show("예상하지 못한 문제가 생겼어요. 앱을 다시 열어 주세요.\n계속되면 앱 정보의 '진단 정보 보기' 파일을 관리자에게 보내 주세요.", AppInfo.WindowTitle, MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
            catch { }
        }
    }
}
