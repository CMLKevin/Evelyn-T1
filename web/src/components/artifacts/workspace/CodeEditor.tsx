/**
 * CodeEditor Component
 * 
 * Monaco-based code editor for editing artifact files.
 * Supports syntax highlighting, IntelliSense, and multiple file tabs.
 */

import React, { useCallback, useRef } from 'react';
import Editor, { OnMount, OnChange } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { X, Circle } from 'lucide-react';
import type { ArtifactFile } from '../types';
import { FILE_LANGUAGE_MAP } from '../types';

interface CodeEditorProps {
  file: ArtifactFile | null;
  openFiles: ArtifactFile[];
  activeFilePath: string | null;
  onFileSelect: (path: string) => void;
  onFileClose: (path: string) => void;
  onChange: (path: string, content: string) => void;
  onSave?: (path: string) => void;
  className?: string;
}

// Get Monaco language from file path
function getMonacoLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return FILE_LANGUAGE_MAP[ext] || 'plaintext';
}

// Monaco editor theme matching Evelyn's dark terminal aesthetic
const EVELYN_THEME: Monaco.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'f97316' }, // Orange
    { token: 'string', foreground: '22c55e' }, // Green
    { token: 'number', foreground: '3b82f6' }, // Blue
    { token: 'type', foreground: 'eab308' }, // Yellow
    { token: 'function', foreground: 'a855f7' }, // Purple
    { token: 'variable', foreground: 'f8fafc' }, // White
  ],
  colors: {
    'editor.background': '#0a0a0a',
    'editor.foreground': '#f8fafc',
    'editor.lineHighlightBackground': '#1a1a1a',
    'editor.selectionBackground': '#f9731640',
    'editorCursor.foreground': '#f97316',
    'editorLineNumber.foreground': '#4b5563',
    'editorLineNumber.activeForeground': '#f97316',
    'editor.inactiveSelectionBackground': '#f9731620',
    'editorIndentGuide.background': '#27272a',
    'editorIndentGuide.activeBackground': '#3f3f46',
  }
};

export function CodeEditor({
  file,
  openFiles,
  activeFilePath,
  onFileSelect,
  onFileClose,
  onChange,
  onSave,
  className = ''
}: CodeEditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  
  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    // Register custom theme
    monaco.editor.defineTheme('evelyn', EVELYN_THEME);
    monaco.editor.setTheme('evelyn');
    
    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (activeFilePath && onSave) {
        onSave(activeFilePath);
      }
    });
  }, [activeFilePath, onSave]);
  
  const handleChange: OnChange = useCallback((value) => {
    if (activeFilePath && value !== undefined) {
      onChange(activeFilePath, value);
    }
  }, [activeFilePath, onChange]);
  
  const handleTabClose = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    onFileClose(path);
  };
  
  return (
    <div className={`flex flex-col h-full bg-[#0a0a0a] ${className}`}>
      {/* Tabs */}
      <div className="flex items-center border-b border-white/10 bg-terminal-dark overflow-x-auto">
        {openFiles.map(f => (
          <button
            key={f.path}
            onClick={() => onFileSelect(f.path)}
            className={`
              flex items-center gap-2 px-3 py-2 text-xs font-mono
              border-r border-white/10 min-w-0 group
              transition-colors
              ${f.path === activeFilePath
                ? 'bg-[#0a0a0a] text-orange border-t-2 border-t-orange -mb-px'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }
            `}
          >
            <span className="truncate max-w-[120px]">{f.name}</span>
            {f.isDirty && (
              <Circle className="w-2 h-2 fill-orange text-orange flex-shrink-0" />
            )}
            <button
              onClick={(e) => handleTabClose(e, f.path)}
              className="p-0.5 hover:bg-white/10 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </button>
        ))}
      </div>
      
      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {file ? (
          <Editor
            height="100%"
            language={getMonacoLanguage(file.path)}
            value={file.content}
            onChange={handleChange}
            onMount={handleEditorMount}
            theme="evelyn"
            options={{
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
              fontSize: 13,
              lineHeight: 1.6,
              tabSize: 2,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
              padding: { top: 12, bottom: 12 },
              renderLineHighlight: 'line',
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              smoothScrolling: true,
              folding: true,
              foldingHighlight: true,
              bracketPairColorization: { enabled: true },
              guides: {
                bracketPairs: true,
                indentation: true
              },
              suggest: {
                showKeywords: true,
                showSnippets: true
              }
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-zinc-500">
            <div className="text-center">
              <p className="text-sm font-mono">No file selected</p>
              <p className="text-xs mt-1">Select a file from the explorer</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CodeEditor;
