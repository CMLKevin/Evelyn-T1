#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# Evelyn Chat - Status Check Script
# ═══════════════════════════════════════════════════════════════════════════
# Checks the status of all Evelyn services and displays comprehensive info
#
# Usage:
#   ./status.sh           # Show full status
#   ./status.sh --watch   # Continuous monitoring
#   ./status.sh --json    # Output in JSON format
# ═══════════════════════════════════════════════════════════════════════════

# Colors
GREEN='\033[0;32m'
BRIGHT_GREEN='\033[1;32m'
BLUE='\033[0;34m'
BRIGHT_BLUE='\033[1;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
WHITE='\033[1;37m'
NC='\033[0m'

# Configuration
BACKEND_PORT=3001
FRONTEND_PORT=5173
PID_FILE=".evelyn.pid"

# Parse arguments
WATCH_MODE=false
JSON_OUTPUT=false

for arg in "$@"; do
    case $arg in
        --watch)
            WATCH_MODE=true
            ;;
        --json)
            JSON_OUTPUT=true
            ;;
        --help)
            echo "Evelyn Chat Status Script"
            echo ""
            echo "Usage: ./status.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --watch    Continuous monitoring (refresh every 2s)"
            echo "  --json     Output in JSON format"
            echo "  --help     Show this help message"
            echo ""
            exit 0
            ;;
    esac
done

# Helper functions
format_bytes() {
    local bytes=$1
    if [ $bytes -gt 1073741824 ]; then
        echo "$(echo "scale=2; $bytes/1073741824" | bc)GB"
    elif [ $bytes -gt 1048576 ]; then
        echo "$(echo "scale=2; $bytes/1048576" | bc)MB"
    elif [ $bytes -gt 1024 ]; then
        echo "$(echo "scale=2; $bytes/1024" | bc)KB"
    else
        echo "${bytes}B"
    fi
}

format_uptime() {
    local seconds=$1
    local days=$((seconds / 86400))
    local hours=$(( (seconds % 86400) / 3600 ))
    local minutes=$(( (seconds % 3600) / 60 ))
    local secs=$((seconds % 60))
    
    if [ $days -gt 0 ]; then
        echo "${days}d ${hours}h ${minutes}m"
    elif [ $hours -gt 0 ]; then
        echo "${hours}h ${minutes}m ${secs}s"
    elif [ $minutes -gt 0 ]; then
        echo "${minutes}m ${secs}s"
    else
        echo "${secs}s"
    fi
}

check_process_info() {
    local pid=$1
    
    if ! ps -p $pid > /dev/null 2>&1; then
        echo "not_running"
        return 1
    fi
    
    # Get process info (compatible with both Linux and macOS)
    local cpu=$(ps -p $pid -o %cpu | tail -1 | tr -d ' ')
    local mem=$(ps -p $pid -o %mem | tail -1 | tr -d ' ')
    local rss=$(ps -p $pid -o rss | tail -1 | tr -d ' ')
    
    # Calculate uptime manually (macOS doesn't have etimes)
    local lstart=$(ps -p $pid -o lstart | tail -1)
    local start_epoch=$(date -j -f "%a %b %d %H:%M:%S %Y" "$lstart" "+%s" 2>/dev/null || echo "0")
    local now_epoch=$(date "+%s")
    local etime=$((now_epoch - start_epoch))
    
    local command=$(ps -p $pid -o command | tail -1 | cut -d' ' -f1-3)
    
    echo "$cpu|$mem|$rss|$etime|$command"
    return 0
}

check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    fi
    return 1
}

check_health() {
    local url=$1
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 2 2>/dev/null || echo "000")
    echo $response
}

get_db_info() {
    if [ -f "server/prisma/dev.db" ]; then
        local size=$(stat -f%z "server/prisma/dev.db" 2>/dev/null || stat -c%s "server/prisma/dev.db" 2>/dev/null)
        local formatted=$(format_bytes $size)
        local modified=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "server/prisma/dev.db" 2>/dev/null || stat -c "%y" "server/prisma/dev.db" 2>/dev/null | cut -d'.' -f1)
        echo "$formatted|$modified"
    else
        echo "not_found|n/a"
    fi
}

show_status() {
    clear 2>/dev/null || true
    
    echo -e "${BRIGHT_BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BRIGHT_BLUE}║                                                            ║${NC}"
    echo -e "${BRIGHT_BLUE}║              📊 EVELYN STATUS DASHBOARD 📊                ║${NC}"
    echo -e "${BRIGHT_BLUE}║                                                            ║${NC}"
    echo -e "${BRIGHT_BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GRAY}$(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo ""
    
    # ═══════════════════════════════════════════════════════════════════════
    # BACKEND STATUS
    # ═══════════════════════════════════════════════════════════════════════
    
    echo -e "${BRIGHT_CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BRIGHT_CYAN}  Backend Server${NC}"
    echo -e "${BRIGHT_CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    # Find backend PID
    local backend_pid=""
    if [ -f "$PID_FILE" ]; then
        backend_pid=$(grep "BACKEND_PID" "$PID_FILE" | cut -d'=' -f2)
    fi
    
    if [ -z "$backend_pid" ]; then
        backend_pid=$(pgrep -f "tsx watch src/index.ts" | head -1)
    fi
    
    if [ ! -z "$backend_pid" ]; then
        local proc_info=$(check_process_info $backend_pid)
        if [ "$proc_info" != "not_running" ]; then
            IFS='|' read -r cpu mem rss etime command <<< "$proc_info"
            
            echo -e "  Status:     ${BRIGHT_GREEN}● RUNNING${NC}"
            echo -e "  PID:        ${WHITE}$backend_pid${NC}"
            echo -e "  Uptime:     ${WHITE}$(format_uptime $etime)${NC}"
            echo -e "  CPU:        ${WHITE}${cpu}%${NC}"
            echo -e "  Memory:     ${WHITE}${mem}% ($(format_bytes $((rss * 1024))))${NC}"
            echo -e "  Port:       ${WHITE}$BACKEND_PORT${NC}"
            
            # Port check
            if check_port $BACKEND_PORT; then
                echo -e "  Listening:  ${BRIGHT_GREEN}✓ Yes${NC}"
            else
                echo -e "  Listening:  ${YELLOW}⚠ Port not open${NC}"
            fi
            
            # Health check
            if command -v curl >/dev/null 2>&1; then
                local health=$(check_health "http://localhost:$BACKEND_PORT/api/health")
                if [ "$health" = "200" ]; then
                    echo -e "  Health:     ${BRIGHT_GREEN}✓ Healthy${NC}"
                else
                    echo -e "  Health:     ${RED}✗ Unhealthy (HTTP $health)${NC}"
                fi
            fi
        else
            echo -e "  Status:     ${RED}● NOT RUNNING${NC}"
        fi
    else
        echo -e "  Status:     ${RED}● NOT RUNNING${NC}"
        echo -e "  ${GRAY}No backend process found${NC}"
    fi
    
    echo ""
    
    # ═══════════════════════════════════════════════════════════════════════
    # FRONTEND STATUS
    # ═══════════════════════════════════════════════════════════════════════
    
    echo -e "${BRIGHT_CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BRIGHT_CYAN}  Frontend Server${NC}"
    echo -e "${BRIGHT_CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    # Find frontend PID
    local frontend_pid=""
    if [ -f "$PID_FILE" ]; then
        frontend_pid=$(grep "FRONTEND_PID" "$PID_FILE" | cut -d'=' -f2)
    fi
    
    if [ -z "$frontend_pid" ]; then
        frontend_pid=$(pgrep -f "vite.*web" | head -1)
        if [ -z "$frontend_pid" ]; then
            frontend_pid=$(pgrep -f "vite" | head -1)
        fi
    fi
    
    if [ ! -z "$frontend_pid" ]; then
        local proc_info=$(check_process_info $frontend_pid)
        if [ "$proc_info" != "not_running" ]; then
            IFS='|' read -r cpu mem rss etime command <<< "$proc_info"
            
            echo -e "  Status:     ${BRIGHT_GREEN}● RUNNING${NC}"
            echo -e "  PID:        ${WHITE}$frontend_pid${NC}"
            echo -e "  Uptime:     ${WHITE}$(format_uptime $etime)${NC}"
            echo -e "  CPU:        ${WHITE}${cpu}%${NC}"
            echo -e "  Memory:     ${WHITE}${mem}% ($(format_bytes $((rss * 1024))))${NC}"
            echo -e "  Port:       ${WHITE}$FRONTEND_PORT${NC}"
            
            # Port check
            if check_port $FRONTEND_PORT; then
                echo -e "  Listening:  ${BRIGHT_GREEN}✓ Yes${NC}"
                echo -e "  URL:        ${CYAN}http://localhost:$FRONTEND_PORT${NC}"
            else
                echo -e "  Listening:  ${YELLOW}⚠ Port not open${NC}"
            fi
        else
            echo -e "  Status:     ${RED}● NOT RUNNING${NC}"
        fi
    else
        echo -e "  Status:     ${RED}● NOT RUNNING${NC}"
        echo -e "  ${GRAY}No frontend process found${NC}"
    fi
    
    echo ""
    
    # ═══════════════════════════════════════════════════════════════════════
    # DATABASE STATUS
    # ═══════════════════════════════════════════════════════════════════════
    
    echo -e "${BRIGHT_CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BRIGHT_CYAN}  Database${NC}"
    echo -e "${BRIGHT_CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    local db_info=$(get_db_info)
    IFS='|' read -r size modified <<< "$db_info"
    
    if [ "$size" != "not_found" ]; then
        echo -e "  Status:     ${BRIGHT_GREEN}● EXISTS${NC}"
        echo -e "  Size:       ${WHITE}$size${NC}"
        echo -e "  Modified:   ${WHITE}$modified${NC}"
        echo -e "  Location:   ${GRAY}server/prisma/dev.db${NC}"
    else
        echo -e "  Status:     ${YELLOW}⚠ NOT FOUND${NC}"
        echo -e "  ${GRAY}Database will be created on first run${NC}"
    fi
    
    echo ""
    
    # ═══════════════════════════════════════════════════════════════════════
    # SYSTEM INFO
    # ═══════════════════════════════════════════════════════════════════════
    
    echo -e "${BRIGHT_CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BRIGHT_CYAN}  System Info${NC}"
    echo -e "${BRIGHT_CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    if command -v node >/dev/null 2>&1; then
        echo -e "  Node:       ${WHITE}$(node --version)${NC}"
    fi
    
    if command -v npm >/dev/null 2>&1; then
        echo -e "  npm:        ${WHITE}v$(npm --version)${NC}"
    fi
    
    echo -e "  OS:         ${WHITE}$(uname -s)${NC}"
    echo -e "  Arch:       ${WHITE}$(uname -m)${NC}"
    
    echo ""
    
    # Watch mode footer
    if [ "$WATCH_MODE" = true ]; then
        echo -e "${GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GRAY}  Refreshing every 2 seconds... (Press Ctrl+C to exit)${NC}"
        echo -e "${GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    fi
}

# Main execution
if [ "$WATCH_MODE" = true ]; then
    # Watch mode: continuous monitoring
    while true; do
        show_status
        sleep 2
    done
else
    # Single run
    show_status
fi

