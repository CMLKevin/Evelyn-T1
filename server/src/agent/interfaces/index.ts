/**
 * Agent Engine Interfaces
 * 
 * Defines contracts for all agent subsystems to enable:
 * - Dependency injection
 * - Mock implementations for testing
 * - Clear separation of concerns
 */

import { Socket } from 'socket.io';
import {
  MemoryType,
  MemoryPrivacy,
  ConversationContext,
  ResponseLength,
  RelationshipStage,
  GoalCategory,
  ContentType,
  EditComplexity,
} from '../../constants/index.js';

// ========================================
// Common Types
// ========================================

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  id?: number;
  createdAt?: Date;
}

export interface ChatMessage {
  role: string;
  content: string;
  timestamp: string;
}

// ========================================
// Memory Engine Interface
// ========================================

export interface Memory {
  id: number;
  type: MemoryType;
  text: string;
  importance: number;
  embedding: number[];
  embeddingDimension: number;
  embeddingModel: string;
  privacy: MemoryPrivacy;
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

export interface MemoryClassification {
  importance: number;
  type: MemoryType;
  rationale: string;
  privacy: MemoryPrivacy;
}

export interface MemoryRetrievalOptions {
  topK?: number;
  includeEphemeral?: boolean;
  minImportance?: number;
  types?: MemoryType[];
}

export interface IMemoryEngine {
  /**
   * Retrieve memories by semantic similarity
   */
  retrieve(query: string, topK?: number): Promise<Memory[]>;
  
  /**
   * Context-aware retrieval with conversation history
   */
  retrieveWithContext(
    query: string,
    recentContext: string[],
    topK?: number,
    mood?: string
  ): Promise<Memory[]>;
  
  /**
   * Store a new memory from conversation
   */
  store(
    text: string,
    classification: MemoryClassification,
    sourceMessageId?: number
  ): Promise<Memory>;
  
  /**
   * Classify a conversation exchange for memory storage
   */
  classify(
    userMessage: string,
    assistantMessage: string
  ): Promise<MemoryClassification>;
  
  /**
   * Update memory access statistics
   */
  updateAccessStats(memoryId: number, relevanceScore: number): Promise<void>;
  
  /**
   * Get memory by ID
   */
  getById(id: number): Promise<Memory | null>;
  
  /**
   * Delete a memory
   */
  delete(id: number): Promise<void>;
}

// ========================================
// Personality Engine Interface
// ========================================

export interface MoodState {
  valence: number;  // -1 to +1
  arousal: number;  // 0 to 1
  stance: string;
}

export interface RelationshipState {
  closeness: number;  // 0 to 1
  trust: number;      // 0 to 1
  flirtation: number; // 0 to 1 (familial affection)
  stage: RelationshipStage;
}

export interface Belief {
  id: number;
  subject: string;
  statement: string;
  confidence: number;
  evidenceIds: number[];
  lastUpdateAt: Date;
}

export interface Goal {
  id: number;
  title: string;
  description: string;
  category: GoalCategory;
  priority: number;  // 1-5
  progress: number;  // 0-1
  createdAt: Date;
}

export interface PersonalitySnapshot {
  mood: MoodState;
  relationship?: RelationshipState;
}

export interface FullPersonalitySnapshot {
  mood: MoodState;
  relationship: RelationshipState;
  beliefs: Belief[];
  goals: Goal[];
}

export interface MoodUpdate {
  valence: number;
  arousal: number;
  stance: string;
  rationale: string;
}

export interface RelationshipUpdate {
  closenessDelta: number;
  trustDelta: number;
  flirtationDelta: number;
  newStage?: RelationshipStage;
  rationale: string;
  boundaryNotes?: string[];
}

export interface EmotionalThread {
  id: string;
  name: string;
  intensity: number;
  startedAt: Date;
}

export interface IPersonalityEngine {
  /**
   * Get current personality snapshot (mood + relationship basics)
   */
  getSnapshot(): Promise<PersonalitySnapshot>;
  
  /**
   * Get full personality state including beliefs and goals
   */
  getFullSnapshot(): Promise<FullPersonalitySnapshot>;
  
  /**
   * Update mood based on conversation
   */
  updateMood(
    userMessage: string,
    assistantMessage: string
  ): Promise<MoodUpdate>;
  
  /**
   * Update relationship metrics
   */
  updateRelationship(
    userMessage: string,
    assistantMessage: string,
    context?: string
  ): Promise<RelationshipUpdate>;
  
  /**
   * Run deep reflection to update beliefs and goals
   */
  runDeepReflection(
    conversationHistory: Message[],
    recentMemories: Memory[]
  ): Promise<void>;
  
  /**
   * Get active emotional threads
   */
  getActiveEmotionalThreads(): EmotionalThread[];
  
  /**
   * Apply temporal decay to mood
   */
  applyMoodDecay(): Promise<void>;
  
  /**
   * Apply temporal decay to beliefs
   */
  applyBeliefDecay(): Promise<void>;
}

// ========================================
// Inner Thought Engine Interface
// ========================================

export interface ContextClassification {
  context: ConversationContext;
  confidence: number;
  reasoning: string;
}

export interface InnerThought {
  thought: string;
  responseApproach: string;
  emotionalTone: string;
  responseLength: ResponseLength;
  memoryGuidance: {
    shouldStore: boolean;
    importanceModifier: number;
    additionalContext: string;
  };
  moodImpact: {
    valenceDelta: number;
    arousalDelta: number;
    newStance?: string;
  };
}

export interface InnerThoughtInput {
  userMessage: string;
  context: ContextClassification;
  personality: PersonalitySnapshot;
  recentMemories: Memory[];
  conversationHistory: Message[];
  emotionalThreads?: EmotionalThread[];
}

export interface IInnerThoughtEngine {
  /**
   * Classify the conversation context
   */
  classifyContext(
    message: string,
    history: Message[]
  ): Promise<ContextClassification>;
  
  /**
   * Generate inner thought before responding
   */
  generateThought(input: InnerThoughtInput): Promise<InnerThought>;
}

// ========================================
// Agentic Editor Interface
// ========================================

export interface EditingGoal {
  goal: string;
  approach: string;
  expectedChanges: string[];
  estimatedComplexity: EditComplexity;
}

export interface EditIntentResult {
  shouldEdit: boolean;
  confidence: number;
  reasoning: string;
  editingGoal?: EditingGoal;
}

export interface EditChange {
  type: 'write' | 'replace' | 'search';
  description: string;
  before?: string;
  after?: string;
}

export interface AgenticIteration {
  step: number;
  think: string;
  toolCall?: {
    tool: string;
    params: Record<string, any>;
  };
  toolResult?: any;
  goalStatus: 'in_progress' | 'achieved' | 'blocked';
}

export interface AgenticEditResult {
  success: boolean;
  editedContent: string;
  changes: EditChange[];
  goalAchieved: boolean;
  iterations: AgenticIteration[];
  summary: string;
}

export interface EditingContext {
  documentId: number;
  documentTitle: string;
  documentContent: string;
  documentType: ContentType;
  language?: string | null;
  userMessage: string;
  systemPrompt: string;
  recentMessages: ChatMessage[];
}

export interface IAgenticEditor {
  /**
   * Detect if message requires document editing
   */
  detectIntent(context: EditingContext): Promise<EditIntentResult>;
  
  /**
   * Execute agentic editing loop
   */
  executeEdit(
    context: EditingContext,
    goal: EditingGoal,
    activityId: number,
    socket: Socket
  ): Promise<AgenticEditResult>;
}

// ========================================
// Search Engine Interface
// ========================================

export interface SearchResult {
  answer: string;
  citations: Array<{
    title: string;
    url: string;
    snippet?: string;
  }>;
  synthesis?: string;
  summary?: string;
  model: string;
}

export interface ISearchEngine {
  /**
   * Decide if a query needs web search
   */
  shouldSearch(query: string): Promise<boolean>;
  
  /**
   * Refine query for better search results
   */
  refineQuery(query: string): Promise<string>;
  
  /**
   * Execute search
   */
  search(query: string, complexity?: 'simple' | 'complex'): Promise<SearchResult>;
  
  /**
   * Synthesize search results
   */
  synthesize(result: SearchResult): Promise<string>;
}

// ========================================
// LLM Client Interface
// ========================================

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProviderPreferences {
  order?: string[];
  require_parameters?: boolean;
  data_collection?: 'allow' | 'deny';
  quantizations?: string[];
}

export interface ILLMClient {
  /**
   * Complete a prompt (non-streaming)
   */
  complete(
    messages: LLMMessage[],
    model?: string,
    providerPreferences?: ProviderPreferences,
    temperature?: number
  ): Promise<string>;
  
  /**
   * Stream a chat response
   */
  streamChat(
    messages: LLMMessage[],
    model?: string,
    providerPreferences?: ProviderPreferences
  ): AsyncGenerator<string, void, unknown>;
  
  /**
   * Generate embeddings
   */
  embed(text: string): Promise<number[]>;
}

// ========================================
// Database Interface (for DI)
// ========================================

export interface IDatabase {
  message: any;
  memory: any;
  mood: any;
  relationship: any;
  belief: any;
  goal: any;
  activity: any;
  searchResult: any;
  collaborateDocument: any;
  collaborateVersion: any;
  settings: any;
}

// ========================================
// Pipeline Context
// ========================================

export interface PipelineContext {
  // Request info
  socket: Socket;
  source: 'chat' | 'collaborate';
  userMessage: string;
  
  // Document context (for collaborate)
  documentContext?: {
    documentId: number;
    title: string;
    contentType: ContentType;
    language: string | null;
    content: string;
  };
  
  // Retrieved context
  memories: Memory[];
  personality: PersonalitySnapshot;
  fullPersona?: FullPersonalitySnapshot;
  searchResult?: SearchResult;
  innerThought?: InnerThought;
  
  // Edit results
  agenticEditResult?: AgenticEditResult;
  
  // Timing
  startTime: number;
  
  // Activity tracking
  activities: Map<string, number>;
}

// ========================================
// Container Interface (for DI)
// ========================================

export interface IAgentContainer {
  memory: IMemoryEngine;
  personality: IPersonalityEngine;
  innerThought: IInnerThoughtEngine;
  agenticEditor: IAgenticEditor;
  search: ISearchEngine;
  llm: ILLMClient;
  db: IDatabase;
}

export default {
  // Re-export all interfaces
};
