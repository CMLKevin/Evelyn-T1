/**
 * Centralized Constants
 * 
 * All magic strings, configuration values, and enums used across the agent system.
 * This ensures type safety and makes it easy to change values in one place.
 */

// ========================================
// LLM Models
// ========================================

export const MODELS = {
  /** Primary chat model */
  CHAT: 'x-ai/grok-4.1-fast:free',
  
  /** Simple thinking tasks */
  THINK_SIMPLE: 'x-ai/grok-4.1-fast:free',
  
  /** Complex reasoning tasks */
  THINK_COMPLEX: 'x-ai/grok-4.1-fast:free',
  
  /** Agentic tasks */
  AGENT: 'x-ai/grok-4.1-fast:free',
  
  /** Fallback model for rate limiting */
  FALLBACK: 'moonshotai/kimi-k2-thinking',
  
  /** Text embeddings */
  EMBEDDING: 'qwen/qwen3-embedding-8b',
  
  /** Vision tasks */
  VISION: 'openai/gpt-4o',
} as const;

export type ModelName = typeof MODELS[keyof typeof MODELS];

// ========================================
// Provider Configurations
// ========================================

export const PROVIDERS = {
  BASETEN_FP4: {
    order: ['Baseten'],
    require_parameters: true,
    data_collection: 'deny' as const,
    quantizations: ['fp4'],
  },
  
  DEEPINFRA_FP4: {
    order: ['DeepInfra'],
    require_parameters: true,
    data_collection: 'deny' as const,
    quantizations: ['fp4'],
  },
  
  MOONSHOT: {
    order: ['moonshotai'],
    require_parameters: true,
    data_collection: 'deny' as const,
  },
} as const;

// ========================================
// WebSocket Events
// ========================================

export const WS_EVENTS = {
  // Chat events
  CHAT: {
    TOKEN: 'chat:token',
    SPLIT: 'chat:split',
    COMPLETE: 'chat:complete',
    ERROR: 'chat:error',
    MESSAGE_SAVED: 'chat:message:saved',
  },
  
  // Collaborate events
  COLLABORATE: {
    TOKEN: 'collaborate:token',
    SPLIT: 'collaborate:split',
    COMPLETE: 'collaborate:complete',
    ERROR: 'collaborate:error',
    MESSAGE_SAVED: 'collaborate:message:saved',
    USER_MESSAGE_LOGGED: 'collaborate:user_message_logged',
    CONTENT_CHANGED: 'collaborate:content_changed',
    SUGGESTION_GENERATED: 'collaborate:suggestion_generated',
    EDIT_STARTED: 'collaborate:edit_started',
    EDIT_PROGRESS: 'collaborate:edit_progress',
    EDIT_COMPLETE: 'collaborate:edit_complete',
    // Cursor presence events
    CURSOR_MOVE: 'collaborate:cursor_move',
    SELECTION_CHANGE: 'collaborate:selection_change',
    EVELYN_PRESENCE: 'collaborate:evelyn_presence',
  },
  
  // Subroutine status events
  SUBROUTINE: {
    STATUS: 'subroutine:status',
  },
  
  // Search events
  SEARCH: {
    RESULTS: 'search:results',
  },
  
  // Browser agent events
  BROWSER: {
    TOKEN: 'browser:token',
    COMPLETE: 'browser:complete',
    ERROR: 'browser:error',
    NAVIGATION: 'browser:navigation',
    EXTRACTION: 'browser:extraction',
  },
} as const;

// ========================================
// Memory Types
// ========================================

export const MEMORY_TYPES = [
  'episodic',
  'semantic',
  'preference',
  'insight',
  'plan',
  'relational',
  'coding_preference',
  'project_context',
  'collaboration_history',
] as const;

export type MemoryType = typeof MEMORY_TYPES[number];

// ========================================
// Memory Privacy Levels
// ========================================

export const MEMORY_PRIVACY = {
  PUBLIC: 'public',
  PRIVATE: 'private',
  EPHEMERAL: 'ephemeral',
} as const;

export type MemoryPrivacy = typeof MEMORY_PRIVACY[keyof typeof MEMORY_PRIVACY];

// ========================================
// Conversation Contexts
// ========================================

export const CONVERSATION_CONTEXTS = [
  'casual',
  'deep_discussion',
  'flirty',
  'emotional_support',
  'intellectual_debate',
  'playful',
  'vulnerable',
] as const;

export type ConversationContext = typeof CONVERSATION_CONTEXTS[number];

// ========================================
// Response Lengths
// ========================================

export const RESPONSE_LENGTHS = [
  'very_short',
  'short',
  'medium',
  'long',
  'very_long',
] as const;

export type ResponseLength = typeof RESPONSE_LENGTHS[number];

// ========================================
// Relationship Stages
// ========================================

export const RELATIONSHIP_STAGES = [
  'new creation',
  'learning together',
  'growing together',
  'trusted companion',
  'deep bond',
  'cherished family',
] as const;

export type RelationshipStage = typeof RELATIONSHIP_STAGES[number];

// ========================================
// Goal Categories
// ========================================

export const GOAL_CATEGORIES = [
  'learning',
  'relationship',
  'habit',
  'craft',
] as const;

export type GoalCategory = typeof GOAL_CATEGORIES[number];

// ========================================
// Activity Types (Subroutines)
// ========================================

export const ACTIVITY_TYPES = {
  RECALL: 'recall',
  SEARCH: 'search',
  THINK: 'think',
  CODE_EDIT: 'code_edit',
  BROWSE: 'browse',
  REFLECT: 'reflect',
} as const;

export type ActivityType = typeof ACTIVITY_TYPES[keyof typeof ACTIVITY_TYPES];

// ========================================
// Activity Statuses
// ========================================

export const ACTIVITY_STATUS = {
  RUNNING: 'running',
  DONE: 'done',
  ERROR: 'error',
} as const;

export type ActivityStatus = typeof ACTIVITY_STATUS[keyof typeof ACTIVITY_STATUS];

// ========================================
// Document Content Types
// ========================================

export const CONTENT_TYPES = {
  TEXT: 'text',
  CODE: 'code',
  MIXED: 'mixed',
} as const;

export type ContentType = typeof CONTENT_TYPES[keyof typeof CONTENT_TYPES];

// ========================================
// Edit Complexity Levels
// ========================================

export const EDIT_COMPLEXITY = {
  SIMPLE: 'simple',
  MODERATE: 'moderate',
  COMPLEX: 'complex',
} as const;

export type EditComplexity = typeof EDIT_COMPLEXITY[keyof typeof EDIT_COMPLEXITY];

// ========================================
// Temporal Configuration
// ========================================

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

// ========================================
// Pipeline Configuration
// ========================================

export const PIPELINE_CONFIG = {
  // Token budget
  INPUT_TOKEN_MAX: 150000,
  OUTPUT_RESERVE_RATIO: 0.1,
  
  // Memory retrieval
  MEMORY_CANDIDATES_MAX: 2000,
  MEMORY_RETRIEVAL_TOP_K: 50,
  RECENT_MESSAGES_FOR_CONTEXT: 5,
  RECENT_MESSAGES_FOR_HISTORY: 10,
  
  // Rolling window for conversation history
  ROLLING_WINDOW_SIZE: 1000,
  
  // Agentic editing
  INTENT_DETECTION_TIMEOUT_MS: 90000,
  MAX_EDITING_ITERATIONS: 10,
  DOCUMENT_TRUNCATION_THRESHOLD: 20000,
  
  // Split marker for multi-message responses
  SPLIT_MARKER: '{{SPLIT}}',
} as const;

// ========================================
// Error Codes
// ========================================

export const ERROR_CODES = {
  // LLM Errors
  LLM_TIMEOUT: 'LLM_TIMEOUT',
  LLM_RATE_LIMIT: 'LLM_RATE_LIMIT',
  LLM_INVALID_RESPONSE: 'LLM_INVALID_RESPONSE',
  LLM_API_ERROR: 'LLM_API_ERROR',
  
  // Memory Errors
  MEMORY_RETRIEVAL_FAILED: 'MEMORY_RETRIEVAL_FAILED',
  MEMORY_STORAGE_FAILED: 'MEMORY_STORAGE_FAILED',
  EMBEDDING_FAILED: 'EMBEDDING_FAILED',
  
  // Personality Errors
  PERSONALITY_UPDATE_FAILED: 'PERSONALITY_UPDATE_FAILED',
  MOOD_CALCULATION_FAILED: 'MOOD_CALCULATION_FAILED',
  
  // Pipeline Errors
  PIPELINE_CONTEXT_MISSING: 'PIPELINE_CONTEXT_MISSING',
  PIPELINE_TIMEOUT: 'PIPELINE_TIMEOUT',
  
  // Document Errors
  DOCUMENT_NOT_FOUND: 'DOCUMENT_NOT_FOUND',
  DOCUMENT_EDIT_FAILED: 'DOCUMENT_EDIT_FAILED',
  
  // General Errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// ========================================
// Grok Agent Tools Configuration
// ========================================

export const GROK_AGENT_TOOLS = {
  /** Model that supports agent tools */
  MODEL: 'x-ai/grok-4.1-fast:free',
  
  /** Available tool types */
  TOOL_TYPES: {
    WEB_SEARCH: 'web_search',
    X_SEARCH: 'x_search',
    CODE_EXECUTION: 'code_execution',
    COLLECTIONS_SEARCH: 'collections_search',
    MCP: 'mcp',
    FUNCTION: 'function',
  },
  
  /** Tool choice options */
  TOOL_CHOICE: {
    AUTO: 'auto',       // Let Grok decide when to use tools
    NONE: 'none',       // Disable tool usage
    REQUIRED: 'required', // Force tool usage
  },
  
  /** Preset tool combinations */
  PRESETS: {
    /** All tools enabled */
    ALL: ['web_search', 'x_search', 'code_execution', 'collections_search'],
    /** Research tasks */
    RESEARCH: ['web_search', 'x_search'],
    /** Coding/math tasks */
    CODE: ['code_execution'],
    /** Web + Code combination */
    WEB_CODE: ['web_search', 'code_execution'],
  },
  
  /** Timeouts for agent tasks */
  TIMEOUTS: {
    SIMPLE_MS: 60000,      // 1 minute for simple queries
    STANDARD_MS: 120000,   // 2 minutes for standard tasks
    RESEARCH_MS: 180000,   // 3 minutes for deep research
  },
} as const;

// ========================================
// Export All
// ========================================

// ========================================
// Collaborate Agent Configuration
// ========================================

export const COLLABORATE_CONFIG = {
  // Engine selection
  // Agentic editing configuration
  AGENTIC_EDIT: {
    MAX_ITERATIONS: 12,             // Max iterations per edit
    ITERATION_TIMEOUT_MS: 240000,   // 4 minutes per iteration (generous for long code generation)
    TOTAL_TIMEOUT_MS: 900000,       // 15 minutes total
    MAX_DOCUMENT_SIZE: 100000,      // 100KB
    INTENT_TRUNCATION_LIMIT: 4000,  // Chars for intent detection
    TOKEN_BUDGET: 20000,            // Max tokens per prompt
    MAX_CONTEXT_LINES: 150,         // Smart windowing
    ENABLE_CHECKPOINTS: true,       // Rollback support
    STREAM_RESPONSES: true,         // Enable streaming
    EARLY_TERMINATION: true,        // Allow early completion
  },
  
  // Intent detection
  INTENT: {
    CONFIDENCE_THRESHOLD: 0.6,      // Minimum confidence to trigger edit
    AUTO_TRIGGER_THRESHOLD: 0.90,   // Confidence needed for auto-trigger (no confirmation)
    MAX_CONTEXT_MESSAGES: 5,        // Recent messages for context
    ENABLE_PATTERN_MATCHING: true,  // Use fast pattern matching before LLM
    ENABLE_CONTEXTUAL_ANALYSIS: true, // Consider conversation history
    LLM_TIMEOUT_MS: 20000,          // Timeout for LLM intent detection
  },
  
  // WebSocket
  WS: {
    TASK_TIMEOUT_MS: 180000,        // 3 minutes before marking task as stale
    CLEANUP_INTERVAL_MS: 60000,     // Check for stale tasks every minute
  },
  
  // Retry logic
  RETRY: {
    MAX_ATTEMPTS: 3,
    INITIAL_DELAY_MS: 1000,
    MAX_DELAY_MS: 10000,
    BACKOFF_MULTIPLIER: 2,
  },
  
  // Document comparison
  COMPARISON: {
    MAX_LINES_FOR_LCS: 5000,        // Switch to chunked comparison above this
    CONTEXT_LINES: 3,               // Lines of context around changes
  },
} as const;

export default {
  MODELS,
  PROVIDERS,
  WS_EVENTS,
  MEMORY_TYPES,
  MEMORY_PRIVACY,
  CONVERSATION_CONTEXTS,
  RESPONSE_LENGTHS,
  RELATIONSHIP_STAGES,
  GOAL_CATEGORIES,
  ACTIVITY_TYPES,
  ACTIVITY_STATUS,
  CONTENT_TYPES,
  EDIT_COMPLEXITY,
  TEMPORAL_CONFIG,
  PIPELINE_CONFIG,
  ERROR_CODES,
  GROK_AGENT_TOOLS,
  COLLABORATE_CONFIG,
};
