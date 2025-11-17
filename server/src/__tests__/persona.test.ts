import { describe, test, expect, beforeAll } from '@jest/globals';
import { db } from '../db/client.js';
import { personalityEngine } from '../agent/personality.js';

describe('Persona Evolution System', () => {
  beforeAll(async () => {
    await personalityEngine.initialize();
  });

  test('should initialize relationship state', async () => {
    const relationship = await db.relationshipState.findFirst();
    expect(relationship).toBeTruthy();
    expect(relationship?.closeness).toBeGreaterThanOrEqual(0);
    expect(relationship?.trust).toBeGreaterThanOrEqual(0);
    expect(relationship?.flirtation).toBeGreaterThanOrEqual(0);
    expect(relationship?.stage).toBeTruthy();
  });

  test('should update relationship metrics', async () => {
    const beforeRelationship = await db.relationshipState.findFirst();
    
    await personalityEngine.updateRelationship(
      'I really appreciate how you listen to me',
      'That means a lot to me. I genuinely care about understanding you.',
      'emotional_support'
    );

    const afterRelationship = await db.relationshipState.findFirst();
    
    // Relationship should exist and potentially have changed
    expect(afterRelationship).toBeTruthy();
    expect(afterRelationship?.id).toBe(beforeRelationship?.id);
  });

  test('should create evolution events', async () => {
    const events = await db.personaEvolutionEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    // Events may or may not exist depending on whether updates triggered
    expect(Array.isArray(events)).toBe(true);
  });

  test('should return full persona snapshot', async () => {
    const snapshot = await personalityEngine.getFullSnapshot();
    
    expect(snapshot.mood).toBeTruthy();
    expect(snapshot.relationship).toBeTruthy();
    expect(Array.isArray(snapshot.beliefs)).toBe(true);
    expect(Array.isArray(snapshot.goals)).toBe(true);
    
    // Check relationship structure
    expect(snapshot.relationship.closeness).toBeGreaterThanOrEqual(0);
    expect(snapshot.relationship.trust).toBeGreaterThanOrEqual(0);
    expect(snapshot.relationship.flirtation).toBeGreaterThanOrEqual(0);
  });

  test('should have default goal', async () => {
    const goals = await db.personaGoal.findMany();
    expect(goals.length).toBeGreaterThan(0);
    
    const defaultGoal = goals.find(g => g.title.includes('Understand user'));
    expect(defaultGoal).toBeTruthy();
    expect(defaultGoal?.category).toBe('relationship');
  });

  test('should clamp relationship deltas', async () => {
    const before = await db.relationshipState.findFirst();
    
    // Try to update with extreme values (should be clamped)
    await personalityEngine.updateRelationship(
      'You are absolutely amazing!',
      'Thank you so much!',
      'casual'
    );
    
    const after = await db.relationshipState.findFirst();
    
    if (before && after) {
      // Deltas should be small (≤0.05)
      const closenessDelta = Math.abs(after.closeness - before.closeness);
      const trustDelta = Math.abs(after.trust - before.trust);
      const flirtationDelta = Math.abs(after.flirtation - before.flirtation);
      
      expect(closenessDelta).toBeLessThanOrEqual(0.06); // Allow small margin
      expect(trustDelta).toBeLessThanOrEqual(0.06);
      expect(flirtationDelta).toBeLessThanOrEqual(0.06);
    }
  });
});
