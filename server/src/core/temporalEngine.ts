/**
 * Temporal Engine - Centralized System Clock Management
 * 
 * This engine ensures all time-dependent subsystems in Evelyn are synchronized
 * with the system clock and correctly calculate their values at any point in time.
 * 
 * Managed Systems:
 * - Mood decay (30-minute half-life)
 * - Belief decay (14-day half-life)
 * - Memory recency (30-day exponential)
 * - Scheduled tasks and reflections
 */

import { db } from '../db/client.js';
import { memoryEngine } from '../agent/memory.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

export const TEMPORAL_CONFIG = {
  // Mood decay parameters
  MOOD_HALF_LIFE_MINUTES: 30,
  MOOD_BASELINE_VALENCE: 0.2,
  MOOD_BASELINE_AROUSAL: 0.4,
  MOOD_MIN_DECAY_INTERVAL_MINUTES: 5,
  MOOD_SIGNIFICANT_CHANGE_THRESHOLD: 0.05,
  
  // Belief decay parameters
  BELIEF_HALF_LIFE_DAYS: 14,
  BELIEF_SIGNIFICANT_DECAY_THRESHOLD: 0.10,
  
  // Memory recency parameters
  MEMORY_RECENCY_HALF_LIFE_DAYS: 30,
  
  // Reflection parameters
  REFLECTION_CADENCE_CONVERSATIONS: 10,
} as const;

// ============================================================================
// TYPES
// ============================================================================

interface MoodState {
  id: number;
  valence: number;
  arousal: number;
  stance: string;
  decayHalfLifeMins: number;
  lastUpdateAt: Date;
}

interface BeliefState {
  id: number;
  subject: string;
  statement: string;
  confidence: number;
  evidenceIds: string;
  lastUpdateAt: Date;
}

interface TemporalCalculationResult {
  system: string;
  calculated: boolean;
  updated: boolean;
  before?: any;
  after?: any;
  elapsedTime?: string;
  message: string;
}

interface ServerLifecycleEvent {
  id: number;
  eventType: string;
  timestamp: Date;
  systemTime: Date;
  uptimeSeconds: number | null;
  downtimeSeconds: number | null;
  metadata: string | null;
}

interface DowntimeInfo {
  hadDowntime: boolean;
  lastShutdown: Date | null;
  currentStartup: Date;
  downtimeSeconds: number;
  downtimeFormatted: string;
}

// ============================================================================
// SERVER LIFECYCLE TRACKING
// ============================================================================

/**
 * Record a server lifecycle event (startup, shutdown, crash)
 */
export async function recordLifecycleEvent(
  eventType: 'startup' | 'shutdown' | 'crash',
  uptimeSeconds?: number
): Promise<ServerLifecycleEvent> {
  const now = new Date();
  
  // Calculate downtime if this is a startup event
  let downtimeSeconds: number | null = null;
  if (eventType === 'startup') {
    const lastShutdown = await db.serverLifecycle.findFirst({
      where: { eventType: { in: ['shutdown', 'crash'] } },
      orderBy: { timestamp: 'desc' }
    });
    
    if (lastShutdown) {
      downtimeSeconds = Math.floor((now.getTime() - new Date(lastShutdown.timestamp).getTime()) / 1000);
    }
  }
  
  const event = await db.serverLifecycle.create({
    data: {
      eventType,
      timestamp: now,
      systemTime: now,
      uptimeSeconds: uptimeSeconds || null,
      downtimeSeconds,
      metadata: JSON.stringify({
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid
      })
    }
  });
  
  return event as ServerLifecycleEvent;
}

/**
 * Get downtime information since last shutdown
 */
export async function getDowntimeInfo(): Promise<DowntimeInfo> {
  const now = new Date();

  try {
    const lastShutdown = await db.serverLifecycle.findFirst({
      where: { eventType: { in: ['shutdown', 'crash'] } },
      orderBy: { timestamp: 'desc' }
    });

    if (!lastShutdown) {
      return {
        hadDowntime: false,
        lastShutdown: null,
        currentStartup: now,
        downtimeSeconds: 0,
        downtimeFormatted: 'N/A (first startup)'
      };
    }

    const downtimeMs = now.getTime() - new Date(lastShutdown.timestamp).getTime();
    const downtimeSeconds = Math.floor(downtimeMs / 1000);

    // Format downtime into human-readable string
    const days = Math.floor(downtimeSeconds / 86400);
    const hours = Math.floor((downtimeSeconds % 86400) / 3600);
    const minutes = Math.floor((downtimeSeconds % 3600) / 60);
    const seconds = downtimeSeconds % 60;

    let formatted = '';
    if (days > 0) formatted += `${days}d `;
    if (hours > 0) formatted += `${hours}h `;
    if (minutes > 0) formatted += `${minutes}m `;
    if (seconds > 0 || formatted === '') formatted += `${seconds}s`;

    return {
      hadDowntime: true,
      lastShutdown: lastShutdown.timestamp,
      currentStartup: now,
      downtimeSeconds,
      downtimeFormatted: formatted.trim()
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Prisma P2021 indicates the table is missing. This can happen before
    // migrations are applied (e.g., first boot). Rather than crash the server,
    // treat it as a first-start scenario and let startup continue.
    if (message.includes('ServerLifecycle')) {
      console.warn('[Temporal] ServerLifecycle table unavailable; treating as first startup');
      return {
        hadDowntime: false,
        lastShutdown: null,
        currentStartup: now,
        downtimeSeconds: 0,
        downtimeFormatted: 'N/A (table missing)'
      };
    }

    console.error('[Temporal] Failed to read downtime info:', message);
    return {
      hadDowntime: false,
      lastShutdown: null,
      currentStartup: now,
      downtimeSeconds: 0,
      downtimeFormatted: 'N/A (error)'
    };
  }
}

/**
 * Get server uptime statistics
 */
export async function getUptimeStatistics(): Promise<{
  totalStartups: number;
  totalShutdowns: number;
  averageUptimeSeconds: number;
  lastStartup: Date | null;
  lastShutdown: Date | null;
}> {
  const startups = await db.serverLifecycle.count({
    where: { eventType: 'startup' }
  });
  
  const shutdowns = await db.serverLifecycle.count({
    where: { eventType: { in: ['shutdown', 'crash'] } }
  });
  
  const lastStartup = await db.serverLifecycle.findFirst({
    where: { eventType: 'startup' },
    orderBy: { timestamp: 'desc' }
  });
  
  const lastShutdown = await db.serverLifecycle.findFirst({
    where: { eventType: { in: ['shutdown', 'crash'] } },
    orderBy: { timestamp: 'desc' }
  });
  
  // Calculate average uptime from shutdown events that have uptimeSeconds
  const uptimeEvents = await db.serverLifecycle.findMany({
    where: {
      eventType: { in: ['shutdown', 'crash'] },
      uptimeSeconds: { not: null }
    },
    select: { uptimeSeconds: true }
  });
  
  const averageUptime = uptimeEvents.length > 0
    ? uptimeEvents.reduce((sum, e) => sum + (e.uptimeSeconds || 0), 0) / uptimeEvents.length
    : 0;
  
  return {
    totalStartups: startups,
    totalShutdowns: shutdowns,
    averageUptimeSeconds: Math.floor(averageUptime),
    lastStartup: lastStartup?.timestamp || null,
    lastShutdown: lastShutdown?.timestamp || null
  };
}

// ============================================================================
// MOOD DECAY CALCULATIONS
// ============================================================================

/**
 * Calculate decayed mood values based on elapsed time
 */
export function calculateMoodDecay(mood: MoodState, now: Date = new Date()): {
  valence: number;
  arousal: number;
  elapsedMinutes: number;
  decayApplied: boolean;
} {
  const lastUpdate = new Date(mood.lastUpdateAt).getTime();
  const currentTime = now.getTime();
  const elapsedMinutes = (currentTime - lastUpdate) / (1000 * 60);
  
  // Don't apply decay if less than minimum interval
  if (elapsedMinutes < TEMPORAL_CONFIG.MOOD_MIN_DECAY_INTERVAL_MINUTES) {
    return {
      valence: mood.valence,
      arousal: mood.arousal,
      elapsedMinutes,
      decayApplied: false
    };
  }
  
  // Calculate exponential decay factor
  const decayFactor = Math.pow(0.5, elapsedMinutes / mood.decayHalfLifeMins);
  
  // Apply decay toward baseline values
  const baselineValence = TEMPORAL_CONFIG.MOOD_BASELINE_VALENCE;
  const baselineArousal = TEMPORAL_CONFIG.MOOD_BASELINE_AROUSAL;
  
  const newValence = baselineValence + (mood.valence - baselineValence) * decayFactor;
  const newArousal = baselineArousal + (mood.arousal - baselineArousal) * decayFactor;
  
  return {
    valence: newValence,
    arousal: newArousal,
    elapsedMinutes,
    decayApplied: true
  };
}

/**
 * Apply mood decay and persist to database if significant change occurred
 */
export async function applyMoodDecay(now: Date = new Date()): Promise<TemporalCalculationResult> {
  try {
    const mood = await db.moodState.findFirst();
    
    if (!mood) {
      return {
        system: 'mood',
        calculated: false,
        updated: false,
        message: 'No mood state found'
      };
    }
    
    const before = {
      valence: mood.valence,
      arousal: mood.arousal,
      lastUpdateAt: mood.lastUpdateAt
    };
    
    const decayResult = calculateMoodDecay(mood, now);
    
    // Check if change is significant enough to update database
    const valenceChange = Math.abs(mood.valence - decayResult.valence);
    const arousalChange = Math.abs(mood.arousal - decayResult.arousal);
    const isSignificant = 
      valenceChange > TEMPORAL_CONFIG.MOOD_SIGNIFICANT_CHANGE_THRESHOLD ||
      arousalChange > TEMPORAL_CONFIG.MOOD_SIGNIFICANT_CHANGE_THRESHOLD;
    
    if (decayResult.decayApplied && isSignificant) {
      await db.moodState.update({
        where: { id: mood.id },
        data: {
          valence: decayResult.valence,
          arousal: decayResult.arousal,
          lastUpdateAt: now
        }
      });
      
      return {
        system: 'mood',
        calculated: true,
        updated: true,
        before,
        after: {
          valence: decayResult.valence,
          arousal: decayResult.arousal,
          lastUpdateAt: now
        },
        elapsedTime: `${decayResult.elapsedMinutes.toFixed(1)} minutes`,
        message: `Mood decay applied: valence ${before.valence.toFixed(2)} → ${decayResult.valence.toFixed(2)}, arousal ${before.arousal.toFixed(2)} → ${decayResult.arousal.toFixed(2)}`
      };
    }
    
    return {
      system: 'mood',
      calculated: true,
      updated: false,
      elapsedTime: `${decayResult.elapsedMinutes.toFixed(1)} minutes`,
      message: decayResult.decayApplied 
        ? 'Mood decay calculated but change not significant enough to persist'
        : 'Mood decay not applied (insufficient time elapsed)'
    };
  } catch (error) {
    return {
      system: 'mood',
      calculated: false,
      updated: false,
      message: `Error applying mood decay: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// ============================================================================
// BELIEF DECAY CALCULATIONS
// ============================================================================

/**
 * Calculate decayed belief confidence based on elapsed time
 */
export function calculateBeliefDecay(
  originalConfidence: number,
  lastUpdateAt: Date,
  now: Date = new Date()
): {
  confidence: number;
  originalConfidence: number;
  daysSinceUpdate: number;
  decayFactor: number;
  percentRetained: number;
} {
  const daysSinceUpdate = 
    (now.getTime() - new Date(lastUpdateAt).getTime()) / (1000 * 60 * 60 * 24);
  
  // Calculate exponential decay
  const decayFactor = Math.pow(0.5, daysSinceUpdate / TEMPORAL_CONFIG.BELIEF_HALF_LIFE_DAYS);
  const confidence = originalConfidence * decayFactor;
  
  return {
    confidence,
    originalConfidence,
    daysSinceUpdate,
    decayFactor,
    percentRetained: decayFactor
  };
}

/**
 * Calculate decay for all beliefs (read-only, no database updates)
 */
export async function calculateAllBeliefDecay(now: Date = new Date()): Promise<TemporalCalculationResult> {
  try {
    const beliefs = await db.personaBelief.findMany({
      orderBy: { confidence: 'desc' }
    });
    
    if (beliefs.length === 0) {
      return {
        system: 'beliefs',
        calculated: false,
        updated: false,
        message: 'No beliefs found'
      };
    }
    
    let significantDecayCount = 0;
    const decayDetails: any[] = [];
    
    for (const belief of beliefs) {
      const result = calculateBeliefDecay(belief.confidence, belief.lastUpdateAt, now);
      
      const decayAmount = result.originalConfidence - result.confidence;
      if (decayAmount > TEMPORAL_CONFIG.BELIEF_SIGNIFICANT_DECAY_THRESHOLD) {
        significantDecayCount++;
        decayDetails.push({
          id: belief.id,
          statement: belief.statement.substring(0, 50) + '...',
          original: (result.originalConfidence * 100).toFixed(0) + '%',
          current: (result.confidence * 100).toFixed(0) + '%',
          days: result.daysSinceUpdate.toFixed(1)
        });
      }
    }
    
    return {
      system: 'beliefs',
      calculated: true,
      updated: false, // Beliefs are calculated at read-time, not persisted
      before: { totalBeliefs: beliefs.length },
      after: { 
        significantDecayCount,
        decayDetails: decayDetails.slice(0, 5) // Show first 5
      },
      message: `Belief decay calculated for ${beliefs.length} beliefs, ${significantDecayCount} with significant decay (>10%)`
    };
  } catch (error) {
    return {
      system: 'beliefs',
      calculated: false,
      updated: false,
      message: `Error calculating belief decay: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// ============================================================================
// MEMORY RECENCY CALCULATIONS
// ============================================================================

/**
 * Calculate memory recency boost factor
 */
export function calculateMemoryRecency(
  lastAccessedAt: Date,
  now: Date = new Date()
): {
  ageDays: number;
  recencyBoost: number;
  decayFactor: number;
} {
  const ageMs = now.getTime() - new Date(lastAccessedAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  
  // Exponential decay with 30-day characteristic time
  const decayFactor = Math.exp(-ageDays / TEMPORAL_CONFIG.MEMORY_RECENCY_HALF_LIFE_DAYS);
  const recencyBoost = decayFactor * 0.2; // Max 20% boost for very recent memories
  
  return {
    ageDays,
    recencyBoost,
    decayFactor
  };
}

/**
 * Analyze memory recency distribution
 */
export async function analyzeMemoryRecency(now: Date = new Date()): Promise<TemporalCalculationResult> {
  try {
    const memories = await db.memory.findMany({
      select: {
        id: true,
        lastAccessedAt: true,
        importance: true
      }
    });
    
    if (memories.length === 0) {
      return {
        system: 'memory-recency',
        calculated: false,
        updated: false,
        message: 'No memories found'
      };
    }
    
    const recencyStats = {
      fresh: 0,      // < 7 days
      recent: 0,     // 7-30 days
      aging: 0,      // 30-90 days
      old: 0         // > 90 days
    };
    
    for (const memory of memories) {
      const { ageDays } = calculateMemoryRecency(memory.lastAccessedAt, now);
      
      if (ageDays < 7) recencyStats.fresh++;
      else if (ageDays < 30) recencyStats.recent++;
      else if (ageDays < 90) recencyStats.aging++;
      else recencyStats.old++;
    }
    
    return {
      system: 'memory-recency',
      calculated: true,
      updated: false,
      after: {
        totalMemories: memories.length,
        distribution: recencyStats
      },
      message: `Memory recency analyzed: ${recencyStats.fresh} fresh, ${recencyStats.recent} recent, ${recencyStats.aging} aging, ${recencyStats.old} old`
    };
  } catch (error) {
    return {
      system: 'memory-recency',
      calculated: false,
      updated: false,
      message: `Error analyzing memory recency: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// ============================================================================
// BACKGROUND PROCESSING
// ============================================================================

let temporalUpdateInterval: NodeJS.Timeout | null = null;
let lastBackgroundUpdate = 0;
const BACKGROUND_UPDATE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Phase 3: Advanced memory maintenance intervals
let lastClusteringRun = 0;
let lastSummarizationRun = 0;
let lastImportanceRecalc = 0;
const CLUSTERING_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // Weekly
const SUMMARIZATION_INTERVAL_MS = 24 * 60 * 60 * 1000; // Daily  
const IMPORTANCE_RECALC_INTERVAL_MS = 12 * 60 * 60 * 1000; // Every 12 hours

/**
 * Start background temporal calculations (non-blocking)
 * Runs every 5 minutes to update time-dependent values without impacting request performance
 */
export function startBackgroundTemporalUpdates(): void {
  if (temporalUpdateInterval) {
    clearInterval(temporalUpdateInterval);
  }
  
  temporalUpdateInterval = setInterval(async () => {
    try {
      const now = new Date();
      const startTime = Date.now();
      
      // Phase 3: Check if advanced maintenance tasks are due
      const tasks: Promise<any>[] = [
        applyMoodDecay(now).catch(err => ({ system: 'mood', calculated: false, updated: false, error: err })),
        calculateAllBeliefDecay(now).catch(err => ({ system: 'beliefs', calculated: false, updated: false, error: err })),
        analyzeMemoryRecency(now).catch(err => ({ system: 'memory', calculated: false, updated: false, error: err })),
        memoryEngine.pruneEphemeralMemories().then(count => ({ system: 'memory-prune-eph', calculated: true, updated: count > 0, count })).catch(err => ({ system: 'memory-prune-eph', calculated: false, updated: false, error: err })),
        memoryEngine.pruneLowImportanceMemories().then(count => ({ system: 'memory-prune-low', calculated: true, updated: count > 0, count })).catch(err => ({ system: 'memory-prune-low', calculated: false, updated: false, error: err })),
        memoryEngine.processPendingMemories().then(stats => ({ system: 'memory-pending', calculated: true, updated: stats.succeeded > 0, ...stats })).catch(err => ({ system: 'memory-pending', calculated: false, updated: false, error: err }))
      ];

      // Weekly clustering (if due)
      if (Date.now() - lastClusteringRun >= CLUSTERING_INTERVAL_MS) {
        tasks.push(
          memoryEngine.clusterMemories().then(count => {
            lastClusteringRun = Date.now();
            return { system: 'memory-cluster', calculated: true, updated: count > 0, count };
          }).catch(err => ({ system: 'memory-cluster', calculated: false, updated: false, error: err }))
        );
      }

      // Daily summarization (if due)
      if (Date.now() - lastSummarizationRun >= SUMMARIZATION_INTERVAL_MS) {
        tasks.push(
          memoryEngine.summarizeOldMemories().then(count => {
            lastSummarizationRun = Date.now();
            return { system: 'memory-summarize', calculated: true, updated: count > 0, count };
          }).catch(err => ({ system: 'memory-summarize', calculated: false, updated: false, error: err }))
        );
      }

      // 12-hour importance recalculation (if due)
      if (Date.now() - lastImportanceRecalc >= IMPORTANCE_RECALC_INTERVAL_MS) {
        tasks.push(
          memoryEngine.recalculateAllImportance().then(count => {
            lastImportanceRecalc = Date.now();
            return { system: 'memory-importance', calculated: true, updated: count > 0, count };
          }).catch(err => ({ system: 'memory-importance', calculated: false, updated: false, error: err }))
        );
      }

      // Run all temporal calculations and memory maintenance in parallel
      Promise.all(tasks).then(results => {
        const elapsedMs = Date.now() - startTime;
        const updateCount = results.filter(r => r.updated).length;
        const calculatedCount = results.filter(r => r.calculated).length;
        const errorCount = results.filter(r => (r as any).error).length;
        
        // Single summary log entry with all key metrics
        if (updateCount > 0 || errorCount > 0) {
          const parts = [
            `⏰ Cycle complete in ${elapsedMs}ms`,
            `calculated: ${calculatedCount}/${results.length}`,
            updateCount > 0 ? `updated: ${updateCount}` : null,
            errorCount > 0 ? `errors: ${errorCount}` : null
          ].filter(Boolean);
          console.log(`[Temporal] ${parts.join(' | ')}`);
          
          // Log individual errors if any occurred
          results.forEach(r => {
            if ((r as any).error) {
              console.error(`[Temporal] ${r.system} error:`, (r as any).error.message || (r as any).error);
            }
          });
        }
      }).catch(err => {
        console.error('[Temporal] Unexpected error in background cycle:', err.message || err);
      });
      
      lastBackgroundUpdate = Date.now();
    } catch (error) {
      console.error('[Temporal] Critical error in background update:', error);
    }
  }, BACKGROUND_UPDATE_INTERVAL_MS);
}

/**
 * Stop background temporal updates
 */
export function stopBackgroundTemporalUpdates(): void {
  if (temporalUpdateInterval) {
    clearInterval(temporalUpdateInterval);
    temporalUpdateInterval = null;
  }
}

// ============================================================================
// SYSTEM INITIALIZATION
// ============================================================================

/**
 * Initialize all temporal systems on server startup (OPTIMIZED FOR SPEED)
 * This ensures all time-dependent values are correctly calculated based on system clock
 * Runs calculations in parallel to minimize startup time
 */
export async function initializeTemporalSystems(): Promise<void> {
  const startTime = Date.now();
  const now = new Date();
  
  // Get downtime info and record startup in parallel (non-blocking)
  const downtimeInfo = await getDowntimeInfo();
  recordLifecycleEvent('startup').catch(err => 
    console.error('[Temporal] Failed to record startup event:', err)
  );
  
  // Run ALL temporal calculations in PARALLEL for maximum speed
  const [moodResult, beliefResult, memoryResult] = await Promise.all([
    applyMoodDecay(now),
    calculateAllBeliefDecay(now),
    analyzeMemoryRecency(now)
  ]);
  
  // Single summary log with all key metrics
  const elapsedMs = Date.now() - startTime;
  const results = [moodResult, beliefResult, memoryResult];
  const successCount = results.filter(r => r.calculated).length;
  const updateCount = results.filter(r => r.updated).length;
  
  const downtimePart = downtimeInfo.hadDowntime 
    ? `downtime: ${Math.floor(downtimeInfo.downtimeSeconds / 60)}min`
    : 'no downtime';
  
  console.log(
    `[Temporal] 🕐 Initialized in ${elapsedMs}ms | ` +
    `calculated: ${successCount}/3 | ` +
    `updated: ${updateCount} | ` +
    `${downtimePart} | ` +
    `background: 5min cycles`
  );
  
  // Start background updates for continuous optimization
  startBackgroundTemporalUpdates();
  lastBackgroundUpdate = Date.now();
}

/**
 * Get temporal system status
 */
export async function getTemporalStatus(): Promise<{
  systemTime: string;
  mood: any;
  beliefs: any;
  memoryRecency: any;
  lifecycle: any;
}> {
  const now = new Date();
  
  // Get mood status
  const mood = await db.moodState.findFirst();
  const moodStatus = mood ? {
    valence: mood.valence,
    arousal: mood.arousal,
    lastUpdate: mood.lastUpdateAt,
    minutesSinceUpdate: ((now.getTime() - new Date(mood.lastUpdateAt).getTime()) / (1000 * 60)).toFixed(1),
    decayed: calculateMoodDecay(mood, now)
  } : null;
  
  // Get belief status
  const beliefCount = await db.personaBelief.count();
  
  // Get memory status
  const memoryCount = await db.memory.count();
  
  // Get lifecycle status
  const downtimeInfo = await getDowntimeInfo();
  const uptimeStats = await getUptimeStatistics();
  
  return {
    systemTime: now.toISOString(),
    mood: moodStatus,
    beliefs: {
      total: beliefCount,
      halfLife: `${TEMPORAL_CONFIG.BELIEF_HALF_LIFE_DAYS} days`
    },
    memoryRecency: {
      total: memoryCount,
      halfLife: `${TEMPORAL_CONFIG.MEMORY_RECENCY_HALF_LIFE_DAYS} days`
    },
    lifecycle: {
      currentUptime: Math.floor((Date.now() - (uptimeStats.lastStartup?.getTime() || Date.now())) / 1000),
      lastDowntime: downtimeInfo.downtimeFormatted,
      lastShutdown: downtimeInfo.lastShutdown?.toISOString() || null,
      totalStartups: uptimeStats.totalStartups,
      totalShutdowns: uptimeStats.totalShutdowns,
      averageUptime: uptimeStats.averageUptimeSeconds
    }
  };
}

/**
 * Record server shutdown event
 * Should be called during graceful shutdown
 */
export async function recordShutdown(uptimeSeconds: number): Promise<void> {
  try {
    stopBackgroundTemporalUpdates();
    await recordLifecycleEvent('shutdown', uptimeSeconds);
    console.log(`[Temporal] 🛑 Shutdown complete | uptime: ${Math.floor(uptimeSeconds / 60)}min`);
  } catch (error) {
    if (error instanceof Error) {
      console.error('[Temporal] Shutdown error:', error.message);
    } else {
      console.error('[Temporal] Shutdown error:', error);
    }
  }
}

// Export configuration for use by other modules
export default {
  initialize: initializeTemporalSystems,
  recordShutdown,
  startBackgroundUpdates: startBackgroundTemporalUpdates,
  stopBackgroundUpdates: stopBackgroundTemporalUpdates,
  calculateMoodDecay,
  calculateBeliefDecay,
  calculateMemoryRecency,
  applyMoodDecay,
  calculateAllBeliefDecay,
  analyzeMemoryRecency,
  getDowntimeInfo,
  getUptimeStatistics,
  getStatus: getTemporalStatus,
  config: TEMPORAL_CONFIG
};
