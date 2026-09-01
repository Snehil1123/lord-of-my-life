param(
  [Parameter(Mandatory = $true)][string]$Repo,
  [Parameter(Mandatory = $true)][string]$Exe,
  [Parameter(Mandatory = $true)][int]$WaitPid
)

# Runs detached, after the app has been asked to quit. electron-builder replaces
# the directory the app runs from, which Windows won't permit while the exe is
# open — so the app can't do this to itself, and this waits for it to go first.

$ErrorActionPreference = 'Stop'
try { $host.UI.RawUI.WindowTitle = 'Lord of My Life - updating' } catch { }
Set-Location $Repo

# A transcript, because the console goes away with the window and a failed update
# would otherwise leave nothing to look at. release/ is gitignored.
$log = Join-Path $Repo 'release\update.log'
try { Start-Transcript -Path $log -Force | Out-Null } catch { }

Write-Host 'Lord of My Life' -ForegroundColor Cyan
Write-Host 'Updating from git. This window closes itself when the app reopens.'
Write-Host ''

Write-Host 'Waiting for the app to close...'
try { Wait-Process -Id $WaitPid -Timeout 30 -ErrorAction Stop } catch { }
Start-Sleep -Seconds 1

try {
  Write-Host ''
  Write-Host 'Pulling...' -ForegroundColor Cyan
  git pull --ff-only
  if ($LASTEXITCODE -ne 0) { throw 'git pull failed' }

  Write-Host ''
  Write-Host 'Installing dependencies...' -ForegroundColor Cyan
  # install, not ci: incremental and quick when nothing changed, where ci would
  # redownload the Agent SDK's ~300MB runtime on every single update
  npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }

  Write-Host ''
  Write-Host 'Building...' -ForegroundColor Cyan
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'vite build failed' }

  npx electron-builder --win --dir
  if ($LASTEXITCODE -ne 0) { throw 'electron-builder failed' }

  node scripts/make-shortcut.mjs

  Write-Host ''
  Write-Host 'Updated. Starting the app...' -ForegroundColor Green
  try { Stop-Transcript | Out-Null } catch { }
  Start-Process $Exe
} catch {
  Write-Host ''
  Write-Host "Update failed: $_" -ForegroundColor Red
  Write-Host 'Nothing was replaced, so the version you had is still there.'
  Write-Host "A full log is at $log"
  Write-Host 'Press Enter to reopen it.'
  try { Stop-Transcript | Out-Null } catch { }
  Read-Host | Out-Null
  if (Test-Path $Exe) { Start-Process $Exe }
}
