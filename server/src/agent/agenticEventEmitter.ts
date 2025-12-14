/**
 * Agentic Edit Event Emitter
 * 
 * Handles real-time streaming of edit progress to the frontend.
 * Provides a clean API for emitting various edit events.
 */

import { Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import type {
  AgenticIteration,
  EditPlan,
  EditChange,
  EditCheckpoint,
  CursorPresence,
  EditVerification,
  StructuredThought,
  ToolCall,
  ToolResult,
  GoalStatus,
} from './types/agenticTypes.js';

// ========================================
// Event Types
// ========================================

export type EditPhase = 'idle' | 'detecting' | 'planning' | 'executing' | 'verifying' | 'complete' | 'error';

export interface EditEventPayload {
  editId: string;
  documentId: number;
  timestamp: number;
}

// ========================================
// Event Emitter Class
// ========================================

// Socket getter type - returns current socket or null if disconnected
type SocketGetter = () => Socket | null;

export class AgenticEventEmitter {
  private socketGetter: SocketGetter;
  private editId: string;
  private documentId: number;
  private startTime: number;
  
  constructor(socket: Socket | SocketGetter, documentId: number, editId?: string) {
    // Support both direct socket and getter function for dynamic socket resolution
    this.socketGetter = typeof socket === 'function' ? socket : () => socket;
    this.documentId = documentId;
    this.editId = editId || uuidv4();
    this.startTime = Date.now();
  }
  
  get id(): string {
    return this.editId;
  }
  
  /**
   * Update the socket reference (called when client reconnects)
   */
  updateSocket(socket: Socket | SocketGetter): void {
    this.socketGetter = typeof socket === 'function' ? socket : () => socket;
  }
  
  private emit(event: string, data: any): void {
    const socket = this.socketGetter();
    if (!socket) {
      console.warn(`[AgenticEmitter] ⚠️ No socket available for ${event}`);
      return;
    }
    if (!socket.connected) {
      console.warn(`[AgenticEmitter] ⚠️ Socket not connected for ${event} (id: ${socket.id})`);
      return;
    }
    console.log(`[AgenticEmitter] 📤 Emitting ${event} to socket ${socket.id}`);
    socket.emit(event, {
      ...data,
      editId: this.editId,
      documentId: this.documentId,
      timestamp: Date.now(),
    });
  }
  
  // ========================================
  // Session Events
  // ========================================
  
  /**
   * Emit when edit session starts
   */
  emitStart(goal: string, approach: string, estimatedSteps: number): void {
    this.emit('agentic:start', {
      goal,
      approach,
      estimatedSteps,
    });
    console.log(`[AgenticEmitter] 🚀 Edit started: ${goal}`);
  }
  
  /**
   * Emit progress update
   */
  emitProgress(
    phase: EditPhase,
    progress: number,
    currentStep: number,
    totalSteps: number,
    message: string,
    currentSubGoal?: string
  ): void {
    this.emit('agentic:progress', {
      phase,
      progress: Math.min(100, Math.max(0, progress)),
      currentStep,
      totalSteps,
      message,
      currentSubGoal,
    });
  }
  
  /**
   * Emit when phase changes
   */
  emitPhaseChange(phase: EditPhase, message: string): void {
    this.emit('agentic:phase', {
      phase,
      message,
    });
    console.log(`[AgenticEmitter] 📍 Phase: ${phase} - ${message}`);
  }
  
  /**
   * Emit session complete
   */
  emitComplete(
    success: boolean,
    summary: string,
    changesCount: number,
    iterationsCount: number
  ): void {
    const duration = Date.now() - this.startTime;
    this.emit('agentic:complete', {
      success,
      summary,
      changesCount,
      iterationsCount,
      duration,
    });
    console.log(`[AgenticEmitter] ✅ Edit complete: ${summary} (${duration}ms)`);
  }
  
  /**
   * Emit error
   */
  emitError(error: string, recoverable: boolean, suggestion?: string): void {
    this.emit('agentic:error', {
      error,
      recoverable,
      suggestion,
    });
    console.error(`[AgenticEmitter] ❌ Error: ${error}`);
  }
  
  // ========================================
  // Plan Events
  // ========================================
  
  /**
   * Emit edit plan
   */
  emitPlan(plan: EditPlan): void {
    this.emit('agentic:plan', { plan });
    console.log(`[AgenticEmitter] 📋 Plan emitted: ${plan.subGoals.length} sub-goals`);
  }
  
  /**
   * Emit sub-goal status update
   */
  emitSubGoalUpdate(subGoalId: string, status: GoalStatus): void {
    this.emit('agentic:subgoal', {
      subGoalId,
      status,
    });
  }
  
  // ========================================
  // Iteration Events
  // ========================================
  
  /**
   * Emit iteration start
   */
  emitIterationStart(step: number, subGoalId?: string): void {
    this.emit('agentic:iteration:start', {
      step,
      subGoalId,
    });
  }
  
  /**
   * Emit thinking/structured thought
   */
  emitThinking(think: string, structuredThought?: StructuredThought): void {
    this.emit('agentic:thinking', {
      think,
      structuredThought,
    });
  }
  
  /**
   * Emit full iteration data
   */
  emitIteration(iteration: AgenticIteration, plan?: EditPlan): void {
    this.emit('agentic:iteration', {
      iteration,
      plan,
    });
  }
  
  // ========================================
  // Tool Events
  // ========================================
  
  /**
   * Emit tool call start
   */
  emitToolCall(toolCall: ToolCall): void {
    this.emit('agentic:tool:call', { toolCall });
    console.log(`[AgenticEmitter] 🔧 Tool: ${toolCall.tool}`);
  }
  
  /**
   * Emit tool result
   */
  emitToolResult(result: ToolResult): void {
    this.emit('agentic:tool:result', { result });
  }
  
  // ========================================
  // Content Events
  // ========================================
  
  /**
   * Emit content change (full replacement)
   */
  emitContentChange(content: string): void {
    this.emit('agentic:content', {
      content,
      isIncremental: false,
    });
  }
  
  /**
   * Emit incremental content change (for streaming effect)
   */
  emitIncrementalChange(
    position: { line: number; column: number },
    insert?: string,
    deleteCount?: number
  ): void {
    this.emit('agentic:content:incremental', {
      position,
      insert,
      deleteCount,
      isIncremental: true,
    });
  }
  
  /**
   * Emit diff summary
   */
  emitDiff(
    linesAdded: number,
    linesRemoved: number,
    hunks: Array<{ type: 'add' | 'remove' | 'context'; lineNumber: number; content: string }>
  ): void {
    this.emit('agentic:diff', {
      linesAdded,
      linesRemoved,
      hunks,
    });
  }
  
  // ========================================
  // Verification Events
  // ========================================
  
  /**
   * Emit verification result
   */
  emitVerification(verification: EditVerification): void {
    this.emit('agentic:verification', { verification });
    if (verification.warnings.length > 0) {
      console.log(`[AgenticEmitter] ⚠️ Verification warnings: ${verification.warnings.join(', ')}`);
    }
  }
  
  // ========================================
  // Checkpoint Events
  // ========================================
  
  /**
   * Emit checkpoint created
   */
  emitCheckpoint(checkpoint: EditCheckpoint): void {
    this.emit('agentic:checkpoint', { checkpoint });
    console.log(`[AgenticEmitter] 🔒 Checkpoint: ${checkpoint.description}`);
  }
  
  // ========================================
  // Cursor Events
  // ========================================
  
  /**
   * Emit cursor presence
   */
  emitCursorPresence(presence: CursorPresence): void {
    this.emit('collaborate:evelyn_presence', presence);
  }
  
  /**
   * Emit cursor move
   */
  emitCursorMove(line: number, column: number, action: CursorPresence['action']): void {
    this.emit('collaborate:cursor_move', {
      line,
      column,
      action,
    });
  }
  
  // ========================================
  // Convenience Methods
  // ========================================
  
  /**
   * Helper to emit a complete iteration cycle
   */
  async emitIterationCycle(
    step: number,
    think: string,
    structuredThought: StructuredThought | undefined,
    toolCall: ToolCall | undefined,
    toolResult: ToolResult | undefined,
    goalStatus: GoalStatus,
    subGoalId?: string
  ): Promise<void> {
    const iteration: AgenticIteration = {
      id: uuidv4(),
      step,
      subGoalId,
      timestamp: Date.now(),
      duration: 0, // Will be calculated
      think,
      structuredThought,
      toolCall,
      toolResult,
      goalStatus,
    };
    
    this.emitIteration(iteration);
  }
  
  /**
   * Helper to emit personality-driven status message
   */
  emitPersonalityStatus(phase: EditPhase, customMessage?: string): void {
    const messages: Record<EditPhase, string[]> = {
      idle: ['Ready~', 'Standing by...'],
      detecting: ['Hmm, let me think about this...', 'Analyzing your request~'],
      planning: ['Breaking this down...', 'Planning the approach~'],
      executing: ['Working on it!', 'Making the changes~'],
      verifying: ['Double-checking...', 'Making sure it looks right~'],
      complete: ['All done! ✨', 'There we go~'],
      error: ['Oops, something went wrong...', 'Let me try another way...'],
    };
    
    const phaseMessages = messages[phase];
    const message = customMessage || phaseMessages[Math.floor(Math.random() * phaseMessages.length)];
    
    this.emitProgress(phase, phase === 'complete' ? 100 : 50, 0, 0, message);
  }
}

// ========================================
// Factory Function
// ========================================

export function createAgenticEmitter(
  socket: Socket | (() => Socket | null), 
  documentId: number, 
  editId?: string
): AgenticEventEmitter {
  return new AgenticEventEmitter(socket, documentId, editId);
}

export default AgenticEventEmitter;
