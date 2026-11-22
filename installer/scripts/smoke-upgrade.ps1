# Proves on a real Windows machine what could not be tried before: the new installer UPDATES an existing installation in
# place (one entry in "Installed apps", not two), keeps the user's data, repairs a half-updated system, and the installed
# app starts its kernel.
#
#   smoke-upgrade.ps1 -NewInstaller path\to\hyadeOS.Setup.<version>.exe
param(
  [Parameter(Mandatory = $true)][string]$NewInstaller,
  [string]$OldUrl = "https://github.com/hyadeOSS/stable/releases/download/v2.0.4/hyadeOSS.Setup.2.0.4.exe",
  [string]$Port = "3000"
)
$ErrorActionPreference = "Stop"
$uninstallRoot = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall"
$work = Join-Path $env:RUNNER_TEMP "hyadeos-smoke"
if (-not $env:RUNNER_TEMP) { $work = Join-Path $env:TEMP "hyadeos-smoke" }
New-Item -ItemType Directory -Force $work | Out-Null

function Fail($message) { Write-Host "::error::$message"; exit 1 }
function Step($message) { Write-Host ""; Write-Host "=== $message" }

function Get-Installs {
  if (-not (Test-Path $uninstallRoot)) { return @() }
  @(Get-ChildItem $uninstallRoot | ForEach-Object {
    $p = Get-ItemProperty $_.PSPath
    if ($p.DisplayName -like "hyadeOS*") {
      # The folder is the uninstaller's folder when the entry has no InstallLocation of its own.
      $location = $p.InstallLocation
      if (-not $location -and $p.UninstallString) { $location = Split-Path ($p.UninstallString -replace '^"([^"]+)".*$', '$1') -Parent }
      [pscustomobject]@{ Key = $_.PSChildName; Name = $p.DisplayName; Location = $location; Uninstall = $p.UninstallString }
    }
  })
}
function Stop-App {
  Get-Process | Where-Object { $_.ProcessName -like "hyadeOS*" } | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}
function Show-Log {
  foreach ($log in @("$env:APPDATA\hyadeOS\system\hyadeos.log", "$env:APPDATA\hyadeOSS\system\hyadeos.log")) {
    if (Test-Path $log) { Write-Host "--- $log (last 40 lines)"; Get-Content $log -Tail 40 }
  }
}

Step "Old installer: $OldUrl"
$old = Join-Path $work "old-installer.exe"
Invoke-WebRequest -Uri $OldUrl -OutFile $old -UseBasicParsing
Start-Process -FilePath $old -ArgumentList "/S" -Wait
Stop-App
$before = Get-Installs
$before | Format-Table -AutoSize | Out-String | Write-Host
if ($before.Count -ne 1) { Fail "after installing 2.0.4 there should be one entry, found $($before.Count)" }
Write-Host "old install: $($before[0].Name) at $($before[0].Location)"

Step "Seed what a user of the broken beta has: data and a half-updated system in %APPDATA%\hyadeOSS"
$legacy = Join-Path $env:APPDATA "hyadeOSS"
$legacySystem = Join-Path $legacy "system"
New-Item -ItemType Directory -Force (Join-Path $legacySystem "desktop\home") | Out-Null
New-Item -ItemType Directory -Force (Join-Path $legacy "Cache") | Out-Null
Set-Content (Join-Path $legacySystem "version.json") '{"version":"2.1.0-beta.1"}'
Set-Content (Join-Path $legacySystem "server.js") 'THIS SERVER IS BROKEN (an update killed halfway)'
Set-Content (Join-Path $legacySystem "launcher.js") 'THIS LAUNCHER IS BROKEN'
Set-Content (Join-Path $legacySystem "config.json") '{"smoke":"my-settings"}'
Set-Content (Join-Path $legacySystem "desktop\home\notes.txt") 'my notes'
Set-Content (Join-Path $legacy "Cache\big.bin") 'cache'

Step "New installer: $NewInstaller"
Start-Process -FilePath $NewInstaller -ArgumentList "/S" -Wait
Stop-App
$after = Get-Installs
$after | Format-Table -AutoSize | Out-String | Write-Host
if ($after.Count -ne 1) { Fail "after the upgrade there must be ONE hyadeOS entry in Installed apps, found $($after.Count): the installer added a second installation instead of updating" }
if ($after[0].Key -ne $before[0].Key) { Fail "the uninstall key changed ($($before[0].Key) -> $($after[0].Key)): this is not an in-place update" }
if ($after[0].Name -notlike "hyadeOS 2.*") { Fail "unexpected name '$($after[0].Name)'" }
$location = $after[0].Location
Write-Host "new install: $($after[0].Name) at $location"
$exe = Join-Path $location "hyadeOS.exe"
if (-not (Test-Path $exe)) { Fail "$exe is missing" }
if (-not (Test-Path (Join-Path $location "resources\app.asar"))) { Fail "resources\app.asar is missing" }
if (-not (Test-Path (Join-Path $location "resources\system\server.js"))) { Fail "resources\system\server.js is missing" }
$folders = @(Get-ChildItem (Join-Path $env:LOCALAPPDATA "Programs") -Directory | Where-Object { $_.Name -like "hyadeOS*" })
Write-Host "folders under Programs: $($folders.Name -join ', ')"
if ($folders.Count -ne 1) { Fail "more than one hyadeOS folder under Programs: $($folders.Name -join ', ')" }
$shortcuts = @(Get-ChildItem -Recurse -Filter "hyadeOS*.lnk" (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs") -ErrorAction SilentlyContinue)
Write-Host "start menu shortcuts: $($shortcuts.Name -join ', ')"
if ($shortcuts.Count -gt 1) { Fail "more than one Start menu shortcut: $($shortcuts.Name -join ', ')" }

Step "Start the installed app and wait for its kernel"
Start-Process -FilePath $exe
$health = $null
for ($i = 0; $i -lt 90 -and -not $health; $i++) {
  Start-Sleep -Seconds 2
  try { $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/system/health" -TimeoutSec 3 } catch { $health = $null }
}
if (-not $health -or $health.status -ne "ok") { Show-Log; Get-Process | Where-Object { $_.ProcessName -like "hyadeOS*" } | Format-Table | Out-String | Write-Host; Fail "the kernel did not answer on port $Port within 3 minutes" }
Write-Host "kernel answered: $($health | ConvertTo-Json -Compress)"

Step "Data kept, code repaired"
$runtime = Join-Path $env:APPDATA "hyadeOS\system"
if (-not (Test-Path (Join-Path $runtime "config.json"))) { Fail "the settings were not brought over to $runtime" }
if ((Get-Content (Join-Path $runtime "config.json") -Raw) -notmatch "my-settings") { Fail "config.json is not the user's" }
if ((Get-Content (Join-Path $runtime "desktop\home\notes.txt") -Raw) -notmatch "my notes") { Fail "the notes were not kept" }
if ((Get-Content (Join-Path $runtime "server.js") -Raw) -match "BROKEN") { Fail "the broken server.js was not replaced by the installer's" }
$version = (Get-Content (Join-Path $runtime "version.json") -Raw | ConvertFrom-Json).version
Write-Host "system version in the data folder: $version"
if ($version -notmatch "^2\.\d+\.\d+$") { Fail "unexpected version $version" }
if (Test-Path (Join-Path $env:APPDATA "hyadeOS\Cache\big.bin")) { Fail "the old cache was copied" }
if (-not (Test-Path (Join-Path $legacySystem "config.json"))) { Fail "the old data folder was changed" }

Step "Uninstall"
Stop-App
$uninstaller = $after[0].Uninstall -replace '^"([^"]+)".*$', '$1'
Write-Host "uninstaller: $uninstaller"
Start-Process -FilePath $uninstaller -ArgumentList "/S" -Wait
Start-Sleep -Seconds 5
if ((Get-Installs).Count -ne 0) { Fail "the uninstall entry is still there" }
Write-Host "OK: in-place update, data kept, system repaired, kernel started, clean uninstall"
