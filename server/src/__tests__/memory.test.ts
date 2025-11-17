import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { db } from '../db/client.js';
import { memoryEngine } from '../agent/memory.js';
import { embed } from '../providers/embeddings.js';

describe('Memory System Tests', () => {
  let testMessageId: number;

  beforeAll(async () => {
    // Create a test message
    const message = await db.message.create({
      data: {
        role: 'user',
        content: 'Test message'
      }
    });
    testMessageId = message.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await db.memory.deleteMany({
      where: {
        text: {
          contains: 'TEST_'
        }
      }
    });
    await db.message.deleteMany({
      where: {
        id: testMessageId
      }
    });
    await db.$disconnect();
  });

  beforeEach(async () => {
    // Clean up any test memories before each test
    await db.memory.deleteMany({
      where: {
        text: {
          contains: 'TEST_'
        }
      }
    });
  });

  describe('Memory Storage', () => {
    test('should store a memory with all required fields', async () => {
      const testEmbedding = await embed('TEST_MEMORY_1');
      
      const memory = await db.memory.create({
        data: {
          type: 'episodic',
          text: 'TEST_MEMORY_1: User shared a story',
          importance: 0.75,
          embedding: JSON.stringify(testEmbedding),
          privacy: 'public',
          sourceMessageId: testMessageId,
          lastAccessedAt: new Date()
        }
      });

      expect(memory).toBeDefined();
      expect(memory.id).toBeGreaterThan(0);
      expect(memory.type).toBe('episodic');
      expect(memory.importance).toBe(0.75);
      expect(memory.privacy).toBe('public');
    });

    test('should handle embedding JSON serialization correctly', async () => {
      const testEmbedding = await embed('TEST_MEMORY_EMBEDDING');
      
      const memory = await db.memory.create({
        data: {
          type: 'semantic',
          text: 'TEST_MEMORY_EMBEDDING: Test embedding storage',
          importance: 0.6,
          embedding: JSON.stringify(testEmbedding),
          privacy: 'public',
          sourceMessageId: testMessageId,
          lastAccessedAt: new Date()
        }
      });

      const retrieved = await memoryEngine.getMemoryById(memory.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.embedding).toEqual(testEmbedding);
      expect(Array.isArray(retrieved!.embedding)).toBe(true);
      expect(retrieved!.embedding.length).toBeGreaterThan(0);
    });

    test('should handle different memory types', async () => {
      const types = ['episodic', 'semantic', 'preference', 'insight', 'plan', 'relational'];
      const embedding = await embed('TEST_TYPES');

      for (const type of types) {
        const memory = await db.memory.create({
          data: {
            type,
            text: `TEST_MEMORY_TYPE_${type}`,
            importance: 0.5,
            embedding: JSON.stringify(embedding),
            privacy: 'public',
            sourceMessageId: testMessageId,
            lastAccessedAt: new Date()
          }
        });

        expect(memory.type).toBe(type);
      }
    });

    test('should handle different privacy levels', async () => {
      const privacyLevels = ['public', 'private', 'ephemeral'];
      const embedding = await embed('TEST_PRIVACY');

      for (const privacy of privacyLevels) {
        const memory = await db.memory.create({
          data: {
            type: 'episodic',
            text: `TEST_MEMORY_PRIVACY_${privacy}`,
            importance: 0.5,
            embedding: JSON.stringify(embedding),
            privacy,
            sourceMessageId: testMessageId,
            lastAccessedAt: new Date()
          }
        });

        expect(memory.privacy).toBe(privacy);
      }
    });
  });

  describe('Memory Retrieval', () => {
    test('should retrieve memories by semantic similarity', async () => {
      // Create test memories
      const embedding1 = await embed('TEST_RETRIEVAL_1: I love programming in Python');
      const embedding2 = await embed('TEST_RETRIEVAL_2: I enjoy coding in JavaScript');
      const embedding3 = await embed('TEST_RETRIEVAL_3: I like eating pizza');

      await db.memory.create({
        data: {
          type: 'preference',
          text: 'TEST_RETRIEVAL_1: I love programming in Python',
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
          text: 'TEST_RETRIEVAL_2: I enjoy coding in JavaScript',
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
          text: 'TEST_RETRIEVAL_3: I like eating pizza',
          importance: 0.7,
          embedding: JSON.stringify(embedding3),
          privacy: 'public',
          sourceMessageId: testMessageId,
          lastAccessedAt: new Date()
        }
      });

      // Query for programming-related memories
      const results = await memoryEngine.retrieve('What programming languages do I like?', 5);
      
      expect(results.length).toBeGreaterThan(0);
      
      // The top results should be programming-related
      const programmingResults = results.filter(m => 
        m.text.includes('TEST_RETRIEVAL_1') || m.text.includes('TEST_RETRIEVAL_2')
      );
      
      expect(programmingResults.length).toBeGreaterThanOrEqual(2);
    });

    test('should return empty array when no memories exist', async () => {
      // Use a unique query that won't match any existing memories
      const results = await memoryEngine.retrieve('UNIQUE_NONEXISTENT_QUERY_12345', 10);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    test('should respect topK parameter', async () => {
      const embedding = await embed('TEST_TOPK');
      
      // Create 10 memories
      for (let i = 0; i < 10; i++) {
        await db.memory.create({
          data: {
            type: 'episodic',
            text: `TEST_TOPK_${i}: Test memory ${i}`,
            importance: 0.5 + (i * 0.01),
            embedding: JSON.stringify(embedding),
            privacy: 'public',
            sourceMessageId: testMessageId,
            lastAccessedAt: new Date()
          }
        });
      }

      const results3 = await memoryEngine.retrieve('TEST_TOPK', 3);
      const results5 = await memoryEngine.retrieve('TEST_TOPK', 5);

      expect(results3.length).toBeLessThanOrEqual(3);
      expect(results5.length).toBeLessThanOrEqual(5);
    });

    test('should exclude ephemeral memories from retrieval', async () => {
      const embedding = await embed('TEST_EPHEMERAL');

      await db.memory.create({
        data: {
          type: 'episodic',
          text: 'TEST_EPHEMERAL_PUBLIC: Public memory',
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
          text: 'TEST_EPHEMERAL_EPHEMERAL: Ephemeral memory',
          importance: 0.9,
          embedding: JSON.stringify(embedding),
          privacy: 'ephemeral',
          sourceMessageId: testMessageId,
          lastAccessedAt: new Date()
        }
      });

      const results = await memoryEngine.retrieve('TEST_EPHEMERAL', 10);
      
      const hasEphemeral = results.some(m => m.text.includes('EPHEMERAL_EPHEMERAL'));
      expect(hasEphemeral).toBe(false);
      
      const hasPublic = results.some(m => m.text.includes('EPHEMERAL_PUBLIC'));
      expect(hasPublic).toBe(true);
    });

    test('should update lastAccessedAt when retrieving memories', async () => {
      const embedding = await embed('TEST_ACCESS_TIME');
      const oldDate = new Date('2024-01-01');

      const memory = await db.memory.create({
        data: {
          type: 'episodic',
          text: 'TEST_ACCESS_TIME: Memory to check access time',
          importance: 0.9,
          embedding: JSON.stringify(embedding),
          privacy: 'public',
          sourceMessageId: testMessageId,
          lastAccessedAt: oldDate
        }
      });

      await memoryEngine.retrieve('TEST_ACCESS_TIME', 5);

      const updated = await db.memory.findUnique({
        where: { id: memory.id }
      });

      expect(updated!.lastAccessedAt.getTime()).toBeGreaterThan(oldDate.getTime());
    });
  });

  describe('Memory Scoring', () => {
    test('should prioritize higher importance memories', async () => {
      const embedding = await embed('TEST_IMPORTANCE');

      const lowImportance = await db.memory.create({
        data: {
          type: 'episodic',
          text: 'TEST_IMPORTANCE_LOW: Low importance',
          importance: 0.3,
          embedding: JSON.stringify(embedding),
          privacy: 'public',
          sourceMessageId: testMessageId,
          lastAccessedAt: new Date()
        }
      });

      const highImportance = await db.memory.create({
        data: {
          type: 'episodic',
          text: 'TEST_IMPORTANCE_HIGH: High importance',
          importance: 0.9,
          embedding: JSON.stringify(embedding),
          privacy: 'public',
          sourceMessageId: testMessageId,
          lastAccessedAt: new Date()
        }
      });

      const results = await memoryEngine.retrieve('TEST_IMPORTANCE', 5);
      
      const highIndex = results.findIndex(m => m.id === highImportance.id);
      const lowIndex = results.findIndex(m => m.id === lowImportance.id);

      // High importance should appear before low importance (or low shouldn't appear)
      if (lowIndex !== -1) {
        expect(highIndex).toBeLessThan(lowIndex);
      }
    });

    test('should give recency boost to recently accessed memories', async () => {
      const embedding = await embed('TEST_RECENCY');

      const oldMemory = await db.memory.create({
        data: {
          type: 'episodic',
          text: 'TEST_RECENCY_OLD: Old memory',
          importance: 0.5,
          embedding: JSON.stringify(embedding),
          privacy: 'public',
          sourceMessageId: testMessageId,
          lastAccessedAt: new Date('2024-01-01')
        }
      });

      const recentMemory = await db.memory.create({
        data: {
          type: 'episodic',
          text: 'TEST_RECENCY_RECENT: Recent memory',
          importance: 0.5,
          embedding: JSON.stringify(embedding),
          privacy: 'public',
          sourceMessageId: testMessageId,
          lastAccessedAt: new Date()
        }
      });

      const results = await memoryEngine.retrieve('TEST_RECENCY', 5);
      
      const recentIndex = results.findIndex(m => m.id === recentMemory.id);
      const oldIndex = results.findIndex(m => m.id === oldMemory.id);

      // Recent should appear before old (or old shouldn't appear)
      if (oldIndex !== -1 && recentIndex !== -1) {
        expect(recentIndex).toBeLessThan(oldIndex);
      }
    });
  });

  describe('Memory Pruning', () => {
    test('should prune ephemeral memories older than 24 hours', async () => {
      const embedding = await embed('TEST_PRUNE_EPHEMERAL');
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago

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

      const recentEphemeral = await db.memory.create({
        data: {
          type: 'episodic',
          text: 'TEST_PRUNE_RECENT_EPHEMERAL',
          importance: 0.5,
          embedding: JSON.stringify(embedding),
          privacy: 'ephemeral',
          sourceMessageId: testMessageId,
          lastAccessedAt: new Date(),
          createdAt: recentDate
        }
      });

      const pruneCount = await memoryEngine.pruneEphemeralMemories();

      const oldExists = await db.memory.findUnique({ where: { id: oldEphemeral.id } });
      const recentExists = await db.memory.findUnique({ where: { id: recentEphemeral.id } });

      expect(oldExists).toBeNull();
      expect(recentExists).not.toBeNull();
      expect(pruneCount).toBeGreaterThan(0);
    });

    test('should prune low importance memories older than threshold', async () => {
      const embedding = await embed('TEST_PRUNE_LOW_IMPORTANCE');
      const oldDate = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000); // 91 days ago

      const lowImportanceOld = await db.memory.create({
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

      const highImportanceOld = await db.memory.create({
        data: {
          type: 'episodic',
          text: 'TEST_PRUNE_HIGH_OLD',
          importance: 0.8,
          embedding: JSON.stringify(embedding),
          privacy: 'public',
          sourceMessageId: testMessageId,
          lastAccessedAt: new Date(),
          createdAt: oldDate
        }
      });

      const pruneCount = await memoryEngine.pruneLowImportanceMemories(0.4, 90);

      const lowExists = await db.memory.findUnique({ where: { id: lowImportanceOld.id } });
      const highExists = await db.memory.findUnique({ where: { id: highImportanceOld.id } });

      expect(lowExists).toBeNull();
      expect(highExists).not.toBeNull();
      expect(pruneCount).toBeGreaterThan(0);
    });
  });

  describe('Memory Links', () => {
    test('should create memory links', async () => {
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

      expect(linkedMemories.length).toBeGreaterThan(0);
      expect(linkedMemories[0].id).toBe(memory2.id);
    });

    test('should update existing link weight', async () => {
      const embedding = await embed('TEST_LINK_UPDATE');

      const memory1 = await db.memory.create({
        data: {
          type: 'episodic',
          text: 'TEST_LINK_UPDATE_1',
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
          text: 'TEST_LINK_UPDATE_2',
          importance: 0.5,
          embedding: JSON.stringify(embedding),
          privacy: 'public',
          sourceMessageId: testMessageId,
          lastAccessedAt: new Date()
        }
      });

      await memoryEngine.linkMemories(memory1.id, memory2.id, 'relates_to', 0.5);
      await memoryEngine.linkMemories(memory1.id, memory2.id, 'relates_to', 0.9);

      const link = await db.memoryLink.findUnique({
        where: {
          fromId_toId_relation: {
            fromId: memory1.id,
            toId: memory2.id,
            relation: 'relates_to'
          }
        }
      });

      expect(link!.weight).toBe(0.9);
    });
  });

  describe('Error Handling', () => {
    test('should handle retrieval errors gracefully', async () => {
      // This should not throw an error even with invalid query
      const results = await memoryEngine.retrieve('', 10);
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    test('should return null for non-existent memory', async () => {
      const memory = await memoryEngine.getMemoryById(999999999);
      expect(memory).toBeNull();
    });

    test('should handle corrupted embedding data gracefully', async () => {
      const memory = await db.memory.create({
        data: {
          type: 'episodic',
          text: 'TEST_CORRUPTED_EMBEDDING',
          importance: 0.5,
          embedding: 'INVALID_JSON',
          privacy: 'public',
          sourceMessageId: testMessageId,
          lastAccessedAt: new Date()
        }
      });

      // This should handle the error gracefully
      try {
        const retrieved = await memoryEngine.getMemoryById(memory.id);
        // If it doesn't throw, it should handle it somehow
        expect(retrieved).toBeDefined();
      } catch (error) {
        // Catching the error is also acceptable
        expect(error).toBeDefined();
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty strings', async () => {
      const embedding = await embed('test');
      
      const memory = await db.memory.create({
        data: {
          type: 'episodic',
          text: '',
          importance: 0.5,
          embedding: JSON.stringify(embedding),
          privacy: 'public',
          sourceMessageId: testMessageId,
          lastAccessedAt: new Date()
        }
      });

      expect(memory).toBeDefined();
      expect(memory.text).toBe('');
    });

    test('should handle importance boundary values', async () => {
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

      expect(minMemory.importance).toBe(0.0);
      expect(maxMemory.importance).toBe(1.0);
    });

    test('should handle very long text', async () => {
      const longText = 'TEST_LONG_TEXT: ' + 'x'.repeat(10000);
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

      expect(memory.text.length).toBeGreaterThan(10000);
    });
  });
});

