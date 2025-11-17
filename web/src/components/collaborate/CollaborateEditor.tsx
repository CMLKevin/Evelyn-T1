import { useRef, useEffect } from 'react';
import { useStore } from '../../state/store';
import Editor from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import InlineSuggestion from './InlineSuggestion';

export default function CollaborateEditor() {
  const { 
    collaborateState,
    updateCollaborateDocumentContent,
    setCollaborateSelectedRange
  } = useStore();

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const { 
    activeDocument, 
    currentContent, 
    editMode,
    showInlineSuggestions,
    currentSuggestions 
  } = collaborateState;

  // Monaco theme configuration
  const monacoTheme = {
    base: 'vs-dark' as const,
    inherit: true,
    rules: [
      { token: 'comment', foreground: '808080' },
      { token: 'string', foreground: '00ff00' },
      { token: 'keyword', foreground: '00ffff' },
      { token: 'number', foreground: 'ff00ff' },
      { token: 'type', foreground: '00ffff' },
      { token: 'function', foreground: 'ffff00' },
      { token: 'variable', foreground: 'e0e0e0' },
    ],
    colors: {
      'editor.background': '#000000',
      'editor.foreground': '#e0e0e0',
      'editor.lineHighlightBackground': '#0a0a0a',
      'editorCursor.foreground': '#00ffff',
      'editor.selectionBackground': '#00ffff33',
      'editorLineNumber.foreground': '#808080',
      'editorLineNumber.activeForeground': '#00ffff',
      'editor.inactiveSelectionBackground': '#00ffff1a',
      'editorIndentGuide.background': '#1a1a1a',
      'editorIndentGuide.activeBackground': '#333333',
    }
  };

  // Handle editor mount
  const handleEditorDidMount = (editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
    editorRef.current = editor;
    
    // Define custom theme
    monaco.editor.defineTheme('evelyn-cyberpunk', monacoTheme);
    monaco.editor.setTheme('evelyn-cyberpunk');

    // Track selection changes
    editor.onDidChangeCursorSelection((e) => {
      const selection = e.selection;
      if (!selection.isEmpty()) {
        setCollaborateSelectedRange({
          startLine: selection.startLineNumber,
          startChar: selection.startColumn,
          endLine: selection.endLineNumber,
          endChar: selection.endColumn
        });
      } else {
        setCollaborateSelectedRange(null);
      }
    });

    // Add suggestion decorations
    if (showInlineSuggestions && currentSuggestions.length > 0) {
      const decorations: Monaco.editor.IModelDeltaDecoration[] = currentSuggestions
        .filter(s => s.status === 'pending' && s.lineStart && s.lineEnd)
        .map(suggestion => ({
          range: new monaco.Range(
            suggestion.lineStart!,
            suggestion.charStart || 1,
            suggestion.lineEnd!,
            suggestion.charEnd || 1000
          ),
          options: {
            className: 'inline-suggestion',
            hoverMessage: { value: suggestion.description },
            glyphMarginClassName: 'suggestion-glyph'
          }
        }));
      
      editor.createDecorationsCollection(decorations);
    }
  };

  // Handle content changes
  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined && activeDocument) {
      updateCollaborateDocumentContent(value);
    }
  };

  // Get language for Monaco
  const getLanguage = (): string => {
    if (!activeDocument) return 'plaintext';
    if (activeDocument.contentType === 'text') return 'plaintext';
    
    const lang = activeDocument.language?.toLowerCase() || 'javascript';
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'jsx': 'javascript',
      'tsx': 'typescript',
      'cpp': 'cpp',
      'c++': 'cpp',
      'c': 'c',
      'java': 'java',
      'php': 'php',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'md': 'markdown',
      'sql': 'sql',
      'sh': 'shell',
      'bash': 'shell',
    };

    return languageMap[lang] || lang;
  };

  if (!activeDocument) {
    return (
      <div className="flex-1 flex items-center justify-center text-terminal-secondary">
        <div className="text-center">
          <p className="text-lg mb-2">No document selected</p>
          <p className="text-sm">Create a new document or select one from the sidebar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col relative collaborate-editor">
      {/* Editor Mode Indicator */}
      {editMode !== 'user' && (
        <div className="absolute top-2 right-2 z-10 px-3 py-1 bg-terminal-secondary/20 
                      border border-terminal-secondary rounded text-terminal-secondary text-sm
                      evelyn-typing-indicator">
          {editMode === 'evelyn' ? 'Evelyn is editing' : 'Collaborative mode'}
        </div>
      )}

      {/* Monaco Editor */}
      <Editor
        height="100%"
        language={getLanguage()}
        value={currentContent}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: true },
          fontSize: 14,
          lineNumbers: 'on',
          renderWhitespace: 'selection',
          scrollBeyondLastLine: false,
          wordWrap: activeDocument.contentType === 'text' ? 'on' : 'off',
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          formatOnPaste: true,
          formatOnType: true,
          readOnly: editMode === 'evelyn',
          cursorStyle: 'line',
          cursorBlinking: 'smooth',
          smoothScrolling: true,
          mouseWheelZoom: true,
          contextmenu: true,
          quickSuggestions: activeDocument.contentType === 'code',
          suggestOnTriggerCharacters: activeDocument.contentType === 'code',
        }}
        theme="evelyn-cyberpunk"
      />

      {/* Inline Suggestions Overlay */}
      {showInlineSuggestions && currentSuggestions.length > 0 && (
        <div className="absolute top-0 left-0 pointer-events-none">
          {currentSuggestions
            .filter(s => s.status === 'pending')
            .map(suggestion => (
              <InlineSuggestion key={suggestion.id} suggestion={suggestion} />
            ))}
        </div>
      )}
    </div>
  );
}
