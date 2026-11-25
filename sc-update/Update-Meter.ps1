# Auto-fill "previous meter reading" in SC manual meter form (Stayhub2Bill branch claude/exciting-tesla-79df57)
# Run:  powershell -ExecutionPolicy Bypass -File .\Update-Meter.ps1   (keep the "meter-files" folder next to this script)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
# target (relative to project root) | file in meter-files | sha256 of GitHub main (CR removed) | sha256 of new file
$files = @(
  @('cloudflare\manual-meter.mjs','manual-meter.mjs','88AF9E9EBBB35F8461F3352B4B489E3B3821F4B8B6E29A594C18D16218C5FA56','C09397444DEA98C406CA586EFE37DDD55E0CAEE04D42C2D04BB99B62EDCF74AE'),
  @('cloudflare\control-portal.mjs','control-portal.mjs','CAAC82F1115921573429DED968F7B469F4ABFFA627538A9D4C244B7EE08D539A','EBDA51384B4FD3C1134C2B13A68F9C37A5C833FA99E1D863D0F0C7ACEB3F8A3A'),
  @('cloudflare\control-portal-html.mjs','control-portal-html.mjs','C9F18808E6D65216C41B61CCC937D5DF9A3BF4FC950DD911ACD71391BAA1865E','72836BCB741CC442FDE25DC13A2E9BE5DFC2DE8261C0406A46A00BB9201EC096'),
  @('cloudflare\public\notices\theme\control-legacy-v1.js','control-legacy-v1.js','651742769B99A4EE78EAB3FE9ABBC2BA3B4F4DD8E308439A0D8BE1A98D31353C','9A62AAB6B0E8BB1A21FF6CC078D5BF1812506A30FCF94595D756A2C8A28FDD91')
)
function NormHash($path) {
  $b = [IO.File]::ReadAllBytes($path) | Where-Object { $_ -ne 13 }
  $sha = [Security.Cryptography.SHA256]::Create()
  ([BitConverter]::ToString($sha.ComputeHash([byte[]]$b))).Replace('-','')
}

$proc = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'local-core[\\/](supervisor\.cjs|server\.mjs)' } | Select-Object -First 1
if (-not $proc) { throw 'local-core is not running (no node supervisor.cjs/server.mjs found).' }
if ($proc.CommandLine -notmatch '"?([A-Za-z]:[^"]*?local-core[\\/](?:supervisor\.cjs|server\.mjs))"?') { throw "Cannot read folder from: $($proc.CommandLine)" }
$root = Split-Path -Parent (Split-Path -Parent $Matches[1].Trim())
$port = (Get-Content (Join-Path $env:LOCALAPPDATA 'StayHub\local-core\config.json') -Raw | ConvertFrom-Json).port
Write-Host "Project: $root  Port: $port"

# Check every file first; stop before changing anything if a file has local edits
$todo = @()
foreach ($f in $files) {
  $src = Join-Path $here ('meter-files\' + $f[1]); $dst = Join-Path $root $f[0]
  if ((NormHash $src) -ne $f[3]) { throw "Download is damaged: $src" }
  $h = NormHash $dst
  if ($h -eq $f[3]) { Write-Host "Already new: $($f[0])"; continue }
  if ($h -ne $f[2]) { throw "STOP: $($f[0]) on this PC has changes that are not on GitHub. Nothing was changed. Send this message to Claude." }
  $todo += ,$f
}
if (-not $todo) { Write-Host 'Nothing to update.' -ForegroundColor Green; exit 0 }

$backup = Join-Path (Split-Path -Parent $root) ('meter-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
foreach ($f in $todo) {
  $dst = Join-Path $root $f[0]; $bk = Join-Path $backup $f[0]
  New-Item -ItemType Directory -Force (Split-Path -Parent $bk) | Out-Null
  Copy-Item $dst $bk
  Copy-Item (Join-Path $here ('meter-files\' + $f[1])) $dst -Force
  Write-Host "Updated: $($f[0])"
}
"Restore: copy everything in this folder back into $root (same sub-folders), then close node local-core\server.mjs." | Set-Content (Join-Path $backup 'RESTORE.txt') -Encoding UTF8

Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'local-core[\\/]server\.mjs' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
$ok = $false
for ($i = 0; $i -lt 30; $i++) { Start-Sleep 2; try { if ((Invoke-WebRequest "http://127.0.0.1:$port/local-healthz" -UseBasicParsing -TimeoutSec 4).StatusCode -eq 200) { $ok = $true; break } } catch {} }
if (-not $ok) { Write-Warning 'local-core did not come back in 60s. Check Task Scheduler "StayHub Local Core".'; exit 1 }
$html = (Invoke-WebRequest "http://127.0.0.1:$port/control" -UseBasicParsing -TimeoutSec 10).Content
if ($html -match 'meter-baseline-20261125-1') { Write-Host 'OK: update is live.' -ForegroundColor Green } else { Write-Warning 'Server is up but still serving the old page.' }
Write-Host "Backup: $backup"
Start-Process "http://127.0.0.1:$port/control"
