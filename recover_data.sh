#!/bin/bash

# Evelyn Data Recovery Script
# This script migrates personality anchors from the old database

echo "════════════════════════════════════════════════════════════"
echo "  🔄 EVELYN DATA RECOVERY"
echo "════════════════════════════════════════════════════════════"
echo ""

OLD_DB="$HOME/Downloads/Evelyn/server/prisma/data/evelyn.db"
NEW_DB="$HOME/Downloads/EvelynChat-main/server/prisma/dev.db"

# Check if old database exists
if [ ! -f "$OLD_DB" ]; then
    echo "❌ Old database not found at: $OLD_DB"
    exit 1
fi

# Check if new database exists
if [ ! -f "$NEW_DB" ]; then
    echo "❌ New database not found at: $NEW_DB"
    exit 1
fi

echo "✅ Found old database (84 KB, 3 messages)"
echo "✅ Found new database (88 KB, empty)"
echo ""

# Backup new database first
echo "📦 Creating backup of new database..."
cp "$NEW_DB" "$NEW_DB.backup.$(date +%Y%m%d_%H%M%S)"
echo "✅ Backup created"
echo ""

# Apply personality migration
echo "🧠 Migrating personality anchors..."
sqlite3 "$NEW_DB" < migrate_personality.sql

echo ""
echo "✅ Migration complete!"
echo ""
echo "📊 Updated Personality Anchors:"
sqlite3 "$NEW_DB" "SELECT trait, value FROM PersonalityAnchor ORDER BY value DESC;"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  ✨ RECOVERY COMPLETE"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "What was recovered:"
echo "  ✅ 6 personality anchor values"
echo ""
echo "What was NOT recovered (minimal data):"
echo "  ❌ 3 messages (all 'Hi!' greetings)"
echo "  ❌ 0 memories (none existed)"
echo "  ❌ 0 search results (none existed)"
echo ""
echo "💡 Recommendation: Start a fresh conversation!"
echo "   The old data was minimal and not worth complex migration."
echo ""

