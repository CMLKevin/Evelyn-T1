/**
 * Dependency Injection Container
 * 
 * Central registry for all agent engines and services.
 * Enables:
 * - Loose coupling between components
 * - Easy mocking for unit tests
 * - Swappable implementations
 * - Centralized configuration
 */

import { db } from '../db/client.js';
import { openRouterClient } from '../providers/openrouter.js';
import { memoryEngine } from './memory.js';
import { personalityEngine } from './personality.js';
import { innerThoughtEngine } from './innerThought.js';
import { 
  createSearchPipeline,
  createMemoryPipeline,
  createPostProcessPipeline,
  createResponsePipeline,
  createAgenticEditPipeline
} from './pipeline/index.js';

// ========================================
// Container Types
// ========================================

export interface IMemoryEngine {
  retrieve(query: string, topK?: number): Promise<any[]>;
  retrieveWithContext(query: string, recentContext: string[], topK?: number, mood?: { valence: number; arousal: number }): Promise<any[]>;
  classifyAndStore(userMessage: string, assistantMessage: string, messageId: number, privacy: string, guidance?: any): Promise<any>;
}

export interface IPersonalityEngine {
  getSnapshot(): Promise<{ mood: { valence: number; arousal: number; stance: string } }>;
  getFullSnapshot(): Promise<any>;
  updateMood(userMessage: string, assistantMessage: string, impact?: any): Promise<void>;
  updateRelationship(userMessage: string, assistantMessage: string, context?: string, thought?: any): Promise<void>;
  trackEmotionalThread(userMessage: string, assistantMessage: string, thought?: any): Promise<void>;
  microReflect(socket: any): Promise<void>;
  getActiveEmotionalThreads(): any[];
}

export interface IInnerThoughtEngine {
  classifyContext(message: string, history: any[]): Promise<any>;
  generateThought(input: any): Promise<any>;
}

export interface ILLMClient {
  complete(messages: any[], model?: string, provider?: any, temperature?: number): Promise<string>;
  streamChat(messages: any[], model?: string, provider?: any): AsyncGenerator<string, void, unknown>;
  simpleThought(prompt: string): Promise<string>;
  complexThought(prompt: string): Promise<string>;
}

export interface IDatabase {
  message: any;
  memory: any;
  searchResult: any;
  toolActivity: any;
  collaborateDocument: any;
  collaborateVersion: any;
  [key: string]: any;
}

export interface AgentContainer {
  // Core engines
  memory: IMemoryEngine;
  personality: IPersonalityEngine;
  innerThought: IInnerThoughtEngine;
  llm: ILLMClient;
  db: IDatabase;

  // Pipeline factories
  createSearchPipeline: typeof createSearchPipeline;
  createMemoryPipeline: typeof createMemoryPipeline;
  createPostProcessPipeline: typeof createPostProcessPipeline;
  createResponsePipeline: typeof createResponsePipeline;
  createAgenticEditPipeline: typeof createAgenticEditPipeline;
}

// ========================================
// Production Container
// ========================================

/**
 * Create the production container with real implementations
 */
export function createProductionContainer(): AgentContainer {
  return {
    // Core engines (existing singletons)
    memory: memoryEngine as IMemoryEngine,
    personality: personalityEngine as IPersonalityEngine,
    innerThought: innerThoughtEngine as IInnerThoughtEngine,
    llm: openRouterClient as ILLMClient,
    db: db as IDatabase,

    // Pipeline factories
    createSearchPipeline,
    createMemoryPipeline,
    createPostProcessPipeline,
    createResponsePipeline,
    createAgenticEditPipeline
  };
}

// ========================================
// Test Container
// ========================================

/**
 * Create a test container with mock implementations
 */
export function createTestContainer(overrides: Partial<AgentContainer> = {}): AgentContainer {
  const mockMemory: IMemoryEngine = {
    retrieve: async () => [],
    retrieveWithContext: async () => [],
    classifyAndStore: async () => null
  };

  const mockPersonality: IPersonalityEngine = {
    getSnapshot: async () => ({ mood: { valence: 0.2, arousal: 0.4, stance: 'neutral' } }),
    getFullSnapshot: async () => ({
      mood: { valence: 0.2, arousal: 0.4, stance: 'neutral' },
      relationship: { closeness: 0.5, trust: 0.7, flirtation: 0.1, stage: 'growing together' },
      beliefs: [],
      goals: []
    }),
    updateMood: async () => {},
    updateRelationship: async () => {},
    trackEmotionalThread: async () => {},
    microReflect: async () => {},
    getActiveEmotionalThreads: () => []
  };

  const mockInnerThought: IInnerThoughtEngine = {
    classifyContext: async () => ({ context: 'casual', confidence: 0.8, reasoning: 'test' }),
    generateThought: async () => ({
      thought: 'test thought',
      responseApproach: 'casual',
      emotionalTone: 'neutral',
      responseLength: 'medium',
      memoryGuidance: { shouldStore: false, importanceModifier: 0, additionalContext: '' },
      moodImpact: { valenceDelta: 0, arousalDelta: 0 }
    })
  };

  const mockLLM: ILLMClient = {
    complete: async () => 'mock response',
    streamChat: async function* () { yield 'mock'; yield ' response'; },
    simpleThought: async () => '{"result": "mock"}',
    complexThought: async () => '{"result": "mock"}'
  };

  const mockDb: IDatabase = {
    message: { create: async () => ({ id: 1 }), findMany: async () => [] } as any,
    memory: { findMany: async () => [], create: async () => ({ id: 1 }) } as any,
    mood: { findFirst: async () => null, create: async () => ({}) } as any,
    searchResult: { create: async () => ({ id: 1 }), findMany: async () => [] } as any,
    toolActivity: { create: async () => ({ id: 1 }), update: async () => ({}) } as any,
    collaborateDocument: { findUnique: async () => null, update: async () => ({}) } as any,
    collaborateVersion: { create: async () => ({ id: 1 }) } as any
  };

  return {
    memory: mockMemory,
    personality: mockPersonality,
    innerThought: mockInnerThought,
    llm: mockLLM,
    db: mockDb,
    createSearchPipeline,
    createMemoryPipeline,
    createPostProcessPipeline,
    createResponsePipeline,
    createAgenticEditPipeline,
    ...overrides
  };
}

// ========================================
// Global Container Instance
// ========================================

let containerInstance: AgentContainer | null = null;

/**
 * Get the current container instance (production by default)
 */
export function getContainer(): AgentContainer {
  if (!containerInstance) {
    containerInstance = createProductionContainer();
  }
  return containerInstance;
}

/**
 * Set a custom container (useful for testing)
 */
export function setContainer(container: AgentContainer): void {
  containerInstance = container;
}

/**
 * Reset the container to production defaults
 */
export function resetContainer(): void {
  containerInstance = null;
}

// ========================================
// Container-Aware Pipeline Factory
// ========================================

/**
 * Create all pipelines with the current container
 */
export function createPipelines(correlationId?: string) {
  const container = getContainer();
  return {
    search: container.createSearchPipeline(correlationId),
    memory: container.createMemoryPipeline(correlationId),
    postProcess: container.createPostProcessPipeline(correlationId),
    response: container.createResponsePipeline(correlationId),
    agenticEdit: container.createAgenticEditPipeline(correlationId)
  };
}

export default {
  createProductionContainer,
  createTestContainer,
  getContainer,
  setContainer,
  resetContainer,
  createPipelines
};
