#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Evelyn Database Management Script
# ═══════════════════════════════════════════════════════════════════════════════
# Manage database operations: backup, restore, reset, migrate, info
#
# Usage:
#   ./scripts/db.sh backup          # Create a backup
#   ./scripts/db.sh restore [file]  # Restore from backup
#   ./scripts/db.sh reset           # Reset database (WARNING: deletes data)
#   ./scripts/db.sh migrate         # Run migrations
#   ./scripts/db.sh info            # Show database info
#   ./scripts/db.sh studio          # Open Prisma Studio
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# Source shared library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib.sh"

# Go to project root
cd "$SCRIPT_DIR/.."

# ═══════════════════════════════════════════════════════════════════════════════
# FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

show_help() {
    echo "Evelyn Database Management Script v$EVELYN_VERSION"
    echo ""
    echo "Usage: ./scripts/db.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  backup              Create a timestamped backup of the database"
    echo "  restore [file]      Restore database from a backup file"
    echo "  reset               Reset database (runs migrations from scratch)"
    echo "  migrate             Run pending Prisma migrations"
    echo "  push                Push schema changes without migrations"
    echo "  info                Show database information and statistics"
    echo "  studio              Open Prisma Studio (database browser)"
    echo "  list-backups        List available backup files"
    echo ""
    echo "Options:"
    echo "  --force             Skip confirmation prompts"
    echo "  --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./scripts/db.sh backup"
    echo "  ./scripts/db.sh restore backups/backup-2024-01-01.db"
    echo "  ./scripts/db.sh reset --force"
    echo ""
}

backup_database() {
    log_header "Database Backup"
    
    if [ ! -f "$DB_PATH" ]; then
        log_error "Database not found at: $DB_PATH"
        exit 1
    fi
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Generate backup filename
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local backup_file="$BACKUP_DIR/backup-${timestamp}.db"
    
    log_step "Creating backup..."
    cp "$DB_PATH" "$backup_file"
    
    # Get sizes
    local original_size=$(get_file_size "$DB_PATH")
    local backup_size=$(get_file_size "$backup_file")
    
    log_success "Backup created: $backup_file"
    log_info "Size: $(format_bytes $backup_size)"
    
    # Show record counts
    if has_command sqlite3; then
        echo ""
        log_section "Backup Contents"
        local msg_count=$(sqlite3 "$backup_file" "SELECT COUNT(*) FROM Message;" 2>/dev/null || echo "?")
        local mem_count=$(sqlite3 "$backup_file" "SELECT COUNT(*) FROM Memory;" 2>/dev/null || echo "?")
        local doc_count=$(sqlite3 "$backup_file" "SELECT COUNT(*) FROM CollaborateDocument;" 2>/dev/null || echo "?")
        
        echo "  Messages:  $msg_count"
        echo "  Memories:  $mem_count"
        echo "  Documents: $doc_count"
    fi
    
    echo ""
    log_success "Backup complete!"
}

restore_database() {
    local backup_file="$1"
    
    log_header "Database Restore"
    
    if [ -z "$backup_file" ]; then
        log_error "Please specify a backup file to restore"
        echo ""
        list_backups
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    # Confirm
    if [ "$FORCE" != true ]; then
        log_warning "This will REPLACE the current database with the backup!"
        if ! confirm "Continue with restore?"; then
            log_info "Restore cancelled"
            exit 0
        fi
    fi
    
    # Create safety backup first
    if [ -f "$DB_PATH" ]; then
        local safety_backup="$BACKUP_DIR/pre-restore-$(date '+%Y%m%d_%H%M%S').db"
        mkdir -p "$BACKUP_DIR"
        cp "$DB_PATH" "$safety_backup"
        log_info "Created safety backup: $safety_backup"
    fi
    
    # Restore
    log_step "Restoring database..."
    cp "$backup_file" "$DB_PATH"
    
    log_success "Database restored from: $backup_file"
    
    # Regenerate Prisma client
    log_step "Regenerating Prisma client..."
    (cd server && npx prisma generate) >/dev/null 2>&1
    
    log_success "Restore complete!"
    log_warning "Please restart Evelyn for changes to take effect"
}

reset_database() {
    log_header "Database Reset" "$BRIGHT_RED"
    
    if [ "$FORCE" != true ]; then
        log_warning "This will DELETE ALL DATA and recreate the database!"
        echo ""
        if ! confirm "Are you absolutely sure?" "n"; then
            log_info "Reset cancelled"
            exit 0
        fi
    fi
    
    # Create backup first
    if [ -f "$DB_PATH" ]; then
        local backup_file="$BACKUP_DIR/pre-reset-$(date '+%Y%m%d_%H%M%S').db"
        mkdir -p "$BACKUP_DIR"
        cp "$DB_PATH" "$backup_file"
        log_info "Created backup before reset: $backup_file"
    fi
    
    # Run reset
    log_step "Resetting database..."
    (cd server && npx prisma migrate reset --force --skip-seed) 2>&1 | while read -r line; do
        if echo "$line" | grep -q "Applying migration"; then
            log_info "$line"
        fi
    done
    
    log_success "Database reset complete!"
}

run_migrations() {
    log_header "Database Migration"
    
    log_step "Checking for pending migrations..."
    
    cd server
    npx prisma migrate deploy 2>&1 | while read -r line; do
        if echo "$line" | grep -q "Applying migration"; then
            log_success "$line"
        elif echo "$line" | grep -q "already in sync"; then
            log_info "Database is already up to date"
        fi
    done
    
    log_step "Regenerating Prisma client..."
    npx prisma generate >/dev/null 2>&1
    
    log_success "Migration complete!"
}

push_schema() {
    log_header "Schema Push"
    
    log_step "Pushing schema changes..."
    
    cd server
    npx prisma db push 2>&1 | while read -r line; do
        if echo "$line" | grep -q "in sync"; then
            log_success "Schema is in sync"
        elif echo "$line" | grep -q "applied"; then
            log_info "$line"
        fi
    done
    
    log_step "Regenerating Prisma client..."
    npx prisma generate >/dev/null 2>&1
    
    log_success "Schema push complete!"
}

show_info() {
    log_header "Database Information"
    
    if [ ! -f "$DB_PATH" ]; then
        log_error "Database not found at: $DB_PATH"
        exit 1
    fi
    
    local db_size=$(get_file_size "$DB_PATH")
    
    echo "  Location:  $DB_PATH"
    echo "  Size:      $(format_bytes $db_size)"
    
    if has_command sqlite3; then
        echo ""
        log_section "Table Statistics"
        
        # Get all table counts
        local tables=(
            "Message" "Memory" "MemoryCluster" "MemoryLink"
            "MoodState" "MoodHistory" "PersonaBelief" "PersonaGoal"
            "CollaborateDocument" "CollaborateVersion" "CollaborateSuggestion"
            "ToolActivity" "SearchResult"
        )
        
        for table in "${tables[@]}"; do
            local count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "-")
            if [ "$count" != "-" ] && [ "$count" != "0" ]; then
                printf "  %-25s %s\n" "$table:" "$count"
            fi
        done
        
        echo ""
        log_section "Recent Activity"
        
        # Show last message time
        local last_msg=$(sqlite3 "$DB_PATH" "SELECT datetime(createdAt) FROM Message ORDER BY id DESC LIMIT 1;" 2>/dev/null || echo "N/A")
        echo "  Last message: $last_msg"
        
        # Show last memory time
        local last_mem=$(sqlite3 "$DB_PATH" "SELECT datetime(createdAt) FROM Memory ORDER BY id DESC LIMIT 1;" 2>/dev/null || echo "N/A")
        echo "  Last memory:  $last_mem"
    else
        log_warning "sqlite3 not installed - cannot show detailed stats"
    fi
    
    echo ""
}

open_studio() {
    log_header "Prisma Studio"
    
    log_info "Opening Prisma Studio..."
    log_info "This will open a browser window to manage your database"
    echo ""
    
    cd server
    npx prisma studio
}

list_backups() {
    log_section "Available Backups"
    
    if [ ! -d "$BACKUP_DIR" ]; then
        log_info "No backups found"
        return
    fi
    
    local count=0
    for file in "$BACKUP_DIR"/*.db; do
        if [ -f "$file" ]; then
            local size=$(get_file_size "$file")
            local name=$(basename "$file")
            printf "  %-40s %s\n" "$name" "$(format_bytes $size)"
            count=$((count + 1))
        fi
    done
    
    if [ $count -eq 0 ]; then
        log_info "No backups found"
    else
        echo ""
        log_info "Total: $count backup(s)"
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

COMMAND=""
FORCE=false
BACKUP_FILE=""

# Parse arguments
for arg in "$@"; do
    case $arg in
        --force|-f)
            FORCE=true
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        backup|restore|reset|migrate|push|info|studio|list-backups)
            COMMAND="$arg"
            ;;
        *)
            if [ "$COMMAND" = "restore" ] && [ -z "$BACKUP_FILE" ]; then
                BACKUP_FILE="$arg"
            fi
            ;;
    esac
done

# Execute command
case "$COMMAND" in
    backup)
        backup_database
        ;;
    restore)
        restore_database "$BACKUP_FILE"
        ;;
    reset)
        reset_database
        ;;
    migrate)
        run_migrations
        ;;
    push)
        push_schema
        ;;
    info)
        show_info
        ;;
    studio)
        open_studio
        ;;
    list-backups)
        list_backups
        ;;
    *)
        show_help
        exit 1
        ;;
esac
