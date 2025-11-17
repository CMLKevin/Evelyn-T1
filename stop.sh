#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# Evelyn Chat - Comprehensive Stop Script
# ═══════════════════════════════════════════════════════════════════════════
# Stops all running Evelyn servers gracefully
#
# Usage:
#   ./stop.sh           # Stop all servers
#   ./stop.sh --force   # Force kill if graceful shutdown fails
#   ./stop.sh --backend # Stop only backend
#   ./stop.sh --frontend # Stop only frontend
# ═══════════════════════════════════════════════════════════════════════════

# Colors
GREEN='\033[0;32m'
BRIGHT_GREEN='\033[1;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BRIGHT_RED='\033[1;31m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m'

# Configuration
PID_FILE=".evelyn.pid"
GRACE_PERIOD=5  # Seconds to wait for graceful shutdown

# Parse arguments
FORCE=false
BACKEND_ONLY=false
FRONTEND_ONLY=false

for arg in "$@"; do
    case $arg in
        --force)
            FORCE=true
            ;;
        --backend)
            BACKEND_ONLY=true
            ;;
        --frontend)
            FRONTEND_ONLY=true
            ;;
        --help)
            echo "Evelyn Chat Stop Script"
            echo ""
            echo "Usage: ./stop.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --force       Force kill if graceful shutdown fails"
            echo "  --backend     Stop only backend server"
            echo "  --frontend    Stop only frontend server"
            echo "  --help        Show this help message"
            echo ""
            exit 0
            ;;
        *)
            echo "Unknown option: $arg"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Helper functions
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

check_process() {
    local pid=$1
    if ps -p $pid > /dev/null 2>&1; then
        return 0
    fi
    return 1
}

stop_process() {
    local pid=$1
    local name=$2
    local force=$3
    
    if ! check_process $pid; then
        log_warning "$name (PID $pid) not running"
        return 0
    fi
    
    log_step "Stopping $name (PID $pid)..."
    
    # Try graceful shutdown first
    kill -TERM $pid 2>/dev/null
    
    # Wait for graceful shutdown
    local waited=0
    while [ $waited -lt $GRACE_PERIOD ]; do
        if ! check_process $pid; then
            log_success "$name stopped gracefully"
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
    done
    
    # If still running and force is enabled
    if [ "$force" = true ]; then
        log_warning "$name did not stop gracefully, force killing..."
        kill -KILL $pid 2>/dev/null
        sleep 1
        if ! check_process $pid; then
            log_success "$name force killed"
            return 0
        else
            log_error "Failed to kill $name"
            return 1
        fi
    else
        log_warning "$name still running (use --force to kill)"
        return 1
    fi
}

# Main execution
echo ""
echo -e "${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║                                                            ║${NC}"
echo -e "${YELLOW}║              🛑 Stopping Evelyn Servers 🛑                ║${NC}"
echo -e "${YELLOW}║                                                            ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

stopped_any=false

# Try to stop using PID file first
if [ -f "$PID_FILE" ]; then
    log_info "Found PID file"
    
    # Read PIDs from file
    while IFS='=' read -r key value; do
        if [ "$key" = "BACKEND_PID" ] && [ "$FRONTEND_ONLY" = false ]; then
            if stop_process $value "Backend" $FORCE; then
                stopped_any=true
            fi
        elif [ "$key" = "FRONTEND_PID" ] && [ "$BACKEND_ONLY" = false ]; then
            if stop_process $value "Frontend" $FORCE; then
                stopped_any=true
            fi
        fi
    done < "$PID_FILE"
    
    # Remove PID file
    rm -f "$PID_FILE"
fi

# Fallback: Kill processes by command pattern
if [ "$stopped_any" = false ]; then
    log_info "No PID file found, searching for running processes..."
    
    if [ "$FRONTEND_ONLY" = false ]; then
        log_step "Searching for backend processes..."
        backend_pids=$(pgrep -f "tsx watch src/index.ts" || true)
        if [ ! -z "$backend_pids" ]; then
            for pid in $backend_pids; do
                if stop_process $pid "Backend" $FORCE; then
                    stopped_any=true
                fi
            done
        else
            log_warning "No backend processes found"
        fi
    fi
    
    if [ "$BACKEND_ONLY" = false ]; then
        log_step "Searching for frontend processes..."
        # More specific pattern to avoid killing other vite processes
        frontend_pids=$(pgrep -f "vite.*web" || pgrep -f "vite" | head -1 || true)
        if [ ! -z "$frontend_pids" ]; then
            for pid in $frontend_pids; do
                # Verify it's actually from this project
                if ps -p $pid -o command= | grep -q "web"; then
                    if stop_process $pid "Frontend" $FORCE; then
                        stopped_any=true
                    fi
                fi
            done
        else
            log_warning "No frontend processes found"
        fi
    fi
fi

# Check for any remaining Evelyn processes
remaining=$(pgrep -f "evelyn|tsx.*index.ts" | wc -l)
if [ $remaining -gt 0 ]; then
    log_warning "$remaining Evelyn process(es) still running"
    log_info "Use ${YELLOW}--force${NC} to forcefully kill remaining processes"
else
    if [ "$stopped_any" = true ]; then
        echo ""
        log_success "All Evelyn servers stopped"
    else
        log_info "No Evelyn servers were running"
    fi
fi

echo ""
