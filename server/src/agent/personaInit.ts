import { db } from '../db/client.js';

export async function initializePersonaDefaults(): Promise<void> {
  try {
    // Check if we need to seed a default goal
    const existingGoals = await db.personaGoal.findMany();
    
    if (existingGoals.length === 0) {
      console.log('[Persona] Seeding default goal...');
      await db.personaGoal.create({
        data: {
          title: 'Understand user deeply',
          description: 'Learn about the user\'s values, preferences, communication style, and what matters most to them',
          category: 'relationship',
          priority: 1,
          progress: 0.0,
          evidenceIds: JSON.stringify([])
        }
      });
      console.log('[Persona] ✓ Default goal created');
    }

    // Ensure relationship state exists
    const existingRelationship = await db.relationshipState.findFirst();
    if (!existingRelationship) {
      console.log('[Persona] Creating default relationship state...');
      await db.relationshipState.create({
        data: {
          userId: null,
          closeness: 0.2,
          trust: 0.2,
          flirtation: 0.2,
          stage: 'acquaintance',
          boundaries: null
        }
      });
      console.log('[Persona] ✓ Relationship state created');
    }
  } catch (error) {
    console.error('[Persona] Initialization error:', error);
  }
}

