#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Evelyn Chat - Start Script v2.1
# ═══════════════════════════════════════════════════════════════════════════════
# Starts both backend and frontend servers with health checks and monitoring
#
# Usage:
#   ./start.sh              # Normal start
#   ./start.sh --dev        # Development mode (verbose)
#   ./start.sh --quick      # Skip checks, fast start
#   ./start.sh --logs       # Save logs to files
#   ./start.sh --fresh      # Reset database before start
#   ./start.sh --check      # Check requirements only
#   ./start.sh --help       # Show help
# ═══════════════════════════════════════════════════════════════════════════════

# Get script directory and source library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/scripts/lib.sh" ]; then
    source "$SCRIPT_DIR/scripts/lib.sh"
else
    echo "Error: scripts/lib.sh not found. Please ensure all files are present."
    exit 1
fi

cd "$SCRIPT_DIR"

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

MODE="normal"
SAVE_LOGS=false
CHECK_ONLY=false
QUICK_START=false
FRESH_START=false
OPEN_BROWSER=false

# ═══════════════════════════════════════════════════════════════════════════════
# ARGUMENT PARSING
# ═══════════════════════════════════════════════════════════════════════════════

show_help() {
    cat << EOF
Evelyn Chat Start Script v$EVELYN_VERSION

Usage: ./start.sh [OPTIONS]

Options:
  --dev         Development mode (verbose logging)
  --prod        Production mode (minimal logging)
  --quick       Quick start - skip requirement checks
  --logs        Save logs to files in logs/
  --fresh       Reset database before starting
  --open        Open browser after start
  --check       Check system requirements only
  --help        Show this help message

Environment Variables:
  BACKEND_PORT    Backend server port (default: 3001)
  FRONTEND_PORT   Frontend server port (default: 5173)

Examples:
  ./start.sh                    # Normal start
  ./start.sh --dev --logs       # Dev mode with file logging
  ./start.sh --quick            # Fast start (skip checks)
  ./start.sh --fresh            # Start with fresh database

EOF
    exit 0
}

for arg in "$@"; do
    case $arg in
        --dev)       MODE="dev" ;;
        --prod)      MODE="prod" ;;
        --logs)      SAVE_LOGS=true ;;
        --check)     CHECK_ONLY=true ;;
        --quick)     QUICK_START=true ;;
        --fresh)     FRESH_START=true ;;
        --open)      OPEN_BROWSER=true ;;
        --help|-h)   show_help ;;
        *)
            log_error "Unknown option: $arg"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# ═══════════════════════════════════════════════════════════════════════════════
# SYSTEM CHECKS
# ═══════════════════════════════════════════════════════════════════════════════

check_requirements() {
    log_header "Checking System Requirements"
    
    local errors=0
    
    # Check Node.js
    log_step "Checking Node.js..."
    if has_command node; then
        local node_version=$(node --version)
        local node_major=$(echo "$node_version" | cut -d'.' -f1 | sed 's/v//')
        if [ "$node_major" -ge 18 ]; then
            log_success "Node.js $node_version (✓ >= 18.0.0)"
        else
            log_error "Node.js $node_version (requires >= 18.0.0)"
            errors=$((errors + 1))
        fi
    else
        log_error "Node.js not found (required)"
        errors=$((errors + 1))
    fi
    
    # Check npm
    log_step "Checking npm..."
    if has_command npm; then
        log_success "npm v$(npm --version)"
    else
        log_error "npm not found (required)"
        errors=$((errors + 1))
    fi
    
    # Check optional tools
    log_step "Checking curl..."
    if has_command curl; then
        log_success "curl available"
    else
        log_warning "curl not found (health checks disabled)"
    fi
    
    log_step "Checking lsof..."
    if has_command lsof; then
        log_success "lsof available"
    else
        log_warning "lsof not found (port checks disabled)"
    fi
    
    # Check ports
    log_step "Checking ports..."
    if has_command lsof; then
        if ! check_port "$BACKEND_PORT"; then
            log_success "Port $BACKEND_PORT available"
        else
            local pid=$(get_port_pid "$BACKEND_PORT")
            log_error "Port $BACKEND_PORT in use (PID: $pid)"
            errors=$((errors + 1))
        fi
        
        if ! check_port "$FRONTEND_PORT"; then
            log_success "Port $FRONTEND_PORT available"
        else
            local pid=$(get_port_pid "$FRONTEND_PORT")
            log_error "Port $FRONTEND_PORT in use (PID: $pid)"
            errors=$((errors + 1))
        fi
    fi
    
    # Check project structure
    log_step "Checking project structure..."
    if [ -d "server" ] && [ -d "web" ]; then
        log_success "Project directories found"
    else
        log_error "Invalid project structure (server/ or web/ missing)"
        errors=$((errors + 1))
    fi
    
    # Check package.json files
    if [ -f "server/package.json" ] && [ -f "web/package.json" ]; then
        log_success "Package configuration found"
    else
        log_error "Missing package.json files"
        errors=$((errors + 1))
    fi
    
    # Check database
    log_step "Checking database..."
    if [ -f "$DB_PATH" ]; then
        local db_size=$(get_file_size "$DB_PATH")
        log_success "Database found ($(format_bytes $db_size))"
    else
        log_warning "Database not found (will be created)"
    fi
    
    # Check .env
    log_step "Checking environment..."
    if [ -f "server/.env" ]; then
        log_success "Server .env found"
    else
        log_warning "Server .env not found (using defaults)"
    fi
    
    echo ""
    if [ $errors -gt 0 ]; then
        log_error "$errors requirement(s) failed"
        return 1
    else
        log_success "All requirements met"
        return 0
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# DEPENDENCY MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

check_dependencies() {
    log_header "Checking Dependencies"
    
    local needs_install=false
    
    log_step "Checking backend dependencies..."
    if [ ! -d "server/node_modules" ] || [ ! -d "node_modules/@prisma" ]; then
        log_warning "Backend dependencies not found"
        needs_install=true
    else
        local backend_count=$(find server/node_modules -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
        log_success "Backend dependencies installed ($backend_count packages)"
    fi
    
    log_step "Checking frontend dependencies..."
    if [ ! -d "web/node_modules" ]; then
        log_warning "Frontend dependencies not found"
        needs_install=true
    else
        local frontend_count=$(find web/node_modules -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
        log_success "Frontend dependencies installed ($frontend_count packages)"
    fi
    
    if [ "$needs_install" = true ]; then
        echo ""
        log_info "Installing dependencies..."
        echo ""
        npm install
        echo ""
        log_success "Dependencies installed"
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# LOG COLORIZATION
# ═══════════════════════════════════════════════════════════════════════════════

colorize_backend() {
    while IFS= read -r line; do
        local timestamp=$(date '+%H:%M:%S')
        
        # Emoji-based patterns
        if echo "$line" | grep -q "🕐"; then
            echo -e "${GRAY}[$timestamp]${NC} ${BRIGHT_MAGENTA}[TEMPORAL]${NC} $line"
        elif echo "$line" | grep -q "✅"; then
            echo -e "${GRAY}[$timestamp]${NC} ${BRIGHT_GREEN}[DONE]${NC} ${GREEN}$line${NC}"
        elif echo "$line" | grep -q "❌"; then
            echo -e "${GRAY}[$timestamp]${NC} ${BRIGHT_RED}[ERROR]${NC} ${RED}$line${NC}"
        elif echo "$line" | grep -q "🚀"; then
            echo -e "${GRAY}[$timestamp]${NC} ${BRIGHT_GREEN}[SERVER]${NC} ${GREEN}$line${NC}"
        elif echo "$line" | grep -q "✨"; then
            echo -e "${GRAY}[$timestamp]${NC} ${BRIGHT_GREEN}[READY]${NC} ${GREEN}$line${NC}"
        elif echo "$line" | grep -q "💾"; then
            echo -e "${GRAY}[$timestamp]${NC} ${BRIGHT_CYAN}[BACKUP]${NC} $line"
        elif echo "$line" | grep -q "🛑"; then
            echo -e "${GRAY}[$timestamp]${NC} ${YELLOW}[SHUTDOWN]${NC} ${YELLOW}$line${NC}"
        # Standard patterns
        elif echo "$line" | grep -qiE "error|failed|exception"; then
            echo -e "${GRAY}[$timestamp]${NC} ${BRIGHT_RED}[BACKEND]${NC} ${RED}$line${NC}"
        elif echo "$line" | grep -qiE "warn"; then
            echo -e "${GRAY}[$timestamp]${NC} ${YELLOW}[BACKEND]${NC} ${YELLOW}$line${NC}"
        elif echo "$line" | grep -qiE "success|ready|listening"; then
            echo -e "${GRAY}[$timestamp]${NC} ${BRIGHT_GREEN}[BACKEND]${NC} ${GREEN}$line${NC}"
        else
            [ "$MODE" != "prod" ] && echo -e "${GRAY}[$timestamp]${NC} ${WHITE}[BACKEND]${NC} $line"
        fi
    done
}

colorize_frontend() {
    while IFS= read -r line; do
        local timestamp=$(date '+%H:%M:%S')
        
        if echo "$line" | grep -q "VITE"; then
            echo -e "${GRAY}[$timestamp]${NC} ${BRIGHT_CYAN}[VITE]${NC} ${CYAN}$line${NC}"
        elif echo "$line" | grep -q "Local:"; then
            echo -e "${GRAY}[$timestamp]${NC} ${BRIGHT_GREEN}[FRONTEND]${NC} ${GREEN}$line${NC}"
        elif echo "$line" | grep -qE "error|Error"; then
            echo -e "${GRAY}[$timestamp]${NC} ${BRIGHT_RED}[FRONTEND]${NC} ${RED}$line${NC}"
        else
            [ "$MODE" != "prod" ] && echo -e "${GRAY}[$timestamp]${NC} ${BRIGHT_CYAN}[FRONTEND]${NC} $line"
        fi
    done
}

# ═══════════════════════════════════════════════════════════════════════════════
# CLEANUP
# ═══════════════════════════════════════════════════════════════════════════════

cleanup() {
    echo ""
    log_header "Shutting Down Evelyn" "$YELLOW"
    
    clear_pid_file
    
    if [ -n "$BACKEND_PID" ]; then
        log_step "Stopping backend server..."
        kill -TERM "$BACKEND_PID" 2>/dev/null || true
        wait "$BACKEND_PID" 2>/dev/null || true
        log_success "Backend stopped"
    fi
    
    if [ -n "$FRONTEND_PID" ]; then
        log_step "Stopping frontend server..."
        kill -TERM "$FRONTEND_PID" 2>/dev/null || true
        wait "$FRONTEND_PID" 2>/dev/null || true
        log_success "Frontend stopped"
    fi
    
    echo ""
    log_success "All servers stopped gracefully"
    echo ""
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

main() {
    # Print header
    echo ""
    echo -e "${BRIGHT_BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BRIGHT_BLUE}║                                                            ║${NC}"
    echo -e "${BRIGHT_BLUE}║              🌟 EVELYN CHAT - START SCRIPT 🌟             ║${NC}"
    echo -e "${BRIGHT_BLUE}║                      Version $EVELYN_VERSION                        ║${NC}"
    echo -e "${BRIGHT_BLUE}║                                                            ║${NC}"
    echo -e "${BRIGHT_BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    log_info "Mode: ${WHITE}$MODE${NC}"
    log_info "Backend Port: ${WHITE}$BACKEND_PORT${NC}"
    log_info "Frontend Port: ${WHITE}$FRONTEND_PORT${NC}"
    
    # Fresh start - reset database
    if [ "$FRESH_START" = true ]; then
        log_warning "Fresh start requested - resetting database..."
        if [ -f "scripts/db.sh" ]; then
            bash scripts/db.sh reset --force
        else
            (cd server && npx prisma migrate reset --force --skip-seed) >/dev/null 2>&1
        fi
    fi
    
    # Run checks (unless quick start)
    if [ "$QUICK_START" != true ]; then
        if ! check_requirements; then
            log_error "System requirements not met"
            exit 1
        fi
        
        if [ "$CHECK_ONLY" = true ]; then
            echo ""
            log_success "System check complete"
            exit 0
        fi
        
        check_dependencies
    else
        log_info "Quick start - skipping checks"
    fi
    
    # Create log directory
    if [ "$SAVE_LOGS" = true ]; then
        mkdir -p "$LOG_DIR"
        log_info "Logs: ${WHITE}$LOG_DIR/${NC}"
    fi
    
    # ═══════════════════════════════════════════════════════════════════════════
    # START BACKEND
    # ═══════════════════════════════════════════════════════════════════════════
    
    log_header "Starting Backend Server"
    
    log_step "Launching backend on port $BACKEND_PORT..."
    
    if [ "$SAVE_LOGS" = true ]; then
        (cd server && npm run dev 2>&1) | tee "$LOG_DIR/backend.log" | colorize_backend &
    else
        (cd server && npm run dev 2>&1) | colorize_backend &
    fi
    BACKEND_PID=$!
    save_pid "BACKEND_PID" "$BACKEND_PID"
    
    log_step "Waiting for backend to initialize..."
    sleep $STARTUP_WAIT
    
    if ! check_process "$BACKEND_PID"; then
        log_error "Backend failed to start"
        exit 1
    fi
    
    if has_command lsof && wait_for_port "$BACKEND_PORT" "$HEALTH_CHECK_TIMEOUT"; then
        log_success "Backend listening on port $BACKEND_PORT"
    fi
    
    # Health check
    if has_command curl; then
        log_step "Performing health check..."
        sleep 2
        if check_health "http://localhost:$BACKEND_PORT/api/health"; then
            log_success "Backend health check passed"
        else
            log_warning "Backend health check pending..."
        fi
    fi
    
    # ═══════════════════════════════════════════════════════════════════════════
    # START FRONTEND
    # ═══════════════════════════════════════════════════════════════════════════
    
    log_header "Starting Frontend Server"
    
    log_step "Launching frontend on port $FRONTEND_PORT..."
    
    if [ "$SAVE_LOGS" = true ]; then
        (cd web && npm run dev 2>&1) | tee "$LOG_DIR/frontend.log" | colorize_frontend &
    else
        (cd web && npm run dev 2>&1) | colorize_frontend &
    fi
    FRONTEND_PID=$!
    save_pid "FRONTEND_PID" "$FRONTEND_PID"
    
    log_step "Waiting for frontend to initialize..."
    sleep 2
    
    if ! check_process "$FRONTEND_PID"; then
        log_error "Frontend failed to start"
        exit 1
    fi
    
    if has_command lsof && wait_for_port "$FRONTEND_PORT" "$HEALTH_CHECK_TIMEOUT"; then
        log_success "Frontend listening on port $FRONTEND_PORT"
    fi
    
    # ═══════════════════════════════════════════════════════════════════════════
    # READY
    # ═══════════════════════════════════════════════════════════════════════════
    
    echo ""
    echo -e "${BRIGHT_GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BRIGHT_GREEN}║                                                            ║${NC}"
    echo -e "${BRIGHT_GREEN}║                   ✨ EVELYN IS READY ✨                    ║${NC}"
    echo -e "${BRIGHT_GREEN}║                                                            ║${NC}"
    echo -e "${BRIGHT_GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    log_success "Backend:  ${WHITE}http://localhost:$BACKEND_PORT${NC}"
    log_success "Frontend: ${WHITE}http://localhost:$FRONTEND_PORT${NC}"
    echo ""
    log_info "Press ${WHITE}Ctrl+C${NC} to stop all servers"
    echo ""
    
    # Open browser if requested
    if [ "$OPEN_BROWSER" = true ]; then
        log_step "Opening browser..."
        if has_command open; then
            open "http://localhost:$FRONTEND_PORT"
        elif has_command xdg-open; then
            xdg-open "http://localhost:$FRONTEND_PORT"
        fi
    fi
    
    # Wait for processes
    wait
}

main
