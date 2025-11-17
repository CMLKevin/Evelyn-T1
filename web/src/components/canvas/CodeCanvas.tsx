import React, { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../../lib/ws';

interface CodeFile {
  id: string;
  name: string;
  content: string;
  language: string;
  path: string;
}

interface CodeCanvasProps {
  fileId?: string;
  initialContent?: string;
  language?: string;
  readOnly?: boolean;
  onContentChange?: (content: string) => void;
  onSave?: (file: CodeFile) => void;
}

export const CodeCanvas: React.FC<CodeCanvasProps> = ({
  fileId,
  initialContent = '',
  language = 'typescript',
  readOnly = false,
  onContentChange,
  onSave
}) => {
  const [content, setContent] = useState(initialContent);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage, lastMessage } = useWebSocket();

  useEffect(() => {
    setContent(initialContent);
    setIsDirty(false);
  }, [initialContent]);

  useEffect(() => {
    if (lastMessage && lastMessage.type === 'canvas_update') {
      setContent(lastMessage.content);
      setIsDirty(false);
    }
  }, [lastMessage]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    setIsDirty(true);
    setError(null);
    
    if (onContentChange) {
      onContentChange(newContent);
    }

    // Send real-time updates via WebSocket
    if (sendMessage && fileId) {
      sendMessage({
        type: 'canvas_content_change',
        fileId,
        content: newContent,
        timestamp: new Date().toISOString()
      });
    }
  };

  const handleSave = async () => {
    if (!fileId || !onSave) return;

    setIsLoading(true);
    setError(null);

    try {
      const file: CodeFile = {
        id: fileId,
        name: fileId.split('/').pop() || 'untitled',
        content,
        language,
        path: fileId
      };

      await onSave(file);
      setIsDirty(false);

      // Notify server of save
      if (sendMessage) {
        sendMessage({
          type: 'canvas_save',
          fileId,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle common keyboard shortcuts
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  const getLineNumbers = () => {
    const lines = content.split('\n');
    return lines.map((_, index) => index + 1);
  };

  return (
    <div className="code-canvas">
      <div className="code-canvas-header">
        <div className="code-canvas-info">
          <span className="file-language">{language}</span>
          {isDirty && <span className="dirty-indicator">●</span>}
        </div>
        <div className="code-canvas-actions">
          <button
            onClick={handleSave}
            disabled={!isDirty || isLoading || readOnly}
            className="save-button"
          >
            {isLoading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="code-canvas-error">
          <span className="error-message">{error}</span>
        </div>
      )}

      <div className="code-canvas-editor">
        <div className="line-numbers">
          {getLineNumbers().map(lineNum => (
            <div key={lineNum} className="line-number">
              {lineNum}
            </div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          readOnly={readOnly}
          className="code-editor"
          spellCheck={false}
          placeholder="Start typing your code here..."
        />
      </div>

      <div className="code-canvas-footer">
        <div className="cursor-position">
          Line: {content.substring(0, textareaRef.current?.selectionStart || 0).split('\n').length}, 
          Column: {(textareaRef.current?.selectionStart || 0) - content.lastIndexOf('\n', (textareaRef.current?.selectionStart || 0) - 1)}
        </div>
        <div className="file-info">
          {content.length} characters, {content.split('\n').length} lines
        </div>
      </div>
    </div>
  );
};
