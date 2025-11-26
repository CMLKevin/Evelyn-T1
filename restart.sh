#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Evelyn Chat - Restart Script v2.1
# ═══════════════════════════════════════════════════════════════════════════════
# Stops and restarts Evelyn servers with proper cleanup
#
# Usage:
#   ./restart.sh          # Restart both servers
#   ./restart.sh --force  # Force kill before restart
#   ./restart.sh --fresh  # Restart with fresh database
#   ./restart.sh --quick  # Quick restart (skip checks)
# ═══════════════════════════════════════════════════════════════════════════════

# Get script directory and source library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/scripts/lib.sh" ]; then
    source "$SCRIPT_DIR/scripts/lib.sh"
else
    # Fallback colors
    GREEN='\033[0;32m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'
    YELLOW='\033[1;33m'; NC='\033[0m'
fi

cd "$SCRIPT_DIR"

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

FORCE_STOP=false
FRESH_START=false
START_ARGS=""

# ═══════════════════════════════════════════════════════════════════════════════
# ARGUMENT PARSING
# ═══════════════════════════════════════════════════════════════════════════════

show_help() {
    cat << EOF
Evelyn Chat Restart Script

Usage: ./restart.sh [OPTIONS]

Options:
  --force       Force kill processes before restart
  --fresh       Restart with fresh database
  --quick       Quick restart (skip requirement checks)
  --dev         Restart in development mode
  --prod        Restart in production mode
  --logs        Enable log file saving
  --help        Show this help message

Examples:
  ./restart.sh              # Normal restart
  ./restart.sh --force      # Force kill then restart
  ./restart.sh --fresh      # Fresh database restart
  ./restart.sh --quick --dev

EOF
    exit 0
}

for arg in "$@"; do
    case $arg in
        --force|-f)
            FORCE_STOP=true
            ;;
        --fresh)
            FRESH_START=true
            START_ARGS="$START_ARGS --fresh"
            ;;
        --quick|--dev|--prod|--logs)
            START_ARGS="$START_ARGS $arg"
            ;;
        --help|-h)
            show_help
            ;;
        *)
            START_ARGS="$START_ARGS $arg"
            ;;
    esac
done

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${BRIGHT_BLUE:-\033[1;34m}╔════════════════════════════════════════════════════════════╗${NC:-\033[0m}"
echo -e "${BRIGHT_BLUE:-\033[1;34m}║              🔄 RESTARTING EVELYN SERVERS 🔄              ║${NC:-\033[0m}"
echo -e "${BRIGHT_BLUE:-\033[1;34m}╚════════════════════════════════════════════════════════════╝${NC:-\033[0m}"
echo ""

# Step 1: Stop existing servers
echo -e "${CYAN:-\033[0;36m}→${NC:-\033[0m}  Stopping existing servers..."
echo ""

STOP_ARGS=""
[ "$FORCE_STOP" = true ] && STOP_ARGS="--force"

if [ -f "./stop.sh" ]; then
    bash ./stop.sh $STOP_ARGS --quiet 2>/dev/null || true
else
    # Fallback stop
    pkill -f "tsx watch" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
fi

# Step 2: Ensure ports are free
echo -e "${CYAN:-\033[0;36m}→${NC:-\033[0m}  Ensuring ports are free..."

BACKEND_PORT=${BACKEND_PORT:-3001}
FRONTEND_PORT=${FRONTEND_PORT:-5173}

for port in $BACKEND_PORT $FRONTEND_PORT; do
    pid=$(lsof -ti:"$port" 2>/dev/null | head -1)
    if [ -n "$pid" ]; then
        echo -e "${YELLOW:-\033[1;33m}⚠${NC:-\033[0m}  Killing process on port $port (PID: $pid)..."
        kill -9 "$pid" 2>/dev/null || true
        sleep 1
    fi
done

echo -e "${GREEN:-\033[0;32m}✓${NC:-\033[0m}  Ports cleared"

# Step 3: Brief pause for cleanup
echo -e "${CYAN:-\033[0;36m}→${NC:-\033[0m}  Waiting for cleanup..."
sleep 2

# Step 4: Start servers
echo -e "${CYAN:-\033[0;36m}→${NC:-\033[0m}  Starting servers..."
echo ""

if [ -f "./start.sh" ]; then
    exec bash ./start.sh $START_ARGS
else
    echo -e "${RED:-\033[0;31m}✗${NC:-\033[0m}  start.sh not found"
    exit 1
fi
