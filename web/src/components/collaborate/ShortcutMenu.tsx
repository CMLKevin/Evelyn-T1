import { useState } from 'react';
import { useStore } from '../../state/store';
import { 
  Pencil, 
  Minimize2, 
  Maximize2, 
  Sparkles, 
  Smile, 
  Code2,
  Bug,
  MessageCircle,
  FileCode,
  Zap,
  Search,
  ChevronDown
} from 'lucide-react';

interface ShortcutMenuProps {
  onClose: () => void;
}

export default function ShortcutMenu({ onClose }: ShortcutMenuProps) {
  const { 
    collaborateState,
    applyCollaborateShortcut 
  } = useStore();

  const [readingLevel, setReadingLevel] = useState('college');
  const [targetLanguage, setTargetLanguage] = useState('python');
  const [lengthType, setLengthType] = useState<'shorter' | 'longer'>('shorter');
  const [isApplying, setIsApplying] = useState(false);

  const { activeDocument, currentContent } = collaborateState;

  const applyShortcut = async (shortcutType: string, options?: any) => {
    if (!activeDocument || isApplying) return;
    
    setIsApplying(true);
    try {
      await applyCollaborateShortcut(shortcutType, options);
      onClose();
    } catch (error) {
      console.error('Shortcut error:', error);
    } finally {
      setIsApplying(false);
    }
  };

  const isCodeDocument = activeDocument?.contentType === 'code';
  const isTextDocument = activeDocument?.contentType === 'text';

  return (
    <div className="absolute right-0 top-full mt-1 w-80 bg-black border border-terminal-border 
                   rounded shadow-lg z-50 max-h-96 overflow-y-auto">
      {/* Writing Shortcuts */}
      {isTextDocument && (
        <div className="p-2">
          <div className="px-2 py-1 text-xs font-semibold text-terminal-secondary uppercase">
            Writing Shortcuts
          </div>

          {/* Suggest Edits */}
          <button
            onClick={() => applyShortcut('suggest_edits')}
            disabled={isApplying}
            className="w-full px-3 py-2 flex items-center gap-3 hover:bg-terminal-border 
                     rounded transition-colors text-left disabled:opacity-50"
          >
            <Pencil className="w-4 h-4 text-terminal-accent" />
            <div className="flex-1">
              <div className="text-sm text-terminal-text">Suggest edits</div>
              <div className="text-xs text-terminal-secondary">Get improvement suggestions</div>
            </div>
          </button>

          {/* Adjust Length */}
          <div className="px-3 py-2">
            <div className="text-sm text-terminal-text mb-2 flex items-center gap-2">
              <Maximize2 className="w-4 h-4 text-terminal-accent" />
              Adjust length
            </div>
            <div className="flex gap-2 ml-6">
              <button
                onClick={() => applyShortcut('adjust_length', { direction: 'shorter' })}
                disabled={isApplying}
                className="flex-1 px-2 py-1 bg-terminal-accent/20 hover:bg-terminal-accent/30 
                         border border-terminal-accent rounded text-terminal-accent text-xs
                         transition-all disabled:opacity-50"
              >
                <Minimize2 className="w-3 h-3 inline mr-1" />
                Shorter
              </button>
              <button
                onClick={() => applyShortcut('adjust_length', { direction: 'longer' })}
                disabled={isApplying}
                className="flex-1 px-2 py-1 bg-terminal-accent/20 hover:bg-terminal-accent/30 
                         border border-terminal-accent rounded text-terminal-accent text-xs
                         transition-all disabled:opacity-50"
              >
                <Maximize2 className="w-3 h-3 inline mr-1" />
                Longer
              </button>
            </div>
          </div>

          {/* Reading Level */}
          <div className="px-3 py-2">
            <div className="text-sm text-terminal-text mb-2 flex items-center gap-2">
              <Search className="w-4 h-4 text-terminal-accent" />
              Reading level
            </div>
            <select
              value={readingLevel}
              onChange={(e) => setReadingLevel(e.target.value)}
              className="w-full ml-6 px-2 py-1 bg-black border border-terminal-border rounded
                       text-terminal-text text-xs focus:outline-none focus:border-terminal-accent"
            >
              <option value="elementary">K-5 (Elementary)</option>
              <option value="middle">6-8 (Middle School)</option>
              <option value="high">9-12 (High School)</option>
              <option value="college">College</option>
              <option value="graduate">Graduate</option>
            </select>
            <button
              onClick={() => applyShortcut('reading_level', { level: readingLevel })}
              disabled={isApplying}
              className="w-full ml-6 mt-1 px-2 py-1 bg-terminal-accent/20 hover:bg-terminal-accent/30 
                       border border-terminal-accent rounded text-terminal-accent text-xs
                       transition-all disabled:opacity-50"
            >
              Apply
            </button>
          </div>

          {/* Add Polish */}
          <button
            onClick={() => applyShortcut('add_polish')}
            disabled={isApplying}
            className="w-full px-3 py-2 flex items-center gap-3 hover:bg-terminal-border 
                     rounded transition-colors text-left disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-terminal-accent" />
            <div className="flex-1">
              <div className="text-sm text-terminal-text">Add final polish</div>
              <div className="text-xs text-terminal-secondary">Refine and perfect</div>
            </div>
          </button>

          {/* Add Emojis */}
          <button
            onClick={() => applyShortcut('add_emojis')}
            disabled={isApplying}
            className="w-full px-3 py-2 flex items-center gap-3 hover:bg-terminal-border 
                     rounded transition-colors text-left disabled:opacity-50"
          >
            <Smile className="w-4 h-4 text-terminal-accent" />
            <div className="flex-1">
              <div className="text-sm text-terminal-text">Add emojis</div>
              <div className="text-xs text-terminal-secondary">Make it more expressive</div>
            </div>
          </button>
        </div>
      )}

      {/* Coding Shortcuts */}
      {isCodeDocument && (
        <div className="p-2">
          <div className="px-2 py-1 text-xs font-semibold text-terminal-secondary uppercase">
            Coding Shortcuts
          </div>

          {/* Review Code */}
          <button
            onClick={() => applyShortcut('review_code')}
            disabled={isApplying}
            className="w-full px-3 py-2 flex items-center gap-3 hover:bg-terminal-border 
                     rounded transition-colors text-left disabled:opacity-50"
          >
            <Search className="w-4 h-4 text-terminal-accent" />
            <div className="flex-1">
              <div className="text-sm text-terminal-text">Review code</div>
              <div className="text-xs text-terminal-secondary">Get code review feedback</div>
            </div>
          </button>

          {/* Add Logs */}
          <button
            onClick={() => applyShortcut('add_logs')}
            disabled={isApplying}
            className="w-full px-3 py-2 flex items-center gap-3 hover:bg-terminal-border 
                     rounded transition-colors text-left disabled:opacity-50"
          >
            <FileCode className="w-4 h-4 text-terminal-accent" />
            <div className="flex-1">
              <div className="text-sm text-terminal-text">Add logs</div>
              <div className="text-xs text-terminal-secondary">Insert logging statements</div>
            </div>
          </button>

          {/* Add Comments */}
          <button
            onClick={() => applyShortcut('add_comments')}
            disabled={isApplying}
            className="w-full px-3 py-2 flex items-center gap-3 hover:bg-terminal-border 
                     rounded transition-colors text-left disabled:opacity-50"
          >
            <MessageCircle className="w-4 h-4 text-terminal-accent" />
            <div className="flex-1">
              <div className="text-sm text-terminal-text">Add comments</div>
              <div className="text-xs text-terminal-secondary">Document your code</div>
            </div>
          </button>

          {/* Fix Bugs */}
          <button
            onClick={() => applyShortcut('fix_bugs')}
            disabled={isApplying}
            className="w-full px-3 py-2 flex items-center gap-3 hover:bg-terminal-border 
                     rounded transition-colors text-left disabled:opacity-50"
          >
            <Bug className="w-4 h-4 text-terminal-accent" />
            <div className="flex-1">
              <div className="text-sm text-terminal-text">Fix bugs</div>
              <div className="text-xs text-terminal-secondary">Identify and fix issues</div>
            </div>
          </button>

          {/* Port to Language */}
          <div className="px-3 py-2">
            <div className="text-sm text-terminal-text mb-2 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-terminal-accent" />
              Port to language
            </div>
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="w-full ml-6 px-2 py-1 bg-black border border-terminal-border rounded
                       text-terminal-text text-xs focus:outline-none focus:border-terminal-accent"
            >
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
              <option value="php">PHP</option>
              <option value="go">Go</option>
              <option value="rust">Rust</option>
            </select>
            <button
              onClick={() => applyShortcut('port_language', { language: targetLanguage })}
              disabled={isApplying}
              className="w-full ml-6 mt-1 px-2 py-1 bg-terminal-accent/20 hover:bg-terminal-accent/30 
                       border border-terminal-accent rounded text-terminal-accent text-xs
                       transition-all disabled:opacity-50"
            >
              Convert
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isApplying && (
        <div className="px-3 py-2 border-t border-terminal-border flex items-center gap-2 text-terminal-secondary text-sm">
          <div className="w-4 h-4 border-2 border-terminal-accent border-t-transparent rounded-full animate-spin" />
          Applying shortcut...
        </div>
      )}
    </div>
  );
}
