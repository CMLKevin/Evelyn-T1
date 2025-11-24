import { create } from 'zustand';
import type { Toast } from '../components/common/Toast';

interface Message {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  auxiliary?: any;
}

interface Activity {
  id: number;
  tool: string;
  status: 'running' | 'done' | 'error' | string;
  messageId?: number;
  summary?: string;
  inputSummary?: string;
  outputSummary?: string;
  query?: string;
  citationCount?: number;
  metadata?: {
    thought?: string;
    context?: string;
    contextConfidence?: number;
    contextReasoning?: string;
    responseApproach?: string;
    emotionalTone?: string;
    responseLength?: string;
    complexity?: string;
    memoryGuidance?: any;
    moodImpact?: any;
    memoryCount?: number;
    // Agentic code editor metadata
    changes?: number;
    iterations?: number;
    goalAchieved?: boolean;
    currentIteration?: number;
    goal?: string;
    agenticProgress?: {
      iterations: Array<{
        step: number;
        think: string;
        toolCall?: {
          tool: string;
          params: Record<string, any>;
        };
        toolResult?: any;
        goalStatus: 'in_progress' | 'achieved' | 'blocked';
      }>;
      currentStep: number;
      totalSteps: number;
      goal: string;
    };
  };
  createdAt?: string;
  finishedAt?: string;
}

interface SearchResult {
  id: number;
  query: string;
  originalQuery?: string;
  answer: string;
  citations: string[];
  synthesis: string;
  model: string;
  timestamp: string;
}

interface Personality {
  mood: { valence: number; arousal: number; stance: string };
}

interface RelationshipState {
  id: number;
  userId: number | null;
  closeness: number;
  trust: number;
  flirtation: number;
  boundaries: { topics: string[]; notes: string } | null;
  stage: string;
  lastUpdateAt: string;
}

interface PersonaBelief {
  id: number;
  subject: string;
  statement: string;
  confidence: number;
  evidenceIds: number[];
  lastUpdateAt: string;
}

interface PersonaGoal {
  id: number;
  title: string;
  description: string;
  category: string;
  priority: number;
  progress: number;
  evidenceIds: number[];
  createdAt: string;
  updatedAt: string;
}

interface PersonaEvolutionEvent {
  id: number;
  type: string;
  target: string;
  delta: number | null;
  rationale: string;
  evidenceIds: number[];
  metadata: any;
  createdAt: string;
}

interface FullPersona {
  mood: { valence: number; arousal: number; stance: string };
  relationship: RelationshipState;
  beliefs: PersonaBelief[];
  goals: PersonaGoal[];
}

interface ContextUsage {
  tokens: number;
  maxTokens: number;
  percentage: number;
  messageCount: number;
  truncated: boolean;
  removedMessages?: number;
  rollingWindowSize?: number;
  windowStatus?: 'full' | 'partial';
  messageIdsInContext?: number[];
  timestamp: string;
}

export interface ContextSnapshot {
  timestamp: string;
  mode: 'chat' | 'coding' | 'browsing';
  sources: {
    systemPrompt: {
      tokens: number;
      length: number;
    };
    personality: {
      mood: { valence: number; arousal: number; stance: string };
      relationship: {
        stage: string;
        closeness: number;
        trust: number;
        flirtation: number;
      };
      beliefs: Array<{
        subject: string;
        statement: string;
        confidence: number;
      }>;
      goals: Array<{
        title: string;
        description: string;
        progress: number;
        category: string;
      }>;
      threads: Array<{
        topic: string;
        emotion: string;
        intensity: number;
        context: string;
      }>;
      tokens: number;
    };
    memories: {
      count: number;
      types: Record<string, number>;
      ids: number[];
      tokens: number;
    };
    searchResults: {
      recent: number;
      current: boolean;
      tokens: number;
    };
    conversation: {
      messageCount: number;
      messageIds: number[];
      windowSize: number;
      windowStatus: 'full' | 'partial';
      tokens: number;
    };
    innerThought: {
      context: string;
      approach: string;
      tone: string;
      tokens: number;
    } | null;
  };
  totalTokens: number;
  maxTokens: number;
  percentage: number;
}

interface ReflectionEvent {
  type: 'start' | 'complete';
  conversationsProcessed?: number;
  newMemoriesCount?: number;
  summary?: string;
  newBeliefs?: number;
  updatedBeliefs?: number;
  newGoals?: number;
  updatedGoals?: number;
  duration?: string;
  timestamp: string;
}

interface BeliefEvent {
  id: number;
  subject: string;
  statement: string;
  confidence: number;
  rationale: string;
  evidenceIds: number[];
  timestamp: string;
}

interface GoalEvent {
  id: number;
  title: string;
  description: string;
  category: string;
  priority: number;
  rationale: string;
  timestamp: string;
}

interface AgentPage {
  url: string;
  title: string;
  keyPoints: string[];
  screenshotBase64?: string;
  favicon?: string;
  timestamp: string;
  evelynThought?: string;
  evelynReaction?: string;
}

interface AgentSession {
  sessionId: string | null;
  approved: boolean;
  isActive: boolean;
  startedAt: string | null;
  currentStep: string | null;
  currentDetail: string | null;
  pages: AgentPage[];
  pageCount: number;
  maxPages: number;
  error: string | null;
  summary: string | null;
  evelynIntent?: string;
  query?: string;
  entryUrl?: string;
  estimatedTime?: number;
}

interface BrowsingResult {
  sessionId: string;
  query: string;
  summary: string;
  pages: Array<{
    title: string;
    url: string;
    keyPoints: string[];
    evelynThought?: string;
    evelynReaction?: string;
  }>;
  timestamp: string;
  messageId: number;
}

// ========================================
// COLLABORATE FEATURE INTERFACES
// ========================================

interface CollaborateDocument {
  id: number;
  sessionId: string;
  title: string;
  contentType: 'text' | 'code' | 'mixed';
  language?: string;
  status: 'active' | 'archived';
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string;
  versions: CollaborateVersion[];
  suggestions: CollaborateSuggestion[];
  comments: CollaborateComment[];
  editHistory: CollaborateEdit[];
}

interface CollaborateVersion {
  id: number;
  documentId: number;
  version: number;
  content: string;
  description?: string;
  evelynNote?: string;
  createdAt: string;
  createdBy: 'user' | 'evelyn' | 'collaborative';
}

interface CollaborateSuggestion {
  id: number;
  documentId: number;
  type: string;
  category: 'writing' | 'code';
  title: string;
  description: string;
  originalText?: string;
  suggestedText?: string;
  lineStart?: number;
  lineEnd?: number;
  charStart?: number;
  charEnd?: number;
  confidence: number;
  status: 'pending' | 'accepted' | 'rejected' | 'applied';
  evelynThought?: string;
  createdAt: string;
  appliedAt?: string;
}

interface CollaborateComment {
  id: number;
  documentId: number;
  author: 'user' | 'evelyn';
  content: string;
  lineStart?: number;
  lineEnd?: number;
  resolved: boolean;
  createdAt: string;
}

interface CollaborateEdit {
  id: number;
  documentId: number;
  author: string;
  editType: string;
  beforeText?: string;
  afterText?: string;
  position?: string;
  description?: string;
  shortcutType?: string;
  createdAt: string;
}

interface CollaborateIntentDetection {
  intent: 'edit_document' | 'ask_question' | 'analyze_document' | 'chat' | 'other';
  action: 'respond_only' | 'edit_document' | 'suggestions' | 'plan';
  confidence: number;
  instruction?: string;
  autoRunTriggered: boolean;
  detectedAt: string;
  originMessageIndex?: number | null;
}

interface CollaborateChatMessage {
  id?: number;
  role: 'user' | 'evelyn';
  content: string;
  timestamp: string;
  messageIndex?: number;
}

interface TextRange {
  startLine: number;
  startChar: number;
  endLine: number;
  endChar: number;
}

interface CollaborateAgentTaskStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  detail?: string;
}

interface CollaborateAgentTaskSession {
  taskId: string;
  kind: 'analyze' | 'rewrite' | 'refactor' | 'review' | 'polish' | 'custom';
  status: 'planning' | 'editing' | 'applying_edits' | 'complete' | 'error';
  startedAt: string;
  completedAt?: string;
  steps: CollaborateAgentTaskStep[];
  currentStepId?: string | null;
  error?: string;
  originMessageIndex?: number;
}

interface CollaborateState {
  activeDocument: CollaborateDocument | null;
  documentList: CollaborateDocument[];
  currentContent: string;
  selectedRange: TextRange | null;
  activePanel: 'editor' | 'versions' | 'suggestions' | 'comments';
  isGenerating: boolean;
  generatingShortcut: string | null;
  currentSuggestions: CollaborateSuggestion[];
  showInlineSuggestions: boolean;
  editMode: 'user' | 'evelyn' | 'collaborative';
  versionHistory: CollaborateVersion[];
  chatMessages: CollaborateChatMessage[];
  isSaving: boolean;
  lastSaved: string | null;
  agentTask: CollaborateAgentTaskSession | null;
  lastIntentDetection: CollaborateIntentDetection | null;
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
  source: string;
}


interface UIState {
  activeTab: 'chat' | 'collaborate' | 'logs' | 'diagnostics' | 'context';
  commandPaletteOpen: boolean;
  quickSearchOpen: boolean;
  settingsModalOpen: boolean;
  reducedMotion: boolean;
}

interface CommandHistory {
  entries: string[];
  index: number;
}

interface Store {
  connected: boolean;
  messages: Message[];
  currentMessage: string;
  tempMessages: Message[]; // Temporary messages during streaming with splits
  activities: Activity[];
  searchResults: SearchResult[];
  personality: Personality | null;
  persona: FullPersona | null;
  evolutionEvents: PersonaEvolutionEvent[];
  reflectionEvents: ReflectionEvent[];
  beliefEvents: BeliefEvent[];
  goalEvents: GoalEvent[];
  showDiagnostics: boolean;
  error: string | null;
  dreamStatus: any;
  contextUsage: ContextUsage | null;
  contextSnapshot: ContextSnapshot | null;
  agentSession: AgentSession;
  browsingResults: BrowsingResult[];
  
  // Collaborate state
  collaborateState: CollaborateState;
  
  // Logs state
  logs: LogEntry[];
  logsMaxSize: number;
  logsPaused: boolean;
  
  // UI state
  uiState: UIState;
  
  // Command history
  commandHistory: CommandHistory;
  
  // Toast notifications
  toasts: Toast[];
  
  setConnected: (connected: boolean) => void;
  addMessage: (message: Message) => void;
  appendToCurrentMessage: (token: string) => void;
  completeMessage: () => void;
  splitMessage: () => void;
  finalizeMessages: () => void;
  replaceTempMessage: (message: Message) => void;
  updateActivity: (activity: Activity) => void;
  setActivities: (activities: Activity[]) => void;
  addSearchResult: (result: SearchResult) => void;
  setPersonality: (personality: Personality) => void;
  setPersona: (persona: FullPersona) => void;
  setEvolutionEvents: (events: PersonaEvolutionEvent[]) => void;
  toggleDiagnostics: () => void;
  setError: (error: string | null) => void;
  updateDreamStatus: (status: any) => void;
  updateContextUsage: (usage: Omit<ContextUsage, 'timestamp'>) => void;
  setContextSnapshot: (snapshot: ContextSnapshot) => void;
  addReflectionEvent: (event: Omit<ReflectionEvent, 'id'>) => void;
  addBeliefEvent: (event: BeliefEvent) => void;
  addGoalEvent: (event: GoalEvent) => void;
  clearMessages: () => void;
  deleteMessage: (messageId: number) => Promise<void>;
  loadMessages: () => Promise<void>;
  loadActivities: () => Promise<void>;
  loadSearchResults: () => Promise<void>;
  loadPersona: () => Promise<void>;
  loadEvolutionEvents: () => Promise<void>;
  
  // Agent browsing state actions
  setAgentApprovalRequest: (data: any) => void;
  updateAgentStatus: (data: any) => void;
  addAgentPage: (page: AgentPage) => void;
  completeAgentSession: (data: any) => void;
  setAgentError: (data: any) => void;
  resetAgentSession: () => void;
  addBrowsingResult: (result: BrowsingResult) => void;
  
  // Logs actions
  addLogEntry: (entry: LogEntry) => void;
  clearLogs: () => void;
  setLogsPaused: (paused: boolean) => void;
  loadLogs: () => Promise<void>;
  
  // UI actions
  setActiveTab: (tab: 'chat' | 'collaborate' | 'logs' | 'diagnostics' | 'context') => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setQuickSearchOpen: (open: boolean) => void;
  setSettingsModalOpen: (open: boolean) => void;
  
  // Command history actions
  addToHistory: (command: string) => void;
  navigateHistory: (direction: 'up' | 'down') => string | null;
  resetHistoryIndex: () => void;
  
  // Toast actions
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  
  // ========================================
  // COLLABORATE FEATURE ACTIONS
  // ========================================
  
  // Document management
  setActiveDocument: (document: CollaborateDocument | null) => void;
  setDocumentList: (documents: CollaborateDocument[]) => void;
  createDocument: (title: string, contentType: 'text' | 'code' | 'mixed', language?: string) => Promise<void>;
  updateDocumentContent: (content: string) => void;
  deleteDocument: (documentId: number) => Promise<void>;
  archiveDocument: (documentId: number) => Promise<void>;
  
  // Suggestions
  addSuggestion: (suggestion: CollaborateSuggestion) => void;
  applySuggestion: (suggestionId: number) => Promise<void>;
  rejectSuggestion: (suggestionId: number) => Promise<void>;
  clearSuggestions: () => void;
  setSuggestions: (suggestions: CollaborateSuggestion[]) => void;
  
  // Version control
  saveVersion: (description?: string) => Promise<void>;
  revertToVersion: (versionId: number) => Promise<void>;
  loadVersionHistory: () => Promise<void>;
  setVersionHistory: (versions: CollaborateVersion[]) => void;
  
  // UI state
  setCollaborateActivePanel: (panel: 'editor' | 'versions' | 'suggestions' | 'comments') => void;
  setSelectedRange: (range: TextRange | null) => void;
  setCollaborateGeneratingStatus: (isGenerating: boolean, shortcutType?: string) => void;
  setShowInlineSuggestions: (show: boolean) => void;
  setEditMode: (mode: 'user' | 'evelyn' | 'collaborative') => void;
  setSavingStatus: (isSaving: boolean) => void;
  
  // Chat
  addCollaborateChatMessage: (
    role: 'user' | 'evelyn',
    content: string,
    metadata?: { id?: number; timestamp?: string; messageIndex?: number }
  ) => void;
  setCollaborateChatMessages: (messages: CollaborateChatMessage[]) => void;
  clearCollaborateChat: () => void;
  setCollaborateAgentTask: (task: CollaborateAgentTaskSession | null) => void;
  setCollaborateIntentDetection: (intent: CollaborateIntentDetection | null) => void;
  
  // Load data
  loadCollaborateDocuments: () => Promise<void>;
  loadCollaborateDocument: (documentId: number) => Promise<void>;
  
  // Aliases for components (to match component usage)
  updateCollaborateDocumentContent: (content: string) => void;
  setCollaborateSelectedRange: (range: TextRange | null) => void;
  saveCollaborateVersion: (description?: string) => Promise<void>;
  deleteCollaborateDocument: (documentId: number) => Promise<void>;
  archiveCollaborateDocument: (documentId: number) => Promise<void>;
  applyCollaborateSuggestion: (suggestionId: number) => Promise<void>;
  rejectCollaborateSuggestion: (suggestionId: number) => Promise<void>;
  createCollaborateDocument: (title: string, contentType: 'text' | 'code' | 'mixed', language?: string) => Promise<void>;
  applyCollaborateShortcut: (shortcutType: string, options?: any) => Promise<void>;
  loadCollaborateVersionHistory: () => Promise<void>;
  revertCollaborateToVersion: (versionId: number) => Promise<void>;
}

export const useStore = create<Store>((set, get) => ({
  connected: false,
  messages: [],
  currentMessage: '',
  tempMessages: [],
  activities: [],
  searchResults: [],
  browsingResults: [],
  agentSession: {
    sessionId: null,
    approved: false,
    isActive: false,
    startedAt: null,
    currentStep: null,
    currentDetail: null,
    pages: [],
    pageCount: 0,
    maxPages: 5,
    error: null,
    summary: null
  },
  personality: null,
  persona: null,
  evolutionEvents: [],
  reflectionEvents: [],
  beliefEvents: [],
  goalEvents: [],
  showDiagnostics: true,
  error: null,
  dreamStatus: null,
  contextUsage: null,
  contextSnapshot: null,
  
  // Logs state
  logs: [],
  logsMaxSize: 1000,
  logsPaused: false,
  
  // UI state
  uiState: {
    activeTab: 'chat',
    commandPaletteOpen: false,
    quickSearchOpen: false,
    settingsModalOpen: false,
    reducedMotion: typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  },
  
  // Command history
  commandHistory: {
    entries: [],
    index: -1,
  },
  
  // Toast notifications
  toasts: [],
  
  // Collaborate state
  collaborateState: {
    activeDocument: null,
    documentList: [],
    currentContent: '',
    selectedRange: null,
    activePanel: 'editor',
    isGenerating: false,
    generatingShortcut: null,
    currentSuggestions: [],
    showInlineSuggestions: true,
    editMode: 'user',
    versionHistory: [],
    chatMessages: [],
    isSaving: false,
    lastSaved: null,
    agentTask: null,
    lastIntentDetection: null,
  },

  setConnected: (connected) => set({ connected }),
  
  addMessage: (message) => {
    // Check if this message contains browsing results in auxiliary
    let newBrowsingResult: BrowsingResult | null = null;
    if (message.auxiliary) {
      try {
        const aux = typeof message.auxiliary === 'string' ? JSON.parse(message.auxiliary) : message.auxiliary;
        if (aux.type === 'browsing_trigger' && aux.browsingResults) {
          newBrowsingResult = {
            sessionId: aux.sessionId,
            query: aux.query,
            summary: aux.browsingResults.summary,
            pages: aux.browsingResults.pages,
            timestamp: aux.browsingResults.timestamp,
            messageId: message.id
          };
        }
      } catch (e) {
        console.error('[Store] Failed to parse message auxiliary:', e);
      }
    }

    set((state) => ({
      messages: [...state.messages, message],
      browsingResults: newBrowsingResult 
        ? [...state.browsingResults, newBrowsingResult]
        : state.browsingResults
    }));
  },

  appendToCurrentMessage: (token) => set((state) => ({
    currentMessage: state.currentMessage + token
  })),

  completeMessage: () => {
    const content = get().currentMessage;
    if (content) {
      set((state) => ({
        messages: [
          ...state.messages,
          {
            id: Date.now(),
            role: 'assistant',
            content,
            createdAt: new Date().toISOString()
          }
        ],
        currentMessage: ''
      }));
    }
  },

  splitMessage: () => {
    // When a split is detected, save current message as temp and start a new one
    const content = get().currentMessage;
    if (content) {
      console.log('[Store] Splitting message, content length:', content.length);
      set((state) => ({
        tempMessages: [
          ...state.tempMessages,
          {
            id: Date.now() + state.tempMessages.length, // Unique temp IDs
            role: 'assistant' as const,
            content,
            createdAt: new Date().toISOString()
          }
        ],
        currentMessage: '' // Clear for next message part
      }));
    }
  },

  finalizeMessages: () => {
    // When streaming is complete, add any remaining temp messages
    const content = get().currentMessage;
    const temps = get().tempMessages;
    
    console.log('[Store] Finalizing messages - temps:', temps.length, 'current:', content.length);
    
    // Add the last message if it exists
    if (content) {
      set((state) => ({
        tempMessages: [
          ...state.tempMessages,
          {
            id: Date.now() + state.tempMessages.length,
            role: 'assistant' as const,
            content,
            createdAt: new Date().toISOString()
          }
        ],
        currentMessage: ''
      }));
    }
  },

  replaceTempMessage: (message) => {
    // Replace temp messages with actual saved messages from the database
    console.log('[Store] Replacing temp message with saved message:', message.id);
    const temps = get().tempMessages;
    
    if (temps.length > 0) {
      // Replace the first temp message with the real one
      const [first, ...rest] = temps;
      set((state) => ({
        messages: [...state.messages, message],
        tempMessages: rest
      }));
    } else {
      // No temp messages, just add it normally
      set((state) => ({
        messages: [...state.messages, message]
      }));
    }
  },

  updateActivity: (activity) => set((state) => {
    const existing = state.activities.findIndex(a => a.id === activity.id);
    if (existing >= 0) {
      const newActivities = [...state.activities];
      // Merge the new activity data with existing to preserve any fields
      newActivities[existing] = {
        ...newActivities[existing],
        ...activity,
        // Ensure metadata is deeply merged if both exist
        metadata: activity.metadata ? {
          ...newActivities[existing].metadata,
          ...activity.metadata
        } : newActivities[existing].metadata
      };
      return { activities: newActivities };
    }
    return { activities: [...state.activities, activity] };
  }),

  setActivities: (activities) => set({ activities }),

  addSearchResult: (result) => set((state) => ({
    searchResults: [...state.searchResults, result]
  })),

  setPersonality: (personality) => set({ personality }),
  
  setPersona: (persona) => set({ persona }),
  
  setEvolutionEvents: (events) => set({ evolutionEvents: events }),
  
  toggleDiagnostics: () => set((state) => ({
    showDiagnostics: !state.showDiagnostics
  })),

  setError: (error) => set({ error }),
  
  updateDreamStatus: (dreamStatus) => set({ dreamStatus }),
  
  updateContextUsage: (usage) => set({ 
    contextUsage: { ...usage, timestamp: new Date().toISOString() } 
  }),

  setContextSnapshot: (snapshot) => set({ contextSnapshot: snapshot }),

  addReflectionEvent: (event) => set((state) => ({
    reflectionEvents: [event as ReflectionEvent, ...state.reflectionEvents].slice(0, 20)
  })),

  addBeliefEvent: (event) => set((state) => ({
    beliefEvents: [event, ...state.beliefEvents].slice(0, 50)
  })),

  addGoalEvent: (event) => set((state) => ({
    goalEvents: [event, ...state.goalEvents].slice(0, 50)
  })),
  
  clearMessages: () => set({ messages: [], currentMessage: '' }),

  deleteMessage: async (messageId: number) => {
    try {
      console.log(`[Store] Deleting message ID: ${messageId}`);
      const response = await fetch(`http://localhost:3001/api/messages/${messageId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to delete message: ${error}`);
      }

      // Remove message from local state and related browsing results
      set((state) => ({
        messages: state.messages.filter(msg => msg.id !== messageId),
        browsingResults: state.browsingResults.filter(br => br.messageId !== messageId)
      }));

      console.log(`[Store] Message ${messageId} deleted successfully`);
    } catch (error) {
      console.error('[Store] Delete message error:', error);
      throw error;
    }
  },

  loadMessages: async () => {
    try {
      console.log('[Store] Loading historical messages...');
      const response = await fetch('http://localhost:3001/api/messages?limit=100');
      if (response.ok) {
        const messages = await response.json();
        console.log(`[Store] Loaded ${messages.length} historical messages`);
        set({ messages });

        // Reconstruct browsing results from message auxiliary data
        const reconstructedBrowsingResults: BrowsingResult[] = [];
        for (const msg of messages) {
          if (msg.auxiliary) {
            try {
              const aux = typeof msg.auxiliary === 'string' ? JSON.parse(msg.auxiliary) : msg.auxiliary;
              if (aux.type === 'browsing_trigger' && aux.browsingResults) {
                reconstructedBrowsingResults.push({
                  sessionId: aux.sessionId,
                  query: aux.query,
                  summary: aux.browsingResults.summary,
                  pages: aux.browsingResults.pages,
                  timestamp: aux.browsingResults.timestamp,
                  messageId: msg.id
                });
                console.log(`[Store] Reconstructed browsing result for session: ${aux.sessionId}`);
              }
            } catch (e) {
              console.error('[Store] Failed to parse message auxiliary:', e);
            }
          }
        }

        if (reconstructedBrowsingResults.length > 0) {
          set({ browsingResults: reconstructedBrowsingResults });
          console.log(`[Store] Reconstructed ${reconstructedBrowsingResults.length} browsing results`);
        }
      }
    } catch (error) {
      console.error('[Store] Failed to load messages:', error);
    }
  },

  loadActivities: async () => {
    try {
      console.log('[Store] Loading historical activities...');
      const response = await fetch('http://localhost:3001/api/activities?limit=50');
      if (response.ok) {
        const activities = await response.json();
        console.log(`[Store] Loaded ${activities.length} activities`);
        set({ activities });
      }
    } catch (error) {
      console.error('[Store] Failed to load activities:', error);
    }
  },

  loadSearchResults: async () => {
    try {
      console.log('[Store] Loading historical search results...');
      const response = await fetch('http://localhost:3001/api/search-results?limit=50');
      if (response.ok) {
        const searchResults = await response.json();
        console.log(`[Store] Loaded ${searchResults.length} search results`);
        set({ searchResults });
      }
    } catch (error) {
      console.error('[Store] Failed to load search results:', error);
    }
  },

  loadPersona: async () => {
    try {
      console.log('[Store] Loading persona snapshot...');
      const response = await fetch('http://localhost:3001/api/persona');
      if (response.ok) {
        const persona = await response.json();
        console.log('[Store] Loaded persona snapshot');
        set({ persona });
      }
    } catch (error) {
      console.error('[Store] Failed to load persona:', error);
    }
  },

  loadEvolutionEvents: async () => {
    try {
      console.log('[Store] Loading evolution events...');
      const response = await fetch('http://localhost:3001/api/persona/evolution?limit=50');
      if (response.ok) {
        const events = await response.json();
        console.log(`[Store] Loaded ${events.length} evolution events`);
        set({ evolutionEvents: events });
      }
    } catch (error) {
      console.error('[Store] Failed to load evolution events:', error);
    }
  },

  // Agent browsing actions
  setAgentApprovalRequest: (data) => set((state) => ({
    agentSession: {
      ...state.agentSession,
      sessionId: data.sessionId,
      isActive: false,
      approved: false,
      evelynIntent: data.evelynIntent,
      query: data.query,
      entryUrl: data.entryUrl,
      maxPages: data.maxPages || 5,
      estimatedTime: data.estimatedTime,
      startedAt: new Date().toISOString(),
      pages: [],
      pageCount: 0,
      error: null,
      summary: null
    }
  })),

  updateAgentStatus: (data) => set((state) => ({
    agentSession: {
      ...state.agentSession,
      isActive: true,
      currentStep: data.step,
      currentDetail: data.detail,
      pageCount: data.pageCount || state.agentSession.pageCount,
      maxPages: data.maxPages || state.agentSession.maxPages
    }
  })),

  addAgentPage: (page) => set((state) => ({
    agentSession: {
      ...state.agentSession,
      pages: [...state.agentSession.pages, page],
      pageCount: state.agentSession.pages.length + 1
    }
  })),

  completeAgentSession: (data) => set((state) => ({
    agentSession: {
      ...state.agentSession,
      isActive: false,
      currentStep: 'complete',
      summary: data.summary,
      error: null
    }
  })),

  setAgentError: (data) => set((state) => ({
    agentSession: {
      ...state.agentSession,
      isActive: false,
      error: data.message,
      currentStep: 'error'
    }
  })),

  addBrowsingResult: (result) => set((state) => ({
    browsingResults: [...state.browsingResults, result]
  })),

  resetAgentSession: () => set({
    agentSession: {
      sessionId: null,
      approved: false,
      isActive: false,
      startedAt: null,
      currentStep: null,
      currentDetail: null,
      pages: [],
      pageCount: 0,
      maxPages: 5,
      error: null,
      summary: null
    }
  }),

  // Logs actions
  addLogEntry: (entry) => set((state) => {
    if (state.logsPaused) return state;
    
    const newLogs = [...state.logs, entry];
    if (newLogs.length > state.logsMaxSize) {
      newLogs.shift();
    }
    return { logs: newLogs };
  }),

  clearLogs: () => set({ logs: [] }),

  setLogsPaused: (paused) => set({ logsPaused: paused }),

  loadLogs: async () => {
    try {
      const response = await fetch('http://localhost:3001/api/logs?limit=300');
      if (response.ok) {
        const data = await response.json();
        set({ logs: data.logs || [] });
      }
    } catch (error) {
      console.error('[Store] Failed to load logs:', error);
    }
  },

  // UI actions
  setActiveTab: (tab) => set((state) => ({
    uiState: { ...state.uiState, activeTab: tab }
  })),

  setCommandPaletteOpen: (open) => set((state) => ({
    uiState: { ...state.uiState, commandPaletteOpen: open }
  })),

  setQuickSearchOpen: (open) => set((state) => ({
    uiState: { ...state.uiState, quickSearchOpen: open }
  })),

  setSettingsModalOpen: (open) => set((state) => ({
    uiState: { ...state.uiState, settingsModalOpen: open }
  })),

  // Command history actions
  addToHistory: (command) => set((state) => {
    const trimmed = command.trim();
    if (!trimmed || (state.commandHistory.entries.length > 0 && 
        state.commandHistory.entries[state.commandHistory.entries.length - 1] === trimmed)) {
      return state;
    }
    
    const newEntries = [...state.commandHistory.entries, trimmed];
    if (newEntries.length > 100) {
      newEntries.shift();
    }
    
    return {
      commandHistory: {
        entries: newEntries,
        index: -1
      }
    };
  }),

  navigateHistory: (direction) => {
    const state = get();
    const { entries, index } = state.commandHistory;
    
    if (entries.length === 0) return null;
    
    let newIndex = index;
    if (direction === 'up') {
      if (index === -1) {
        newIndex = entries.length - 1;
      } else if (index > 0) {
        newIndex = index - 1;
      }
    } else {
      if (index === -1) return null;
      if (index < entries.length - 1) {
        newIndex = index + 1;
      } else {
        newIndex = -1;
      }
    }
    
    set((state) => ({
      commandHistory: { ...state.commandHistory, index: newIndex }
    }));
    
    return newIndex === -1 ? '' : entries[newIndex];
  },

  resetHistoryIndex: () => set((state) => ({
    commandHistory: { ...state.commandHistory, index: -1 }
  })),
  
  // Toast actions
  addToast: (toast) => set((state) => {
    const newToast = { ...toast, id: `toast-${Date.now()}-${Math.random()}` };
    const newToasts = [...state.toasts, newToast];
    
    // Limit to 10 toasts max to prevent memory leaks
    if (newToasts.length > 10) {
      return { toasts: newToasts.slice(-10) };
    }
    
    return { toasts: newToasts };
  }),
  
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter(t => t.id !== id)
  })),
  
  // ========================================
  // COLLABORATE FEATURE ACTION IMPLEMENTATIONS
  // ========================================
  
  // Document management
  setActiveDocument: (document) => set((state) => ({
    collaborateState: { ...state.collaborateState, activeDocument: document }
  })),
  
  setDocumentList: (documents) => set((state) => ({
    collaborateState: { ...state.collaborateState, documentList: documents }
  })),
  
  createDocument: async (title, contentType, language) => {
    try {
      console.log(`[Store] Creating collaborate document: ${title}`);
      const response = await fetch('http://localhost:3001/api/collaborate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, contentType, language })
      });
      
      if (response.ok) {
        const document = await response.json();
        console.log(`[Store] Created document: ${document.id}`);
        set((state) => ({
          collaborateState: {
            ...state.collaborateState,
            activeDocument: document,
            documentList: [document, ...state.collaborateState.documentList],
            currentContent: '',
            versionHistory: []
          }
        }));
      }
    } catch (error) {
      console.error('[Store] Failed to create document:', error);
      throw error;
    }
  },
  
  updateDocumentContent: (content) => set((state) => ({
    collaborateState: { ...state.collaborateState, currentContent: content }
  })),
  
  deleteDocument: async (documentId) => {
    try {
      console.log(`[Store] Deleting document: ${documentId}`);
      const response = await fetch(`http://localhost:3001/api/collaborate/${documentId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        set((state) => ({
          collaborateState: {
            ...state.collaborateState,
            documentList: state.collaborateState.documentList.filter(d => d.id !== documentId),
            activeDocument: state.collaborateState.activeDocument?.id === documentId ? null : state.collaborateState.activeDocument
          }
        }));
      }
    } catch (error) {
      console.error('[Store] Failed to delete document:', error);
      throw error;
    }
  },
  
  archiveDocument: async (documentId) => {
    try {
      console.log(`[Store] Archiving document: ${documentId}`);
      const response = await fetch(`http://localhost:3001/api/collaborate/${documentId}/archive`, {
        method: 'PATCH'
      });
      
      if (response.ok) {
        const updated = await response.json();
        set((state) => ({
          collaborateState: {
            ...state.collaborateState,
            documentList: state.collaborateState.documentList.map(d => 
              d.id === documentId ? updated : d
            ),
            activeDocument: state.collaborateState.activeDocument?.id === documentId ? updated : state.collaborateState.activeDocument
          }
        }));
      }
    } catch (error) {
      console.error('[Store] Failed to archive document:', error);
      throw error;
    }
  },
  
  // Suggestions
  addSuggestion: (suggestion) => set((state) => ({
    collaborateState: {
      ...state.collaborateState,
      currentSuggestions: [...state.collaborateState.currentSuggestions, suggestion]
    }
  })),
  
  applySuggestion: async (suggestionId) => {
    try {
      const state = get();
      if (!state.collaborateState.activeDocument) return;
      
      const response = await fetch(`http://localhost:3001/api/collaborate/${state.collaborateState.activeDocument.id}/apply-suggestion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId })
      });
      
      if (response.ok) {
        set((state) => ({
          collaborateState: {
            ...state.collaborateState,
            currentSuggestions: state.collaborateState.currentSuggestions.map(s =>
              s.id === suggestionId ? { ...s, status: 'applied' as const } : s
            )
          }
        }));
      }
    } catch (error) {
      console.error('[Store] Failed to apply suggestion:', error);
      throw error;
    }
  },
  
  rejectSuggestion: async (suggestionId) => {
    try {
      const state = get();
      if (!state.collaborateState.activeDocument) return;
      
      const response = await fetch(`http://localhost:3001/api/collaborate/${state.collaborateState.activeDocument.id}/reject-suggestion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId })
      });
      
      if (response.ok) {
        set((state) => ({
          collaborateState: {
            ...state.collaborateState,
            currentSuggestions: state.collaborateState.currentSuggestions.filter(s => s.id !== suggestionId)
          }
        }));
      }
    } catch (error) {
      console.error('[Store] Failed to reject suggestion:', error);
      throw error;
    }
  },
  
  clearSuggestions: () => set((state) => ({
    collaborateState: { ...state.collaborateState, currentSuggestions: [] }
  })),
  
  setSuggestions: (suggestions) => set((state) => ({
    collaborateState: { ...state.collaborateState, currentSuggestions: suggestions }
  })),
  
  // Version control
  saveVersion: async (description) => {
    try {
      const state = get();
      if (!state.collaborateState.activeDocument) return;
      
      const response = await fetch(`http://localhost:3001/api/collaborate/${state.collaborateState.activeDocument.id}/save-version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: state.collaborateState.currentContent,
          description 
        })
      });
      
      if (response.ok) {
        const version = await response.json();
        set((state) => ({
          collaborateState: {
            ...state.collaborateState,
            versionHistory: [version, ...state.collaborateState.versionHistory],
            lastSaved: new Date().toISOString()
          }
        }));
      }
    } catch (error) {
      console.error('[Store] Failed to save version:', error);
      throw error;
    }
  },
  
  revertToVersion: async (versionId) => {
    try {
      const state = get();
      if (!state.collaborateState.activeDocument) return;
      
      const response = await fetch(`http://localhost:3001/api/collaborate/${state.collaborateState.activeDocument.id}/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId })
      });
      
      if (response.ok) {
        const { content } = await response.json();
        set((state) => ({
          collaborateState: { ...state.collaborateState, currentContent: content }
        }));
      }
    } catch (error) {
      console.error('[Store] Failed to revert version:', error);
      throw error;
    }
  },
  
  loadVersionHistory: async () => {
    try {
      const state = get();
      if (!state.collaborateState.activeDocument) return;
      
      const response = await fetch(`http://localhost:3001/api/collaborate/${state.collaborateState.activeDocument.id}/versions`);
      if (response.ok) {
        const versions = await response.json();
        set((state) => ({
          collaborateState: { ...state.collaborateState, versionHistory: versions }
        }));
      }
    } catch (error) {
      console.error('[Store] Failed to load version history:', error);
    }
  },
  
  setVersionHistory: (versions) => set((state) => ({
    collaborateState: { ...state.collaborateState, versionHistory: versions }
  })),
  
  // UI state
  setCollaborateActivePanel: (panel) => set((state) => ({
    collaborateState: { ...state.collaborateState, activePanel: panel }
  })),
  
  setSelectedRange: (range) => set((state) => ({
    collaborateState: { ...state.collaborateState, selectedRange: range }
  })),
  
  setCollaborateGeneratingStatus: (isGenerating, shortcutType) => set((state) => ({
    collaborateState: {
      ...state.collaborateState,
      isGenerating,
      generatingShortcut: shortcutType || null
    }
  })),
  
  setShowInlineSuggestions: (show) => set((state) => ({
    collaborateState: { ...state.collaborateState, showInlineSuggestions: show }
  })),
  
  setEditMode: (mode) => set((state) => ({
    collaborateState: { ...state.collaborateState, editMode: mode }
  })),
  
  setSavingStatus: (isSaving) => set((state) => ({
    collaborateState: {
      ...state.collaborateState,
      isSaving,
      lastSaved: isSaving ? state.collaborateState.lastSaved : new Date().toISOString()
    }
  })),
  
  // Chat
  addCollaborateChatMessage: (role, content, metadata) => set((state) => {
    const nextIndex = metadata?.messageIndex ?? state.collaborateState.chatMessages.length;
    const nextMessage: CollaborateChatMessage = {
      id: metadata?.id,
      role,
      content,
      timestamp: metadata?.timestamp ?? new Date().toISOString(),
      messageIndex: nextIndex
    };

    return {
      collaborateState: {
        ...state.collaborateState,
        chatMessages: [...state.collaborateState.chatMessages, nextMessage]
      }
    };
  }),

  setCollaborateChatMessages: (messages) => set((state) => ({
    collaborateState: {
      ...state.collaborateState,
      chatMessages: messages
    }
  })),
  
  clearCollaborateChat: () => set((state) => ({
    collaborateState: { ...state.collaborateState, chatMessages: [], lastIntentDetection: null }
  })),

  setCollaborateAgentTask: (task: CollaborateAgentTaskSession | null) => set((state) => ({
    collaborateState: { ...state.collaborateState, agentTask: task }
  })),

  setCollaborateIntentDetection: (intent) => set((state) => ({
    collaborateState: {
      ...state.collaborateState,
      lastIntentDetection: intent
    }
  })),
  
  // Load data



  loadCollaborateDocuments: async () => {
    try {
      console.log('[Store] Loading collaborate documents...');
      const response = await fetch('http://localhost:3001/api/collaborate?limit=50');
      if (response.ok) {
        const documents = await response.json();
        console.log(`[Store] Loaded ${documents.length} collaborate documents`);
        set((state) => ({
          collaborateState: { ...state.collaborateState, documentList: documents }
        }));
      }
    } catch (error) {
      console.error('[Store] Failed to load collaborate documents:', error);
    }
  },
  
  loadCollaborateDocument: async (documentId) => {
    try {
      console.log(`[Store] Loading collaborate document ${documentId}...`);
      const response = await fetch(`http://localhost:3001/api/collaborate/${documentId}`);
      if (response.ok) {
        const document = await response.json();
        console.log(`[Store] Loaded document: ${document.title}`);
        
        // Get the latest version content if available
        const latestVersion = document.versions && document.versions.length > 0 
          ? document.versions[0]
          : null;

        let chatMessages: CollaborateChatMessage[] = [];
        try {
          const chatResponse = await fetch(`http://localhost:3001/api/collaborate/${documentId}/chat`);
          if (chatResponse.ok) {
            const serverMessages = await chatResponse.json();
            chatMessages = Array.isArray(serverMessages)
              ? serverMessages.map((msg: any, idx: number) => ({
                  id: msg.id,
                  role: msg.role,
                  content: msg.content,
                  timestamp: msg.timestamp || new Date().toISOString(),
                  messageIndex: typeof msg.messageIndex === 'number' ? msg.messageIndex : idx
                }))
              : [];
          }
        } catch (chatError) {
          console.error('[Store] Failed to hydrate collaborate chat history:', chatError);
        }
        
        set((state) => ({
          collaborateState: {
            ...state.collaborateState,
            activeDocument: document,
            currentContent: latestVersion?.content || '',
            versionHistory: document.versions || [],
            currentSuggestions: document.suggestions?.filter((s: CollaborateSuggestion) => s.status === 'pending') || [],
            // New document load clears any previous agent task state
            agentTask: null,
            chatMessages,
            lastIntentDetection: null
          }
        }));
      }
    } catch (error) {
      console.error('[Store] Failed to load collaborate document:', error);
    }
  },
  
  // Alias implementations (to match component usage patterns)
  updateCollaborateDocumentContent: (content) => {
    get().updateDocumentContent(content);
  },
  
  setCollaborateSelectedRange: (range) => {
    get().setSelectedRange(range);
  },
  
  saveCollaborateVersion: async (description) => {
    await get().saveVersion(description);
  },
  
  deleteCollaborateDocument: async (documentId) => {
    await get().deleteDocument(documentId);
  },
  
  archiveCollaborateDocument: async (documentId) => {
    await get().archiveDocument(documentId);
  },
  
  applyCollaborateSuggestion: async (suggestionId) => {
    await get().applySuggestion(suggestionId);
  },
  
  rejectCollaborateSuggestion: async (suggestionId) => {
    await get().rejectSuggestion(suggestionId);
  },
  
  createCollaborateDocument: async (title, contentType, language) => {
    await get().createDocument(title, contentType, language);
  },
  
  applyCollaborateShortcut: async (shortcutType, options) => {
    try {
      const state = get();
      if (!state.collaborateState.activeDocument) return;
      
      const response = await fetch(`http://localhost:3001/api/collaborate/${state.collaborateState.activeDocument.id}/shortcut`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortcutType, options })
      });
      
      if (response.ok) {
        const { content } = await response.json();
        set((state) => ({
          collaborateState: { ...state.collaborateState, currentContent: content }
        }));
      }
    } catch (error) {
      console.error('[Store] Failed to apply shortcut:', error);
      throw error;
    }
  },
  
  loadCollaborateVersionHistory: async () => {
    await get().loadVersionHistory();
  },
  
  revertCollaborateToVersion: async (versionId) => {
    await get().revertToVersion(versionId);
  }
}));
