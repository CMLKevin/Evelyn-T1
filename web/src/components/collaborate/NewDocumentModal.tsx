import { useState } from 'react';
import { X, FileText, Code } from 'lucide-react';
import { useStore } from '../../state/store';

interface NewDocumentModalProps {
  onClose: () => void;
}

export default function NewDocumentModal({ onClose }: NewDocumentModalProps) {
  const { createCollaborateDocument } = useStore();
  
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState<'text' | 'code'>('text');
  const [language, setLanguage] = useState('javascript');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;

    setIsCreating(true);
    try {
      await createCollaborateDocument(
        title.trim(),
        contentType,
        contentType === 'code' ? language : undefined
      );
      onClose();
    } catch (error) {
      console.error('Failed to create document:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && title.trim()) {
      handleCreate();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-black border border-terminal-border rounded-lg w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-terminal-border">
          <h2 className="text-terminal-text font-semibold">Create New Document</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-terminal-border rounded transition-colors"
          >
            <X className="w-4 h-4 text-terminal-text" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Title Input */}
          <div>
            <label className="block text-sm text-terminal-text mb-2">
              Document Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter document title..."
              autoFocus
              className="w-full px-3 py-2 bg-black border border-terminal-border rounded
                       text-terminal-text placeholder-terminal-secondary
                       focus:outline-none focus:border-terminal-accent"
            />
          </div>

          {/* Content Type */}
          <div>
            <label className="block text-sm text-terminal-text mb-2">
              Content Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setContentType('text')}
                className={`px-4 py-3 rounded border transition-all flex items-center justify-center gap-2
                           ${contentType === 'text'
                             ? 'bg-terminal-accent/20 border-terminal-accent text-terminal-accent'
                             : 'bg-terminal-border/30 border-terminal-border text-terminal-text hover:bg-terminal-border'}`}
              >
                <FileText className="w-5 h-5" />
                <span className="font-medium">Text</span>
              </button>
              <button
                onClick={() => setContentType('code')}
                className={`px-4 py-3 rounded border transition-all flex items-center justify-center gap-2
                           ${contentType === 'code'
                             ? 'bg-terminal-accent/20 border-terminal-accent text-terminal-accent'
                             : 'bg-terminal-border/30 border-terminal-border text-terminal-text hover:bg-terminal-border'}`}
              >
                <Code className="w-5 h-5" />
                <span className="font-medium">Code</span>
              </button>
            </div>
          </div>

          {/* Language Selection (for code) */}
          {contentType === 'code' && (
            <div>
              <label className="block text-sm text-terminal-text mb-2">
                Programming Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-terminal-border rounded
                         text-terminal-text focus:outline-none focus:border-terminal-accent"
              >
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
                <option value="php">PHP</option>
                <option value="go">Go</option>
                <option value="rust">Rust</option>
                <option value="html">HTML</option>
                <option value="css">CSS</option>
                <option value="sql">SQL</option>
                <option value="markdown">Markdown</option>
              </select>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-terminal-border flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-terminal-border hover:bg-terminal-border/70 
                     rounded text-terminal-text transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || isCreating}
            className="px-4 py-2 bg-terminal-accent/20 hover:bg-terminal-accent/30 
                     border border-terminal-accent rounded text-terminal-accent
                     transition-all disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center gap-2"
          >
            {isCreating ? (
              <>
                <div className="w-4 h-4 border-2 border-terminal-accent border-t-transparent rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              'Create Document'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
