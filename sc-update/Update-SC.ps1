# Update StayHub Control (SC) page in local-core to Stayhub2Bill main @ 43438e7
# Run in PowerShell (normal user):  powershell -ExecutionPolicy Bypass -File .\Update-SC.ps1
# Put this script next to the "new-files" folder.
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$newHtml = Join-Path $here 'new-files\control-portal-html.mjs'
$newLogo = Join-Path $here 'new-files\sanshine-logo-256.png'
$expect = @{
  $newHtml = 'C9F18808E6D65216C41B61CCC937D5DF9A3BF4FC950DD911ACD71391BAA1865E'
  $newLogo = '1A4A8F3B2FEBFC1C533F3CBE4E268A009F5D423555A476A6D410A5A6F33EF367'
}
foreach ($f in $expect.Keys) {
  if (-not (Test-Path $f)) { throw "Missing $f" }
  if ((Get-FileHash $f -Algorithm SHA256).Hash -ne $expect[$f]) { throw "Checksum mismatch: $f" }
}

# 1) Find where local-core runs
$procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'local-core[\\/](supervisor\.cjs|server\.mjs)' }
if (-not $procs) { throw 'No node process running local-core/supervisor.cjs or server.mjs found.' }
$procs | ForEach-Object { Write-Host ("PID {0}: {1}" -f $_.ProcessId, $_.CommandLine) }
$scriptPath = $null
foreach ($p in $procs) {
  if ($p.CommandLine -match '"?([^"]*?local-core[\\/](?:supervisor\.cjs|server\.mjs))"?') {
    $c = $Matches[1].Trim()
    if (-not [IO.Path]::IsPathRooted($c) -and $p.ExecutablePath) { $c = $null }
    if ($c -and (Test-Path $c)) { $scriptPath = (Resolve-Path $c).Path; break }
  }
}
if (-not $scriptPath) { throw 'Could not resolve local-core folder from the process command line. Send me the PID lines above.' }
$localCore = Split-Path -Parent $scriptPath
$root = Split-Path -Parent $localCore
Write-Host "local-core folder : $localCore"
Write-Host "project root      : $root"

$cfgPath = Join-Path $env:LOCALAPPDATA 'StayHub\local-core\config.json'
$port = $null
if (Test-Path $cfgPath) { $port = (Get-Content $cfgPath -Raw | ConvertFrom-Json).port }  # read only
if (-not $port) { throw "Could not read port from $cfgPath" }
Write-Host "local-core port   : $port"

$dstHtml = Join-Path $root 'cloudflare\control-portal-html.mjs'
$dstLogo = Join-Path $root 'cloudflare\public\notices\theme\sanshine-logo-256.png'
if (-not (Test-Path $dstHtml)) { throw "Not found: $dstHtml" }

# 2) Backup (skip any folder named data, node_modules, .git; never touches %LOCALAPPDATA%\StayHub)
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path (Split-Path -Parent $root) ("{0}-backup-{1}" -f (Split-Path -Leaf $root), $stamp)
Write-Host "Backing up to     : $backup"
robocopy $root $backup /E /XD data node_modules .git /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Backup failed (robocopy $LASTEXITCODE)" }
$old = Join-Path $backup '_old-sc-files'
New-Item -ItemType Directory -Force $old | Out-Null
Copy-Item $dstHtml $old
if (Test-Path $dstLogo) { Copy-Item $dstLogo $old }
@"
Restore = copy these back, then close node local-core\server.mjs (supervisor restarts it):
$old\control-portal-html.mjs -> $dstHtml
$old\sanshine-logo-256.png   -> $dstLogo
"@ | Set-Content (Join-Path $old 'RESTORE.txt') -Encoding UTF8

# 3) Update the 2 files
New-Item -ItemType Directory -Force (Split-Path -Parent $dstLogo) | Out-Null
Copy-Item $newHtml $dstHtml -Force
Copy-Item $newLogo $dstLogo -Force
Write-Host 'Files updated.'

# 4) Stop only the node process running local-core/server.mjs
$srv = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'local-core[\\/]server\.mjs' }
foreach ($s in $srv) { Write-Host "Stopping server PID $($s.ProcessId)"; Stop-Process -Id $s.ProcessId -Force }

# 6) Wait for supervisor restart and check /control
$ok = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 2
  try { if ((Invoke-WebRequest "http://127.0.0.1:$port/local-healthz" -UseBasicParsing -TimeoutSec 4).StatusCode -eq 200) { $ok = $true; break } } catch {}
}
if (-not $ok) { Write-Warning 'local-core not back after 60s. Check Task Scheduler "StayHub Local Core".'; exit 1 }
$html = (Invoke-WebRequest "http://127.0.0.1:$port/control" -UseBasicParsing -TimeoutSec 10).Content
$logo = Invoke-WebRequest "http://127.0.0.1:$port/notices/theme/sanshine-logo-256.png" -UseBasicParsing -TimeoutSec 10
if ($html -match 'sanshine-logo-256\.png' -and $logo.StatusCode -eq 200) { Write-Host 'OK: new SC page is served.' -ForegroundColor Green }
else { Write-Warning 'Server is up but /control does not look like the new version.' }
Start-Process "http://127.0.0.1:$port/control"
Write-Host "Backup: $backup"
