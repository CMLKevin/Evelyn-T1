#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# Evelyn Chat - Comprehensive Start Script
# ═══════════════════════════════════════════════════════════════════════════
# Starts both backend and frontend servers with health checks, monitoring,
# and beautiful logging
#
# Usage:
#   ./start.sh              # Normal start with colorized logs
#   ./start.sh --dev        # Development mode (verbose logging)
#   ./start.sh --prod       # Production mode (minimal logging)
#   ./start.sh --logs       # Save logs to files
#   ./start.sh --check      # Check system requirements only
#   ./start.sh --help       # Show help
# ═══════════════════════════════════════════════════════════════════════════

set -e  # Exit on error (disabled for graceful error handling)

# ═══════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

VERSION="2.0.0"
BACKEND_PORT=${BACKEND_PORT:-3001}
FRONTEND_PORT=${FRONTEND_PORT:-5173}
HEALTH_CHECK_TIMEOUT=30
STARTUP_WAIT=3
LOG_DIR="logs"
PID_FILE=".evelyn.pid"

# Parse arguments
MODE="normal"
SAVE_LOGS=false
CHECK_ONLY=false

for arg in "$@"; do
    case $arg in
        --dev)
            MODE="dev"
            ;;
        --prod)
            MODE="prod"
            ;;
        --logs)
            SAVE_LOGS=true
            ;;
        --check)
            CHECK_ONLY=true
            ;;
        --help)
            echo "Evelyn Chat Start Script v$VERSION"
            echo ""
            echo "Usage: ./start.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --dev       Development mode (verbose logging)"
            echo "  --prod      Production mode (minimal logging)"
            echo "  --logs      Save logs to files in logs/"
            echo "  --check     Check system requirements only"
            echo "  --help      Show this help message"
            echo ""
            echo "Environment Variables:"
            echo "  BACKEND_PORT    Backend server port (default: 3001)"
            echo "  FRONTEND_PORT   Frontend server port (default: 5173)"
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

# ═══════════════════════════════════════════════════════════════════════════
# COLORS & FORMATTING
# ═══════════════════════════════════════════════════════════════════════════

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
NC='\033[0m'  # No Color

# ═══════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

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

log_header() {
    echo ""
    echo -e "${BRIGHT_BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BRIGHT_BLUE}║  $1${NC}"
    echo -e "${BRIGHT_BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

log_step() {
    echo -e "${CYAN}→${NC}  $1"
}

spinner() {
    local pid=$1
    local message=$2
    local spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local i=0
    
    while kill -0 $pid 2>/dev/null; do
        i=$(( (i+1) %10 ))
        printf "\r${CYAN}${spin:$i:1}${NC}  $message"
        sleep 0.1
    done
    printf "\r"
}

check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1
    fi
    return 0
}

wait_for_port() {
    local port=$1
    local timeout=$2
    local elapsed=0
    
    while [ $elapsed -lt $timeout ]; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            return 0
        fi
        sleep 0.5
        elapsed=$((elapsed + 1))
    done
    return 1
}

check_health() {
    local url=$1
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    if [ "$response" = "200" ]; then
        return 0
    fi
    return 1
}

# ═══════════════════════════════════════════════════════════════════════════
# SYSTEM REQUIREMENTS CHECK
# ═══════════════════════════════════════════════════════════════════════════

check_requirements() {
    log_header "Checking System Requirements"
    
    local errors=0
    
    # Check Node.js
    log_step "Checking Node.js..."
    if command -v node >/dev/null 2>&1; then
        local node_version=$(node --version)
        local node_major=$(echo $node_version | cut -d'.' -f1 | sed 's/v//')
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
    if command -v npm >/dev/null 2>&1; then
        local npm_version=$(npm --version)
        log_success "npm v$npm_version"
    else
        log_error "npm not found (required)"
        errors=$((errors + 1))
    fi
    
    # Check curl (for health checks)
    log_step "Checking curl..."
    if command -v curl >/dev/null 2>&1; then
        log_success "curl available"
    else
        log_warning "curl not found (health checks disabled)"
    fi
    
    # Check lsof (for port checks)
    log_step "Checking lsof..."
    if command -v lsof >/dev/null 2>&1; then
        log_success "lsof available"
    else
        log_warning "lsof not found (port checks disabled)"
    fi
    
    # Check port availability
    log_step "Checking ports..."
    if command -v lsof >/dev/null 2>&1; then
        if check_port $BACKEND_PORT; then
            log_success "Port $BACKEND_PORT available"
        else
            log_error "Port $BACKEND_PORT already in use"
            errors=$((errors + 1))
        fi
        
        if check_port $FRONTEND_PORT; then
            log_success "Port $FRONTEND_PORT available"
        else
            log_error "Port $FRONTEND_PORT already in use"
            errors=$((errors + 1))
        fi
    fi
    
    # Check directories
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
    if [ -f "server/prisma/dev.db" ]; then
        local db_size=$(du -h "server/prisma/dev.db" | cut -f1)
        log_success "Database found ($db_size)"
    else
        log_warning "Database not found (will be created)"
    fi
    
    # Check environment files
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

# ═══════════════════════════════════════════════════════════════════════════
# DEPENDENCY MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════

check_dependencies() {
    log_header "Checking Dependencies"
    
    local needs_install=false
    
    # Check backend dependencies
    log_step "Checking backend dependencies..."
    if [ ! -d "server/node_modules" ]; then
        log_warning "Backend dependencies not found"
        needs_install=true
    else
        local backend_count=$(find server/node_modules -maxdepth 1 -type d | wc -l)
        log_success "Backend dependencies installed ($backend_count packages)"
    fi
    
    # Check frontend dependencies
    log_step "Checking frontend dependencies..."
    if [ ! -d "web/node_modules" ]; then
        log_warning "Frontend dependencies not found"
        needs_install=true
    else
        local frontend_count=$(find web/node_modules -maxdepth 1 -type d | wc -l)
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

# ═══════════════════════════════════════════════════════════════════════════
# LOG COLORIZATION
# ═══════════════════════════════════════════════════════════════════════════

colorize_backend() {
    while IFS= read -r line; do
        local timestamp=$(date '+%H:%M:%S')
        
        # New emoji-based log format
        if echo "$line" | grep -q "🕐"; then
            echo -e "${GRAY}[${timestamp}]${NC} ${BRIGHT_MAGENTA}[TEMPORAL]${NC} ${MAGENTA}$line${NC}"
        elif echo "$line" | grep -q "⏰"; then
            echo -e "${GRAY}[${timestamp}]${NC} ${MAGENTA}[TEMPORAL]${NC} $line"
        elif echo "$line" | grep -q "💬"; then
            echo -e "${GRAY}[${timestamp}]${NC} ${BRIGHT_BLUE}[PIPELINE]${NC} ${BLUE}$line${NC}"
        elif echo "$line" | grep -q "🔍"; then
            echo -e "${GRAY}[${timestamp}]${NC} ${BRIGHT_CYAN}[SEARCH]${NC} ${CYAN}$line${NC}"
        elif echo "$line" | grep -q "🧠"; then
            echo -e "${GRAY}[${timestamp}]${NC} ${BRIGHT_BLUE}[CONTEXT]${NC} ${BLUE}$line${NC}"
        elif echo "$line" | grep -q "💭"; then
            echo -e "${GRAY}[${timestamp}]${NC} ${BRIGHT_MAGENTA}[THOUGHT]${NC} ${MAGENTA}$line${NC}"
        elif echo "$line" | grep -q "📝"; then
            echo -e "${GRAY}[${timestamp}]${NC} ${BRIGHT_CYAN}[BUILD]${NC} ${CYAN}$line${NC}"
        elif echo "$line" | grep -q "✅"; then
            echo -e "${GRAY}[${timestamp}]${NC} ${BRIGHT_GREEN}[DONE]${NC} ${GREEN}$line${NC}"
        elif echo "$line" | grep -q "❌"; then
            echo -e "${GRAY}[${timestamp}]${NC} ${BRIGHT_RED}[ERROR]${NC} ${RED}$line${NC}"
        elif echo "$line" | grep -q "🚀"; then
            echo -e "${GRAY}[${timestamp}]${NC} ${BRIGHT_GREEN}[SERVER]${NC} ${GREEN}$line${NC}"
        elif echo "$line" | grep -q "✨"; then
            echo -e "${GRAY}[${timestamp}]${NC} ${BRIGHT_GREEN}[READY]${NC} ${GREEN}$line${NC}"
        elif echo "$line" | grep -q "💾"; then
            echo -e "${GRAY}[${timestamp}]${NC} ${BRIGHT_CYAN}[BACKUP]${NC} ${CYAN}$line${NC}"
        elif echo "$line" | grep -q "🛑"; then
            echo -e "${GRAY}[${timestamp}]${NC} ${YELLOW}[SHUTDOWN]${NC} ${YELLOW}$line${NC}"
        
        # Legacy log patterns
        elif echo "$line" | grep -qiE "error|failed|fail|exception"; then
            echo -e "${GRAY}[${timestamp}]${NC} ${BRIGHT_RED}[BACKEND]${NC} ${RED}$line${NC}"
        elif echo "$line" | grep -qiE "warn|warning"; then
            echo -e "${GRAY}[${timestamp}]${NC} ${YELLOW}[BACKEND]${NC} ${YELLOW}$line${NC}"
        elif echo "$line" | grep -qiE "success|complete|ready|listening|started"; then
            echo -e "${GRAY}[${timestamp}]${NC} ${BRIGHT_GREEN}[BACKEND]${NC} ${GREEN}$line${NC}"
        else
            if [ "$MODE" = "dev" ]; then
                echo -e "${GRAY}[${timestamp}]${NC} ${WHITE}[BACKEND]${NC} $line"
            elif [ "$MODE" = "prod" ]; then
                # In prod mode, only show important logs
                if echo "$line" | grep -qE "\[Server\]|\[Pipeline\]|\[Temporal\]"; then
                    echo -e "${GRAY}[${timestamp}]${NC} ${WHITE}[BACKEND]${NC} $line"
                fi
            else
                echo -e "${GRAY}[${timestamp}]${NC} ${WHITE}[BACKEND]${NC} $line"
            fi
        fi
    done
}

colorize_frontend() {
    while IFS= read -r line; do
        local timestamp=$(date '+%H:%M:%S')
        
        if echo "$line" | grep -q "VITE"; then
            echo -e "${GRAY}[${timestamp}]${NC} ${BRIGHT_CYAN}[VITE]${NC} ${CYAN}$line${NC}"
        elif echo "$line" | grep -q "Local:"; then
            echo -e "${GRAY}[${timestamp}]${NC} ${BRIGHT_GREEN}[FRONTEND]${NC} ${GREEN}$line${NC}"
        elif echo "$line" | grep -q "Network:"; then
            echo -e "${GRAY}[${timestamp}]${NC} ${BRIGHT_BLUE}[FRONTEND]${NC} ${BLUE}$line${NC}"
        elif echo "$line" | grep -qE "error|Error"; then
            echo -e "${GRAY}[${timestamp}]${NC} ${BRIGHT_RED}[FRONTEND]${NC} ${RED}$line${NC}"
        elif echo "$line" | grep -qE "ready|✓"; then
            echo -e "${GRAY}[${timestamp}]${NC} ${BRIGHT_GREEN}[FRONTEND]${NC} ${GREEN}$line${NC}"
        else
            if [ "$MODE" != "prod" ]; then
                echo -e "${GRAY}[${timestamp}]${NC} ${BRIGHT_CYAN}[FRONTEND]${NC} $line"
            fi
        fi
    done
}

# ═══════════════════════════════════════════════════════════════════════════
# CLEANUP & SIGNAL HANDLING
# ═══════════════════════════════════════════════════════════════════════════

cleanup() {
    echo ""
    log_header "Shutting Down Evelyn"
    
    # Remove PID file
    rm -f "$PID_FILE"
    
    # Kill backend
    if [ ! -z "$BACKEND_PID" ]; then
        log_step "Stopping backend server..."
        kill -TERM $BACKEND_PID 2>/dev/null || true
        wait $BACKEND_PID 2>/dev/null || true
        log_success "Backend stopped"
    fi
    
    # Kill frontend
    if [ ! -z "$FRONTEND_PID" ]; then
        log_step "Stopping frontend server..."
        kill -TERM $FRONTEND_PID 2>/dev/null || true
        wait $FRONTEND_PID 2>/dev/null || true
        log_success "Frontend stopped"
    fi
    
    echo ""
    log_success "All servers stopped gracefully"
    echo ""
    exit 0
}

# Set up trap to cleanup on script exit
trap cleanup SIGINT SIGTERM EXIT

# ═══════════════════════════════════════════════════════════════════════════
# MAIN EXECUTION
# ═══════════════════════════════════════════════════════════════════════════

main() {
    # Get script directory
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    cd "$SCRIPT_DIR"
    
    # Print header
    echo ""
    echo -e "${BRIGHT_BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BRIGHT_BLUE}║                                                            ║${NC}"
    echo -e "${BRIGHT_BLUE}║              🌟 EVELYN CHAT - START SCRIPT 🌟             ║${NC}"
    echo -e "${BRIGHT_BLUE}║                      Version $VERSION                        ║${NC}"
    echo -e "${BRIGHT_BLUE}║                                                            ║${NC}"
    echo -e "${BRIGHT_BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    log_info "Mode: ${BRIGHT_WHITE}$MODE${NC}"
    log_info "Backend Port: ${BRIGHT_WHITE}$BACKEND_PORT${NC}"
    log_info "Frontend Port: ${BRIGHT_WHITE}$FRONTEND_PORT${NC}"
    if [ "$SAVE_LOGS" = true ]; then
        log_info "Logs: ${BRIGHT_WHITE}$LOG_DIR/${NC}"
    fi
    
    # Run system checks
    if ! check_requirements; then
        log_error "System requirements not met"
        exit 1
    fi
    
    # Exit if check-only mode
    if [ "$CHECK_ONLY" = true ]; then
        echo ""
        log_success "System check complete"
        exit 0
    fi
    
    # Check and install dependencies
    check_dependencies
    
    # Create log directory if needed
    if [ "$SAVE_LOGS" = true ]; then
        mkdir -p "$LOG_DIR"
        log_info "Logs will be saved to $LOG_DIR/"
    fi
    
    # ═══════════════════════════════════════════════════════════════════════
    # START BACKEND
    # ═══════════════════════════════════════════════════════════════════════
    
    log_header "Starting Backend Server"
    
    log_step "Launching backend on port $BACKEND_PORT..."
    
    if [ "$SAVE_LOGS" = true ]; then
        (cd server && npm run dev 2>&1) | tee "$LOG_DIR/backend.log" | colorize_backend &
    else
        (cd server && npm run dev 2>&1) | colorize_backend &
    fi
    BACKEND_PID=$!
    
    # Save PID
    echo "BACKEND_PID=$BACKEND_PID" > "$PID_FILE"
    
    # Wait for backend to start
    log_step "Waiting for backend to initialize..."
    sleep $STARTUP_WAIT
    
    # Check if backend process is still running
    if ! ps -p $BACKEND_PID > /dev/null 2>&1; then
        log_error "Backend failed to start (process died)"
        exit 1
    fi
    
    # Wait for backend port to be available
    if command -v lsof >/dev/null 2>&1; then
        if wait_for_port $BACKEND_PORT $HEALTH_CHECK_TIMEOUT; then
            log_success "Backend listening on port $BACKEND_PORT"
        else
            log_error "Backend failed to bind to port $BACKEND_PORT"
            exit 1
        fi
    fi
    
    # Health check
    if command -v curl >/dev/null 2>&1; then
        log_step "Performing health check..."
        sleep 2
        if check_health "http://localhost:$BACKEND_PORT/api/health"; then
            log_success "Backend health check passed"
        else
            log_warning "Backend health check failed (might still be initializing)"
        fi
    fi
    
    # ═══════════════════════════════════════════════════════════════════════
    # START FRONTEND
    # ═══════════════════════════════════════════════════════════════════════
    
    log_header "Starting Frontend Server"
    
    log_step "Launching frontend on port $FRONTEND_PORT..."
    
    if [ "$SAVE_LOGS" = true ]; then
        (cd web && npm run dev 2>&1) | tee "$LOG_DIR/frontend.log" | colorize_frontend &
    else
        (cd web && npm run dev 2>&1) | colorize_frontend &
    fi
    FRONTEND_PID=$!
    
    # Update PID file
    echo "FRONTEND_PID=$FRONTEND_PID" >> "$PID_FILE"
    
    # Wait for frontend to start
    log_step "Waiting for frontend to initialize..."
    sleep 2
    
    # Check if frontend process is still running
    if ! ps -p $FRONTEND_PID > /dev/null 2>&1; then
        log_error "Frontend failed to start (process died)"
        exit 1
    fi
    
    # Wait for frontend port
    if command -v lsof >/dev/null 2>&1; then
        if wait_for_port $FRONTEND_PORT $HEALTH_CHECK_TIMEOUT; then
            log_success "Frontend listening on port $FRONTEND_PORT"
        else
            log_error "Frontend failed to bind to port $FRONTEND_PORT"
            exit 1
        fi
    fi
    
    # ═══════════════════════════════════════════════════════════════════════
    # READY
    # ═══════════════════════════════════════════════════════════════════════
    
    echo ""
    echo -e "${BRIGHT_GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BRIGHT_GREEN}║                                                            ║${NC}"
    echo -e "${BRIGHT_GREEN}║                   ✨ EVELYN IS READY ✨                    ║${NC}"
    echo -e "${BRIGHT_GREEN}║                                                            ║${NC}"
    echo -e "${BRIGHT_GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    log_success "Backend:  ${BRIGHT_WHITE}http://localhost:$BACKEND_PORT${NC}"
    log_success "Frontend: ${BRIGHT_WHITE}http://localhost:$FRONTEND_PORT${NC}"
    echo ""
    log_info "Press ${BRIGHT_WHITE}Ctrl+C${NC} to stop all servers"
    echo ""
    
    # Wait for both processes
    wait
}

# Run main function
main
