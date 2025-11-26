import { useState, useMemo } from 'react';
import { X, AlertTriangle, ArrowLeft, ArrowRight, Merge } from 'lucide-react';
import { ConflictInfo } from '../../lib/collaborateAutoSave';

interface ConflictModalProps {
  conflict: ConflictInfo;
  onResolve: (choice: 'local' | 'server' | 'merge', mergedContent?: string) => void;
  onCancel: () => void;
}

// Simple line diff calculation
function computeLineDiff(oldText: string, newText: string) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  
  let added = 0;
  let removed = 0;
  
  // Simple diff: count lines that differ
  const maxLen = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    if (i >= oldLines.length) {
      added++;
    } else if (i >= newLines.length) {
      removed++;
    } else if (oldLines[i] !== newLines[i]) {
      added++;
      removed++;
    }
  }
  
  return { added, removed };
}

export default function ConflictModal({ conflict, onResolve, onCancel }: ConflictModalProps) {
  const [activeTab, setActiveTab] = useState<'side-by-side' | 'merge'>('side-by-side');
  const [mergedContent, setMergedContent] = useState(conflict.localContent);

  // Compute simple diff stats
  const diffStats = useMemo(() => {
    return computeLineDiff(conflict.serverContent, conflict.localContent);
  }, [conflict.serverContent, conflict.localContent]);

  const handleResolve = (choice: 'local' | 'server' | 'merge') => {
    if (choice === 'merge') {
      onResolve('merge', mergedContent);
    } else {
      onResolve(choice);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-terminal-black border-2 border-red-500 w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b-2 border-red-500/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <div>
              <h2 className="text-sm font-mono font-bold text-red-400 uppercase tracking-wider">
                Version Conflict Detected
              </h2>
              <p className="text-xs text-terminal-500 font-mono">
                The document was modified elsewhere. Choose how to resolve.
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 border border-white/20 text-terminal-500 hover:text-white 
                     hover:border-white/40 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="px-4 py-2 border-b border-white/10 flex gap-2">
          <button
            onClick={() => setActiveTab('side-by-side')}
            className={`px-3 py-1.5 text-xs font-mono font-bold transition-colors ${
              activeTab === 'side-by-side'
                ? 'bg-orange/20 border-2 border-orange text-orange'
                : 'border-2 border-white/20 text-terminal-400 hover:border-white/30'
            }`}
          >
            Side by Side
          </button>
          <button
            onClick={() => setActiveTab('merge')}
            className={`px-3 py-1.5 text-xs font-mono font-bold transition-colors ${
              activeTab === 'merge'
                ? 'bg-orange/20 border-2 border-orange text-orange'
                : 'border-2 border-white/20 text-terminal-400 hover:border-white/30'
            }`}
          >
            Manual Merge
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'side-by-side' ? (
            <div className="h-full flex">
              {/* Server Version */}
              <div className="flex-1 flex flex-col border-r border-white/10">
                <div className="px-4 py-2 bg-cyan-500/10 border-b border-cyan-500/30 flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-mono font-bold text-cyan-400 uppercase">
                    Server Version (v{conflict.serverVersion})
                  </span>
                </div>
                <div className="flex-1 overflow-auto terminal-scrollbar p-4">
                  <pre className="text-xs font-mono text-terminal-300 whitespace-pre-wrap">
                    {conflict.serverContent}
                  </pre>
                </div>
              </div>

              {/* Local Version */}
              <div className="flex-1 flex flex-col">
                <div className="px-4 py-2 bg-orange/10 border-b border-orange/30 flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-orange" />
                  <span className="text-xs font-mono font-bold text-orange uppercase">
                    Your Version (v{conflict.localVersion})
                  </span>
                </div>
                <div className="flex-1 overflow-auto terminal-scrollbar p-4">
                  <pre className="text-xs font-mono text-terminal-300 whitespace-pre-wrap">
                    {conflict.localContent}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col p-4">
              <div className="flex items-center gap-2 mb-3">
                <Merge className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-mono font-bold text-purple-400 uppercase">
                  Merged Result
                </span>
                <span className="text-[10px] text-terminal-500 font-mono ml-auto">
                  Edit below to create your merged version
                </span>
              </div>
              <textarea
                value={mergedContent}
                onChange={(e) => setMergedContent(e.target.value)}
                className="flex-1 w-full bg-terminal-900 border-2 border-white/20 p-4 
                         text-xs font-mono text-terminal-300 resize-none
                         focus:outline-none focus:border-purple-500 transition-colors"
                spellCheck={false}
              />
            </div>
          )}
        </div>

        {/* Diff Summary */}
        <div className="px-4 py-2 border-t border-white/10 bg-terminal-900">
          <div className="flex items-center gap-4 text-[10px] font-mono">
            <span className="text-terminal-500">Changes:</span>
            <span className="text-emerald-400">
              +{diffStats.added} lines added
            </span>
            <span className="text-red-400">
              -{diffStats.removed} lines removed
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 py-3 border-t-2 border-white/20 flex items-center justify-between">
          <button
            onClick={onCancel}
            className="px-4 py-2 border-2 border-white/20 text-terminal-400 text-xs font-mono font-bold
                     hover:border-white/40 hover:text-terminal-300 transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleResolve('server')}
              className="px-4 py-2 bg-cyan-500/20 border-2 border-cyan-500 text-cyan-400 
                       text-xs font-mono font-bold hover:bg-cyan-500/30 transition-colors
                       flex items-center gap-2"
            >
              <ArrowLeft className="w-3 h-3" />
              Keep Server
            </button>
            
            {activeTab === 'merge' && (
              <button
                onClick={() => handleResolve('merge')}
                className="px-4 py-2 bg-purple-500/20 border-2 border-purple-500 text-purple-400 
                         text-xs font-mono font-bold hover:bg-purple-500/30 transition-colors
                         flex items-center gap-2"
              >
                <Merge className="w-3 h-3" />
                Use Merged
              </button>
            )}
            
            <button
              onClick={() => handleResolve('local')}
              className="px-4 py-2 bg-orange/20 border-2 border-orange text-orange 
                       text-xs font-mono font-bold hover:bg-orange/30 transition-colors
                       flex items-center gap-2"
            >
              Keep Mine
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
