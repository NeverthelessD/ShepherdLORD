using System;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32;

namespace ShepherdLORD
{
    /// <summary>앱 전체에서 함께 쓰는 값들 (주소, 폴더, 버전, 색)</summary>
    internal static class AppInfo
    {
        public const string AppName = "ShepherdLORD";
        public const string WindowTitle = "영복교회 성도 돌봄";
        public const string AppUrl = "https://script.google.com/macros/s/AKfycbyTieV3DIEnEtg6fZesuIIP6iY0v8NOo0ZnVmPFQZ8-IuFGbP_wq4uBZnWNKhrNEY4h8A/exec";
        public const string LatestUrl = "https://raw.githubusercontent.com/NeverthelessD/ShepherdLORD/main/releases/latest-windows.json";
        public const string WebView2DownloadUrl = "https://go.microsoft.com/fwlink/p/?LinkId=2124703";

        public static Version Version => Assembly.GetExecutingAssembly().GetName().Version;
        public static string VersionText => Version.Major + "." + Version.Minor + "." + Version.Build;

        public static string AppDir => AppDomain.CurrentDomain.BaseDirectory;
        public static string ExePath => Assembly.GetExecutingAssembly().Location;

        public static string DataDir
        {
            get
            {
                var d = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), AppName);
                Directory.CreateDirectory(d);
                return d;
            }
        }
        public static string WebDataDir => Path.Combine(DataDir, "WebView2");
        public static string LogPath => Path.Combine(DataDir, "launcher.log");
        public static string WindowStatePath => Path.Combine(DataDir, "window.txt");

        public static bool IsDark
        {
            get
            {
                try
                {
                    using (var k = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"))
                    {
                        var v = k?.GetValue("AppsUseLightTheme");
                        return v is int i && i == 0;
                    }
                }
                catch { return false; }
            }
        }

        public static Color Bg => IsDark ? Color.FromArgb(0x12, 0x17, 0x15) : Color.FromArgb(0xF6, 0xF4, 0xEF);
        public static Color Surface => IsDark ? Color.FromArgb(0x1C, 0x23, 0x20) : Color.White;
        public static Color Text => IsDark ? Color.FromArgb(0xEA, 0xEF, 0xEC) : Color.FromArgb(0x1E, 0x26, 0x22);
        public static Color Sub => IsDark ? Color.FromArgb(0xA3, 0xAD, 0xA8) : Color.FromArgb(0x5C, 0x66, 0x60);
        public static Color Line => IsDark ? Color.FromArgb(0x2C, 0x35, 0x31) : Color.FromArgb(0xE4, 0xE0, 0xD8);
        public static Color Green => IsDark ? Color.FromArgb(0x7C, 0xC4, 0xA8) : Color.FromArgb(0x2E, 0x6B, 0x57);
        public static Color OnGreen => IsDark ? Color.FromArgb(0x0F, 0x1F, 0x19) : Color.White;
        public static Color GreenBg => IsDark ? Color.FromArgb(0x1F, 0x3A, 0x30) : Color.FromArgb(0xE3, 0xEF, 0xE8);

        public static Stream Resource(string name) => Assembly.GetExecutingAssembly().GetManifestResourceStream(name);

        public static Icon AppIcon
        {
            get { using (var s = Resource("app.ico")) return new Icon(s); }
        }

        public static Image IconImage(int size)
        {
            using (var s = Resource(size > 128 ? "icon-256.png" : "icon-128.png"))
            using (var img = Image.FromStream(s))
                return new Bitmap(img, new Size(size, size));
        }

        public static string IconDataUrl
        {
            get
            {
                using (var s = Resource("icon-128.png"))
                using (var ms = new MemoryStream())
                {
                    s.CopyTo(ms);
                    return "data:image/png;base64," + Convert.ToBase64String(ms.ToArray());
                }
            }
        }
    }

    /// <summary>문제가 생겼을 때 사용자가 보내 줄 수 있도록 모든 단계를 launcher.log 에 남겨요</summary>
    internal static class Log
    {
        private static readonly object Gate = new object();

        public static void Init()
        {
            try
            {
                var f = new FileInfo(AppInfo.LogPath);
                if (f.Exists && f.Length > 1024 * 1024)
                {
                    var keep = File.ReadAllText(f.FullName, Encoding.UTF8);
                    File.WriteAllText(f.FullName, keep.Substring(keep.Length - 200 * 1024), Encoding.UTF8);
                }
            }
            catch { }
        }

        public static void Write(string msg)
        {
            try
            {
                lock (Gate)
                {
                    File.AppendAllText(AppInfo.LogPath, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "  " + msg + Environment.NewLine, Encoding.UTF8);
                }
            }
            catch { }
        }
    }

    internal static class Native
    {
        public const int WM_SYSCOMMAND = 0x0112;
        public const int MF_STRING = 0x0;
        public const int MF_SEPARATOR = 0x800;
        public static readonly IntPtr HWND_BROADCAST = new IntPtr(0xffff);
        public static readonly int WM_SHOWME = RegisterWindowMessage("ShepherdLORD_ShowMe_7b1e");

        [DllImport("user32.dll")] public static extern IntPtr GetSystemMenu(IntPtr hWnd, bool bRevert);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern bool AppendMenu(IntPtr hMenu, int uFlags, int uIDNewItem, string lpNewItem);
        [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hwnd, int msg, IntPtr wparam, IntPtr lparam);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int RegisterWindowMessage(string message);
        [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
        [DllImport("dwmapi.dll")] public static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

        public static void UseDarkTitleBar(IntPtr handle, bool dark)
        {
            try
            {
                int v = dark ? 1 : 0;
                if (DwmSetWindowAttribute(handle, 20, ref v, 4) != 0) DwmSetWindowAttribute(handle, 19, ref v, 4);
            }
            catch { }
        }
    }
}
