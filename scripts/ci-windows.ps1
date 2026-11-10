# Windows 빌드 서버에서: 빌드 → 실행 시험(--smoke) → 내려받기 zip 만들기
$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
$out = Join-Path $root 'ci-out'
New-Item -ItemType Directory -Force $out | Out-Null
$status = Join-Path $out 'status.txt'
Set-Content $status "build=pending`nsmoke=pending" -Encoding utf8

[xml]$proj = Get-Content 'windows/ShepherdLORD/ShepherdLORD.csproj'
$ver = ($proj.Project.PropertyGroup | Where-Object { $_.Version } | Select-Object -First 1).Version
Write-Host "version $ver"

# 1) 빌드
$app = Join-Path $root 'build/ShepherdLORD'
dotnet publish windows/ShepherdLORD/ShepherdLORD.csproj -c Release -o $app --nologo
if ($LASTEXITCODE -ne 0) { Set-Content $status "build=fail`nsmoke=skip`nversion=$ver" -Encoding utf8; exit 1 }
Get-ChildItem $app -Recurse -Include *.pdb, *.xml, Microsoft.Web.WebView2.Wpf.dll | Remove-Item -Force
Set-Content (Join-Path $app 'version.txt') $ver -NoNewline -Encoding ascii
Copy-Item 'windows/guide/ShepherdLORD-사용가이드.png' $app
Get-ChildItem $app -Recurse | ForEach-Object { $_.FullName.Substring($app.Length) } | Out-File (Join-Path $out 'files.txt') -Encoding utf8

# 2) 실행 시험: WebView2 가 없으면 설치
$wv = Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}' -ErrorAction SilentlyContinue
if (-not $wv) {
  Write-Host 'WebView2 runtime 설치'
  Invoke-WebRequest 'https://go.microsoft.com/fwlink/p/?LinkId=2124703' -OutFile "$env:RUNNER_TEMP\wv2.exe"
  Start-Process "$env:RUNNER_TEMP\wv2.exe" -ArgumentList '/silent /install' -Wait
}
$smoke = Join-Path $out 'smoke'
New-Item -ItemType Directory -Force $smoke | Out-Null
$p = Start-Process (Join-Path $app 'ShepherdLORD.exe') -ArgumentList "--smoke `"$smoke`"" -PassThru
if (-not $p.WaitForExit(170000)) { $p.Kill(); Write-Host 'smoke timeout' }
$smokeResult = if (Test-Path "$smoke/smoke.txt") { Get-Content "$smoke/smoke.txt" -Raw } else { 'smoke=fail no-result' }
Copy-Item "$env:LOCALAPPDATA\ShepherdLORD\launcher.log" $out -ErrorAction SilentlyContinue
Write-Host $smokeResult

# 3) 내려받기 zip (폴더째) + 업데이트 zip (파일만) + sha256
Add-Type -AssemblyName System.IO.Compression.FileSystem
$dl = Join-Path $out 'ShepherdLORD-Windows.zip'
$up = Join-Path $out 'ShepherdLORD-Windows-update.zip'
Remove-Item $dl, $up -ErrorAction SilentlyContinue
[System.IO.Compression.ZipFile]::CreateFromDirectory($app, $dl, [System.IO.Compression.CompressionLevel]::Optimal, $true)
$upDir = Join-Path $root 'build/update'
Copy-Item $app $upDir -Recurse
Remove-Item (Join-Path $upDir 'ShepherdLORD-사용가이드.png')
[System.IO.Compression.ZipFile]::CreateFromDirectory($upDir, $up, [System.IO.Compression.CompressionLevel]::Optimal, $false)
$sha = (Get-FileHash $up -Algorithm SHA256).Hash.ToLower()

$smokeOk = $smokeResult -match '^smoke=ok'
Set-Content $status ("build=ok`nsmoke=" + ($(if ($smokeOk) { 'ok' } else { 'fail' })) + "`nversion=$ver`nupdate_sha256=$sha`nsmoke_detail=$($smokeResult.Trim())") -Encoding utf8
if (-not $smokeOk) { exit 1 }
