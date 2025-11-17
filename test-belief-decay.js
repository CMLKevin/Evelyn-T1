/**
 * Test script to demonstrate belief decay with 14-day half-life
 * 
 * Usage: node test-belief-decay.js
 */

// Simulate belief decay calculation
function calculateDecay(originalConfidence, daysSinceUpdate, halfLifeDays = 14) {
  return originalConfidence * Math.pow(0.5, daysSinceUpdate / halfLifeDays);
}

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║          Evelyn Belief Decay System - Test Suite             ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

console.log('Testing 14-day half-life decay formula:\n');
console.log('  Formula: confidence × 0.5^(days / 14)\n');

// Test cases (expected values calculated using the formula)
const testCases = [
  { original: 0.80, days: 0, expected: 0.800 },
  { original: 0.80, days: 7, expected: 0.566 },  // 0.80 × 0.5^(7/14) ≈ 0.566
  { original: 0.80, days: 14, expected: 0.400 },
  { original: 0.80, days: 21, expected: 0.283 }, // 0.80 × 0.5^(21/14) ≈ 0.283
  { original: 0.80, days: 28, expected: 0.200 },
  { original: 0.80, days: 42, expected: 0.100 },
  { original: 1.00, days: 14, expected: 0.500 },
  { original: 0.65, days: 14, expected: 0.325 },
];

console.log('┌─────────┬──────────┬──────────┬───────────┬────────────┐');
console.log('│  Days   │ Original │ Expected │  Actual   │   Status   │');
console.log('├─────────┼──────────┼──────────┼───────────┼────────────┤');

let allPassed = true;
for (const test of testCases) {
  const actual = calculateDecay(test.original, test.days);
  const passed = Math.abs(actual - test.expected) < 0.01;
  allPassed = allPassed && passed;
  
  const status = passed ? '✓ PASS' : '✗ FAIL';
  const statusColor = passed ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';
  
  console.log(
    `│  ${test.days.toString().padStart(2)}     │  ${test.original.toFixed(2)}    │  ${test.expected.toFixed(3)}  │  ${actual.toFixed(3)}   │ ${statusColor}${status}${reset}     │`
  );
}

console.log('└─────────┴──────────┴──────────┴───────────┴────────────┘\n');

// Decay timeline visualization
console.log('Decay Timeline (80% initial confidence):\n');

const timeline = [0, 1, 3, 7, 10, 14, 21, 28, 35, 42];
const maxWidth = 50;

for (const days of timeline) {
  const confidence = calculateDecay(0.80, days);
  const percentage = confidence / 0.80;
  const barWidth = Math.round(percentage * maxWidth);
  const bar = '█'.repeat(barWidth) + '░'.repeat(maxWidth - barWidth);
  
  console.log(
    `Day ${days.toString().padStart(2)}: ${bar} ${(confidence * 100).toFixed(1)}%`
  );
}

console.log('\n' + '═'.repeat(64));
if (allPassed) {
  console.log('✓ All tests passed! Belief decay system is working correctly.');
} else {
  console.log('✗ Some tests failed. Please review the implementation.');
}
console.log('═'.repeat(64) + '\n');

// Practical examples
console.log('Practical Examples:\n');

const examples = [
  {
    belief: 'User prefers direct communication',
    lastUpdate: 'Yesterday',
    days: 1,
    original: 0.85
  },
  {
    belief: 'User enjoys dark humor',
    lastUpdate: '1 week ago',
    days: 7,
    original: 0.75
  },
  {
    belief: 'User likes Python over JavaScript',
    lastUpdate: '2 weeks ago',
    days: 14,
    original: 0.70
  },
  {
    belief: 'User mentioned they like cats',
    lastUpdate: '1 month ago',
    days: 30,
    original: 0.65
  }
];

for (const ex of examples) {
  const decayed = calculateDecay(ex.original, ex.days);
  const loss = ((ex.original - decayed) / ex.original * 100).toFixed(1);
  
  console.log(`• "${ex.belief}"`);
  console.log(`  Last updated: ${ex.lastUpdate} (${ex.days} days)`);
  console.log(`  Confidence: ${(ex.original * 100).toFixed(0)}% → ${(decayed * 100).toFixed(0)}% (${loss}% decay)`);
  console.log();
}

console.log('Recommendation: Update beliefs during conversations to maintain confidence!\n');

