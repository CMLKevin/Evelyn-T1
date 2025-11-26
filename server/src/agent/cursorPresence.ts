/**
 * Cursor Presence Module
 * 
 * Handles emitting cursor and selection events during agentic editing.
 * These events are used by the frontend to visualize Evelyn's position
 * in the Monaco editor in real-time.
 */

import { Socket } from 'socket.io';
import { WS_EVENTS } from '../constants/index.js';

// ========================================
// Types
// ========================================

export type PresenceAction = 'idle' | 'thinking' | 'reading' | 'typing' | 'selecting' | 'searching';

export interface CursorPosition {
  line: number;
  column: number;
}

export interface SelectionRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface EvelynPresence {
  documentId: number;
  action: PresenceAction;
  cursor?: CursorPosition;
  selection?: SelectionRange;
  targetDescription?: string;
  timestamp: string;
}

// ========================================
// Cursor Presence Emitter
// ========================================

export class CursorPresenceEmitter {
  private socket: Socket;
  private documentId: number;

  constructor(socket: Socket, documentId: number) {
    this.socket = socket;
    this.documentId = documentId;
  }

  /**
   * Emit cursor move event
   */
  emitCursorMove(line: number, column: number, action: PresenceAction = 'idle') {
    this.socket.emit(WS_EVENTS.COLLABORATE.CURSOR_MOVE, {
      documentId: this.documentId,
      line,
      column,
      action,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit selection change event
   */
  emitSelectionChange(
    startLine: number, 
    startColumn: number, 
    endLine: number, 
    endColumn: number,
    action: PresenceAction = 'selecting'
  ) {
    this.socket.emit(WS_EVENTS.COLLABORATE.SELECTION_CHANGE, {
      documentId: this.documentId,
      startLine,
      startColumn,
      endLine,
      endColumn,
      action,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit full presence update
   */
  emitPresence(presence: Omit<EvelynPresence, 'documentId' | 'timestamp'>) {
    this.socket.emit(WS_EVENTS.COLLABORATE.EVELYN_PRESENCE, {
      ...presence,
      documentId: this.documentId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit thinking state
   */
  emitThinking(description?: string) {
    this.emitPresence({
      action: 'thinking',
      targetDescription: description
    });
  }

  /**
   * Emit reading state at a specific line
   */
  emitReading(line: number, column: number = 1) {
    this.emitPresence({
      action: 'reading',
      cursor: { line, column }
    });
  }

  /**
   * Emit searching state
   */
  emitSearching(pattern: string) {
    this.emitPresence({
      action: 'searching',
      targetDescription: `Searching for: ${pattern.slice(0, 50)}`
    });
  }

  /**
   * Emit typing state with cursor position
   */
  emitTyping(line: number, column: number) {
    this.emitPresence({
      action: 'typing',
      cursor: { line, column }
    });
  }

  /**
   * Emit selection state (for replace operations)
   */
  emitSelecting(selection: SelectionRange) {
    this.emitPresence({
      action: 'selecting',
      cursor: { line: selection.startLine, column: selection.startColumn },
      selection
    });
  }

  /**
   * Clear presence (editing complete)
   */
  emitIdle() {
    this.emitPresence({ action: 'idle' });
  }
}

// ========================================
// Helper Functions
// ========================================

/**
 * Find the line and column of a text pattern in content
 */
export function findTextPosition(content: string, searchText: string): CursorPosition | null {
  const index = content.indexOf(searchText);
  if (index === -1) return null;

  const lines = content.substring(0, index).split('\n');
  const line = lines.length;
  const column = lines[lines.length - 1].length + 1;

  return { line, column };
}

/**
 * Find the selection range for a text pattern in content
 */
export function findTextRange(content: string, searchText: string): SelectionRange | null {
  const startPos = findTextPosition(content, searchText);
  if (!startPos) return null;

  const searchLines = searchText.split('\n');
  const endLine = startPos.line + searchLines.length - 1;
  const endColumn = searchLines.length > 1
    ? searchLines[searchLines.length - 1].length + 1
    : startPos.column + searchText.length;

  return {
    startLine: startPos.line,
    startColumn: startPos.column,
    endLine,
    endColumn
  };
}

/**
 * Factory function to create a cursor presence emitter
 */
export function createCursorPresence(socket: Socket, documentId: number): CursorPresenceEmitter {
  return new CursorPresenceEmitter(socket, documentId);
}

export default CursorPresenceEmitter;
