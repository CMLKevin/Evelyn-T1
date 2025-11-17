import { db } from '../db/client.js';
import { embed } from '../providers/embeddings.js';
import { openRouterClient } from '../providers/openrouter.js';
import { cosineSimilarity } from '../utils/similarity.js';
import temporalEngine from '../core/temporalEngine.js';
import crypto from 'crypto';

interface Memory {
  id: number;
  type: string;
  text: string;
  importance: number;
  embedding: number[];
  embeddingDimension: number;
  embeddingModel: string;
  privacy: string;
  conversationTurnId: string | null;
  contextTags: string;
  summary: string | null;
  accessFrequency: number;
  avgRelevance: number;
  isEvergreen: boolean;
  lastAccessedAt: Date;
  sourceMessageId: number | null;
  createdAt: Date;
}

interface MemoryClassification {
  importance: number;
  type: 'episodic' | 'semantic' | 'preference' | 'insight' | 'plan' | 'relational';
  rationale: string;
  privacy: 'public' | 'private' | 'ephemeral';
}

const MEMORY_CLASSIFICATION_PROMPT = `You are analyzing a conversation between a user and Evelyn (an AI) to decide if anything should be remembered long-term.

Task: Determine if a memory should be stored from this exchange.

Guidelines for importance scoring (0.0 to 1.0):
- **High importance (0.7-1.0):** Deeply personal revelations, major life events, explicit commitments, core beliefs/values, significant relationship moments
- **Medium importance (0.4-0.7):** Personal facts, preferences, meaningful stories, plans, emotional expressions, insights about the user
- **Low importance (0.0-0.4):** Casual chat, simple acknowledgments, generic opinions, everyday small talk

Specific criteria:
- Vulnerability or deep emotional sharing: +0.3 to +0.5
- Novel facts about user's life, identity, background: +0.3
- Explicit "remember this" or future reference: +0.4
- Commitments, promises, or plans: +0.3 to +0.4
- Strong preferences or values: +0.2 to +0.3
- Relationship-defining moments: +0.3 to +0.5
- Rare facts, milestones, achievements: +0.3
- Insight or realization about the user: +0.2 to +0.4

Memory types:
- **episodic**: Specific events, stories, experiences the user shared
- **semantic**: Facts, knowledge, information about the user or their world
- **preference**: Likes, dislikes, opinions, tastes
- **insight**: Deeper understanding about who the user is, their patterns, motivations
- **plan**: Future intentions, commitments, goals
- **relational**: Relationship dynamics, boundaries, connection moments
- **coding_preference**: Programming language preferences, coding style, patterns, frameworks
- **project_context**: Active coding projects, their status, architecture decisions
- **collaboration_history**: Past coding sessions with Evelyn, outcomes, lessons learned

Privacy levels:
- **public**: General, non-sensitive information
- **private**: Personal, sensitive information
- **ephemeral**: Very temporary, not worth long-term storage (casual banter, simple acknowledgments)

IMPORTANT: Be selective. Casual greetings, simple reactions ("lol", "ok", "thanks"), and surface-level chat should be marked ephemeral or have importance < 0.4.

Respond ONLY with JSON:
{
  "importance": 0.75,
  "type": "relational",
  "rationale": "User shared vulnerable moment about family - meaningful relationship depth",
  "privacy": "private"
}

User message: """
{{USER}}
"""

Evelyn's response: """
{{ASSISTANT}}
"""`;

class MemoryEngine {
  async retrieve(query: string, topK: number = 30): Promise<Memory[]> {
    try {
      // Validate inputs
      if (!query || query.trim().length === 0) {
        console.warn('[Memory] Empty query provided, returning empty array');
        return [];
      }
      
      if (topK <= 0 || !Number.isInteger(topK)) {
        console.warn(`[Memory] Invalid topK value: ${topK}, using default 30`);
        topK = 30;
      }
      
      console.log(`[Memory] Retrieving memories for query: "${query.slice(0, 50)}..."`);
      
      // Embed query
      console.log('[Memory] Generating embedding...');
      let queryEmbedding: number[];
      try {
        queryEmbedding = await embed(query);
        console.log('[Memory] Embedding generated, dimension:', queryEmbedding.length);
      } catch (embedError) {
        console.error('[Memory] Failed to generate query embedding, returning empty results');
        console.error('[Memory] Embedding service may be unavailable');
        return [];
      }

    // Get candidate memories (top by importance first)
    // Increased from 800 to 2000 for better coverage
    const candidates = await db.memory.findMany({
      where: {
        privacy: { not: 'ephemeral' }
      },
      orderBy: [
        { importance: 'desc' }
      ],
      take: 2000
    });

      console.log(`[Memory] Found ${candidates.length} candidate memories`);

      if (candidates.length === 0) {
        console.log('[Memory] No memories found, returning empty array');
        return [];
      }

      // Score by cosine similarity * blended importance
      const scored = candidates.map((m: any) => {
        try {
          const embedding = JSON.parse(m.embedding) as number[];
          
          // Validate embedding dimension matches query
          if (embedding.length !== queryEmbedding.length) {
            console.warn(`[Memory] Dimension mismatch for memory ${m.id}: expected ${queryEmbedding.length}, got ${embedding.length}`);
            return null;
          }
          
          const similarity = cosineSimilarity(queryEmbedding, embedding);
          
          // Recency boost (decay over 30 days) - using centralized temporal engine
          const recencyResult = temporalEngine.calculateMemoryRecency(m.lastAccessedAt);
          const recencyBoost = recencyResult.recencyBoost;

          // Validate importance is in valid range
          const normalizedImportance = Math.max(0, Math.min(1, m.importance));

          // Evergreen boost - critical memories get +0.3 to ensure they surface
          const evergreenBoost = m.isEvergreen ? 0.3 : 0;

          const score = similarity * (0.6 + 0.4 * normalizedImportance) + recencyBoost + evergreenBoost;

          return { m, score, embedding };
        } catch (parseError) {
          console.error(`[Memory] Error parsing embedding for memory ${m.id}:`, parseError);
          return null;
        }
      }).filter((item: any) => item !== null);

      // Sort and take top K
      scored.sort((a: any, b: any) => b.score - a.score);
      const topMemories = scored.slice(0, topK).map((x: any) => ({
        ...x.m,
        embedding: x.embedding
      }));

      // Update last accessed time and access frequency
      const now = new Date();
      const ids = topMemories.map((m: Memory) => m.id);
      if (ids.length > 0) {
        // Update in batches for better performance
        for (const id of ids) {
          const memory = topMemories.find(m => m.id === id);
          if (memory) {
            await db.memory.update({
              where: { id },
              data: {
                lastAccessedAt: now,
                accessFrequency: { increment: 1 }
              }
            });
          }
        }
      }

      console.log(`[Memory] Returning ${topMemories.length} memories`);
      return topMemories;
    } catch (error) {
      console.error('[Memory] Error in retrieve:', error);
      return [];
    }
  }

  /**
   * Queue a memory for later processing when embedding service is unavailable
   */
  private async queuePendingMemory(
    userMessage: string,
    assistantMessage: string,
    sourceMessageId: number,
    privacy: string,
    thoughtGuidance?: any
  ): Promise<void> {
    try {
      await db.pendingMemory.create({
        data: {
          userMessage,
          assistantMessage,
          sourceMessageId,
          privacy,
          retryCount: 0,
          status: 'pending',
          thoughtGuidance: thoughtGuidance ? JSON.stringify(thoughtGuidance) : null,
          nextRetryAt: new Date(Date.now() + 5 * 60 * 1000) // Retry in 5 minutes
        }
      });
      console.log(`[Memory] Queued pending memory for message #${sourceMessageId}`);
    } catch (error) {
      console.error('[Memory] Failed to queue pending memory:', error);
    }
  }

  async classifyAndStore(
    userMessage: string,
    assistantMessage: string,
    sourceMessageId: number,
    privacyOverride?: string,
    thoughtGuidance?: {
      shouldStore: boolean;
      importanceModifier: number;
      additionalContext: string;
    }
  ): Promise<Memory | null> {
    // Validate inputs
    if (!userMessage || !assistantMessage || !sourceMessageId) {
      console.warn('[Memory] Invalid inputs for classifyAndStore, skipping');
      return null;
    }
    
    // Check if memory already exists for this source message
    try {
      const existingMemory = await db.memory.findFirst({
        where: { sourceMessageId }
      });
      
      if (existingMemory) {
        console.log(`[Memory] Memory already exists for message #${sourceMessageId}, skipping duplicate`);
        return null;
      }
    } catch (error) {
      console.error('[Memory] Error checking for existing memory:', error);
      // Continue anyway - better to risk duplicate than skip important memory
    }
    
    // Classify with Gemini Flash
    const prompt = MEMORY_CLASSIFICATION_PROMPT
      .replace('{{USER}}', userMessage)
      .replace('{{ASSISTANT}}', assistantMessage);

    try {
      const response = await openRouterClient.simpleThought(prompt);
      
      // Parse JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[Memory] No JSON in classification response');
        return null;
      }

      let classification: MemoryClassification;
      try {
        classification = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('[Memory] Failed to parse classification JSON:', parseError);
        console.error('[Memory] JSON content:', jsonMatch[0].slice(0, 200));
        return null;
      }

      // Validate classification structure
      if (typeof classification.importance !== 'number' || 
          !classification.type || 
          !classification.privacy) {
        console.warn('[Memory] Invalid classification structure:', classification);
        return null;
      }

      // Apply heuristic adjustments
      let importance = classification.importance;

      // Strong boost for explicit memory requests
      if (userMessage.toLowerCase().includes('remember this') || userMessage.toLowerCase().includes('don\'t forget')) {
        importance = Math.min(1.0, importance + 0.25);
      } else if (userMessage.toLowerCase().includes('remember')) {
        importance = Math.min(1.0, importance + 0.15);
      }

      // Boost for strong commitments
      if (userMessage.toLowerCase().includes('promise') || userMessage.toLowerCase().includes('i will')) {
        importance = Math.min(1.0, importance + 0.2);
      }

      // Penalty for very short exchanges (likely casual)
      if (userMessage.length < 30 && assistantMessage.length < 50) {
        importance *= 0.7;
      }

      // Apply inner thought guidance if provided
      if (thoughtGuidance) {
        console.log(`[Memory] Applying thought guidance: shouldStore=${thoughtGuidance.shouldStore}, modifier=${thoughtGuidance.importanceModifier}`);
        
        // If thought says not to store and importance is below high threshold, skip
        if (!thoughtGuidance.shouldStore && importance < 0.65) {
          console.log(`[Memory] Inner thought suggests not storing (importance: ${importance.toFixed(2)})`);
          return null;
        }
        
        // Apply importance modifier from inner thought
        importance += thoughtGuidance.importanceModifier;
        importance = Math.max(0, Math.min(1, importance));
        
        console.log(`[Memory] Importance adjusted to ${importance.toFixed(2)} based on inner thought`);
      }

      if (importance < 0.30) {
        console.log(`[Memory] Importance ${importance.toFixed(2)} below threshold (0.30), skipping storage`);
        return null;
      }

      // Skip ephemeral privacy unless importance is very high
      if (classification.privacy === 'ephemeral' && importance < 0.6) {
        console.log(`[Memory] Marked ephemeral with low importance (${importance.toFixed(2)}), skipping`);
        return null;
      }

      // Create memory text with optional thought context
      let memoryText = `User: ${userMessage}\nEvelyn: ${assistantMessage}`;
      
      // Enhance memory text with thought context if provided
      if (thoughtGuidance && thoughtGuidance.additionalContext) {
        memoryText += `\n[Context: ${thoughtGuidance.additionalContext}]`;
      }

      // Embed with retry queue fallback
      let embedding: number[];
      try {
        embedding = await embed(memoryText);
      } catch (embedError) {
        console.error('[Memory] Failed to generate embedding for memory storage');
        console.error('[Memory] Embedding service unavailable - queuing for later retry');
        
        // Queue this memory for later processing
        await this.queuePendingMemory(
          userMessage,
          assistantMessage,
          sourceMessageId,
          privacyOverride || classification.privacy,
          thoughtGuidance
        );
        
        return null;
      }

      // Generate conversation turn ID for deduplication
      const conversationTurnId = crypto.createHash('md5')
        .update(`${sourceMessageId}_${Date.now()}`)
        .digest('hex');

      // Store with all new fields
      const memory = await db.memory.create({
        data: {
          type: classification.type,
          text: memoryText,
          importance,
          embedding: JSON.stringify(embedding),
          embeddingDimension: embedding.length,
          embeddingModel: process.env.EMBEDDING_MODEL || 'openai/text-embedding-3-large',
          privacy: privacyOverride || classification.privacy,
          conversationTurnId,
          contextTags: JSON.stringify([]), // Will be populated by clustering later
          summary: null, // Will be generated for old memories
          accessFrequency: 0,
          avgRelevance: 0.0,
          isEvergreen: importance >= 0.9, // Auto-mark very high importance as evergreen
          sourceMessageId,
          lastAccessedAt: new Date()
        }
      });

      console.log(`💾 Stored ${memory.type} memory #${memory.id} (importance: ${importance.toFixed(2)})`);

      // Return complete Memory object
      return {
        id: memory.id,
        type: memory.type,
        text: memory.text,
        importance: memory.importance,
        embedding,
        embeddingDimension: memory.embeddingDimension,
        embeddingModel: memory.embeddingModel,
        privacy: memory.privacy,
        conversationTurnId: memory.conversationTurnId,
        contextTags: memory.contextTags,
        summary: memory.summary,
        accessFrequency: memory.accessFrequency,
        avgRelevance: memory.avgRelevance,
        isEvergreen: memory.isEvergreen,
        lastAccessedAt: memory.lastAccessedAt,
        sourceMessageId: memory.sourceMessageId,
        createdAt: memory.createdAt
      };

    } catch (error) {
      console.error('Memory classification error:', error);
      return null;
    }
  }

  async getMemoryById(id: number): Promise<Memory | null> {
    try {
      if (!id || id <= 0) {
        console.warn('[Memory] Invalid memory ID provided');
        return null;
      }
      
      const memory = await db.memory.findUnique({ where: { id } });
      if (!memory) return null;
      
      try {
      const embedding = JSON.parse(memory.embedding);
      return {
        ...memory,
        embedding
      };
      } catch (parseError) {
        console.error(`[Memory] Error parsing embedding for memory ${id}:`, parseError);
        return null;
      }
    } catch (error) {
      console.error(`[Memory] Error getting memory ${id}:`, error);
      return null;
    }
  }

  async linkMemories(fromId: number, toId: number, relation: string, weight: number = 1.0): Promise<void> {
    try {
      // Validate inputs
      if (!fromId || !toId || !relation) {
        console.warn('[Memory] Invalid inputs for linkMemories');
        return;
      }
      
      if (fromId === toId) {
        console.warn('[Memory] Cannot link memory to itself');
        return;
      }
      
      // Validate weight
      if (typeof weight !== 'number' || weight < 0 || weight > 1) {
        console.warn(`[Memory] Invalid weight ${weight}, clamping to [0, 1]`);
        weight = Math.max(0, Math.min(1, weight));
      }
      
    await db.memoryLink.upsert({
      where: {
        fromId_toId_relation: { fromId, toId, relation }
      },
      create: { fromId, toId, relation, weight },
      update: { weight }
    });
      
      console.log(`[Memory] Linked memories ${fromId} -> ${toId} (${relation}, weight: ${weight.toFixed(2)})`);
    } catch (error) {
      console.error(`[Memory] Error linking memories ${fromId} -> ${toId}:`, error);
      throw error;
    }
  }

  async getLinkedMemories(memoryId: number): Promise<Memory[]> {
    try {
      const links = await db.memoryLink.findMany({
        where: { fromId: memoryId },
        include: { to: true },
        orderBy: { weight: 'desc' }
      });

      return links.map((link: any) => {
        try {
          return {
            ...link.to,
            embedding: JSON.parse(link.to.embedding)
          };
        } catch (parseError) {
          console.error(`[Memory] Error parsing embedding for memory ${link.to.id}:`, parseError);
          return null;
        }
      }).filter((m: Memory | null) => m !== null) as Memory[];
    } catch (error) {
      console.error('[Memory] Error getting linked memories:', error);
      return [];
    }
  }

  async pruneEphemeralMemories(): Promise<number> {
    try {
    // Delete ephemeral memories older than 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await db.memory.deleteMany({
      where: {
        privacy: 'ephemeral',
        createdAt: { lt: cutoff }
      }
    });
      
      if (result.count > 0) {
        console.log(`[Memory] Pruned ${result.count} ephemeral memories older than 24 hours`);
      }
      
    return result.count;
    } catch (error) {
      console.error('[Memory] Error pruning ephemeral memories:', error);
      return 0;
    }
  }

  async pruneLowImportanceMemories(threshold: number = 0.4, maxAge: number = 90): Promise<number> {
    try {
      // Validate inputs
      if (threshold < 0 || threshold > 1) {
        console.warn(`[Memory] Invalid threshold ${threshold}, using default 0.4`);
        threshold = 0.4;
      }
      
      if (maxAge <= 0) {
        console.warn(`[Memory] Invalid maxAge ${maxAge}, using default 90`);
        maxAge = 90;
      }
      
    // Delete low-importance memories older than maxAge days (but preserve evergreen)
    const cutoff = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);
    const result = await db.memory.deleteMany({
      where: {
        importance: { lt: threshold },
        createdAt: { lt: cutoff },
        isEvergreen: false // Never delete evergreen memories
      }
    });
      
      if (result.count > 0) {
        console.log(`[Memory] Pruned ${result.count} low-importance memories (threshold: ${threshold}, maxAge: ${maxAge} days)`);
      }
      
    return result.count;
    } catch (error) {
      console.error('[Memory] Error pruning low-importance memories:', error);
      return 0;
    }
  }

  /**
   * Process pending memories that failed embedding during storage
   * Uses exponential backoff for retry attempts
   */
  async processPendingMemories(): Promise<{ processed: number; succeeded: number; failed: number }> {
    try {
      const now = new Date();
      
      // Get pending memories ready for retry
      const pending = await db.pendingMemory.findMany({
        where: {
          status: 'pending',
          nextRetryAt: { lte: now }
        },
        take: 10 // Process in batches
      });

      if (pending.length === 0) {
        return { processed: 0, succeeded: 0, failed: 0 };
      }

      let succeeded = 0;
      let failed = 0;

      for (const pm of pending) {
        try {
          // Update status to processing
          await db.pendingMemory.update({
            where: { id: pm.id },
            data: { status: 'processing', lastAttemptAt: now }
          });

          // Parse thought guidance if present
          let thoughtGuidance;
          if (pm.thoughtGuidance) {
            try {
              thoughtGuidance = JSON.parse(pm.thoughtGuidance);
            } catch (e) {
              console.warn(`[Memory] Failed to parse thought guidance for pending memory ${pm.id}`);
            }
          }

          // Attempt to store the memory
          const memory = await this.classifyAndStore(
            pm.userMessage,
            pm.assistantMessage,
            pm.sourceMessageId,
            pm.privacy,
            thoughtGuidance
          );

          if (memory) {
            // Success! Mark as completed
            await db.pendingMemory.update({
              where: { id: pm.id },
              data: { status: 'completed' }
            });
            succeeded++;
            console.log(`[Memory] ✅ Successfully processed pending memory ${pm.id}`);
          } else {
            // Failed to store, update retry info
            const newRetryCount = pm.retryCount + 1;
            
            if (newRetryCount >= 5) {
              // Max retries reached, mark as failed
              await db.pendingMemory.update({
                where: { id: pm.id },
                data: {
                  status: 'failed',
                  retryCount: newRetryCount,
                  lastError: 'Max retry attempts reached'
                }
              });
              failed++;
              console.warn(`[Memory] ❌ Pending memory ${pm.id} failed after ${newRetryCount} attempts`);
            } else {
              // Calculate next retry time with exponential backoff
              const backoffMinutes = Math.pow(2, newRetryCount) * 5; // 5, 10, 20, 40 minutes
              const nextRetry = new Date(now.getTime() + backoffMinutes * 60 * 1000);
              
              await db.pendingMemory.update({
                where: { id: pm.id },
                data: {
                  status: 'pending',
                  retryCount: newRetryCount,
                  nextRetryAt: nextRetry,
                  lastError: 'Memory classification or embedding failed'
                }
              });
              console.log(`[Memory] 🔄 Pending memory ${pm.id} scheduled for retry in ${backoffMinutes}min (attempt ${newRetryCount}/5)`);
            }
          }
        } catch (error) {
          // Unexpected error during processing
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          await db.pendingMemory.update({
            where: { id: pm.id },
            data: {
              status: 'pending',
              retryCount: pm.retryCount + 1,
              lastError: errorMsg,
              nextRetryAt: new Date(now.getTime() + 10 * 60 * 1000) // Retry in 10 min
            }
          });
          console.error(`[Memory] Error processing pending memory ${pm.id}:`, errorMsg);
        }
      }

      console.log(`[Memory] Processed ${pending.length} pending memories: ${succeeded} succeeded, ${failed} failed`);
      return { processed: pending.length, succeeded, failed };

    } catch (error) {
      console.error('[Memory] Error in processPendingMemories:', error);
      return { processed: 0, succeeded: 0, failed: 0 };
    }
  }

  /**
   * Get statistics about pending memories
   */
  async getPendingMemoryStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    try {
      const [pending, processing, completed, failed] = await Promise.all([
        db.pendingMemory.count({ where: { status: 'pending' } }),
        db.pendingMemory.count({ where: { status: 'processing' } }),
        db.pendingMemory.count({ where: { status: 'completed' } }),
        db.pendingMemory.count({ where: { status: 'failed' } })
      ]);

      return { pending, processing, completed, failed };
    } catch (error) {
      console.error('[Memory] Error getting pending memory stats:', error);
      return { pending: 0, processing: 0, completed: 0, failed: 0 };
    }
  }

  /**
   * PHASE 2: Perform semantic clustering on memories
   * Groups similar memories together for better retrieval
   */
  async clusterMemories(minClusterSize: number = 3, similarityThreshold: number = 0.75): Promise<number> {
    try {
      console.log('[Memory] Starting semantic clustering...');
      
      // Get all non-ephemeral memories with embeddings
      const memories = await db.memory.findMany({
        where: {
          privacy: { not: 'ephemeral' }
        },
        select: {
          id: true,
          embedding: true,
          type: true,
          importance: true
        }
      });

      if (memories.length < minClusterSize) {
        console.log(`[Memory] Not enough memories for clustering (${memories.length} < ${minClusterSize})`);
        return 0;
      }

      // Parse embeddings
      const memoryVectors: Array<{ id: number; embedding: number[]; type: string; importance: number }> = [];
      for (const m of memories) {
        try {
          const embedding = JSON.parse(m.embedding);
          memoryVectors.push({ id: m.id, embedding, type: m.type, importance: m.importance });
        } catch (e) {
          console.warn(`[Memory] Failed to parse embedding for memory ${m.id}`);
        }
      }

      // Simple agglomerative clustering
      const clusters: number[][] = [];
      const assigned = new Set<number>();

      // For each memory, find similar memories to form clusters
      for (let i = 0; i < memoryVectors.length; i++) {
        if (assigned.has(memoryVectors[i].id)) continue;

        const cluster: number[] = [memoryVectors[i].id];
        assigned.add(memoryVectors[i].id);

        // Find similar memories
        for (let j = i + 1; j < memoryVectors.length; j++) {
          if (assigned.has(memoryVectors[j].id)) continue;

          const similarity = cosineSimilarity(memoryVectors[i].embedding, memoryVectors[j].embedding);
          
          if (similarity >= similarityThreshold) {
            cluster.push(memoryVectors[j].id);
            assigned.add(memoryVectors[j].id);
          }
        }

        // Only create cluster if it meets minimum size
        if (cluster.length >= minClusterSize) {
          clusters.push(cluster);
        }
      }

      console.log(`[Memory] Found ${clusters.length} clusters from ${memories.length} memories`);

      // Store clusters in database
      let createdCount = 0;
      for (const cluster of clusters) {
        // Calculate average importance for cluster
        const clusterMemories = memoryVectors.filter(m => cluster.includes(m.id));
        const avgImportance = clusterMemories.reduce((sum, m) => sum + m.importance, 0) / clusterMemories.length;

        // Generate label using AI (simplified - could use LLM)
        const dominantType = this.getMostFrequent(clusterMemories.map(m => m.type));
        const label = `${dominantType}_cluster_${Date.now()}`;

        // Calculate centroid (average embedding)
        const centroid = new Array(clusterMemories[0].embedding.length).fill(0);
        for (const mem of clusterMemories) {
          for (let i = 0; i < centroid.length; i++) {
            centroid[i] += mem.embedding[i];
          }
        }
        for (let i = 0; i < centroid.length; i++) {
          centroid[i] /= clusterMemories.length;
        }

        // Calculate coherence (average pairwise similarity within cluster)
        let similaritySum = 0;
        let pairCount = 0;
        for (let i = 0; i < clusterMemories.length; i++) {
          for (let j = i + 1; j < clusterMemories.length; j++) {
            similaritySum += cosineSimilarity(clusterMemories[i].embedding, clusterMemories[j].embedding);
            pairCount++;
          }
        }
        const coherence = pairCount > 0 ? similaritySum / pairCount : 0.0;

        // Create cluster
        await db.memoryCluster.create({
          data: {
            label,
            description: `Cluster of ${cluster.length} ${dominantType} memories`,
            centroid: JSON.stringify(centroid),
            coherence,
            importance: avgImportance
          }
        });

        // Update memories with cluster tags
        const clusterTag = `cluster:${label}`;
        for (const memoryId of cluster) {
          const memory = await db.memory.findUnique({ where: { id: memoryId } });
          if (memory) {
            const tags = JSON.parse(memory.contextTags || '[]');
            if (!tags.includes(clusterTag)) {
              tags.push(clusterTag);
              await db.memory.update({
                where: { id: memoryId },
                data: { contextTags: JSON.stringify(tags) }
              });
            }
          }
        }

        createdCount++;
      }

      console.log(`[Memory] Created ${createdCount} clusters`);
      return createdCount;

    } catch (error) {
      console.error('[Memory] Error in clusterMemories:', error);
      return 0;
    }
  }

  /**
   * Helper: Get most frequent item in array
   */
  private getMostFrequent(arr: string[]): string {
    const freq: Record<string, number> = {};
    let maxFreq = 0;
    let result = arr[0] || 'unknown';

    for (const item of arr) {
      freq[item] = (freq[item] || 0) + 1;
      if (freq[item] > maxFreq) {
        maxFreq = freq[item];
        result = item;
      }
    }

    return result;
  }

  /**
   * PHASE 2: Generate summaries for old memories to reduce context size
   */
  async summarizeOldMemories(ageThresholdDays: number = 180): Promise<number> {
    try {
      console.log(`[Memory] Summarizing memories older than ${ageThresholdDays} days...`);
      
      const cutoff = new Date(Date.now() - ageThresholdDays * 24 * 60 * 60 * 1000);
      
      // Get old memories without summaries
      const oldMemories = await db.memory.findMany({
        where: {
          createdAt: { lt: cutoff },
          summary: null,
          privacy: { not: 'ephemeral' }
        },
        take: 10 // Process in batches
      });

      if (oldMemories.length === 0) {
        return 0;
      }

      console.log(`[Memory] Found ${oldMemories.length} old memories to summarize`);

      let summarized = 0;
      for (const memory of oldMemories) {
        try {
          // Generate summary using AI
          const summaryPrompt = `Summarize this memory in 1-2 concise sentences, preserving key information:

${memory.text}

Summary:`;

          const summary = await openRouterClient.simpleThought(summaryPrompt);
          
          // Update memory with summary
          await db.memory.update({
            where: { id: memory.id },
            data: { summary: summary.trim().slice(0, 500) } // Limit to 500 chars
          });

          summarized++;
          console.log(`[Memory] Summarized memory #${memory.id}`);

        } catch (error) {
          console.error(`[Memory] Failed to summarize memory #${memory.id}:`, error);
        }
      }

      console.log(`[Memory] Summarized ${summarized} memories`);
      return summarized;

    } catch (error) {
      console.error('[Memory] Error in summarizeOldMemories:', error);
      return 0;
    }
  }

  /**
   * PHASE 2: Retrieve memories using multi-query expansion
   * Generates alternative phrasings to improve recall
   */
  async retrieveWithExpansion(query: string, topK: number = 30): Promise<Memory[]> {
    try {
      console.log(`[Memory] Retrieving with query expansion: "${query.slice(0, 50)}..."`);

      // Generate query variations
      const variations = await this.generateQueryVariations(query);
      console.log(`[Memory] Generated ${variations.length} query variations`);

      // Retrieve for each variation
      const allResults: Map<number, { memory: Memory; maxScore: number }> = new Map();

      for (const variation of variations) {
        const results = await this.retrieve(variation, topK * 2); // Get more candidates
        
        for (const memory of results) {
          const existing = allResults.get(memory.id);
          if (!existing || existing.maxScore < 1.0) {
            allResults.set(memory.id, {
              memory,
              maxScore: Math.max(existing?.maxScore || 0, 1.0)
            });
          }
        }
      }

      // Sort by max score and return top K
      const sortedResults = Array.from(allResults.values())
        .sort((a, b) => b.maxScore - a.maxScore)
        .slice(0, topK)
        .map(r => r.memory);

      console.log(`[Memory] Multi-query expansion returned ${sortedResults.length} unique memories`);
      return sortedResults;

    } catch (error) {
      console.error('[Memory] Error in retrieveWithExpansion:', error);
      // Fallback to regular retrieve
      return this.retrieve(query, topK);
    }
  }

  /**
   * Generate query variations for better recall
   */
  private async generateQueryVariations(query: string): Promise<string[]> {
    try {
      const prompt = `Generate 3 alternative phrasings of this query that would help find the same information:

Original: "${query}"

Return ONLY a JSON array of the 3 variations, nothing else:`;

      const response = await openRouterClient.simpleThought(prompt);
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        const variations = JSON.parse(jsonMatch[0]);
        return [query, ...variations]; // Include original
      }

      return [query]; // Fallback to original only

    } catch (error) {
      console.warn('[Memory] Failed to generate query variations, using original');
      return [query];
    }
  }

  /**
   * PHASE 2: Auto-adjust memory importance based on usage patterns
   */
  async recalculateImportance(memoryId: number): Promise<boolean> {
    try {
      const memory = await db.memory.findUnique({
        where: { id: memoryId }
      });

      if (!memory) return false;

      // Calculate new importance based on usage
      let newImportance = memory.importance;

      // Boost for high access frequency
      if (memory.accessFrequency > 10) {
        newImportance = Math.min(1.0, newImportance + 0.1);
      } else if (memory.accessFrequency > 5) {
        newImportance = Math.min(1.0, newImportance + 0.05);
      }

      // Boost for high average relevance
      if (memory.avgRelevance > 0.8) {
        newImportance = Math.min(1.0, newImportance + 0.1);
      }

      // Update if changed significantly
      if (Math.abs(newImportance - memory.importance) > 0.05) {
        await db.memory.update({
          where: { id: memoryId },
          data: { 
            importance: newImportance,
            isEvergreen: newImportance >= 0.9 // Update evergreen status
          }
        });
        console.log(`[Memory] Adjusted importance for memory #${memoryId}: ${memory.importance.toFixed(2)} → ${newImportance.toFixed(2)}`);
        return true;
      }

      return false;

    } catch (error) {
      console.error(`[Memory] Error recalculating importance for memory #${memoryId}:`, error);
      return false;
    }
  }

  /**
   * PHASE 3: Recalculate importance for frequently accessed memories
   * Runs periodically to boost memories that show high usage
   */
  async recalculateAllImportance(): Promise<number> {
    try {
      console.log('[Memory] Recalculating importance for frequently accessed memories...');
      
      // Get memories with significant access patterns
      const candidates = await db.memory.findMany({
        where: {
          OR: [
            { accessFrequency: { gte: 5 } },
            { avgRelevance: { gte: 0.7 } }
          ]
        },
        take: 50 // Process top 50 most accessed
      });

      if (candidates.length === 0) {
        return 0;
      }

      console.log(`[Memory] Found ${candidates.length} candidates for importance recalculation`);

      let adjustedCount = 0;
      for (const memory of candidates) {
        const adjusted = await this.recalculateImportance(memory.id);
        if (adjusted) {
          adjustedCount++;
        }
      }

      console.log(`[Memory] Adjusted importance for ${adjustedCount} memories`);
      return adjustedCount;

    } catch (error) {
      console.error('[Memory] Error in recalculateAllImportance:', error);
      return 0;
    }
  }

  /**
   * PHASE 3: Cluster-aware retrieval
   * Uses cluster information to find related memories more effectively
   */
  async retrieveWithClusters(query: string, topK: number = 30): Promise<Memory[]> {
    try {
      console.log(`[Memory] Cluster-aware retrieval for: "${query.slice(0, 50)}..."`);

      // First, get initial matches
      const initialResults = await this.retrieve(query, topK);

      if (initialResults.length === 0) {
        return [];
      }

      // Identify clusters represented in initial results
      const clusterTags = new Set<string>();
      for (const memory of initialResults) {
        const tags = JSON.parse(memory.contextTags || '[]');
        for (const tag of tags) {
          if (tag.startsWith('cluster:')) {
            clusterTags.add(tag);
          }
        }
      }

      if (clusterTags.size === 0) {
        // No clusters found, return standard results
        return initialResults;
      }

      console.log(`[Memory] Found ${clusterTags.size} relevant clusters`);

      // Retrieve additional memories from the same clusters
      const clusterMemories = await db.memory.findMany({
        where: {
          contextTags: {
            contains: Array.from(clusterTags)[0] // At least one cluster tag
          },
          privacy: { not: 'ephemeral' }
        },
        take: topK * 2
      });

      // Combine and deduplicate
      const memoryMap = new Map<number, Memory>();
      for (const memory of initialResults) {
        memoryMap.set(memory.id, memory);
      }

      for (const memory of clusterMemories) {
        if (!memoryMap.has(memory.id)) {
          const embedding = JSON.parse(memory.embedding);
          memoryMap.set(memory.id, { ...memory, embedding });
        }
      }

      // Re-rank combined results and return topK
      const combined = Array.from(memoryMap.values());
      const queryEmbedding = await embed(query);
      
      const scored = combined.map(m => {
        const similarity = cosineSimilarity(queryEmbedding, m.embedding);
        const recencyResult = temporalEngine.calculateMemoryRecency(m.lastAccessedAt);
        const evergreenBoost = m.isEvergreen ? 0.3 : 0;
        
        // Cluster boost - memories in same cluster as top results get +0.1
        const clusterBoost = JSON.parse(m.contextTags || '[]').some((tag: string) => clusterTags.has(tag)) ? 0.1 : 0;
        
        const score = similarity * (0.6 + 0.4 * m.importance) + recencyResult.recencyBoost + evergreenBoost + clusterBoost;
        
        return { memory: m, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const result = scored.slice(0, topK).map(s => s.memory);

      console.log(`[Memory] Cluster-aware retrieval returned ${result.length} memories`);
      return result;

    } catch (error) {
      console.error('[Memory] Error in retrieveWithClusters:', error);
      // Fallback to standard retrieve
      return this.retrieve(query, topK);
    }
  }

  /**
   * PHASE 3: Detect and merge duplicate/similar memories
   * Identifies memories that are highly similar and should be consolidated
   */
  async detectMemoryMerges(similarityThreshold: number = 0.95): Promise<Array<{ id1: number; id2: number; similarity: number }>> {
    try {
      console.log('[Memory] Detecting duplicate memories for merge...');

      // Get all non-ephemeral memories
      const memories = await db.memory.findMany({
        where: {
          privacy: { not: 'ephemeral' }
        },
        select: {
          id: true,
          embedding: true,
          importance: true,
          accessFrequency: true,
          createdAt: true
        }
      });

      if (memories.length < 2) {
        return [];
      }

      const duplicates: Array<{ id1: number; id2: number; similarity: number }> = [];
      
      // Parse embeddings
      const memoryData = memories.map(m => ({
        id: m.id,
        embedding: JSON.parse(m.embedding) as number[],
        importance: m.importance,
        accessFrequency: m.accessFrequency,
        createdAt: m.createdAt
      }));

      // Compare all pairs to find duplicates
      for (let i = 0; i < memoryData.length; i++) {
        for (let j = i + 1; j < memoryData.length; j++) {
          const similarity = cosineSimilarity(memoryData[i].embedding, memoryData[j].embedding);
          
          if (similarity >= similarityThreshold) {
            duplicates.push({
              id1: memoryData[i].id,
              id2: memoryData[j].id,
              similarity
            });
          }
        }
      }

      console.log(`[Memory] Found ${duplicates.length} potential duplicate pairs`);
      return duplicates;

    } catch (error) {
      console.error('[Memory] Error in detectMemoryMerges:', error);
      return [];
    }
  }

  /**
   * PHASE 3: Merge two duplicate memories
   * Keeps the more important/accessed one, transfers metrics, deletes the other
   */
  async mergeDuplicateMemories(id1: number, id2: number): Promise<boolean> {
    try {
      const [mem1, mem2] = await Promise.all([
        db.memory.findUnique({ where: { id: id1 } }),
        db.memory.findUnique({ where: { id: id2 } })
      ]);

      if (!mem1 || !mem2) {
        console.warn(`[Memory] Cannot merge - one or both memories not found: ${id1}, ${id2}`);
        return false;
      }

      // Determine which to keep (higher importance + access frequency)
      const score1 = mem1.importance + (mem1.accessFrequency * 0.01);
      const score2 = mem2.importance + (mem2.accessFrequency * 0.01);
      
      const keep = score1 >= score2 ? mem1 : mem2;
      const remove = score1 >= score2 ? mem2 : mem1;

      // Merge metrics
      const combinedAccessFreq = keep.accessFrequency + remove.accessFrequency;
      const combinedAvgRelevance = (keep.avgRelevance * keep.accessFrequency + remove.avgRelevance * remove.accessFrequency) / combinedAccessFreq;
      const mergedImportance = Math.max(keep.importance, remove.importance);

      // Update the kept memory
      await db.memory.update({
        where: { id: keep.id },
        data: {
          accessFrequency: combinedAccessFreq,
          avgRelevance: combinedAvgRelevance,
          importance: mergedImportance,
          isEvergreen: keep.isEvergreen || remove.isEvergreen
        }
      });

      // Transfer any memory links from removed to kept
      const linksFrom = await db.memoryLink.findMany({
        where: { fromId: remove.id }
      });
      
      for (const link of linksFrom) {
        try {
          await db.memoryLink.create({
            data: {
              fromId: keep.id,
              toId: link.toId,
              relation: link.relation,
              weight: link.weight
            }
          });
        } catch (e) {
          // Link already exists, skip
        }
      }

      // Delete the removed memory (CASCADE will handle links)
      await db.memory.delete({ where: { id: remove.id } });

      console.log(`[Memory] Merged memory #${remove.id} into #${keep.id}`);
      return true;

    } catch (error) {
      console.error(`[Memory] Error merging memories ${id1} and ${id2}:`, error);
      return false;
    }
  }

  /**
   * PHASE 3: Calculate contextual salience score
   * Determines how relevant a memory is based on current conversation context
   */
  async calculateContextualSalience(
    memoryId: number,
    recentMessages: string[],
    currentMood?: { valence: number; arousal: number }
  ): Promise<number> {
    try {
      const memory = await db.memory.findUnique({ where: { id: memoryId } });
      if (!memory) return 0.0;

      let salience = memory.importance; // Base salience from importance

      // Boost based on recent context
      if (recentMessages.length > 0) {
        const contextText = recentMessages.join(' ');
        const memoryEmbedding = JSON.parse(memory.embedding) as number[];
        const contextEmbedding = await embed(contextText);
        
        const contextRelevance = cosineSimilarity(memoryEmbedding, contextEmbedding);
        salience += contextRelevance * 0.3; // Up to +0.3 boost for high context relevance
      }

      // Mood-based boost (if memory relates to current emotional state)
      if (currentMood && memory.type === 'relational') {
        // Relational memories get boost during high arousal states
        if (currentMood.arousal > 0.6) {
          salience += 0.15;
        }
      }

      // Recency boost
      const recencyResult = temporalEngine.calculateMemoryRecency(memory.lastAccessedAt);
      salience += recencyResult.recencyBoost;

      // Evergreen boost
      if (memory.isEvergreen) {
        salience += 0.2;
      }

      // Normalize to [0, 1]
      salience = Math.min(1.0, Math.max(0.0, salience));

      return salience;

    } catch (error) {
      console.error(`[Memory] Error calculating salience for memory ${memoryId}:`, error);
      return 0.0;
    }
  }

  /**
   * PHASE 3: Retrieve memories with contextual salience ranking
   * Uses current conversation context to find most relevant memories
   */
  async retrieveWithContext(
    query: string,
    recentMessages: string[],
    topK: number = 30,
    currentMood?: { valence: number; arousal: number }
  ): Promise<Memory[]> {
    try {
      console.log(`[Memory] Context-aware retrieval for: "${query.slice(0, 50)}..."`);

      // Get initial candidates
      const candidates = await this.retrieve(query, topK * 2);

      if (candidates.length === 0) {
        return [];
      }

      // Calculate salience for each candidate
      const scoredMemories = await Promise.all(
        candidates.map(async (memory) => {
          const salience = await this.calculateContextualSalience(memory.id, recentMessages, currentMood);
          return { memory, salience };
        })
      );

      // Sort by salience and return topK
      scoredMemories.sort((a, b) => b.salience - a.salience);
      const result = scoredMemories.slice(0, topK).map(s => s.memory);

      console.log(`[Memory] Context-aware retrieval returned ${result.length} memories`);
      return result;

    } catch (error) {
      console.error('[Memory] Error in retrieveWithContext:', error);
      // Fallback to standard retrieve
      return this.retrieve(query, topK);
    }
  }
}

export const memoryEngine = new MemoryEngine();
