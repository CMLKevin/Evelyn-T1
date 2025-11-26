#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Evelyn Developer Utilities
# ═══════════════════════════════════════════════════════════════════════════════
# Quick commands for development workflow
#
# Usage:
#   ./scripts/dev.sh tsc          # Run TypeScript check
#   ./scripts/dev.sh lint         # Run linter
#   ./scripts/dev.sh test         # Run tests
#   ./scripts/dev.sh clean        # Clean build artifacts
#   ./scripts/dev.sh deps         # Update dependencies
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# Source shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

cd "$SCRIPT_DIR/.."

# ═══════════════════════════════════════════════════════════════════════════════
# FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

show_help() {
    cat << EOF
Evelyn Developer Utilities v$EVELYN_VERSION

Usage: ./scripts/dev.sh <command> [options]

Commands:
  tsc           Run TypeScript type checking
  lint          Run ESLint on the codebase
  test          Run test suite
  clean         Clean build artifacts and caches
  deps          Update all dependencies
  prisma        Regenerate Prisma client
  build         Build for production
  doctor        Run diagnostics on the project

Options:
  --fix         Auto-fix issues (for lint)
  --watch       Watch mode (for tsc)
  --help        Show this help message

Examples:
  ./scripts/dev.sh tsc
  ./scripts/dev.sh lint --fix
  ./scripts/dev.sh clean

EOF
}

# TypeScript check
run_tsc() {
    log_header "TypeScript Check"
    
    local errors=0
    
    log_step "Checking server..."
    if (cd server && npx tsc --noEmit 2>&1); then
        log_success "Server: No errors"
    else
        log_error "Server: TypeScript errors found"
        errors=$((errors + 1))
    fi
    
    log_step "Checking web..."
    if (cd web && npx tsc --noEmit 2>&1); then
        log_success "Web: No errors"
    else
        log_error "Web: TypeScript errors found"
        errors=$((errors + 1))
    fi
    
    echo ""
    if [ $errors -eq 0 ]; then
        log_success "All TypeScript checks passed!"
    else
        log_error "$errors project(s) have errors"
        return 1
    fi
}

# Lint check
run_lint() {
    local fix_flag=""
    [ "$FIX" = true ] && fix_flag="--fix"
    
    log_header "ESLint Check"
    
    log_step "Linting server..."
    (cd server && npx eslint src $fix_flag) || true
    
    log_step "Linting web..."
    (cd web && npx eslint src $fix_flag) || true
    
    log_success "Lint complete"
}

# Run tests
run_tests() {
    log_header "Running Tests"
    
    log_step "Running server tests..."
    (cd server && npm test) || log_warning "No server tests or tests failed"
    
    log_step "Running web tests..."
    (cd web && npm test) || log_warning "No web tests or tests failed"
    
    log_success "Test run complete"
}

# Clean build artifacts
run_clean() {
    log_header "Cleaning Build Artifacts"
    
    log_step "Cleaning server..."
    rm -rf server/dist server/.tsbuildinfo
    log_success "Server cleaned"
    
    log_step "Cleaning web..."
    rm -rf web/dist web/.vite
    log_success "Web cleaned"
    
    log_step "Cleaning node_modules caches..."
    rm -rf node_modules/.cache server/node_modules/.cache web/node_modules/.cache
    log_success "Caches cleaned"
    
    if confirm "Also clean log files?"; then
        rm -rf logs/*.log
        log_success "Logs cleaned"
    fi
    
    log_success "Clean complete"
}

# Update dependencies
run_deps() {
    log_header "Updating Dependencies"
    
    log_step "Checking for updates..."
    npm outdated || true
    
    if confirm "Update all dependencies?"; then
        log_step "Updating root dependencies..."
        npm update
        
        log_step "Updating server dependencies..."
        (cd server && npm update)
        
        log_step "Updating web dependencies..."
        (cd web && npm update)
        
        log_success "Dependencies updated"
    fi
}

# Regenerate Prisma client
run_prisma() {
    log_header "Regenerating Prisma Client"
    
    log_step "Running prisma generate..."
    (cd server && npx prisma generate)
    
    log_success "Prisma client regenerated"
}

# Build for production
run_build() {
    log_header "Building for Production"
    
    log_step "Building server..."
    (cd server && npm run build) || log_warning "Server build failed or not configured"
    
    log_step "Building web..."
    (cd web && npm run build)
    
    log_success "Build complete"
}

# Run diagnostics
run_doctor() {
    log_header "Project Diagnostics"
    
    # Node version
    log_section "Environment"
    echo "  Node.js:     $(node --version)"
    echo "  npm:         v$(npm --version)"
    echo "  OS:          $(uname -s) $(uname -m)"
    
    # Dependencies
    log_section "Dependencies"
    local root_deps=$(cat package.json | grep -c '"dependencies"\|"devDependencies"' || echo "0")
    local server_deps=$(find server/node_modules -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
    local web_deps=$(find web/node_modules -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
    echo "  Server:      $server_deps packages"
    echo "  Web:         $web_deps packages"
    
    # Database
    log_section "Database"
    if [ -f "$DB_PATH" ]; then
        local db_size=$(get_file_size "$DB_PATH")
        echo "  Status:      EXISTS"
        echo "  Size:        $(format_bytes $db_size)"
    else
        echo "  Status:      NOT FOUND"
    fi
    
    # Git status
    log_section "Git Status"
    if has_command git && [ -d ".git" ]; then
        local branch=$(git branch --show-current 2>/dev/null || echo "unknown")
        local changes=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
        echo "  Branch:      $branch"
        echo "  Changes:     $changes file(s)"
    else
        echo "  Not a git repository"
    fi
    
    # TypeScript status
    log_section "TypeScript Check"
    local server_errors=$(cd server && npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0")
    local web_errors=$(cd web && npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0")
    echo "  Server:      $server_errors error(s)"
    echo "  Web:         $web_errors error(s)"
    
    echo ""
    log_success "Diagnostics complete"
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

COMMAND=""
FIX=false
WATCH=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --fix)   FIX=true ;;
        --watch) WATCH=true ;;
        --help|-h) show_help; exit 0 ;;
        tsc|lint|test|clean|deps|prisma|build|doctor)
            COMMAND="$arg"
            ;;
        *)
            log_error "Unknown option: $arg"
            show_help
            exit 1
            ;;
    esac
done

# Execute command
case "$COMMAND" in
    tsc)     run_tsc ;;
    lint)    run_lint ;;
    test)    run_tests ;;
    clean)   run_clean ;;
    deps)    run_deps ;;
    prisma)  run_prisma ;;
    build)   run_build ;;
    doctor)  run_doctor ;;
    *)
        show_help
        exit 1
        ;;
esac
