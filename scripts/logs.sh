#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Evelyn Log Viewer Script
# ═══════════════════════════════════════════════════════════════════════════════
# View, tail, and manage Evelyn server logs
#
# Usage:
#   ./scripts/logs.sh              # Tail all logs (live)
#   ./scripts/logs.sh backend      # Tail backend logs only
#   ./scripts/logs.sh frontend     # Tail frontend logs only
#   ./scripts/logs.sh --lines 100  # Show last 100 lines
#   ./scripts/logs.sh clean        # Clean old log files
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# Source shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

# Go to project root
cd "$SCRIPT_DIR/.."

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"
COMBINED_LOG="$LOG_DIR/combined.log"
DEFAULT_LINES=50

# ═══════════════════════════════════════════════════════════════════════════════
# FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

show_help() {
    echo "Evelyn Log Viewer v$EVELYN_VERSION"
    echo ""
    echo "Usage: ./scripts/logs.sh [command] [options]"
    echo ""
    echo "Commands:"
    echo "  tail              Tail logs in real-time (default)"
    echo "  backend           Show/tail backend logs only"
    echo "  frontend          Show/tail frontend logs only"
    echo "  show              Show recent logs (non-streaming)"
    echo "  clean             Clean old log files"
    echo "  list              List available log files"
    echo ""
    echo "Options:"
    echo "  -n, --lines N     Number of lines to show (default: $DEFAULT_LINES)"
    echo "  -f, --follow      Follow logs in real-time"
    echo "  --no-color        Disable colorized output"
    echo "  --help            Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/logs.sh                    # Tail all logs"
    echo "  ./scripts/logs.sh backend --lines 100"
    echo "  ./scripts/logs.sh show -n 200"
    echo ""
}

# Colorize log output
colorize_logs() {
    while IFS= read -r line; do
        # Backend patterns
        if echo "$line" | grep -q "\[BACKEND\]"; then
            if echo "$line" | grep -qiE "error|failed|exception"; then
                echo -e "${RED}$line${NC}"
            elif echo "$line" | grep -qiE "warn"; then
                echo -e "${YELLOW}$line${NC}"
            elif echo "$line" | grep -qiE "success|ready|✓|✅"; then
                echo -e "${GREEN}$line${NC}"
            else
                echo -e "${WHITE}$line${NC}"
            fi
        # Frontend patterns
        elif echo "$line" | grep -q "\[FRONTEND\]"; then
            if echo "$line" | grep -qiE "error"; then
                echo -e "${RED}$line${NC}"
            elif echo "$line" | grep -q "VITE"; then
                echo -e "${CYAN}$line${NC}"
            else
                echo -e "${BRIGHT_CYAN}$line${NC}"
            fi
        # Timestamp patterns
        elif echo "$line" | grep -qE "^\[?[0-9]{2}:[0-9]{2}:[0-9]{2}"; then
            echo -e "${GRAY}$line${NC}"
        # Error patterns
        elif echo "$line" | grep -qiE "error|failed|exception"; then
            echo -e "${RED}$line${NC}"
        # Success patterns
        elif echo "$line" | grep -qiE "success|ready|started|listening"; then
            echo -e "${GREEN}$line${NC}"
        else
            echo "$line"
        fi
    done
}

# Tail logs in real-time
tail_logs() {
    local log_file="$1"
    local lines="${2:-$DEFAULT_LINES}"
    
    if [ ! -f "$log_file" ]; then
        log_warning "Log file not found: $log_file"
        log_info "Logs are only saved when running with --logs flag"
        return 1
    fi
    
    log_info "Tailing $log_file (Ctrl+C to stop)"
    log_divider
    echo ""
    
    if [ "$NO_COLOR" = true ]; then
        tail -n "$lines" -f "$log_file"
    else
        tail -n "$lines" -f "$log_file" | colorize_logs
    fi
}

# Tail multiple logs
tail_all_logs() {
    local lines="${1:-$DEFAULT_LINES}"
    
    # Check if any logs exist
    local has_logs=false
    [ -f "$BACKEND_LOG" ] && has_logs=true
    [ -f "$FRONTEND_LOG" ] && has_logs=true
    
    if [ "$has_logs" = false ]; then
        log_warning "No log files found"
        log_info "Start Evelyn with --logs flag to enable logging:"
        echo "  ./start.sh --logs"
        return 1
    fi
    
    log_info "Tailing all logs (Ctrl+C to stop)"
    log_divider
    echo ""
    
    # Use tail with multiple files
    local files=""
    [ -f "$BACKEND_LOG" ] && files="$files $BACKEND_LOG"
    [ -f "$FRONTEND_LOG" ] && files="$files $FRONTEND_LOG"
    
    if [ "$NO_COLOR" = true ]; then
        tail -n "$lines" -f $files 2>/dev/null
    else
        tail -n "$lines" -f $files 2>/dev/null | colorize_logs
    fi
}

# Show recent logs (non-streaming)
show_logs() {
    local log_file="$1"
    local lines="${2:-$DEFAULT_LINES}"
    
    if [ -n "$log_file" ]; then
        if [ ! -f "$log_file" ]; then
            log_warning "Log file not found: $log_file"
            return 1
        fi
        
        log_section "$(basename "$log_file") (last $lines lines)"
        
        if [ "$NO_COLOR" = true ]; then
            tail -n "$lines" "$log_file"
        else
            tail -n "$lines" "$log_file" | colorize_logs
        fi
    else
        # Show both
        if [ -f "$BACKEND_LOG" ]; then
            log_section "Backend Logs (last $lines lines)"
            if [ "$NO_COLOR" = true ]; then
                tail -n "$lines" "$BACKEND_LOG"
            else
                tail -n "$lines" "$BACKEND_LOG" | colorize_logs
            fi
        fi
        
        if [ -f "$FRONTEND_LOG" ]; then
            log_section "Frontend Logs (last $lines lines)"
            if [ "$NO_COLOR" = true ]; then
                tail -n "$lines" "$FRONTEND_LOG"
            else
                tail -n "$lines" "$FRONTEND_LOG" | colorize_logs
            fi
        fi
    fi
}

# Clean old log files
clean_logs() {
    log_header "Clean Logs"
    
    if [ ! -d "$LOG_DIR" ]; then
        log_info "No log directory found"
        return 0
    fi
    
    # Count files
    local count=$(find "$LOG_DIR" -name "*.log" -type f | wc -l | tr -d ' ')
    
    if [ "$count" -eq 0 ]; then
        log_info "No log files to clean"
        return 0
    fi
    
    # Calculate total size
    local total_size=0
    for file in "$LOG_DIR"/*.log; do
        if [ -f "$file" ]; then
            local size=$(get_file_size "$file")
            total_size=$((total_size + size))
        fi
    done
    
    log_info "Found $count log file(s) ($(format_bytes $total_size))"
    
    if [ "$FORCE" != true ]; then
        if ! confirm "Delete all log files?"; then
            log_info "Clean cancelled"
            return 0
        fi
    fi
    
    rm -f "$LOG_DIR"/*.log
    log_success "Cleaned $count log file(s)"
}

# List log files
list_logs() {
    log_section "Log Files"
    
    if [ ! -d "$LOG_DIR" ]; then
        log_info "No log directory found"
        return 0
    fi
    
    local count=0
    for file in "$LOG_DIR"/*.log; do
        if [ -f "$file" ]; then
            local size=$(get_file_size "$file")
            local name=$(basename "$file")
            local modified=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$file" 2>/dev/null || stat -c "%y" "$file" 2>/dev/null | cut -d'.' -f1)
            printf "  %-20s %-12s %s\n" "$name" "$(format_bytes $size)" "$modified"
            count=$((count + 1))
        fi
    done
    
    if [ $count -eq 0 ]; then
        log_info "No log files found"
        log_info "Start Evelyn with --logs flag to enable logging"
    else
        echo ""
        log_info "Log directory: $LOG_DIR"
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

COMMAND="tail"
TARGET=""
LINES=$DEFAULT_LINES
FOLLOW=true
NO_COLOR=false
FORCE=false

# Parse arguments
while [ $# -gt 0 ]; do
    case "$1" in
        -n|--lines)
            LINES="$2"
            shift 2
            ;;
        -f|--follow)
            FOLLOW=true
            shift
            ;;
        --no-follow)
            FOLLOW=false
            shift
            ;;
        --no-color)
            NO_COLOR=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        tail|show|clean|list)
            COMMAND="$1"
            shift
            ;;
        backend)
            TARGET="backend"
            shift
            ;;
        frontend)
            TARGET="frontend"
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Execute command
case "$COMMAND" in
    tail)
        case "$TARGET" in
            backend)
                tail_logs "$BACKEND_LOG" "$LINES"
                ;;
            frontend)
                tail_logs "$FRONTEND_LOG" "$LINES"
                ;;
            *)
                tail_all_logs "$LINES"
                ;;
        esac
        ;;
    show)
        case "$TARGET" in
            backend)
                show_logs "$BACKEND_LOG" "$LINES"
                ;;
            frontend)
                show_logs "$FRONTEND_LOG" "$LINES"
                ;;
            *)
                show_logs "" "$LINES"
                ;;
        esac
        ;;
    clean)
        clean_logs
        ;;
    list)
        list_logs
        ;;
    *)
        show_help
        exit 1
        ;;
esac
