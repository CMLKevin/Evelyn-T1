/**
 * Personality Anchors Sync Script
 * 
 * This script syncs the database with the latest personality anchors.
 * Run this after updating the INITIAL_ANCHORS in personality.ts
 * 
 * Usage: node sync-personality.js
 */

async function syncAnchors() {
  console.log('🔄 Syncing personality anchors...\n');
  
  try {
    const response = await fetch('http://localhost:3001/api/personality/sync-anchors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    console.log('✅ Success!');
    console.log(`📊 Total anchors: ${result.anchorCount}`);
    console.log(`\n🧠 Current personality anchors:\n`);
    
    result.anchors.forEach((anchor, index) => {
      const percentage = (anchor.value * 100).toFixed(0);
      const bar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
      console.log(`${(index + 1).toString().padStart(2)}. ${anchor.trait.padEnd(25)} ${percentage}% ${bar}`);
    });
    
    console.log(`\n✨ ${result.message}`);
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Error: Server is not running!');
      console.log('\n💡 Start the server first:');
      console.log('   cd server && npm run dev');
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  }
}

// Run the sync
syncAnchors();

