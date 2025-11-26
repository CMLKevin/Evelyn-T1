#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Evelyn Scripts - Shared Library
# ═══════════════════════════════════════════════════════════════════════════════
# Common functions, colors, and utilities used by all Evelyn scripts
# Source this file at the beginning of each script:
#   source "$(dirname "$0")/scripts/lib.sh"
# ═══════════════════════════════════════════════════════════════════════════════

# Version
EVELYN_VERSION="2.1.0"

# ═══════════════════════════════════════════════════════════════════════════════
# COLORS & FORMATTING
# ═══════════════════════════════════════════════════════════════════════════════

# Check if terminal supports colors
if [ -t 1 ] && [ "$(tput colors 2>/dev/null)" -ge 8 ]; then
    COLORS_SUPPORTED=true
else
    COLORS_SUPPORTED=false
fi

# Define colors (empty if not supported)
if [ "$COLORS_SUPPORTED" = true ]; then
    GREEN='\033[0;32m'
    BRIGHT_GREEN='\033[1;32m'
    BLUE='\033[0;34m'
    BRIGHT_BLUE='\033[1;34m'
    CYAN='\033[0;36m'
    BRIGHT_CYAN='\033[1;36m'
    YELLOW='\033[1;33m'
    RED='\033[0;31m'
    BRIGHT_RED='\033[1;31m'
    MAGENTA='\033[0;35m'
    BRIGHT_MAGENTA='\033[1;35m'
    GRAY='\033[0;90m'
    WHITE='\033[1;37m'
    BOLD='\033[1m'
    DIM='\033[2m'
    NC='\033[0m'
else
    GREEN='' BRIGHT_GREEN='' BLUE='' BRIGHT_BLUE='' CYAN='' BRIGHT_CYAN=''
    YELLOW='' RED='' BRIGHT_RED='' MAGENTA='' BRIGHT_MAGENTA=''
    GRAY='' WHITE='' BOLD='' DIM='' NC=''
fi

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# Default ports (can be overridden by environment)
BACKEND_PORT=${BACKEND_PORT:-3001}
FRONTEND_PORT=${FRONTEND_PORT:-5173}

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$SCRIPT_DIR/.evelyn.pid"
LOG_DIR="$SCRIPT_DIR/logs"
DB_PATH="$SCRIPT_DIR/server/prisma/prisma/dev.db"
BACKUP_DIR="$SCRIPT_DIR/server/backups"

# Timeouts
HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-30}
GRACE_PERIOD=${GRACE_PERIOD:-5}
STARTUP_WAIT=${STARTUP_WAIT:-3}

# ═══════════════════════════════════════════════════════════════════════════════
# LOGGING FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

log_info() {
    echo -e "${BLUE}ℹ${NC}  $1"
}

log_success() {
    echo -e "${BRIGHT_GREEN}✓${NC}  $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC}  $1"
}

log_error() {
    echo -e "${BRIGHT_RED}✗${NC}  $1"
}

log_step() {
    echo -e "${CYAN}→${NC}  $1"
}

log_debug() {
    if [ "$DEBUG" = true ]; then
        echo -e "${DIM}[DEBUG] $1${NC}"
    fi
}

# Box header with title
log_header() {
    local title="$1"
    local color="${2:-$BRIGHT_BLUE}"
    local width=60
    local padding=$(( (width - ${#title} - 4) / 2 ))
    
    echo ""
    echo -e "${color}╔$(printf '═%.0s' $(seq 1 $width))╗${NC}"
    echo -e "${color}║$(printf ' %.0s' $(seq 1 $padding))  $title  $(printf ' %.0s' $(seq 1 $((width - padding - ${#title} - 4))))║${NC}"
    echo -e "${color}╚$(printf '═%.0s' $(seq 1 $width))╝${NC}"
    echo ""
}

# Simple divider
log_divider() {
    echo -e "${GRAY}────────────────────────────────────────────────────────────${NC}"
}

# Section header
log_section() {
    echo ""
    echo -e "${BRIGHT_CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BRIGHT_CYAN}  $1${NC}"
    echo -e "${BRIGHT_CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# SPINNER & PROGRESS
# ═══════════════════════════════════════════════════════════════════════════════

# Modern spinner animation
spinner() {
    local pid=$1
    local message="${2:-Processing...}"
    local spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local i=0
    
    while kill -0 "$pid" 2>/dev/null; do
        i=$(( (i + 1) % 10 ))
        printf "\r${CYAN}${spin:$i:1}${NC}  %s" "$message"
        sleep 0.1
    done
    printf "\r"
}

# Progress bar
progress_bar() {
    local current=$1
    local total=$2
    local width=${3:-40}
    local percent=$((current * 100 / total))
    local filled=$((current * width / total))
    local empty=$((width - filled))
    
    printf "\r${CYAN}[${NC}"
    printf "${BRIGHT_GREEN}%${filled}s${NC}" | tr ' ' '█'
    printf "${GRAY}%${empty}s${NC}" | tr ' ' '░'
    printf "${CYAN}]${NC} %3d%%" "$percent"
}

# ═══════════════════════════════════════════════════════════════════════════════
# PROCESS & PORT UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════

# Check if port is in use
check_port() {
    local port=$1
    if command -v lsof >/dev/null 2>&1; then
        lsof -Pi :"$port" -sTCP:LISTEN -t >/dev/null 2>&1
        return $?
    elif command -v netstat >/dev/null 2>&1; then
        netstat -tuln | grep -q ":$port "
        return $?
    fi
    return 1
}

# Get PID using port
get_port_pid() {
    local port=$1
    if command -v lsof >/dev/null 2>&1; then
        lsof -ti:"$port" 2>/dev/null | head -1
    fi
}

# Wait for port to become available
wait_for_port() {
    local port=$1
    local timeout=${2:-$HEALTH_CHECK_TIMEOUT}
    local elapsed=0
    
    while [ $elapsed -lt $timeout ]; do
        if check_port "$port"; then
            return 0
        fi
        sleep 0.5
        elapsed=$((elapsed + 1))
    done
    return 1
}

# Wait for port to be free
wait_for_port_free() {
    local port=$1
    local timeout=${2:-10}
    local elapsed=0
    
    while [ $elapsed -lt $timeout ]; do
        if ! check_port "$port"; then
            return 0
        fi
        sleep 0.5
        elapsed=$((elapsed + 1))
    done
    return 1
}

# Check if process is running
check_process() {
    local pid=$1
    if [ -n "$pid" ] && ps -p "$pid" > /dev/null 2>&1; then
        return 0
    fi
    return 1
}

# Kill process gracefully
kill_process() {
    local pid=$1
    local name="${2:-Process}"
    local force="${3:-false}"
    
    if ! check_process "$pid"; then
        log_warning "$name (PID $pid) not running"
        return 0
    fi
    
    log_step "Stopping $name (PID $pid)..."
    
    # Try graceful shutdown
    kill -TERM "$pid" 2>/dev/null
    
    # Wait for graceful shutdown
    local waited=0
    while [ $waited -lt $GRACE_PERIOD ]; do
        if ! check_process "$pid"; then
            log_success "$name stopped gracefully"
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
    done
    
    # Force kill if needed
    if [ "$force" = true ]; then
        log_warning "$name did not stop gracefully, force killing..."
        kill -KILL "$pid" 2>/dev/null
        sleep 1
        if ! check_process "$pid"; then
            log_success "$name force killed"
            return 0
        fi
        log_error "Failed to kill $name"
        return 1
    fi
    
    log_warning "$name still running (use --force to kill)"
    return 1
}

# Find Evelyn processes
find_backend_pids() {
    pgrep -f "tsx.*watch.*src/index.ts" 2>/dev/null || pgrep -f "tsx watch" 2>/dev/null || true
}

find_frontend_pids() {
    pgrep -f "vite.*5173" 2>/dev/null || pgrep -f "vite" 2>/dev/null | head -1 || true
}

# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH CHECK UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════

# HTTP health check
check_health() {
    local url=$1
    local timeout=${2:-5}
    
    if ! command -v curl >/dev/null 2>&1; then
        return 1
    fi
    
    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$timeout" "$url" 2>/dev/null || echo "000")
    
    if [ "$response" = "200" ]; then
        return 0
    fi
    return 1
}

# Get HTTP status code
get_http_status() {
    local url=$1
    local timeout=${2:-5}
    
    if ! command -v curl >/dev/null 2>&1; then
        echo "N/A"
        return
    fi
    
    curl -s -o /dev/null -w "%{http_code}" --max-time "$timeout" "$url" 2>/dev/null || echo "000"
}

# ═══════════════════════════════════════════════════════════════════════════════
# FILE & FORMAT UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════

# Format bytes to human readable
format_bytes() {
    local bytes=$1
    
    if [ "$bytes" -ge 1073741824 ]; then
        printf "%.2fGB" "$(echo "scale=2; $bytes/1073741824" | bc)"
    elif [ "$bytes" -ge 1048576 ]; then
        printf "%.2fMB" "$(echo "scale=2; $bytes/1048576" | bc)"
    elif [ "$bytes" -ge 1024 ]; then
        printf "%.2fKB" "$(echo "scale=2; $bytes/1024" | bc)"
    else
        printf "%dB" "$bytes"
    fi
}

# Format seconds to human readable uptime
format_uptime() {
    local seconds=$1
    local days=$((seconds / 86400))
    local hours=$(( (seconds % 86400) / 3600 ))
    local minutes=$(( (seconds % 3600) / 60 ))
    local secs=$((seconds % 60))
    
    if [ $days -gt 0 ]; then
        printf "%dd %dh %dm" $days $hours $minutes
    elif [ $hours -gt 0 ]; then
        printf "%dh %dm %ds" $hours $minutes $secs
    elif [ $minutes -gt 0 ]; then
        printf "%dm %ds" $minutes $secs
    else
        printf "%ds" $secs
    fi
}

# Get file size
get_file_size() {
    local file=$1
    if [ -f "$file" ]; then
        if stat --version 2>/dev/null | grep -q GNU; then
            stat -c%s "$file"
        else
            stat -f%z "$file"
        fi
    else
        echo "0"
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# SYSTEM UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════

# Detect OS
detect_os() {
    case "$(uname -s)" in
        Darwin*) echo "macos" ;;
        Linux*)  echo "linux" ;;
        CYGWIN*|MINGW*|MSYS*) echo "windows" ;;
        *) echo "unknown" ;;
    esac
}

# Check if command exists
has_command() {
    command -v "$1" >/dev/null 2>&1
}

# Require command or exit
require_command() {
    local cmd=$1
    local msg="${2:-$cmd is required but not installed}"
    
    if ! has_command "$cmd"; then
        log_error "$msg"
        exit 1
    fi
}

# Get Node.js version
get_node_version() {
    if has_command node; then
        node --version | sed 's/v//'
    else
        echo "not installed"
    fi
}

# Get npm version
get_npm_version() {
    if has_command npm; then
        npm --version
    else
        echo "not installed"
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# PID FILE MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

# Save PID to file
save_pid() {
    local key=$1
    local pid=$2
    
    if [ -f "$PID_FILE" ]; then
        # Update existing entry or append
        if grep -q "^${key}=" "$PID_FILE" 2>/dev/null; then
            sed -i.bak "s/^${key}=.*/${key}=${pid}/" "$PID_FILE"
            rm -f "${PID_FILE}.bak"
        else
            echo "${key}=${pid}" >> "$PID_FILE"
        fi
    else
        echo "${key}=${pid}" > "$PID_FILE"
    fi
}

# Get PID from file
get_pid() {
    local key=$1
    
    if [ -f "$PID_FILE" ]; then
        grep "^${key}=" "$PID_FILE" 2>/dev/null | cut -d'=' -f2
    fi
}

# Clear PID file
clear_pid_file() {
    rm -f "$PID_FILE"
}

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIRMATION & INPUT
# ═══════════════════════════════════════════════════════════════════════════════

# Ask for confirmation
confirm() {
    local message="${1:-Are you sure?}"
    local default="${2:-n}"
    
    if [ "$default" = "y" ]; then
        prompt="[Y/n]"
    else
        prompt="[y/N]"
    fi
    
    echo -en "${YELLOW}?${NC}  $message $prompt "
    read -r response
    
    case "$response" in
        [yY][eE][sS]|[yY]) return 0 ;;
        [nN][oO]|[nN]) return 1 ;;
        "") [ "$default" = "y" ] && return 0 || return 1 ;;
        *) return 1 ;;
    esac
}

# ═══════════════════════════════════════════════════════════════════════════════
# CLEANUP HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

# Clean up on exit
cleanup_on_exit() {
    local backend_pid=$(get_pid "BACKEND_PID")
    local frontend_pid=$(get_pid "FRONTEND_PID")
    
    echo ""
    log_header "Shutting Down Evelyn" "$YELLOW"
    
    if [ -n "$backend_pid" ] && check_process "$backend_pid"; then
        kill_process "$backend_pid" "Backend" true
    fi
    
    if [ -n "$frontend_pid" ] && check_process "$frontend_pid"; then
        kill_process "$frontend_pid" "Frontend" true
    fi
    
    clear_pid_file
    
    echo ""
    log_success "All servers stopped gracefully"
    echo ""
}

# Export functions for subshells
export -f log_info log_success log_warning log_error log_step log_debug 2>/dev/null || true
