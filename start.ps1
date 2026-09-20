# ============================================================
# Fifth Aeon one-click launcher (PowerShell)
# Starts: dependency checks -> Server (2222) -> Web Client (4200)
# Logs:   logs\server.log / logs\client.log (+ *.err.log)
# Entry:  double-click start.bat (wraps this script)
# ============================================================
$ErrorActionPreference = 'Continue'
$Root = $PSScriptRoot
$LogDir = Join-Path $Root 'logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$ServerDir = Join-Path $Root 'Fifth-Aeon-Server'
$ClientDir = Join-Path $Root 'Fifth-Aeon-Web-Client'

Write-Host '============================================'
Write-Host '  Fifth Aeon one-click launcher'
Write-Host '============================================'

function Fail($msg) {
    Write-Host "[ERROR] $msg"
    Read-Host 'Press Enter to exit'
    exit 1
}

# ---- 1. Check Node.js ----
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail 'Node.js not found. Please install Node.js 16+ first.'
}
Write-Host "[OK] Node.js $(node --version)"

# ---- 2. Check PostgreSQL (recommended) ----
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Host '[WARN] psql not found in PATH. Server may still work if PostgreSQL is running.'
} else {
    Write-Host '[OK] psql found'
    if (-not $env:PGPASSWORD) { $env:PGPASSWORD = 'postgres' }
    $dbExists = & psql -U postgres -h localhost -tAc "SELECT 1 FROM pg_database WHERE datname='ccg'" 2>$null
    if ("$dbExists".Trim() -eq '1') {
        Write-Host '[OK] Database ccg exists'
    } else {
        Write-Host '[..] Creating database ccg ...'
        & psql -U postgres -h localhost -c 'CREATE DATABASE ccg;' 2>>"$LogDir\db.log" | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host '[OK] Database ccg created'
        } else {
            Write-Host '[WARN] Could not create database automatically. See logs\db.log'
            Write-Host '       If your postgres password is not "postgres", edit Fifth-Aeon-Server\config.json'
        }
    }
}

# ---- 3. Install dependencies if missing ----
if (-not (Test-Path (Join-Path $ServerDir 'node_modules'))) {
    Write-Host '[..] Installing server dependencies ...'
    Push-Location $ServerDir
    cmd /c "npm install --no-audit --no-fund >> `"$LogDir\install-server.log`" 2>&1"
    Pop-Location
    Write-Host '[OK] Server dependencies installed'
} else {
    Write-Host '[OK] Server dependencies present'
}

if (-not (Test-Path (Join-Path $ClientDir 'node_modules'))) {
    Write-Host '[..] Installing web client dependencies, this may take a while ...'
    Push-Location $ClientDir
    cmd /c "npm install --no-audit --no-fund --legacy-peer-deps >> `"$LogDir\install-client.log`" 2>&1"
    Pop-Location
    Write-Host '[OK] Client dependencies installed'
} else {
    Write-Host '[OK] Client dependencies present'
}

# ---- 4. Compile server (always incremental, avoids stale dist) ----
Write-Host '[..] Compiling server ...'
Push-Location $ServerDir
cmd /c "npx gulp scripts >> `"$LogDir\build-server.log`" 2>&1"
$compileExit = $LASTEXITCODE
Pop-Location
if ($compileExit -ne 0) {
    Fail "Server compile failed. See logs\build-server.log"
}
Write-Host '[OK] Server compiled'

# ---- 5. Stop anything already on our ports ----
foreach ($port in 2222, 4200) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
}

# ---- 6. Start game server ----
Write-Host '[..] Starting game server on port 2222 ...'
Start-Process -FilePath 'node' -ArgumentList 'dist\index.js' `
    -WorkingDirectory $ServerDir -WindowStyle Minimized `
    -RedirectStandardOutput (Join-Path $LogDir 'server.log') `
    -RedirectStandardError (Join-Path $LogDir 'server-err.log')

# ---- 7. Start web client ----
Write-Host '[..] Starting web client on port 4200 ...'
$npx = (Get-Command npx.cmd -ErrorAction SilentlyContinue).Source
if (-not $npx) { $npx = 'npx.cmd' }
Start-Process -FilePath $npx -ArgumentList 'ng', 'serve' `
    -WorkingDirectory $ClientDir -WindowStyle Minimized `
    -RedirectStandardOutput (Join-Path $LogDir 'client.log') `
    -RedirectStandardError (Join-Path $LogDir 'client-err.log')

# ---- 8. Wait and verify ----
Write-Host '[..] Waiting for services (up to 120s) ...'
$serverUp = $false
$clientUp = $false
for ($i = 1; $i -le 40; $i++) {
    Start-Sleep -Seconds 3
    if (-not $serverUp) {
        & curl.exe -s --noproxy '*' -o NUL --max-time 3 http://localhost:2222/report 2>$null
        if ($LASTEXITCODE -eq 0) {
            $serverUp = $true
            Write-Host '[OK] Server is up: http://localhost:2222'
        }
    }
    if (-not $clientUp) {
        & curl.exe -s --noproxy '*' -o NUL --max-time 3 http://localhost:4200 2>$null
        if ($LASTEXITCODE -eq 0) {
            $clientUp = $true
            Write-Host '[OK] Web client is up: http://localhost:4200'
        }
    }
    if ($serverUp -and $clientUp) { break }
}

if (-not $serverUp) {
    Write-Host '[WARN] Server not responding yet - check logs\server.log and logs\server-err.log'
}
if (-not $clientUp) {
    Write-Host '[WARN] Web client not responding yet - check logs\client.log'
    Write-Host '       First compile can take 1-2 minutes. Re-open http://localhost:4200 shortly.'
}

Write-Host ''
Write-Host '============================================'
if ($serverUp -and $clientUp) {
    Write-Host '  Game ready:  http://localhost:4200'
} else {
    Write-Host '  Partial startup - see warnings above'
}
Write-Host '  Server API:  http://localhost:2222'
Write-Host "  Logs:        $LogDir"
Write-Host '  Stop: close the two minimized node windows.'
Write-Host '============================================'

Start-Process 'http://localhost:4200'
