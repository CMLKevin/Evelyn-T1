#!/usr/bin/env tsx
/**
 * Manual Memory System Test Suite
 * Run with: npx tsx server/src/__tests__/memory-manual-test.ts
 */

import { db } from '../db/client.js';
import { memoryEngine } from '../agent/memory.js';
import { embed } from '../providers/embeddings.js';

// Test utilities
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
  }
}

function assertGreaterThan(actual: number, expected: number, message: string) {
  if (actual <= expected) {
    throw new Error(`${message}\nExpected > ${expected}\nActual: ${actual}`);
  }
}

function assertNotNull(value: any, message: string) {
  if (value === null || value === undefined) {
    throw new Error(`${message}\nValue was ${value}`);
  }
}

async function test(name: string, fn: () => Promise<void>) {
  testsRun++;
  try {
    console.log(`\n🧪 Running: ${name}`);
    await fn();
    testsPassed++;
    console.log(`✅ PASS: ${name}`);
  } catch (error) {
    testsFailed++;
    console.error(`❌ FAIL: ${name}`);
    console.error(error);
  }
}

// Test setup
let testMessageId: number;

async function setup() {
  console.log('\n🔧 Setting up test environment...');
  
  // Create test message
  const message = await db.message.create({
    data: {
      role: 'user',
      content: 'Test message for memory tests'
    }
  });
  testMessageId = message.id;
  
  // Clean up any existing test memories
  await db.memory.deleteMany({
    where: {
      text: {
        contains: 'TEST_'
      }
    }
  });
  
  console.log('✅ Setup complete');
}

async function cleanup() {
  console.log('\n🧹 Cleaning up...');
  
  await db.memory.deleteMany({
    where: {
      text: {
        contains: 'TEST_'
      }
    }
  });
  
  await db.message.delete({
    where: { id: testMessageId }
  }).catch(() => {});
  
  await db.$disconnect();
  
  console.log('✅ Cleanup complete');
}

// Test Suite
async function runTests() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   MEMORY SYSTEM - COMPREHENSIVE TEST');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  await setup();
  
  // ===== STORAGE TESTS =====
  console.log('\n📦 STORAGE TESTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  await test('Store memory with all fields', async () => {
    const embedding = await embed('TEST_STORAGE_1');
    
    const memory = await db.memory.create({
      data: {
        type: 'episodic',
        text: 'TEST_STORAGE_1: User shared a story',
        importance: 0.75,
        embedding: JSON.stringify(embedding),
        privacy: 'public',
        sourceMessageId: testMessageId,
        lastAccessedAt: new Date()
      }
    });
    
    assertNotNull(memory, 'Memory should be created');
    assertGreaterThan(memory.id, 0, 'Memory ID should be positive');
    assertEqual(memory.type, 'episodic', 'Memory type should match');
    assertEqual(memory.importance, 0.75, 'Memory importance should match');
  });
  
  await test('Handle different memory types', async () => {
    const types = ['episodic', 'semantic', 'preference', 'insight', 'plan', 'relational'];
    const embedding = await embed('TEST_TYPES');
    
    for (const type of types) {
      const memory = await db.memory.create({
        data: {
          type,
          text: `TEST_TYPE_${type}`,
          importance: 0.5,
          embedding: JSON.stringify(embedding),
          privacy: 'public',
          sourceMessageId: testMessageId,
          lastAccessedAt: new Date()
        }
      });
      
      assertEqual(memory.type, type, `Memory type should be ${type}`);
    }
  });
  
  await test('Handle different privacy levels', async () => {
    const privacyLevels = ['public', 'private', 'ephemeral'];
    const embedding = await embed('TEST_PRIVACY');
    
    for (const privacy of privacyLevels) {
      const memory = await db.memory.create({
        data: {
          type: 'episodic',
          text: `TEST_PRIVACY_${privacy}`,
          importance: 0.5,
          embedding: JSON.stringify(embedding),
          privacy,
          sourceMessageId: testMessageId,
          lastAccessedAt: new Date()
        }
      });
      
      assertEqual(memory.privacy, privacy, `Privacy should be ${privacy}`);
    }
  });
  
  // ===== RETRIEVAL TESTS =====
  console.log('\n🔍 RETRIEVAL TESTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  await test('Retrieve memories by semantic similarity', async () => {
    const embedding1 = await embed('TEST_RETRIEVAL_1: I love programming');
    const embedding2 = await embed('TEST_RETRIEVAL_2: I enjoy coding');
    const embedding3 = await embed('TEST_RETRIEVAL_3: I like pizza');
    
    await db.memory.create({
      data: {
        type: 'preference',
        text: 'TEST_RETRIEVAL_1: I love programming',
        importance: 0.7,
        embedding: JSON.stringify(embedding1),
        privacy: 'public',
        sourceMessageId: testMessageId,
        lastAccessedAt: new Date()
      }
    });
    
    await db.memory.create({
      data: {
        type: 'preference',
        text: 'TEST_RETRIEVAL_2: I enjoy coding',
        importance: 0.7,
        embedding: JSON.stringify(embedding2),
        privacy: 'public',
        sourceMessageId: testMessageId,
        lastAccessedAt: new Date()
      }
    });
    
    await db.memory.create({
      data: {
        type: 'preference',
        text: 'TEST_RETRIEVAL_3: I like pizza',
        importance: 0.7,
        embedding: JSON.stringify(embedding3),
        privacy: 'public',
        sourceMessageId: testMessageId,
        lastAccessedAt: new Date()
      }
    });
    
    const results = await memoryEngine.retrieve('Tell me about programming', 5);
    
    assertGreaterThan(results.length, 0, 'Should retrieve memories');
    
    // Check if programming-related memories are retrieved
    const hasRelevant = results.some(m => 
      m.text.includes('programming') || m.text.includes('coding')
    );
    
    assert(hasRelevant, 'Should retrieve programming-related memories');
  });
  
  await test('Respect topK parameter', async () => {
    const embedding = await embed('TEST_TOPK');
    
    // Create 5 memories
    for (let i = 0; i < 5; i++) {
      await db.memory.create({
        data: {
          type: 'episodic',
          text: `TEST_TOPK_${i}`,
          importance: 0.5,
          embedding: JSON.stringify(embedding),
          privacy: 'public',
          sourceMessageId: testMessageId,
          lastAccessedAt: new Date()
        }
      });
    }
    
    const results2 = await memoryEngine.retrieve('TEST_TOPK', 2);
    const results4 = await memoryEngine.retrieve('TEST_TOPK', 4);
    
    assert(results2.length <= 2, 'Should respect topK=2');
    assert(results4.length <= 4, 'Should respect topK=4');
  });
  
  await test('Exclude ephemeral memories', async () => {
    const embedding = await embed('TEST_EPHEMERAL');
    
    await db.memory.create({
      data: {
        type: 'episodic',
        text: 'TEST_EPHEMERAL_PUBLIC',
        importance: 0.8,
        embedding: JSON.stringify(embedding),
        privacy: 'public',
        sourceMessageId: testMessageId,
        lastAccessedAt: new Date()
      }
    });
    
    await db.memory.create({
      data: {
        type: 'episodic',
        text: 'TEST_EPHEMERAL_TEMP',
        importance: 0.9,
        embedding: JSON.stringify(embedding),
        privacy: 'ephemeral',
        sourceMessageId: testMessageId,
        lastAccessedAt: new Date()
      }
    });
    
    const results = await memoryEngine.retrieve('TEST_EPHEMERAL', 10);
    
    const hasEphemeral = results.some(m => m.text.includes('EPHEMERAL_TEMP'));
    const hasPublic = results.some(m => m.text.includes('EPHEMERAL_PUBLIC'));
    
    assert(!hasEphemeral, 'Should not retrieve ephemeral memories');
    assert(hasPublic, 'Should retrieve public memories');
  });
  
  await test('Update lastAccessedAt on retrieval', async () => {
    const embedding = await embed('TEST_ACCESS');
    const oldDate = new Date('2024-01-01');
    
    const memory = await db.memory.create({
      data: {
        type: 'episodic',
        text: 'TEST_ACCESS_TIME',
        importance: 0.9,
        embedding: JSON.stringify(embedding),
        privacy: 'public',
        sourceMessageId: testMessageId,
        lastAccessedAt: oldDate
      }
    });
    
    await memoryEngine.retrieve('TEST_ACCESS', 5);
    
    const updated = await db.memory.findUnique({ where: { id: memory.id } });
    
    assertGreaterThan(
      updated!.lastAccessedAt.getTime(), 
      oldDate.getTime(), 
      'lastAccessedAt should be updated'
    );
  });
  
  // ===== PRUNING TESTS =====
  console.log('\n🗑️  PRUNING TESTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  await test('Prune old ephemeral memories', async () => {
    const embedding = await embed('TEST_PRUNE');
    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
    
    const oldEphemeral = await db.memory.create({
      data: {
        type: 'episodic',
        text: 'TEST_PRUNE_OLD_EPHEMERAL',
        importance: 0.5,
        embedding: JSON.stringify(embedding),
        privacy: 'ephemeral',
        sourceMessageId: testMessageId,
        lastAccessedAt: new Date(),
        createdAt: oldDate
      }
    });
    
    const pruned = await memoryEngine.pruneEphemeralMemories();
    
    assertGreaterThan(pruned, 0, 'Should prune at least one memory');
    
    const stillExists = await db.memory.findUnique({ 
      where: { id: oldEphemeral.id } 
    });
    
    assertEqual(stillExists, null, 'Old ephemeral memory should be deleted');
  });
  
  await test('Prune low importance old memories', async () => {
    const embedding = await embed('TEST_PRUNE_LOW');
    const oldDate = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000); // 91 days
    
    const lowImportance = await db.memory.create({
      data: {
        type: 'episodic',
        text: 'TEST_PRUNE_LOW_OLD',
        importance: 0.3,
        embedding: JSON.stringify(embedding),
        privacy: 'public',
        sourceMessageId: testMessageId,
        lastAccessedAt: new Date(),
        createdAt: oldDate
      }
    });
    
    const pruned = await memoryEngine.pruneLowImportanceMemories(0.4, 90);
    
    assertGreaterThan(pruned, 0, 'Should prune at least one memory');
    
    const stillExists = await db.memory.findUnique({ 
      where: { id: lowImportance.id } 
    });
    
    assertEqual(stillExists, null, 'Low importance old memory should be deleted');
  });
  
  // ===== MEMORY LINKS TESTS =====
  console.log('\n🔗 MEMORY LINKS TESTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  await test('Create memory links', async () => {
    const embedding = await embed('TEST_LINKS');
    
    const memory1 = await db.memory.create({
      data: {
        type: 'episodic',
        text: 'TEST_LINK_1',
        importance: 0.5,
        embedding: JSON.stringify(embedding),
        privacy: 'public',
        sourceMessageId: testMessageId,
        lastAccessedAt: new Date()
      }
    });
    
    const memory2 = await db.memory.create({
      data: {
        type: 'episodic',
        text: 'TEST_LINK_2',
        importance: 0.5,
        embedding: JSON.stringify(embedding),
        privacy: 'public',
        sourceMessageId: testMessageId,
        lastAccessedAt: new Date()
      }
    });
    
    await memoryEngine.linkMemories(memory1.id, memory2.id, 'relates_to', 0.8);
    
    const linkedMemories = await memoryEngine.getLinkedMemories(memory1.id);
    
    assertGreaterThan(linkedMemories.length, 0, 'Should have linked memories');
    assertEqual(linkedMemories[0].id, memory2.id, 'Should link to correct memory');
  });
  
  // ===== ERROR HANDLING TESTS =====
  console.log('\n⚠️  ERROR HANDLING TESTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  await test('Handle empty query gracefully', async () => {
    const results = await memoryEngine.retrieve('', 10);
    assertNotNull(results, 'Should return results even with empty query');
    assert(Array.isArray(results), 'Should return an array');
  });
  
  await test('Return null for non-existent memory', async () => {
    const memory = await memoryEngine.getMemoryById(999999999);
    assertEqual(memory, null, 'Should return null for non-existent memory');
  });
  
  await test('Handle corrupted embedding data', async () => {
    const memory = await db.memory.create({
      data: {
        type: 'episodic',
        text: 'TEST_CORRUPTED',
        importance: 0.5,
        embedding: 'INVALID_JSON',
        privacy: 'public',
        sourceMessageId: testMessageId,
        lastAccessedAt: new Date()
      }
    });
    
    // Should handle error gracefully
    const retrieved = await memoryEngine.getMemoryById(memory.id);
    // Either returns null or handles the error
    assert(retrieved === null || retrieved !== undefined, 'Should handle corrupted data');
  });
  
  // ===== EDGE CASES =====
  console.log('\n🎯 EDGE CASE TESTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  await test('Handle boundary importance values', async () => {
    const embedding = await embed('TEST_BOUNDARIES');
    
    const minMemory = await db.memory.create({
      data: {
        type: 'episodic',
        text: 'TEST_MIN_IMPORTANCE',
        importance: 0.0,
        embedding: JSON.stringify(embedding),
        privacy: 'public',
        sourceMessageId: testMessageId,
        lastAccessedAt: new Date()
      }
    });
    
    const maxMemory = await db.memory.create({
      data: {
        type: 'episodic',
        text: 'TEST_MAX_IMPORTANCE',
        importance: 1.0,
        embedding: JSON.stringify(embedding),
        privacy: 'public',
        sourceMessageId: testMessageId,
        lastAccessedAt: new Date()
      }
    });
    
    assertEqual(minMemory.importance, 0.0, 'Should handle min importance');
    assertEqual(maxMemory.importance, 1.0, 'Should handle max importance');
  });
  
  await test('Handle very long text', async () => {
    const longText = 'TEST_LONG: ' + 'x'.repeat(5000);
    const embedding = await embed(longText.slice(0, 100));
    
    const memory = await db.memory.create({
      data: {
        type: 'episodic',
        text: longText,
        importance: 0.5,
        embedding: JSON.stringify(embedding),
        privacy: 'public',
        sourceMessageId: testMessageId,
        lastAccessedAt: new Date()
      }
    });
    
    assertGreaterThan(memory.text.length, 5000, 'Should store long text');
  });
  
  await cleanup();
  
  // Print summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           TEST SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total Tests:  ${testsRun}`);
  console.log(`✅ Passed:     ${testsPassed}`);
  console.log(`❌ Failed:     ${testsFailed}`);
  console.log(`Success Rate: ${((testsPassed / testsRun) * 100).toFixed(1)}%`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (testsFailed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});

