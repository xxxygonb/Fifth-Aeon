#!/usr/bin/env bash
# ============================================================
# Fifth Aeon one-click launcher (Linux / macOS)
# Starts: PostgreSQL check -> Server (2222) -> Web Client (4200)
# Logs:   logs/server.log / logs/client.log
# ============================================================
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
LOGDIR="$ROOT/logs"
mkdir -p "$LOGDIR"

echo "============================================"
echo "  Fifth Aeon one-click launcher"
echo "============================================"

fail() { echo "[ERROR] $1"; exit 1; }

# ---- 1. Check Node.js ----
command -v node >/dev/null 2>&1 || fail "Node.js not found. Please install Node.js 16+."
echo "[OK] Node.js $(node --version)"

# ---- 2. Check PostgreSQL ----
PSQL=""
command -v psql >/dev/null 2>&1 && PSQL=psql
if [ -z "$PSQL" ]; then
    echo "[WARN] psql not found in PATH. Make sure PostgreSQL is running."
else
    echo "[OK] psql found"
    export PGPASSWORD="${PGPASSWORD:-postgres}"
    if ! $PSQL -U postgres -h localhost -tAc "SELECT 1 FROM pg_database WHERE datname='ccg'" 2>/dev/null | grep -q 1; then
        echo "[..] Creating database ccg ..."
        $PSQL -U postgres -h localhost -c "CREATE DATABASE ccg;" >>"$LOGDIR/db.log" 2>&1 \
            && echo "[OK] Database ccg created" \
            || { echo "[WARN] Could not create database. See logs/db.log"; echo "       If your postgres password is not 'postgres', edit Fifth-Aeon-Server/config.json"; }
    else
        echo "[OK] Database ccg exists"
    fi
fi

# ---- 3. Install dependencies if missing ----
if [ ! -d "$ROOT/Fifth-Aeon-Server/node_modules" ]; then
    echo "[..] Installing server dependencies ..."
    (cd "$ROOT/Fifth-Aeon-Server" && npm install --no-audit --no-fund >>"$LOGDIR/install-server.log" 2>&1) \
        && echo "[OK] Server dependencies installed" || fail "server npm install failed (see logs/install-server.log)"
else
    echo "[OK] Server dependencies present"
fi

if [ ! -d "$ROOT/Fifth-Aeon-Web-Client/node_modules" ]; then
    echo "[..] Installing web client dependencies (this may take a while) ..."
    (cd "$ROOT/Fifth-Aeon-Web-Client" && npm install --no-audit --no-fund --legacy-peer-deps >>"$LOGDIR/install-client.log" 2>&1) \
        && echo "[OK] Client dependencies installed" || fail "client npm install failed (see logs/install-client.log)"
else
    echo "[OK] Client dependencies present"
fi

# ---- 4. Build server if needed ----
if [ ! -f "$ROOT/Fifth-Aeon-Server/dist/index.js" ]; then
    echo "[..] Compiling server ..."
    (cd "$ROOT/Fifth-Aeon-Server" && npx gulp scripts >>"$LOGDIR/build-server.log" 2>&1) \
        && echo "[OK] Server compiled" || fail "server build failed (see logs/build-server.log)"
else
    echo "[OK] Server build present"
fi

# ---- 5. Stop anything already on port 2222 ----
if command -v fuser >/dev/null 2>&1; then
    fuser -k 2222/tcp 2>/dev/null
fi

PIDS=()
cleanup() {
    echo ""
    echo "Stopping services ..."
    for pid in "${PIDS[@]:-}"; do kill "$pid" 2>/dev/null; done
    exit 0
}
trap cleanup INT TERM

# ---- 6. Start server ----
echo "[..] Starting game server on port 2222 ..."
(cd "$ROOT/Fifth-Aeon-Server" && node dist/index.js >"$LOGDIR/server.log" 2>&1) &
PIDS+=($!)

# ---- 7. Start web client ----
echo "[..] Starting web client on port 4200 ..."
(cd "$ROOT/Fifth-Aeon-Web-Client" && npx ng serve >"$LOGDIR/client.log" 2>&1) &
PIDS+=($!)

# ---- 8. Wait and verify ----
echo "[..] Waiting for services (up to 90s) ..."
SERVER_UP=0
for i in $(seq 1 30); do
    sleep 3
    if [ "$SERVER_UP" = 0 ] && curl -s -o /dev/null http://localhost:2222/report; then
        SERVER_UP=1
        echo "[OK] Server is up: http://localhost:2222"
    fi
    if curl -s -o /dev/null http://localhost:4200; then
        echo "[OK] Web client is up: http://localhost:4200"
        break
    fi
    if [ "$i" = 30 ]; then
        [ "$SERVER_UP" = 0 ] && echo "[WARN] Server not responding - check logs/server.log"
        echo "[WARN] Web client not responding - check logs/client.log (first compile can take 1-2 min)"
    fi
done

echo ""
echo "============================================"
echo "  Game ready:  http://localhost:4200"
echo "  Server API:  http://localhost:2222"
echo "  Logs:        logs/server.log / logs/client.log"
echo "  Press Ctrl+C to stop both services."
echo "============================================"

command -v xdg-open >/dev/null 2>&1 && xdg-open http://localhost:4200
command -v open >/dev/null 2>&1 && open http://localhost:4200

wait
