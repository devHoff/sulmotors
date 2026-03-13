#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# start-api.sh  —  Start (or restart) the SulMotor Payment API on port 3001
#
# Usage:
#   ./start-api.sh          # start/restart normally
#   ./start-api.sh --log    # show live logs after starting
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$SCRIPT_DIR/api"
LOG_FILE="/tmp/sulmtr-api.log"
PID_FILE="/tmp/sulmtr-api.pid"
PORT="${PORT:-3001}"

echo "▶  SulMotor Payment API — starting on port $PORT"

# ── 1. Kill any process already using port 3001 ───────────────────────────────
OLD_PID=$(lsof -ti:"$PORT" 2>/dev/null || true)
if [[ -n "$OLD_PID" ]]; then
    echo "   ⚠  Port $PORT in use by PID $OLD_PID — killing..."
    kill -9 $OLD_PID 2>/dev/null || true
    sleep 0.5
fi

# ── 2. Also kill by PID file ──────────────────────────────────────────────────
if [[ -f "$PID_FILE" ]]; then
    OLD_PID2=$(cat "$PID_FILE" 2>/dev/null || true)
    if [[ -n "$OLD_PID2" ]] && kill -0 "$OLD_PID2" 2>/dev/null; then
        echo "   ⚠  Stopping previous instance (PID $OLD_PID2)..."
        kill -9 "$OLD_PID2" 2>/dev/null || true
        sleep 0.5
    fi
    rm -f "$PID_FILE"
fi

# ── 3. Verify .env.server exists ─────────────────────────────────────────────
if [[ ! -f "$SCRIPT_DIR/.env.server" ]]; then
    echo "   ❌  .env.server not found at $SCRIPT_DIR/.env.server"
    exit 1
fi

# ── 4. Install dependencies if needed ────────────────────────────────────────
if [[ ! -d "$API_DIR/node_modules" ]]; then
    echo "   📦  Installing API dependencies..."
    (cd "$API_DIR" && npm install --no-audit --no-fund 2>&1)
fi

# ── 5. Start the server ───────────────────────────────────────────────────────
echo "   🚀  Starting server..."
(
    set -a
    source "$SCRIPT_DIR/.env.server"
    set +a
    cd "$API_DIR"
    node server.js >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
)

SERVER_PID=$(cat "$PID_FILE")
echo "   ✅  Server started with PID $SERVER_PID"
echo "   📄  Logs: $LOG_FILE"

# ── 6. Wait for health check ─────────────────────────────────────────────────
echo -n "   ⏳  Waiting for health check"
for i in $(seq 1 15); do
    sleep 1
    echo -n "."
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/api/health" 2>/dev/null || true)
    if [[ "$STATUS" == "200" ]]; then
        echo " ✅"
        echo "   🏥  Health: $(curl -s http://localhost:$PORT/api/health 2>/dev/null)"
        break
    fi
    if [[ $i -eq 15 ]]; then
        echo " ❌  Server did not respond in 15 seconds"
        echo "   Last 20 lines of log:"
        tail -20 "$LOG_FILE" 2>/dev/null || true
        exit 1
    fi
done

# ── 7. Optional live log tail ────────────────────────────────────────────────
if [[ "${1:-}" == "--log" ]]; then
    echo "   📋  Live logs (Ctrl+C to stop):"
    tail -f "$LOG_FILE"
fi
