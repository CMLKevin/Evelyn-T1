#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# Evelyn Chat - Restart Script
# ═══════════════════════════════════════════════════════════════════════════
# Stops and restarts Evelyn servers
#
# Usage:
#   ./restart.sh          # Restart both servers
#   ./restart.sh --force  # Force kill before restart
#   ./restart.sh --dev    # Restart in development mode
# ═══════════════════════════════════════════════════════════════════════════

# Colors
GREEN='\033[0;32m'
BRIGHT_GREEN='\033[1;32m'
BLUE='\033[0;34m'
BRIGHT_BLUE='\033[1;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo ""
echo -e "${BRIGHT_BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BRIGHT_BLUE}║                                                            ║${NC}"
echo -e "${BRIGHT_BLUE}║              🔄 RESTARTING EVELYN SERVERS 🔄              ║${NC}"
echo -e "${BRIGHT_BLUE}║                                                            ║${NC}"
echo -e "${BRIGHT_BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Parse force flag from start.sh args
FORCE_ARG=""
START_ARGS=""

for arg in "$@"; do
    if [ "$arg" = "--force" ]; then
        FORCE_ARG="--force"
    else
        START_ARGS="$START_ARGS $arg"
    fi
done

# Step 1: Stop servers
echo -e "${CYAN}→${NC}  Stopping existing servers..."
echo ""

if [ -f "./stop.sh" ]; then
    bash ./stop.sh $FORCE_ARG
else
    echo -e "${YELLOW}⚠${NC}  stop.sh not found, attempting manual stop..."
    pkill -f "tsx watch src/index.ts" 2>/dev/null
    pkill -f "vite" 2>/dev/null
    sleep 2
fi

echo ""

# Step 2: Force kill processes on ports (if any remain)
echo -e "${CYAN}→${NC}  Ensuring ports are free..."

# Kill backend port (3001)
BACKEND_PID=$(lsof -ti:3001 2>/dev/null)
if [ -n "$BACKEND_PID" ]; then
    echo -e "${YELLOW}⚠${NC}  Killing process on port 3001 (PID: $BACKEND_PID)..."
    kill -9 $BACKEND_PID 2>/dev/null || true
    echo -e "${GREEN}✓${NC}  Port 3001 freed"
else
    echo -e "${GREEN}✓${NC}  Port 3001 already free"
fi

# Kill frontend port (5173)
FRONTEND_PID=$(lsof -ti:5173 2>/dev/null)
if [ -n "$FRONTEND_PID" ]; then
    echo -e "${YELLOW}⚠${NC}  Killing process on port 5173 (PID: $FRONTEND_PID)..."
    kill -9 $FRONTEND_PID 2>/dev/null || true
    echo -e "${GREEN}✓${NC}  Port 5173 freed"
else
    echo -e "${GREEN}✓${NC}  Port 5173 already free"
fi

echo ""

# Step 3: Wait a moment for cleanup
echo -e "${CYAN}→${NC}  Waiting for cleanup..."
sleep 2

# Step 4: Start servers
echo -e "${CYAN}→${NC}  Starting servers..."
echo ""

if [ -f "./start.sh" ]; then
    bash ./start.sh $START_ARGS
else
    echo -e "${BRIGHT_RED}✗${NC}  start.sh not found"
    exit 1
fi

