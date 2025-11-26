#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Evelyn Chat - Stop Script v2.1
# ═══════════════════════════════════════════════════════════════════════════════
# Stops all running Evelyn servers gracefully
#
# Usage:
#   ./stop.sh           # Stop all servers
#   ./stop.sh --force   # Force kill if graceful shutdown fails
#   ./stop.sh --all     # Kill all related Node processes
# ═══════════════════════════════════════════════════════════════════════════════

# Get script directory and source library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/scripts/lib.sh" ]; then
    source "$SCRIPT_DIR/scripts/lib.sh"
else
    # Fallback colors if lib.sh not found
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
    BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
    log_info() { echo -e "${BLUE}ℹ${NC}  $1"; }
    log_success() { echo -e "${GREEN}✓${NC}  $1"; }
    log_warning() { echo -e "${YELLOW}⚠${NC}  $1"; }
    log_error() { echo -e "${RED}✗${NC}  $1"; }
    log_step() { echo -e "${CYAN}→${NC}  $1"; }
fi

cd "$SCRIPT_DIR"

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

FORCE=false
KILL_ALL=false
BACKEND_ONLY=false
FRONTEND_ONLY=false
QUIET=false

# ═══════════════════════════════════════════════════════════════════════════════
# ARGUMENT PARSING
# ═══════════════════════════════════════════════════════════════════════════════

show_help() {
    cat << EOF
Evelyn Chat Stop Script

Usage: ./stop.sh [OPTIONS]

Options:
  --force       Force kill if graceful shutdown fails
  --all         Kill all Node.js processes related to Evelyn
  --backend     Stop only the backend server
  --frontend    Stop only the frontend server
  --quiet       Minimal output
  --help        Show this help message

Examples:
  ./stop.sh             # Graceful stop
  ./stop.sh --force     # Force kill all
  ./stop.sh --backend   # Stop backend only

EOF
    exit 0
}

for arg in "$@"; do
    case $arg in
        --force|-f)    FORCE=true ;;
        --all|-a)      KILL_ALL=true ;;
        --backend)     BACKEND_ONLY=true ;;
        --frontend)    FRONTEND_ONLY=true ;;
        --quiet|-q)    QUIET=true ;;
        --help|-h)     show_help ;;
        *)
            log_error "Unknown option: $arg"
            exit 1
            ;;
    esac
done

# ═══════════════════════════════════════════════════════════════════════════════
# STOP FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

stop_by_pid() {
    local pid=$1
    local name=$2
    
    if [ -z "$pid" ] || ! ps -p "$pid" > /dev/null 2>&1; then
        [ "$QUIET" != true ] && log_warning "$name not running"
        return 0
    fi
    
    log_step "Stopping $name (PID $pid)..."
    
    # Try graceful shutdown
    kill -TERM "$pid" 2>/dev/null
    
    # Wait for graceful shutdown
    local waited=0
    while [ $waited -lt ${GRACE_PERIOD:-5} ]; do
        if ! ps -p "$pid" > /dev/null 2>&1; then
            log_success "$name stopped"
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
    done
    
    # Force kill if enabled
    if [ "$FORCE" = true ]; then
        log_warning "Force killing $name..."
        kill -KILL "$pid" 2>/dev/null
        sleep 1
        if ! ps -p "$pid" > /dev/null 2>&1; then
            log_success "$name force killed"
            return 0
        fi
        log_error "Failed to kill $name"
        return 1
    fi
    
    log_warning "$name still running (use --force)"
    return 1
}

stop_by_port() {
    local port=$1
    local name=$2
    
    if ! command -v lsof >/dev/null 2>&1; then
        return 1
    fi
    
    local pid=$(lsof -ti:"$port" 2>/dev/null | head -1)
    
    if [ -n "$pid" ]; then
        stop_by_pid "$pid" "$name"
        return $?
    fi
    
    return 1
}

stop_by_pattern() {
    local pattern=$1
    local name=$2
    
    local pids=$(pgrep -f "$pattern" 2>/dev/null)
    
    if [ -z "$pids" ]; then
        [ "$QUIET" != true ] && log_warning "No $name processes found"
        return 0
    fi
    
    local stopped=0
    for pid in $pids; do
        if stop_by_pid "$pid" "$name"; then
            stopped=$((stopped + 1))
        fi
    done
    
    return 0
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

[ "$QUIET" != true ] && {
    echo ""
    echo -e "${YELLOW:-}╔════════════════════════════════════════════════════════════╗${NC:-}"
    echo -e "${YELLOW:-}║              🛑 Stopping Evelyn Servers 🛑                ║${NC:-}"
    echo -e "${YELLOW:-}╚════════════════════════════════════════════════════════════╝${NC:-}"
    echo ""
}

stopped_any=false

# Method 1: Stop using PID file
PID_FILE="${PID_FILE:-.evelyn.pid}"
if [ -f "$PID_FILE" ]; then
    [ "$QUIET" != true ] && log_info "Using PID file..."
    
    if [ "$FRONTEND_ONLY" != true ]; then
        backend_pid=$(grep "BACKEND_PID" "$PID_FILE" 2>/dev/null | cut -d'=' -f2)
        if [ -n "$backend_pid" ] && stop_by_pid "$backend_pid" "Backend"; then
            stopped_any=true
        fi
    fi
    
    if [ "$BACKEND_ONLY" != true ]; then
        frontend_pid=$(grep "FRONTEND_PID" "$PID_FILE" 2>/dev/null | cut -d'=' -f2)
        if [ -n "$frontend_pid" ] && stop_by_pid "$frontend_pid" "Frontend"; then
            stopped_any=true
        fi
    fi
    
    rm -f "$PID_FILE"
fi

# Method 2: Stop by port
if [ "$stopped_any" != true ]; then
    [ "$QUIET" != true ] && log_info "Checking ports..."
    
    if [ "$FRONTEND_ONLY" != true ]; then
        if stop_by_port "${BACKEND_PORT:-3001}" "Backend"; then
            stopped_any=true
        fi
    fi
    
    if [ "$BACKEND_ONLY" != true ]; then
        if stop_by_port "${FRONTEND_PORT:-5173}" "Frontend"; then
            stopped_any=true
        fi
    fi
fi

# Method 3: Stop by process pattern
if [ "$stopped_any" != true ] || [ "$KILL_ALL" = true ]; then
    [ "$QUIET" != true ] && log_info "Searching for processes..."
    
    if [ "$FRONTEND_ONLY" != true ]; then
        stop_by_pattern "tsx.*watch.*index" "Backend"
    fi
    
    if [ "$BACKEND_ONLY" != true ]; then
        stop_by_pattern "vite" "Frontend"
    fi
fi

# Kill all related processes if requested
if [ "$KILL_ALL" = true ]; then
    [ "$QUIET" != true ] && log_info "Killing all related processes..."
    
    # Kill any remaining tsx processes
    pkill -f "tsx watch" 2>/dev/null && log_success "Killed tsx processes"
    
    # Kill any vite processes
    pkill -f "vite" 2>/dev/null && log_success "Killed vite processes"
    
    # Kill processes on our ports
    for port in ${BACKEND_PORT:-3001} ${FRONTEND_PORT:-5173}; do
        pid=$(lsof -ti:"$port" 2>/dev/null)
        if [ -n "$pid" ]; then
            kill -9 "$pid" 2>/dev/null
            log_success "Killed process on port $port"
        fi
    done
fi

# Summary
echo ""
remaining=$(pgrep -f "tsx.*index\|vite" 2>/dev/null | wc -l | tr -d ' ')
if [ "$remaining" -gt 0 ]; then
    log_warning "$remaining related process(es) still running"
    [ "$FORCE" != true ] && log_info "Use --force or --all to kill all"
else
    log_success "All Evelyn servers stopped"
fi
echo ""
