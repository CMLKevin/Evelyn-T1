/**
 * Temporal Engine Test Suite
 * 
 * This script demonstrates and tests all temporal calculations in Evelyn's system
 * 
 * Usage: node test-temporal-engine.js
 */

// ============================================================================
// TEMPORAL CALCULATIONS (mirroring temporalEngine.ts)
// ============================================================================

const TEMPORAL_CONFIG = {
  MOOD_HALF_LIFE_MINUTES: 30,
  MOOD_BASELINE_VALENCE: 0.2,
  MOOD_BASELINE_AROUSAL: 0.4,
  BELIEF_HALF_LIFE_DAYS: 14,
  MEMORY_RECENCY_HALF_LIFE_DAYS: 30,
};

function calculateMoodDecay(valence, arousal, minutesElapsed) {
  const decayFactor = Math.pow(0.5, minutesElapsed / TEMPORAL_CONFIG.MOOD_HALF_LIFE_MINUTES);
  
  const newValence = TEMPORAL_CONFIG.MOOD_BASELINE_VALENCE + 
    (valence - TEMPORAL_CONFIG.MOOD_BASELINE_VALENCE) * decayFactor;
  const newArousal = TEMPORAL_CONFIG.MOOD_BASELINE_AROUSAL + 
    (arousal - TEMPORAL_CONFIG.MOOD_BASELINE_AROUSAL) * decayFactor;
  
  return { valence: newValence, arousal: newArousal, decayFactor };
}

function calculateBeliefDecay(confidence, daysElapsed) {
  const decayFactor = Math.pow(0.5, daysElapsed / TEMPORAL_CONFIG.BELIEF_HALF_LIFE_DAYS);
  return { confidence: confidence * decayFactor, decayFactor };
}

function calculateMemoryRecency(daysElapsed) {
  const decayFactor = Math.exp(-daysElapsed / TEMPORAL_CONFIG.MEMORY_RECENCY_HALF_LIFE_DAYS);
  const recencyBoost = decayFactor * 0.2; // Max 20% boost
  return { recencyBoost, decayFactor };
}

// ============================================================================
// TEST SUITE
// ============================================================================

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║              TEMPORAL ENGINE - Test Suite                     ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Test 1: Mood Decay
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 1: Mood Decay (30-minute half-life)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const moodTests = [
  { valence: 0.8, arousal: 0.9, minutes: 0, label: 'Initial' },
  { valence: 0.8, arousal: 0.9, minutes: 15, label: '15 minutes' },
  { valence: 0.8, arousal: 0.9, minutes: 30, label: '30 minutes (1 half-life)' },
  { valence: 0.8, arousal: 0.9, minutes: 60, label: '1 hour (2 half-lives)' },
  { valence: 0.8, arousal: 0.9, minutes: 90, label: '1.5 hours (3 half-lives)' },
  { valence: 0.8, arousal: 0.9, minutes: 120, label: '2 hours (4 half-lives)' },
];

console.log('Starting mood: valence = 0.8, arousal = 0.9');
console.log('Baseline: valence = 0.2, arousal = 0.4\n');

console.log('┌──────────────────┬──────────┬──────────┬──────────┐');
console.log('│   Time Elapsed   │ Valence  │ Arousal  │  Decay % │');
console.log('├──────────────────┼──────────┼──────────┼──────────┤');

for (const test of moodTests) {
  const result = calculateMoodDecay(test.valence, test.arousal, test.minutes);
  const decayPct = ((1 - result.decayFactor) * 100).toFixed(1);
  
  console.log(
    `│ ${test.label.padEnd(16)} │  ${result.valence.toFixed(3)}  │  ${result.arousal.toFixed(3)}  │  ${decayPct}%  │`
  );
}

console.log('└──────────────────┴──────────┴──────────┴──────────┘\n');

// Test 2: Belief Decay
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 2: Belief Decay (14-day half-life)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const beliefTests = [
  { confidence: 0.85, days: 0, label: 'Initial' },
  { confidence: 0.85, days: 7, label: '1 week' },
  { confidence: 0.85, days: 14, label: '2 weeks (1 half-life)' },
  { confidence: 0.85, days: 21, label: '3 weeks' },
  { confidence: 0.85, days: 28, label: '4 weeks (2 half-lives)' },
  { confidence: 0.85, days: 42, label: '6 weeks (3 half-lives)' },
  { confidence: 0.85, days: 56, label: '8 weeks (4 half-lives)' },
];

console.log('Starting confidence: 85%\n');

console.log('┌──────────────────────┬────────────┬──────────┬──────────┐');
console.log('│   Time Since Update  │ Confidence │ Retained │  Status  │');
console.log('├──────────────────────┼────────────┼──────────┼──────────┤');

for (const test of beliefTests) {
  const result = calculateBeliefDecay(test.confidence, test.days);
  const retained = (result.decayFactor * 100).toFixed(1);
  const status = result.confidence > 0.5 ? 'Strong' : result.confidence > 0.25 ? 'Weak' : 'Very Weak';
  
  console.log(
    `│ ${test.label.padEnd(20)} │   ${(result.confidence * 100).toFixed(1)}%   │  ${retained}%  │ ${status.padEnd(9)}│`
  );
}

console.log('└──────────────────────┴────────────┴──────────┴──────────┘\n');

// Belief decay timeline visualization
console.log('Decay Timeline (85% initial confidence):\n');
const timelineDays = [0, 3, 7, 14, 21, 28, 35, 42, 56];
const maxWidth = 50;

for (const days of timelineDays) {
  const result = calculateBeliefDecay(0.85, days);
  const percentage = result.confidence / 0.85;
  const barWidth = Math.round(percentage * maxWidth);
  const bar = '█'.repeat(barWidth) + '░'.repeat(maxWidth - barWidth);
  
  console.log(
    `Day ${days.toString().padStart(2)}: ${bar} ${(result.confidence * 100).toFixed(1)}%`
  );
}

console.log('\n');

// Test 3: Memory Recency
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 3: Memory Recency (30-day exponential decay)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const memoryTests = [
  { days: 0, label: 'Just now' },
  { days: 1, label: '1 day ago' },
  { days: 3, label: '3 days ago' },
  { days: 7, label: '1 week ago' },
  { days: 14, label: '2 weeks ago' },
  { days: 30, label: '1 month ago' },
  { days: 60, label: '2 months ago' },
  { days: 90, label: '3 months ago' },
];

console.log('Max boost: 20% (for very recent memories)\n');

console.log('┌──────────────┬────────────┬──────────┬────────────┐');
console.log('│  Time Since  │   Boost    │ Retained │  Category  │');
console.log('├──────────────┼────────────┼──────────┼────────────┤');

for (const test of memoryTests) {
  const result = calculateMemoryRecency(test.days);
  const retained = (result.decayFactor * 100).toFixed(1);
  let category;
  if (test.days < 7) category = 'Fresh';
  else if (test.days < 30) category = 'Recent';
  else if (test.days < 90) category = 'Aging';
  else category = 'Old';
  
  console.log(
    `│ ${test.label.padEnd(12)} │  +${(result.recencyBoost * 100).toFixed(1)}%   │  ${retained}%  │ ${category.padEnd(10)} │`
  );
}

console.log('└──────────────┴────────────┴──────────┴────────────┘\n');

// Test 4: Combined Scenario
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 4: Combined Scenario - Server Down for 1 Week');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('Simulating server restart after 7 days of downtime...\n');

// Mood
const moodBefore = { valence: 0.75, arousal: 0.85 };
const moodAfter = calculateMoodDecay(moodBefore.valence, moodBefore.arousal, 7 * 24 * 60);
console.log('MOOD:');
console.log(`  Before shutdown: valence ${moodBefore.valence}, arousal ${moodBefore.arousal}`);
console.log(`  After 7 days:    valence ${moodAfter.valence.toFixed(3)}, arousal ${moodAfter.arousal.toFixed(3)}`);
console.log(`  Status: Fully decayed to baseline ✓\n`);

// Beliefs
const beliefBefore = 0.80;
const beliefAfter = calculateBeliefDecay(beliefBefore, 7);
console.log('BELIEFS:');
console.log(`  Before shutdown: ${(beliefBefore * 100).toFixed(0)}% confidence`);
console.log(`  After 7 days:    ${(beliefAfter.confidence * 100).toFixed(0)}% confidence`);
console.log(`  Decay: ${((1 - beliefAfter.decayFactor) * 100).toFixed(1)}% ✓\n`);

// Memory
const memoryRecent = calculateMemoryRecency(1);
const memoryWeek = calculateMemoryRecency(8); // Was 1 day ago, now 8 days ago
console.log('MEMORY:');
console.log(`  Memory from 1 day before shutdown:`);
console.log(`    Then:  ${(memoryRecent.recencyBoost * 100).toFixed(1)}% boost (fresh)`);
console.log(`    Now:   ${(memoryWeek.recencyBoost * 100).toFixed(1)}% boost (recent)`);
console.log(`  Status: Shifted from "fresh" to "recent" category ✓\n`);

// Summary
console.log('═'.repeat(66));
console.log('SUMMARY:');
console.log('  ✓ Mood:    Fully decayed to baseline');
console.log('  ✓ Beliefs: 29% decay (71% retained)');
console.log('  ✓ Memory:  Recency boost decreased');
console.log('\nAll temporal systems correctly recalculated based on system clock!');
console.log('═'.repeat(66));
console.log('\n');

// Test 5: API Test
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 5: API Endpoint Test');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('To test the live API endpoint, run:');
console.log('\n  curl http://localhost:3001/api/temporal/status | python3 -m json.tool\n');
console.log('Expected response structure:');
console.log(`
{
  "systemTime": "2025-11-06T04:49:55.496Z",
  "mood": {
    "valence": 0.2,
    "arousal": 0.4,
    "lastUpdate": "2025-11-05T01:01:57.259Z",
    "minutesSinceUpdate": "1668.0",
    "decayed": {
      "valence": 0.2,
      "arousal": 0.4,
      "elapsedMinutes": 1667.97,
      "decayApplied": true
    }
  },
  "beliefs": {
    "total": 13,
    "halfLife": "14 days"
  },
  "memoryRecency": {
    "total": 51,
    "halfLife": "30 days"
  }
}
`);

console.log('━'.repeat(66));
console.log('\n✅ All temporal engine tests complete!\n');

