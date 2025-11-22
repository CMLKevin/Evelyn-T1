import { useState } from 'react';
import { FileText, Code } from 'lucide-react';
import { useStore } from '../../state/store';
import { Modal, Button, Input } from '../ui';

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
    <Modal isOpen={true} onClose={onClose} title="Create New Document" size="md">
      <div className="space-y-4">
        {/* Title Input */}
        <Input
          label="Document Title *"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter document title..."
          autoFocus
        />

        {/* Content Type */}
        <div>
          <label className="block text-sm text-zinc-400 mb-2 font-medium">
            Content Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setContentType('text')}
              className={`px-4 py-3 rounded-lg border transition-all flex items-center justify-center gap-2
                         ${contentType === 'text'
                           ? 'bg-gradient-to-br from-purple-500/20 to-blue-500/20 border-purple-500/50 text-purple-300'
                           : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:border-white/20'}`}
            >
              <FileText className="w-5 h-5" />
              <span className="font-medium">Text</span>
            </button>
            <button
              onClick={() => setContentType('code')}
              className={`px-4 py-3 rounded-lg border transition-all flex items-center justify-center gap-2
                         ${contentType === 'code'
                           ? 'bg-gradient-to-br from-purple-500/20 to-blue-500/20 border-purple-500/50 text-purple-300'
                           : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:border-white/20'}`}
            >
              <Code className="w-5 h-5" />
              <span className="font-medium">Code</span>
            </button>
          </div>
        </div>

        {/* Language Selection (for code) */}
        {contentType === 'code' && (
          <div>
            <label className="block text-sm text-zinc-400 mb-2 font-medium">
              Programming Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-900/50 border border-white/10 hover:border-white/20 focus:border-purple-500/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
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
      
      {/* Footer with Button components */}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button 
          variant="primary" 
          onClick={handleCreate}
          disabled={!title.trim() || isCreating}
          loading={isCreating}
        >
          Create Document
        </Button>
      </div>
    </Modal>
  );
}
