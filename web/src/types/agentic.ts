/**
 * Agentic Code Editor - Frontend Types
 * 
 * Type definitions for the agentic editing UI components.
 * Mirrors backend types for type safety across the stack.
 */

// ========================================
// Core Enums & Types
// ========================================

export type EditComplexity = 'simple' | 'moderate' | 'complex';
export type GoalStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'skipped';
export type RiskLevel = 'low' | 'medium' | 'high';
export type ToolName = 'read_file' | 'write_to_file' | 'replace_in_file' | 'search_files';
export type CursorAction = 'idle' | 'thinking' | 'reading' | 'typing' | 'selecting' | 'searching' | 'verifying';
export type EditPhase = 'idle' | 'detecting' | 'planning' | 'executing' | 'verifying' | 'complete' | 'error';

// ========================================
// Structured Thinking
// ========================================

export interface StructuredThought {
  observation: string;
  plan: string;
  risk: RiskLevel;
  toolChoice: string;
  confidence: number;
}

// ========================================
// Tool System
// ========================================

export interface ToolCall {
  id: string;
  tool: ToolName;
  params: Record<string, any>;
  timestamp: number;
}

export interface ToolResult {
  toolCallId: string;
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  duration: number;
}

// ========================================
// Goals & Planning
// ========================================

export interface SubGoal {
  id: string;
  description: string;
  status: GoalStatus;
  estimatedSteps: number;
  actualSteps: number;
  dependencies: string[];
  order: number;
}

export interface EditPlan {
  id: string;
  overallGoal: string;
  approach: string;
  subGoals: SubGoal[];
  currentSubGoalId: string | null;
  estimatedTotalSteps: number;
  actualSteps: number;
  complexity: EditComplexity;
}

// ========================================
// Iterations
// ========================================

export interface AgenticIteration {
  id: string;
  step: number;
  subGoalId?: string;
  timestamp: number;
  duration: number;
  think: string;
  structuredThought?: StructuredThought;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  goalStatus: GoalStatus;
}

// ========================================
// Changes & Diff
// ========================================

export interface EditChange {
  id: string;
  type: 'write' | 'replace' | 'insert' | 'delete';
  description: string;
  lineStart?: number;
  lineEnd?: number;
  before?: string;
  after?: string;
  timestamp: number;
}

export interface DiffLine {
  type: 'add' | 'remove' | 'context';
  lineNumber: number;
  content: string;
}

// ========================================
// Checkpoints
// ========================================

export interface EditCheckpoint {
  id: string;
  iteration: number;
  timestamp: number;
  description: string;
}

// ========================================
// Cursor Presence
// ========================================

export interface CursorPosition {
  line: number;
  column: number;
}

export interface CursorPresence {
  action: CursorAction;
  cursor?: CursorPosition;
  selection?: { start: CursorPosition; end: CursorPosition };
  targetDescription?: string;
}

// ========================================
// Edit Session State
// ========================================

export interface AgenticEditSession {
  id: string;
  documentId: number;
  phase: EditPhase;
  plan: EditPlan | null;
  iterations: AgenticIteration[];
  changes: EditChange[];
  checkpoints: EditCheckpoint[];
  currentIteration: number;
  totalIterations: number;
  progress: number; // 0-100
  startTime: number;
  endTime?: number;
  error?: string;
  
  // Content states for diff
  originalContent: string;
  currentContent: string;
  pendingContent?: string;
  
  // Cursor
  cursorPresence: CursorPresence | null;
}

// ========================================
// WebSocket Events (Frontend receives)
// ========================================

export interface EditStartEvent {
  editId: string;
  documentId: number;
  goal: string;
  approach: string;
  estimatedSteps: number;
}

export interface EditProgressEvent {
  editId: string;
  phase: EditPhase;
  progress: number;
  currentStep: number;
  totalSteps: number;
  currentSubGoal?: string;
  message: string;
}

export interface EditIterationEvent {
  editId: string;
  iteration: AgenticIteration;
  plan?: EditPlan;
}

export interface EditContentEvent {
  editId: string;
  documentId: number;
  content: string;
  diff?: DiffLine[];
  isIncremental: boolean;
}

export interface EditCompleteEvent {
  editId: string;
  success: boolean;
  summary: string;
  changesCount: number;
  iterationsCount: number;
  duration: number;
}

export interface EditErrorEvent {
  editId: string;
  error: string;
  recoverable: boolean;
  suggestion?: string;
}

// ========================================
// Component Props
// ========================================

export interface AgenticEditProgressProps {
  session: AgenticEditSession | null;
  onJumpToLine?: (line: number) => void;
  onUndo?: (checkpointId: string) => void;
  onRetry?: () => void;
  onCancel?: () => void;
  compact?: boolean;
}

export interface EditPlanSidebarProps {
  plan: EditPlan | null;
  currentIteration: number;
  totalIterations: number;
  isActive: boolean;
  onGoalClick?: (goalId: string) => void;
}

export interface LiveDiffViewProps {
  original: string;
  current: string;
  pending?: string;
  highlightLines?: number[];
  language?: string;
}

export interface EditControlBarProps {
  session: AgenticEditSession | null;
  onUndo?: () => void;
  onRedo?: () => void;
  onRetry?: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

// ========================================
// Utility Functions Types
// ========================================

export interface PersonalityMessageOptions {
  phase: EditPhase;
  tool?: ToolName;
  success?: boolean;
  errorType?: 'noMatch' | 'syntaxError' | 'timeout' | 'generic';
}

// ========================================
// Store Slice
// ========================================

export interface AgenticEditState {
  activeSession: AgenticEditSession | null;
  recentSessions: AgenticEditSession[];
  isEditing: boolean;
  
  // Actions
  startSession: (documentId: number, goal: string) => void;
  updateSession: (updates: Partial<AgenticEditSession>) => void;
  addIteration: (iteration: AgenticIteration) => void;
  setPhase: (phase: EditPhase) => void;
  updateContent: (content: string, diff?: DiffLine[]) => void;
  setCursorPresence: (presence: CursorPresence | null) => void;
  completeSession: (success: boolean, summary: string) => void;
  cancelSession: () => void;
  undoToCheckpoint: (checkpointId: string) => void;
}
