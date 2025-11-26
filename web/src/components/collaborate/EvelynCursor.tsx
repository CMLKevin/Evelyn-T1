import { useEffect, useRef, useState } from 'react';
import type * as Monaco from 'monaco-editor';

// ========================================
// Types
// ========================================

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
  action: 'idle' | 'thinking' | 'reading' | 'typing' | 'selecting' | 'searching';
  cursor?: CursorPosition;
  selection?: SelectionRange;
  targetDescription?: string;
  timestamp: string;
}

interface EvelynCursorProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  presence: EvelynPresence | null;
}

// ========================================
// CSS Classes for Monaco Decorations
// ========================================

const CURSOR_STYLE = `
  .evelyn-cursor-line {
    background-color: rgba(255, 149, 0, 0.1);
    border-left: 2px solid #ff9500;
  }
  
  .evelyn-cursor-widget {
    background-color: #ff9500;
    width: 2px;
    animation: evelyn-cursor-blink 1s ease-in-out infinite;
  }
  
  .evelyn-cursor-widget.thinking {
    animation: evelyn-cursor-pulse 0.8s ease-in-out infinite;
  }
  
  .evelyn-selection {
    background-color: rgba(255, 149, 0, 0.25);
    border: 1px solid rgba(255, 149, 0, 0.5);
  }
  
  .evelyn-cursor-label {
    position: absolute;
    background-color: #ff9500;
    color: black;
    font-size: 10px;
    font-weight: bold;
    font-family: monospace;
    padding: 2px 6px;
    border-radius: 0 4px 4px 0;
    white-space: nowrap;
    z-index: 100;
    pointer-events: none;
    transform: translateY(-100%);
  }
  
  @keyframes evelyn-cursor-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  
  @keyframes evelyn-cursor-pulse {
    0%, 100% { 
      opacity: 1;
      box-shadow: 0 0 0 0 rgba(255, 149, 0, 0.4);
    }
    50% { 
      opacity: 0.7;
      box-shadow: 0 0 10px 5px rgba(255, 149, 0, 0.2);
    }
  }
`;

// ========================================
// Component
// ========================================

export default function EvelynCursor({ editor, presence }: EvelynCursorProps) {
  const decorationsRef = useRef<string[]>([]);
  const widgetRef = useRef<Monaco.editor.IContentWidget | null>(null);
  const styleInjectedRef = useRef(false);

  // Inject CSS styles once
  useEffect(() => {
    if (styleInjectedRef.current) return;
    
    const style = document.createElement('style');
    style.textContent = CURSOR_STYLE;
    document.head.appendChild(style);
    styleInjectedRef.current = true;
    
    return () => {
      document.head.removeChild(style);
      styleInjectedRef.current = false;
    };
  }, []);

  // Update decorations when presence changes
  useEffect(() => {
    if (!editor || !presence) {
      // Clear decorations when no presence
      if (decorationsRef.current.length > 0) {
        editor?.deltaDecorations(decorationsRef.current, []);
        decorationsRef.current = [];
      }
      return;
    }

    const newDecorations: Monaco.editor.IModelDeltaDecoration[] = [];

    // Add cursor line decoration
    if (presence.cursor) {
      newDecorations.push({
        range: {
          startLineNumber: presence.cursor.line,
          startColumn: 1,
          endLineNumber: presence.cursor.line,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: 'evelyn-cursor-line',
          stickiness: 1, // NeverGrowsWhenTypingAtEdges
        },
      });
    }

    // Add selection decoration
    if (presence.selection) {
      newDecorations.push({
        range: {
          startLineNumber: presence.selection.startLine,
          startColumn: presence.selection.startColumn,
          endLineNumber: presence.selection.endLine,
          endColumn: presence.selection.endColumn,
        },
        options: {
          className: 'evelyn-selection',
          stickiness: 1,
        },
      });
    }

    // Update decorations
    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      newDecorations
    );

    // Update content widget (cursor indicator with label)
    if (presence.cursor) {
      // Remove old widget
      if (widgetRef.current) {
        editor.removeContentWidget(widgetRef.current);
      }

      // Create new widget
      const widget: Monaco.editor.IContentWidget = {
        getId: () => 'evelyn-cursor-widget',
        getDomNode: () => {
          const container = document.createElement('div');
          container.style.position = 'relative';
          
          // Cursor line
          const cursor = document.createElement('div');
          cursor.className = `evelyn-cursor-widget ${presence.action === 'thinking' ? 'thinking' : ''}`;
          cursor.style.height = '18px';
          container.appendChild(cursor);
          
          // Label
          const label = document.createElement('div');
          label.className = 'evelyn-cursor-label';
          label.textContent = getActionLabel(presence.action);
          container.appendChild(label);
          
          return container;
        },
        getPosition: () => ({
          position: {
            lineNumber: presence.cursor!.line,
            column: presence.cursor!.column,
          },
          preference: [0], // EXACT position
        }),
      };

      editor.addContentWidget(widget);
      widgetRef.current = widget;
    }

    // Cleanup on unmount
    return () => {
      if (widgetRef.current && editor) {
        editor.removeContentWidget(widgetRef.current);
        widgetRef.current = null;
      }
    };
  }, [editor, presence]);

  // Scroll to cursor position when Evelyn starts editing
  useEffect(() => {
    if (!editor || !presence?.cursor) return;
    
    // Only scroll when action changes to typing or selecting
    if (presence.action === 'typing' || presence.action === 'selecting') {
      editor.revealLineInCenter(presence.cursor.line);
    }
  }, [editor, presence?.action, presence?.cursor?.line]);

  return null; // This component only manages Monaco decorations
}

// ========================================
// Helpers
// ========================================

function getActionLabel(action: EvelynPresence['action']): string {
  switch (action) {
    case 'thinking':
      return 'Evelyn thinking...';
    case 'reading':
      return 'Evelyn reading';
    case 'typing':
      return 'Evelyn typing';
    case 'selecting':
      return 'Evelyn selecting';
    case 'searching':
      return 'Evelyn searching';
    default:
      return 'Evelyn';
  }
}

// ========================================
// Hook for managing presence state
// ========================================

export function useEvelynPresence() {
  const [presence, setPresence] = useState<EvelynPresence | null>(null);

  const updateCursor = (cursor: CursorPosition, action: EvelynPresence['action'] = 'idle') => {
    setPresence(prev => ({
      documentId: prev?.documentId ?? 0,
      action,
      cursor,
      selection: undefined,
      timestamp: new Date().toISOString(),
    }));
  };

  const updateSelection = (selection: SelectionRange, action: EvelynPresence['action'] = 'selecting') => {
    setPresence(prev => ({
      documentId: prev?.documentId ?? 0,
      action,
      cursor: { line: selection.startLine, column: selection.startColumn },
      selection,
      timestamp: new Date().toISOString(),
    }));
  };

  const updateAction = (action: EvelynPresence['action'], description?: string) => {
    setPresence(prev => prev ? {
      ...prev,
      action,
      targetDescription: description,
      timestamp: new Date().toISOString(),
    } : null);
  };

  const clearPresence = () => {
    setPresence(null);
  };

  return {
    presence,
    setPresence,
    updateCursor,
    updateSelection,
    updateAction,
    clearPresence,
  };
}
