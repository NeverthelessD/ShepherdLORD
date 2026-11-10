// ShepherdLORD · 영복교회 성도 돌봄 — 맥 앱
// Dock 에 보이는 정식 맥 앱. 창 안에서 웹앱(구글 시트와 연결된 성도 돌봄 화면)을 그대로 열어요.
// 로그인 정보는 이 앱 전용 저장소에 따로 보관돼서, 사파리·크롬의 구글 계정과 섞이지 않아요.
// made by. Nevertheless_D

import AppKit
import WebKit
import CryptoKit

// MARK: - 기본 값

enum AppInfo {
    static let name = "ShepherdLORD"
    static let windowTitle = "영복교회 성도 돌봄"
    static let appURL = URL(string: "https://script.google.com/macros/s/AKfycbyTieV3DIEnEtg6fZesuIIP6iY0v8NOo0ZnVmPFQZ8-IuFGbP_wq4uBZnWNKhrNEY4h8A/exec")!
    static var latestURL: URL {
        if let o = ProcessInfo.processInfo.environment["SHEPHERD_LATEST_URL"], let u = URL(string: o) { return u } // 시험용
        return URL(string: "https://raw.githubusercontent.com/NeverthelessD/ShepherdLORD/main/releases/latest.json")!
    }
    static var version: String { Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0" }

    static var supportDir: URL {
        let d = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent(name, isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }
    static var logURL: URL { supportDir.appendingPathComponent("launcher.log") }
    static var backupURL: URL { supportDir.appendingPathComponent("backup", isDirectory: true).appendingPathComponent(name + ".app") }

    static var iconImage: NSImage {
        if let u = Bundle.main.url(forResource: "icon-256", withExtension: "png"), let i = NSImage(contentsOf: u) { return i }
        return NSApp.applicationIconImage
    }
    static var iconDataURL: String {
        if let u = Bundle.main.url(forResource: "icon-256", withExtension: "png"), let d = try? Data(contentsOf: u) {
            return "data:image/png;base64," + d.base64EncodedString()
        }
        return ""
    }
}

// MARK: - 기록 (문제가 생기면 사용자가 이 파일을 보내 줄 수 있게)

enum Log {
    private static let q = DispatchQueue(label: "log")
    static func trim() {
        if let a = try? FileManager.default.attributesOfItem(atPath: AppInfo.logURL.path), let s = a[.size] as? Int, s > 1_000_000,
           let d = try? Data(contentsOf: AppInfo.logURL) {
            try? d.suffix(200_000).write(to: AppInfo.logURL)
        }
    }
    static func write(_ msg: String) {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd HH:mm:ss"
        let line = f.string(from: Date()) + "  " + msg + "\n"
        q.sync {
            if let h = try? FileHandle(forWritingTo: AppInfo.logURL) {
                h.seekToEndOfFile(); h.write(line.data(using: .utf8)!); try? h.close()
            } else {
                try? line.data(using: .utf8)!.write(to: AppInfo.logURL)
            }
        }
    }
}

// MARK: - 창 안에 잠깐 보이는 화면 (확정 시안)

enum Pages {
    static let css = """
    :root{--bg:#F6F4EF;--text:#1E2622;--sub:#5C6660;--green:#2E6B57;--on-green:#fff;--green-bg:#E3EFE8;--rose-bg:#F8E7E2;--rose-text:#8A3628}
    @media (prefers-color-scheme: dark){:root{--bg:#121715;--text:#EAEFEC;--sub:#A3ADA8;--green:#7CC4A8;--on-green:#0F1F19;--green-bg:#1F3A30;--rose-bg:#3D2420;--rose-text:#F2BDB2}}
    html,body{margin:0;height:100%;background:var(--bg);color:var(--text);font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;-webkit-user-select:none;user-select:none}
    .c{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:24px;box-sizing:border-box}
    .ic{width:88px;height:88px}
    .s{font-size:14px;color:var(--sub);line-height:1.7;margin:0}
    .t{font-family:'Gowun Batang','AppleMyungjo','Nanum Myeongjo',serif;font-weight:700;font-size:30px;margin:0}
    .bar{width:160px;height:4px;border-radius:2px;background:var(--green-bg);overflow:hidden;margin-top:6px}
    .bar i{display:block;height:100%;width:40%;background:var(--green);border-radius:2px;animation:m 1.2s ease-in-out infinite}
    @keyframes m{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}
    .warn{width:72px;height:72px;border-radius:20px;background:var(--rose-bg);color:var(--rose-text);display:flex;align-items:center;justify-content:center}
    .h{font-size:20px;font-weight:700;margin:4px 0 0}
    button{margin-top:10px;min-height:44px;padding:0 22px;border:0;border-radius:12px;background:var(--green);color:var(--on-green);font:inherit;font-size:15px;font-weight:700;cursor:pointer}
    .foot{position:fixed;bottom:14px;left:0;right:0;text-align:center;font-size:11px;color:var(--sub);letter-spacing:.3px}
    """

    static func loading() -> String {
        "<!DOCTYPE html><html lang='ko'><head><meta charset='utf-8'><style>\(css)</style></head><body><div class='c'>" +
        "<img class='ic' alt='' src='\(AppInfo.iconDataURL)'><p class='s'>영복교회</p><p class='t'>성도 돌봄</p>" +
        "<div class='bar' aria-hidden='true'><i></i></div><p class='s' role='status'>여는 중이에요…</p></div>" +
        "<p class='foot'>made by. Nevertheless_D</p></body></html>"
    }

    static func offline(_ detail: String) -> String {
        let d = detail.replacingOccurrences(of: "<", with: "&lt;").replacingOccurrences(of: ">", with: "&gt;")
        return "<!DOCTYPE html><html lang='ko'><head><meta charset='utf-8'><style>\(css)</style></head><body><div class='c'>" +
        "<div class='warn' aria-hidden='true'><svg width='38' height='38' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round'><path d='M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0'/><path d='M3 3l18 18'/></svg></div>" +
        "<p class='h'>인터넷에 연결되지 않았어요</p><p class='s'>연결을 확인한 뒤 다시 시도해 주세요.<br>입력한 내용은 구글 시트에 안전하게 있어요.</p>" +
        "<button type='button' id='retry'>다시 시도</button><p class='s' style='font-size:11px;margin-top:8px'>\(d)</p></div>" +
        "<p class='foot'>made by. Nevertheless_D</p>" +
        "<script>document.getElementById('retry').addEventListener('click',function(){window.webkit.messageHandlers.shepherd.postMessage('retry');});</script></body></html>"
    }
}

// MARK: - 업데이트 (releases/latest.json: version · url · sha256)

struct UpdateInfo { let version: String; let url: URL; let sha256: String }

enum Updater {
    static func compare(_ a: String, _ b: String) -> Int {
        let x = a.split(separator: ".").map { Int($0) ?? 0 }, y = b.split(separator: ".").map { Int($0) ?? 0 }
        for i in 0..<max(x.count, y.count) {
            let p = i < x.count ? x[i] : 0, q = i < y.count ? y[i] : 0
            if p != q { return p < q ? -1 : 1 }
        }
        return 0
    }

    static func check(_ done: @escaping (Result<UpdateInfo, Error>) -> Void) {
        var req = URLRequest(url: AppInfo.latestURL, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 20)
        req.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
        URLSession.shared.dataTask(with: req) { data, _, err in
            DispatchQueue.main.async {
                if let err = err { done(.failure(err)); return }
                guard let data = data,
                      let j = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let v = j["version"] as? String, let u = j["url"] as? String, let url = URL(string: u),
                      let h = j["sha256"] as? String, h.count == 64 else {
                    done(.failure(NSError(domain: "update", code: 1, userInfo: [NSLocalizedDescriptionKey: "업데이트 정보를 읽지 못했어요"]))); return
                }
                Log.write("업데이트 확인: 최신 \(v), 지금 \(AppInfo.version)")
                done(.success(UpdateInfo(version: v, url: url, sha256: h.lowercased())))
            }
        }.resume()
    }

    static func isNewer(_ i: UpdateInfo) -> Bool { compare(i.version, AppInfo.version) > 0 }

    /// 내려받기 → sha256 확인 → 풀기 → 버전 확인 → 지금 앱을 백업 → 바꾸기 → 새 버전으로 다시 열기
    static func apply(_ info: UpdateInfo, done: @escaping (Error?) -> Void) {
        URLSession.shared.downloadTask(with: info.url) { tmp, _, err in
            let result: Error? = {
                if let err = err { return err }
                guard let tmp = tmp else { return NSError(domain: "update", code: 2, userInfo: [NSLocalizedDescriptionKey: "내려받지 못했어요"]) }
                do {
                    let data = try Data(contentsOf: tmp)
                    let hash = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
                    guard hash == info.sha256 else { throw NSError(domain: "update", code: 3, userInfo: [NSLocalizedDescriptionKey: "내려받은 파일이 손상됐어요. 잠시 뒤 다시 해 주세요."]) }
                    Log.write("업데이트 파일 확인 완료 (sha256 일치)")
                    let work = AppInfo.supportDir.appendingPathComponent("update", isDirectory: true)
                    try? FileManager.default.removeItem(at: work)
                    try FileManager.default.createDirectory(at: work, withIntermediateDirectories: true)
                    let zip = work.appendingPathComponent("update.zip")
                    try data.write(to: zip)
                    try run("/usr/bin/ditto", ["-x", "-k", zip.path, work.appendingPathComponent("new").path])
                    guard let newApp = findApp(in: work.appendingPathComponent("new")) else { throw NSError(domain: "update", code: 4, userInfo: [NSLocalizedDescriptionKey: "업데이트 파일 안에 앱이 없어요."]) }
                    let nv = Bundle(url: newApp)?.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
                    guard nv == info.version else { throw NSError(domain: "update", code: 5, userInfo: [NSLocalizedDescriptionKey: "업데이트 파일의 버전이 맞지 않아요."]) }
                    try replaceCurrentApp(with: newApp, backup: true)
                    Log.write("업데이트 설치 완료 → \(nv) 로 다시 열어요")
                    return nil
                } catch { return error }
            }()
            DispatchQueue.main.async { done(result) }
        }.resume()
    }

    static func findApp(in dir: URL) -> URL? {
        guard let e = FileManager.default.enumerator(at: dir, includingPropertiesForKeys: nil) else { return nil }
        for case let u as URL in e where u.pathExtension == "app" && u.lastPathComponent == AppInfo.name + ".app" { return u }
        return nil
    }

    static func replaceCurrentApp(with newApp: URL, backup: Bool) throws {
        let fm = FileManager.default
        let cur = Bundle.main.bundleURL
        if backup {
            try? fm.removeItem(at: AppInfo.backupURL)
            try fm.createDirectory(at: AppInfo.backupURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try fm.copyItem(at: cur, to: AppInfo.backupURL)
        }
        let staged = cur.deletingLastPathComponent().appendingPathComponent("." + AppInfo.name + "-new.app")
        try? fm.removeItem(at: staged)
        do {
            try fm.copyItem(at: newApp, to: staged)
            _ = try fm.replaceItemAt(cur, withItemAt: staged)
        } catch {
            try? fm.removeItem(at: staged)
            if (error as NSError).code == NSFileWriteNoPermissionError {
                throw NSError(domain: "update", code: 6, userInfo: [NSLocalizedDescriptionKey: "앱 폴더에 쓸 수 없어요. 내려받기 파일을 새로 받아 주세요."])
            }
            throw error
        }
        try? run("/usr/bin/xattr", ["-dr", "com.apple.quarantine", cur.path])
    }

    /// 맥 안의 백업으로 되돌려요
    static func rollback() throws {
        guard FileManager.default.fileExists(atPath: AppInfo.backupURL.path) else {
            throw NSError(domain: "update", code: 7, userInfo: [NSLocalizedDescriptionKey: "되돌릴 이전 버전이 없어요."])
        }
        let copy = AppInfo.supportDir.appendingPathComponent("rollback-" + AppInfo.name + ".app")
        try? FileManager.default.removeItem(at: copy)
        try FileManager.default.copyItem(at: AppInfo.backupURL, to: copy)
        try replaceCurrentApp(with: copy, backup: false)
        try? FileManager.default.removeItem(at: copy)
        Log.write("이전 버전으로 되돌림")
    }

    /// 새 버전을 다시 열고 지금 앱은 닫아요 (RESTART 는 빼고 RELAUNCHED=1 을 붙여 무한 재실행을 막아요)
    static func relaunch(extraArgs: [String] = []) {
        var env = ProcessInfo.processInfo.environment
        env.removeValue(forKey: "RESTART")
        env["RELAUNCHED"] = "1"
        let cfg = NSWorkspace.OpenConfiguration()
        cfg.createsNewApplicationInstance = true
        cfg.environment = env
        cfg.arguments = extraArgs
        NSWorkspace.shared.openApplication(at: Bundle.main.bundleURL, configuration: cfg) { _, err in
            if let err = err { Log.write("다시 열기 실패: \(err.localizedDescription)") }
            DispatchQueue.main.async { NSApp.terminate(nil) }
        }
    }

    @discardableResult
    static func run(_ tool: String, _ args: [String]) throws -> Int32 {
        let p = Process(); p.executableURL = URL(fileURLWithPath: tool); p.arguments = args
        try p.run(); p.waitUntilExit()
        if p.terminationStatus != 0 && tool != "/usr/bin/xattr" {
            throw NSError(domain: "update", code: Int(p.terminationStatus), userInfo: [NSLocalizedDescriptionKey: "\((tool as NSString).lastPathComponent) 실패"])
        }
        return p.terminationStatus
    }
}

// MARK: - 앱 정보 창

final class AboutWindow: NSWindowController {
    private let status = NSTextField(labelWithString: "")
    private var updateButton: NSButton!
    private var pending: UpdateInfo?
    var onUpdate: ((UpdateInfo) -> Void)?
    var onRollback: (() -> Void)?

    convenience init() {
        let w = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 380, height: 440), styleMask: [.titled, .closable], backing: .buffered, defer: false)
        w.title = "앱 정보"
        w.isReleasedWhenClosed = false
        self.init(window: w)
        build()
    }

    private func label(_ s: String, size: CGFloat, weight: NSFont.Weight = .regular, color: NSColor = .secondaryLabelColor) -> NSTextField {
        let l = NSTextField(labelWithString: s)
        l.font = .systemFont(ofSize: size, weight: weight); l.textColor = color; l.alignment = .center
        l.lineBreakMode = .byWordWrapping; l.maximumNumberOfLines = 2
        return l
    }

    private func build() {
        let img = NSImageView(image: AppInfo.iconImage); img.imageScaling = .scaleProportionallyUpOrDown
        img.widthAnchor.constraint(equalToConstant: 88).isActive = true; img.heightAnchor.constraint(equalToConstant: 88).isActive = true
        let name = label(AppInfo.name, size: 19, weight: .bold, color: .labelColor)
        let ver = label("영복교회 성도 돌봄 · 버전 \(AppInfo.version)", size: 13)
        let note = label("앱 안의 새 기능은 열 때마다 자동으로 반영돼요.", size: 12)
        status.alignment = .center; status.font = .systemFont(ofSize: 12); status.textColor = NSColor(name: nil) { a in
            a.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? NSColor(srgbRed: 0.49, green: 0.77, blue: 0.66, alpha: 1) : NSColor(srgbRed: 0.18, green: 0.42, blue: 0.34, alpha: 1)
        }
        updateButton = NSButton(title: "업데이트 확인", target: self, action: #selector(checkUpdate))
        let logButton = NSButton(title: "진단 정보 보기", target: self, action: #selector(openLog))
        let buttons = NSStackView(views: [updateButton, logButton]); buttons.spacing = 10
        var views: [NSView] = [img, name, ver, note, status, buttons]
        if FileManager.default.fileExists(atPath: AppInfo.backupURL.path) {
            let rb = NSButton(title: "이전 버전으로 되돌리기", target: self, action: #selector(rollback))
            rb.bezelStyle = .inline
            views.append(rb)
        }
        let foot = label("made by. Nevertheless_D", size: 11)
        views.append(foot)
        let stack = NSStackView(views: views)
        stack.orientation = .vertical; stack.alignment = .centerX; stack.spacing = 10
        stack.setCustomSpacing(16, after: img); stack.setCustomSpacing(18, after: buttons)
        stack.edgeInsets = NSEdgeInsets(top: 28, left: 20, bottom: 22, right: 20)
        stack.translatesAutoresizingMaskIntoConstraints = false
        let content = NSView()
        content.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: content.leadingAnchor), stack.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            stack.topAnchor.constraint(equalTo: content.topAnchor), stack.bottomAnchor.constraint(lessThanOrEqualTo: content.bottomAnchor)
        ])
        window?.contentView = content
        window?.center()
    }

    @objc func checkUpdate() {
        if let p = pending { onUpdate?(p); return }
        updateButton.isEnabled = false
        status.stringValue = "새 버전을 확인하는 중…"
        Updater.check { [weak self] r in
            guard let self = self else { return }
            self.updateButton.isEnabled = true
            switch r {
            case .success(let i) where Updater.isNewer(i):
                self.pending = i
                self.status.stringValue = "새 버전 \(i.version) 이 있어요."
                self.updateButton.title = "지금 업데이트"
            case .success:
                self.status.stringValue = "지금이 최신 버전이에요."
            case .failure(let e):
                Log.write("업데이트 확인 실패: \(e.localizedDescription)")
                self.status.stringValue = "확인하지 못했어요. 인터넷 연결을 확인해 주세요."
            }
        }
    }

    @objc func openLog() { AboutWindow.openLog() }
    @objc func rollback() { onRollback?() }

    static func openLog() {
        Log.write("진단 정보 열기 · 버전 \(AppInfo.version) · macOS \(ProcessInfo.processInfo.operatingSystemVersionString) · \(machine())")
        NSWorkspace.shared.open(AppInfo.logURL)
    }

    static func machine() -> String {
        var s = utsname(); uname(&s)
        return withUnsafeBytes(of: &s.machine) { String(decoding: $0.prefix(while: { $0 != 0 }), as: UTF8.self) }
    }
}

// MARK: - 앱

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, NSWindowDelegate {
    var window: NSWindow!
    var web: WKWebView!
    var about: AboutWindow?
    var appRequested = false
    var appShown = false
    var updateBanner: NSView?
    let args = CommandLine.arguments
    lazy var smokeDir: URL? = {
        if let i = args.firstIndex(of: "--smoke"), i + 1 < args.count { return URL(fileURLWithPath: args[i + 1]) }
        return nil
    }()
    lazy var updateTestDir: URL? = {
        if let i = args.firstIndex(of: "--smoke-update"), i + 1 < args.count { return URL(fileURLWithPath: args[i + 1]) }
        return nil
    }()

    func applicationDidFinishLaunching(_ n: Notification) {
        Log.trim()
        Log.write("앱 시작 · 버전 \(AppInfo.version) · macOS \(ProcessInfo.processInfo.operatingSystemVersionString) · \(AboutWindow.machine())" +
                  (ProcessInfo.processInfo.environment["RELAUNCHED"] == "1" ? " · 업데이트 뒤 다시 열림" : ""))
        buildMenu()
        buildWindow()

        if let dir = updateTestDir {
            // 시험: 업데이트 → 다시 열기 흐름 (새 버전이 relaunched.txt 를 남기고 끝나요)
            if ProcessInfo.processInfo.environment["RELAUNCHED"] == "1" {
                try? "relaunched version=\(AppInfo.version)".write(to: dir.appendingPathComponent("relaunched.txt"), atomically: true, encoding: .utf8)
                NSApp.terminate(nil); return
            }
            Updater.check { r in
                guard case .success(let i) = r, Updater.isNewer(i) else {
                    try? "update-check-failed".write(to: dir.appendingPathComponent("relaunched.txt"), atomically: true, encoding: .utf8)
                    NSApp.terminate(nil); return
                }
                Updater.apply(i) { e in
                    if let e = e { try? "apply-failed \(e.localizedDescription)".write(to: dir.appendingPathComponent("relaunched.txt"), atomically: true, encoding: .utf8); NSApp.terminate(nil); return }
                    Updater.relaunch(extraArgs: ["--smoke-update", dir.path])
                }
            }
            return
        }

        showLoading()
        if smokeDir == nil {
            DispatchQueue.main.asyncAfter(deadline: .now() + 4) { self.checkUpdateQuietly() }
        } else {
            DispatchQueue.main.asyncAfter(deadline: .now() + 120) { self.smokeDone("smoke=fail timeout") }
        }
    }

    // 창을 닫아도 앱은 Dock 에 남아요
    func applicationShouldTerminateAfterLastWindowClosed(_ s: NSApplication) -> Bool { false }

    // Dock 아이콘을 누르면 창이 다시 열려요
    func applicationShouldHandleReopen(_ s: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        Log.write("Dock 에서 다시 열기")
        window.makeKeyAndOrderFront(nil)
        return true
    }

    func applicationWillTerminate(_ n: Notification) { Log.write("앱 종료") }

    // MARK: 창

    func buildWindow() {
        let bg = NSColor(name: nil) { a in
            a.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? NSColor(srgbRed: 0x12/255, green: 0x17/255, blue: 0x15/255, alpha: 1)
                                                                : NSColor(srgbRed: 0xF6/255, green: 0xF4/255, blue: 0xEF/255, alpha: 1)
        }
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1120, height: 820),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = AppInfo.windowTitle
        window.minSize = NSSize(width: 420, height: 560)
        window.backgroundColor = bg
        window.isReleasedWhenClosed = false
        window.delegate = self
        if !window.setFrameUsingName("ShepherdLORDMain") { window.center() }
        window.setFrameAutosaveName("ShepherdLORDMain")

        let cfg = WKWebViewConfiguration()
        cfg.websiteDataStore = .default()   // 이 앱 전용 저장소 (로그인 유지)
        cfg.userContentController.add(self, name: "shepherd")
        cfg.preferences.javaScriptCanOpenWindowsAutomatically = true
        web = WKWebView(frame: .zero, configuration: cfg)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.setValue(false, forKey: "drawsBackground")
        web.allowsMagnification = true

        let content = NSView()
        web.translatesAutoresizingMaskIntoConstraints = false
        content.addSubview(web)
        NSLayoutConstraint.activate([
            web.leadingAnchor.constraint(equalTo: content.leadingAnchor), web.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            web.topAnchor.constraint(equalTo: content.topAnchor), web.bottomAnchor.constraint(equalTo: content.bottomAnchor)
        ])
        window.contentView = content
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func showLoading() {
        appRequested = false; appShown = false
        web.loadHTMLString(Pages.loading(), baseURL: nil)
    }

    @objc func goApp() {
        appRequested = true; appShown = false
        Log.write("앱 주소 열기")
        web.load(URLRequest(url: AppInfo.appURL))
    }

    // MARK: 메뉴

    func buildMenu() {
        let main = NSMenu()
        func item(_ t: String, _ a: Selector?, _ k: String = "", _ m: NSEvent.ModifierFlags = .command, target: AnyObject? = nil) -> NSMenuItem {
            let i = NSMenuItem(title: t, action: a, keyEquivalent: k); i.keyEquivalentModifierMask = m; if let target = target { i.target = target }; return i
        }
        let appItem = NSMenuItem(); main.addItem(appItem)
        let appMenu = NSMenu(title: AppInfo.name)
        appMenu.addItem(item("\(AppInfo.name)에 관하여", #selector(showAbout), target: self))
        appMenu.addItem(.separator())
        appMenu.addItem(item("업데이트 확인…", #selector(showAboutAndCheck), target: self))
        appMenu.addItem(item("진단 정보 보기", #selector(openLog), target: self))
        appMenu.addItem(.separator())
        appMenu.addItem(item("새로고침", #selector(goApp), "r", target: self))
        appMenu.addItem(.separator())
        appMenu.addItem(item("\(AppInfo.name) 가리기", #selector(NSApplication.hide(_:)), "h"))
        appMenu.addItem(item("기타 가리기", #selector(NSApplication.hideOtherApplications(_:)), "h", [.command, .option]))
        appMenu.addItem(item("모두 보기", #selector(NSApplication.unhideAllApplications(_:))))
        appMenu.addItem(.separator())
        appMenu.addItem(item("\(AppInfo.name) 종료", #selector(NSApplication.terminate(_:)), "q"))
        appItem.submenu = appMenu

        let editItem = NSMenuItem(); main.addItem(editItem)
        let edit = NSMenu(title: "편집")
        edit.addItem(item("실행 취소", Selector(("undo:")), "z"))
        edit.addItem(item("실행 복귀", Selector(("redo:")), "z", [.command, .shift]))
        edit.addItem(.separator())
        edit.addItem(item("오려두기", #selector(NSText.cut(_:)), "x"))
        edit.addItem(item("복사하기", #selector(NSText.copy(_:)), "c"))
        edit.addItem(item("붙여넣기", #selector(NSText.paste(_:)), "v"))
        edit.addItem(item("전체 선택", #selector(NSText.selectAll(_:)), "a"))
        editItem.submenu = edit

        let viewItem = NSMenuItem(); main.addItem(viewItem)
        let view = NSMenu(title: "보기")
        view.addItem(item("새로고침", #selector(goApp), "r", target: self))
        view.addItem(.separator())
        view.addItem(item("크게 보기", #selector(zoomIn), "+", target: self))
        view.addItem(item("작게 보기", #selector(zoomOut), "-", target: self))
        view.addItem(item("실제 크기", #selector(zoomReset), "0", target: self))
        viewItem.submenu = view

        let winItem = NSMenuItem(); main.addItem(winItem)
        let win = NSMenu(title: "윈도우")
        win.addItem(item("최소화", #selector(NSWindow.performMiniaturize(_:)), "m"))
        win.addItem(item("확대/축소", #selector(NSWindow.performZoom(_:))))
        win.addItem(item("닫기", #selector(NSWindow.performClose(_:)), "w"))
        win.addItem(.separator())
        win.addItem(item("성도 돌봄 창 보기", #selector(showMain), "1", target: self))
        winItem.submenu = win
        NSApp.windowsMenu = win

        NSApp.mainMenu = main
    }

    @objc func showMain() { window.makeKeyAndOrderFront(nil) }
    @objc func zoomIn() { web.pageZoom = min(web.pageZoom + 0.1, 2.0) }
    @objc func zoomOut() { web.pageZoom = max(web.pageZoom - 0.1, 0.6) }
    @objc func zoomReset() { web.pageZoom = 1.0 }
    @objc func openLog() { AboutWindow.openLog() }

    @objc func showAbout() {
        let a = AboutWindow()
        a.onUpdate = { [weak self] i in a.close(); self?.doUpdate(i) }
        a.onRollback = { [weak self] in a.close(); self?.doRollback() }
        about = a
        a.showWindow(nil)
        a.window?.makeKeyAndOrderFront(nil)
    }
    @objc func showAboutAndCheck() { showAbout(); about?.checkUpdate() }

    // MARK: 업데이트

    func checkUpdateQuietly() {
        Updater.check { [weak self] r in
            guard let self = self else { return }
            if case .success(let i) = r, Updater.isNewer(i) { self.showUpdateBanner(i) }
            if case .failure(let e) = r { Log.write("자동 업데이트 확인 건너뜀: \(e.localizedDescription)") }
        }
    }

    func showUpdateBanner(_ i: UpdateInfo) {
        guard updateBanner == nil, let content = window.contentView else { return }
        let bar = NSView(); bar.wantsLayer = true
        bar.layer?.backgroundColor = NSColor(srgbRed: 0.89, green: 0.94, blue: 0.91, alpha: 0.98).cgColor
        let text = NSTextField(labelWithString: "새 버전 \(i.version) 이 나왔어요. 지금 바꾸면 앱이 잠깐 닫혔다가 다시 열려요.")
        text.textColor = NSColor(srgbRed: 0.12, green: 0.15, blue: 0.13, alpha: 1); text.font = .systemFont(ofSize: 13)
        let now = NSButton(title: "지금 업데이트", target: nil, action: nil); now.bezelStyle = .rounded; now.keyEquivalent = "\r"
        let later = NSButton(title: "나중에", target: nil, action: nil); later.bezelStyle = .rounded
        let stack = NSStackView(views: [text, NSView(), later, now]); stack.edgeInsets = NSEdgeInsets(top: 8, left: 14, bottom: 8, right: 12)
        stack.translatesAutoresizingMaskIntoConstraints = false; bar.translatesAutoresizingMaskIntoConstraints = false
        bar.addSubview(stack); content.addSubview(bar)
        NSLayoutConstraint.activate([
            bar.leadingAnchor.constraint(equalTo: content.leadingAnchor), bar.trailingAnchor.constraint(equalTo: content.trailingAnchor), bar.topAnchor.constraint(equalTo: content.topAnchor),
            stack.leadingAnchor.constraint(equalTo: bar.leadingAnchor), stack.trailingAnchor.constraint(equalTo: bar.trailingAnchor),
            stack.topAnchor.constraint(equalTo: bar.topAnchor), stack.bottomAnchor.constraint(equalTo: bar.bottomAnchor)
        ])
        updateBanner = bar
        let box = ClosureBox { [weak self] in self?.doUpdate(i) }
        let box2 = ClosureBox { [weak self] in self?.updateBanner?.removeFromSuperview(); self?.updateBanner = nil }
        now.target = box; now.action = #selector(ClosureBox.fire); later.target = box2; later.action = #selector(ClosureBox.fire)
        objc_setAssociatedObject(bar, "boxes", [box, box2], .OBJC_ASSOCIATION_RETAIN)
    }

    func doUpdate(_ i: UpdateInfo) {
        let alert = NSAlert(); alert.messageText = "새 버전을 내려받는 중이에요…"; alert.informativeText = "잠시만 기다려 주세요. 끝나면 앱이 다시 열려요."
        alert.addButton(withTitle: "숨기기")
        alert.beginSheetModal(for: window, completionHandler: nil)
        Updater.apply(i) { [weak self] e in
            guard let self = self else { return }
            self.window.endSheet(alert.window)
            if let e = e {
                Log.write("업데이트 실패: \(e.localizedDescription)")
                let a = NSAlert(); a.messageText = "업데이트하지 못했어요"; a.informativeText = e.localizedDescription; a.runModal()
                return
            }
            Updater.relaunch()
        }
    }

    func doRollback() {
        do { try Updater.rollback(); Updater.relaunch() }
        catch { let a = NSAlert(); a.messageText = "되돌리지 못했어요"; a.informativeText = error.localizedDescription; a.runModal() }
    }

    // MARK: 화면 이동

    private func isAllowed(_ url: URL?) -> Bool {
        guard let url = url, let scheme = url.scheme?.lowercased() else { return true }
        if scheme == "about" || scheme == "data" || scheme == "blob" { return true }
        guard let host = url.host?.lowercased() else { return true }
        return host == "script.google.com" || host.hasSuffix(".googleusercontent.com") || host == "accounts.google.com" || host == "www.google.com"
            || host == "fonts.googleapis.com" || host == "fonts.gstatic.com" || host == "cdnjs.cloudflare.com"
    }

    func webView(_ w: WKWebView, decidePolicyFor a: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if a.targetFrame?.isMainFrame ?? true, !isAllowed(a.request.url), let u = a.request.url {
            Log.write("바깥 주소는 기본 브라우저로 열기: \(u.absoluteString)")
            NSWorkspace.shared.open(u)
            decisionHandler(.cancel); return
        }
        decisionHandler(.allow)
    }

    // target=_blank 같은 새 창은 기본 브라우저로 열어요
    func webView(_ w: WKWebView, createWebViewWith c: WKWebViewConfiguration, for a: WKNavigationAction, windowFeatures f: WKWindowFeatures) -> WKWebView? {
        if let u = a.request.url, u.scheme?.hasPrefix("http") == true { NSWorkspace.shared.open(u) }
        return nil
    }

    // 사진 · 엑셀 파일 고르기
    func webView(_ w: WKWebView, runOpenPanelWith p: WKOpenPanelParameters, initiatedByFrame f: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true; panel.canChooseDirectories = false
        panel.allowsMultipleSelection = p.allowsMultipleSelection
        panel.beginSheetModal(for: window) { r in completionHandler(r == .OK ? panel.urls : nil) }
    }

    func webView(_ w: WKWebView, runJavaScriptAlertPanelWithMessage m: String, initiatedByFrame f: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = NSAlert(); a.messageText = m; a.beginSheetModal(for: window) { _ in completionHandler() }
    }

    func webView(_ w: WKWebView, runJavaScriptConfirmPanelWithMessage m: String, initiatedByFrame f: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = NSAlert(); a.messageText = m; a.addButton(withTitle: "확인"); a.addButton(withTitle: "취소")
        a.beginSheetModal(for: window) { r in completionHandler(r == .alertFirstButtonReturn) }
    }

    func webView(_ w: WKWebView, didFinish n: WKNavigation!) {
        if !appRequested {
            // 여는 중 화면이 그려졌어요 → 앱 주소로 (그동안 여는 중 화면이 보여요)
            if smokeDir != nil { snapshot("loading.png") { self.goApp() } } else { goApp() }
            return
        }
        if !appShown, w.url?.scheme?.hasPrefix("http") == true {
            appShown = true
            Log.write("앱 화면 열림")
            if smokeDir != nil { smokeAfterApp() }
        }
    }

    func webView(_ w: WKWebView, didFail n: WKNavigation!, withError e: Error) { failed(e) }
    func webView(_ w: WKWebView, didFailProvisionalNavigation n: WKNavigation!, withError e: Error) { failed(e) }

    private func failed(_ e: Error) {
        let ns = e as NSError
        if ns.code == NSURLErrorCancelled || ns.code == 102 { return }  // 취소 · 다른 앱에서 열기
        Log.write("앱을 열지 못함: \(ns.domain) \(ns.code) \(ns.localizedDescription)")
        appRequested = true
        web.loadHTMLString(Pages.offline("오류 코드: \(ns.code)"), baseURL: nil)
    }

    func webViewWebContentProcessDidTerminate(_ w: WKWebView) {
        Log.write("화면 엔진이 멈춰서 다시 열어요")
        goApp()
    }

    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
        if (m.body as? String) == "retry" { Log.write("다시 시도 누름"); goApp() }
    }

    // MARK: 빌드 서버 시험 (--smoke 폴더)

    func snapshot(_ name: String, then: (() -> Void)? = nil) {
        guard let dir = smokeDir else { then?(); return }
        web.takeSnapshot(with: nil) { img, _ in
            if let img = img, let t = img.tiffRepresentation, let rep = NSBitmapImageRep(data: t), let png = rep.representation(using: .png, properties: [:]) {
                try? png.write(to: dir.appendingPathComponent(name)); Log.write("시험 캡처: \(name)")
            }
            then?()
        }
    }

    func smokeAfterApp() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 9) {
            self.snapshot("app.png") {
                self.web.evaluateJavaScript("document.title") { v, _ in
                    let title = (v as? String) ?? ""
                    Log.write("시험: 앱 제목 = \(title)")
                    self.web.loadHTMLString(Pages.offline("오류 코드: 시험 화면"), baseURL: nil)
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
                        self.snapshot("offline.png") {
                            self.showAbout()
                            DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
                                if let v = self.about?.window?.contentView, let rep = v.bitmapImageRepForCachingDisplay(in: v.bounds) {
                                    v.cacheDisplay(in: v.bounds, to: rep)
                                    try? rep.representation(using: .png, properties: [:])?.write(to: self.smokeDir!.appendingPathComponent("about.png"))
                                }
                                self.about?.close()
                                self.smokeDone(title.contains("성도 돌봄") ? "smoke=ok title=\(title)" : "smoke=fail title=\(title)")
                            }
                        }
                    }
                }
            }
        }
    }

    var smokeFinished = false
    func smokeDone(_ r: String) {
        guard !smokeFinished, let dir = smokeDir else { return }
        smokeFinished = true
        Log.write("시험 결과: \(r)")
        try? r.write(to: dir.appendingPathComponent("smoke.txt"), atomically: true, encoding: .utf8)
        NSApp.terminate(nil)
    }
}

final class ClosureBox: NSObject {
    let f: () -> Void
    init(_ f: @escaping () -> Void) { self.f = f }
    @objc func fire() { f() }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
