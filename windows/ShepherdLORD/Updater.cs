using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace ShepherdLORD
{
    /// <summary>
    /// 새 버전 확인과 업데이트. 앱 안 화면(웹앱)은 서버에서 바로 바뀌므로, 이건 창 껍데기만 바꿀 때 쓰여요.
    /// latest-windows.json: {"version":"1.0.1","url":"…zip","sha256":"…"}
    /// </summary>
    internal static class Updater
    {
        public class Info { public Version Version; public string Url; public string Sha256; }

        static Updater()
        {
            try { ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12; } catch { }
        }

        public static async Task<Info> CheckAsync()
        {
            using (var wc = new WebClient())
            {
                wc.Headers[HttpRequestHeader.CacheControl] = "no-cache";
                wc.Encoding = System.Text.Encoding.UTF8;
                var json = await wc.DownloadStringTaskAsync(new Uri(AppInfo.LatestUrl + "?t=" + DateTime.UtcNow.Ticks));
                var v = Regex.Match(json, "\"version\"\\s*:\\s*\"([0-9.]+)\"").Groups[1].Value;
                var u = Regex.Match(json, "\"url\"\\s*:\\s*\"([^\"]+)\"").Groups[1].Value;
                var h = Regex.Match(json, "\"sha256\"\\s*:\\s*\"([0-9a-fA-F]{64})\"").Groups[1].Value;
                if (string.IsNullOrEmpty(v) || string.IsNullOrEmpty(u) || string.IsNullOrEmpty(h)) throw new Exception("latest-windows.json 형식이 맞지 않아요");
                var info = new Info { Version = new Version(v), Url = u, Sha256 = h.ToLowerInvariant() };
                Log.Write("업데이트 확인: 최신 " + v + ", 지금 " + AppInfo.VersionText);
                return info;
            }
        }

        public static bool IsNewer(Info info)
        {
            var cur = new Version(AppInfo.Version.Major, AppInfo.Version.Minor, AppInfo.Version.Build);
            return info != null && info.Version > cur;
        }

        /// <summary>내려받고(sha256 확인) 앱 폴더의 파일을 바꾼 뒤 새 버전을 다시 열어요. 실패하면 원래대로 되돌려요.</summary>
        public static async Task ApplyAsync(Info info)
        {
            var work = Path.Combine(AppInfo.DataDir, "update");
            if (Directory.Exists(work)) Directory.Delete(work, true);
            Directory.CreateDirectory(work);
            var zip = Path.Combine(work, "update.zip");
            using (var wc = new WebClient()) await wc.DownloadFileTaskAsync(new Uri(info.Url + "?t=" + DateTime.UtcNow.Ticks), zip);
            string hash;
            using (var sha = SHA256.Create())
            using (var fs = File.OpenRead(zip))
                hash = BitConverter.ToString(sha.ComputeHash(fs)).Replace("-", "").ToLowerInvariant();
            if (hash != info.Sha256) throw new Exception("내려받은 파일이 손상됐어요. 잠시 뒤 다시 해 주세요.");
            Log.Write("업데이트 파일 확인 완료 (sha256 일치)");

            var unpack = Path.Combine(work, "new");
            ZipFile.ExtractToDirectory(zip, unpack);
            var root = unpack;
            if (!File.Exists(Path.Combine(root, "ShepherdLORD.exe")) && File.Exists(Path.Combine(unpack, "ShepherdLORD", "ShepherdLORD.exe")))
                root = Path.Combine(unpack, "ShepherdLORD");
            if (!File.Exists(Path.Combine(root, "ShepherdLORD.exe"))) throw new Exception("업데이트 파일 안에 앱이 없어요.");
            var vt = Path.Combine(root, "version.txt");
            if (File.Exists(vt) && File.ReadAllText(vt).Trim() != info.Version.ToString()) throw new Exception("업데이트 파일의 버전이 맞지 않아요.");

            var appDir = AppInfo.AppDir;
            var moved = new System.Collections.Generic.List<string>();
            var added = new System.Collections.Generic.List<string>();
            try
            {
                foreach (var src in Directory.GetFiles(root, "*", SearchOption.AllDirectories))
                {
                    var rel = src.Substring(root.Length).TrimStart('\\', '/');
                    var dst = Path.Combine(appDir, rel);
                    Directory.CreateDirectory(Path.GetDirectoryName(dst));
                    if (File.Exists(dst))
                    {
                        var old = dst + ".old";
                        if (File.Exists(old)) File.Delete(old);
                        File.Move(dst, old);   // 실행 중인 exe 도 이름은 바꿀 수 있어요
                        moved.Add(dst);
                    }
                    else added.Add(dst);
                    File.Copy(src, dst);
                }
            }
            catch (Exception ex)
            {
                Log.Write("업데이트 중 문제, 되돌림: " + ex.Message);
                foreach (var a in added) { try { File.Delete(a); } catch { } }
                foreach (var m in moved) { try { if (File.Exists(m)) File.Delete(m); File.Move(m + ".old", m); } catch { } }
                if (ex is UnauthorizedAccessException)
                    throw new Exception("앱 폴더에 파일을 쓸 수 없어요. 내려받기 파일을 새로 받아 압축을 풀어 주세요.");
                throw;
            }
            Log.Write("업데이트 설치 완료 → " + info.Version + " 로 다시 열어요");
            Process.Start(new ProcessStartInfo(AppInfo.ExePath, "--relaunched") { UseShellExecute = false, WorkingDirectory = appDir });
        }

        /// <summary>지난 업데이트 때 남긴 .old 백업을 지워요(다음 실행 때).</summary>
        public static void CleanupOld()
        {
            try
            {
                foreach (var f in Directory.GetFiles(AppInfo.AppDir, "*.old", SearchOption.AllDirectories))
                {
                    try { File.Delete(f); } catch { }
                }
            }
            catch { }
        }
    }
}
