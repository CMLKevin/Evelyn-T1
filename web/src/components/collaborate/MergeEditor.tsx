import { useState, useEffect } from 'react';
import { 
  X, 
  GitMerge, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Sparkles, 
  Loader2,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Combine
} from 'lucide-react';

// ========================================
// Types
// ========================================

interface MergeConflict {
  id: string;
  startLine: number;
  endLine: number;
  baseContent: string;
  leftContent: string;
  rightContent: string;
  resolution?: string;
  aiSuggestion?: string;
}

interface MergeResult {
  success: boolean;
  mergedContent: string;
  conflicts: MergeConflict[];
  aiResolutions: { conflictId: string; resolution: string; reasoning: string }[];
}

interface MergeEditorProps {
  isOpen: boolean;
  onClose: () => void;
  baseContent: string;
  leftContent: string;
  rightContent: string;
  baseTitle?: string;
  leftTitle?: string;
  rightTitle?: string;
  onMergeComplete?: (mergedContent: string) => void;
}

// ========================================
// Component
// ========================================

export default function MergeEditor({
  isOpen,
  onClose,
  baseContent,
  leftContent,
  rightContent,
  baseTitle = 'Base',
  leftTitle = 'Theirs',
  rightTitle = 'Yours',
  onMergeComplete
}: MergeEditorProps) {
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
  const [conflicts, setConflicts] = useState<MergeConflict[]>([]);
  const [currentConflictIndex, setCurrentConflictIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [mergedContent, setMergedContent] = useState('');

  // Perform initial merge
  useEffect(() => {
    if (!isOpen) return;

    const performMerge = async () => {
      setLoading(true);
      try {
        const response = await fetch('http://localhost:3001/api/collaborate/merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base: baseContent,
            left: leftContent,
            right: rightContent,
            resolveWithAI: false
          })
        });

        if (response.ok) {
          const result: MergeResult = await response.json();
          setMergeResult(result);
          setConflicts(result.conflicts);
          setMergedContent(result.mergedContent);
        }
      } catch (error) {
        console.error('Merge failed:', error);
      }
      setLoading(false);
    };

    performMerge();
  }, [isOpen, baseContent, leftContent, rightContent]);

  // Request AI resolutions
  const requestAIResolutions = async () => {
    if (!conflicts.length) return;
    
    setLoadingAI(true);
    try {
      const response = await fetch('http://localhost:3001/api/collaborate/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base: baseContent,
          left: leftContent,
          right: rightContent,
          resolveWithAI: true
        })
      });

      if (response.ok) {
        const result: MergeResult = await response.json();
        
        // Apply AI resolutions to conflicts
        const updatedConflicts = conflicts.map(conflict => {
          const aiRes = result.aiResolutions.find(r => r.conflictId === conflict.id);
          if (aiRes) {
            return { ...conflict, aiSuggestion: aiRes.resolution };
          }
          return conflict;
        });
        
        setConflicts(updatedConflicts);
      }
    } catch (error) {
      console.error('AI resolution failed:', error);
    }
    setLoadingAI(false);
  };

  // Resolve a conflict
  const resolveConflict = (conflictId: string, resolution: 'left' | 'right' | 'both' | 'ai' | 'custom', customContent?: string) => {
    setConflicts(prev => prev.map(conflict => {
      if (conflict.id !== conflictId) return conflict;

      let resolvedContent = '';
      switch (resolution) {
        case 'left':
          resolvedContent = conflict.leftContent;
          break;
        case 'right':
          resolvedContent = conflict.rightContent;
          break;
        case 'both':
          resolvedContent = `${conflict.leftContent}\n${conflict.rightContent}`;
          break;
        case 'ai':
          resolvedContent = conflict.aiSuggestion || conflict.rightContent;
          break;
        case 'custom':
          resolvedContent = customContent || '';
          break;
      }

      return { ...conflict, resolution: resolvedContent };
    }));
  };

  // Apply resolutions to merged content
  const applyResolutions = () => {
    let content = mergedContent;
    
    conflicts.forEach(conflict => {
      if (conflict.resolution) {
        // Replace conflict markers with resolution
        const conflictPattern = new RegExp(
          `<<<<<<< LEFT\\n${escapeRegex(conflict.leftContent)}\\n=======\\n${escapeRegex(conflict.rightContent)}\\n>>>>>>> RIGHT`,
          'g'
        );
        content = content.replace(conflictPattern, conflict.resolution);
      }
    });

    return content;
  };

  // Complete merge
  const handleCompleteMerge = () => {
    const unresolvedCount = conflicts.filter(c => !c.resolution).length;
    
    if (unresolvedCount > 0) {
      if (!confirm(`There are ${unresolvedCount} unresolved conflict(s). Continue anyway?`)) {
        return;
      }
    }

    const finalContent = applyResolutions();
    onMergeComplete?.(finalContent);
    onClose();
  };

  // Navigate conflicts
  const nextConflict = () => {
    if (currentConflictIndex < conflicts.length - 1) {
      setCurrentConflictIndex(currentConflictIndex + 1);
    }
  };

  const prevConflict = () => {
    if (currentConflictIndex > 0) {
      setCurrentConflictIndex(currentConflictIndex - 1);
    }
  };

  const currentConflict = conflicts[currentConflictIndex];
  const resolvedCount = conflicts.filter(c => c.resolution).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b-2 border-white/20 flex items-center justify-between bg-terminal-black">
        <div className="flex items-center gap-3">
          <GitMerge className="w-5 h-5 text-purple-500" />
          <h2 className="text-lg font-mono font-bold text-white">Merge Editor</h2>
          
          {conflicts.length > 0 && (
            <div className="flex items-center gap-2 ml-4">
              <span className={`px-2 py-1 text-xs font-mono border ${
                resolvedCount === conflicts.length
                  ? 'bg-green-500/20 border-green-500/30 text-green-400'
                  : 'bg-orange/20 border-orange/30 text-orange'
              }`}>
                {resolvedCount}/{conflicts.length} resolved
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* AI Resolution Button */}
          {conflicts.length > 0 && !conflicts.every(c => c.aiSuggestion) && (
            <button
              onClick={requestAIResolutions}
              disabled={loadingAI}
              className="px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 text-purple-400 
                       text-xs font-mono hover:bg-purple-500/30 transition-colors flex items-center gap-2
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingAI ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              Let Evelyn Resolve
            </button>
          )}

          <button onClick={onClose} className="p-1.5 hover:bg-terminal-800 transition-colors">
            <X className="w-5 h-5 text-terminal-400 hover:text-white" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-terminal-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Analyzing changes...
          </div>
        ) : conflicts.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-green-400">
            <Check className="w-8 h-8 mr-3" />
            <div>
              <h3 className="text-lg font-mono font-bold">No Conflicts!</h3>
              <p className="text-sm text-terminal-400">The documents were merged automatically.</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            {/* Conflict Navigation */}
            <div className="px-6 py-3 border-b border-white/10 flex items-center justify-between bg-terminal-900">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange" />
                <span className="text-sm font-mono text-white">
                  Conflict {currentConflictIndex + 1} of {conflicts.length}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={prevConflict}
                  disabled={currentConflictIndex === 0}
                  className="p-1 hover:bg-terminal-800 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4 text-terminal-400" />
                </button>
                <button
                  onClick={nextConflict}
                  disabled={currentConflictIndex === conflicts.length - 1}
                  className="p-1 hover:bg-terminal-800 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4 text-terminal-400" />
                </button>
              </div>
            </div>

            {/* Three-way View */}
            {currentConflict && (
              <div className="flex-1 flex">
                {/* Left (Theirs) */}
                <div className="flex-1 flex flex-col border-r border-white/10">
                  <div className="px-4 py-2 border-b border-white/10 bg-red-500/10 flex items-center justify-between">
                    <span className="text-xs font-mono text-red-400">{leftTitle}</span>
                    <button
                      onClick={() => resolveConflict(currentConflict.id, 'left')}
                      className="px-2 py-1 text-[10px] font-mono bg-red-500/20 border border-red-500/30 
                               text-red-400 hover:bg-red-500/30 transition-colors flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      Accept
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto terminal-scrollbar bg-terminal-black/50 p-4">
                    <pre className="text-xs font-mono text-red-300 whitespace-pre-wrap">
                      {currentConflict.leftContent}
                    </pre>
                  </div>
                </div>

                {/* Center (Resolution) */}
                <div className="flex-1 flex flex-col border-r border-white/10">
                  <div className="px-4 py-2 border-b border-white/10 bg-green-500/10 flex items-center justify-between">
                    <span className="text-xs font-mono text-green-400">Resolution</span>
                    <button
                      onClick={() => resolveConflict(currentConflict.id, 'both')}
                      className="px-2 py-1 text-[10px] font-mono bg-purple-500/20 border border-purple-500/30 
                               text-purple-400 hover:bg-purple-500/30 transition-colors flex items-center gap-1"
                    >
                      <Combine className="w-3 h-3" />
                      Keep Both
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto terminal-scrollbar bg-terminal-black/50 p-4">
                    {currentConflict.resolution ? (
                      <pre className="text-xs font-mono text-green-300 whitespace-pre-wrap">
                        {currentConflict.resolution}
                      </pre>
                    ) : currentConflict.aiSuggestion ? (
                      <div>
                        <div className="text-[10px] text-purple-400 mb-2 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Evelyn's suggestion:
                        </div>
                        <pre className="text-xs font-mono text-purple-300 whitespace-pre-wrap">
                          {currentConflict.aiSuggestion}
                        </pre>
                        <button
                          onClick={() => resolveConflict(currentConflict.id, 'ai')}
                          className="mt-2 px-2 py-1 text-[10px] font-mono bg-purple-500/20 border border-purple-500/30 
                                   text-purple-400 hover:bg-purple-500/30 transition-colors"
                        >
                          Accept AI Suggestion
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-terminal-500 italic">
                        Choose a resolution or let Evelyn suggest one
                      </div>
                    )}
                  </div>
                </div>

                {/* Right (Yours) */}
                <div className="flex-1 flex flex-col">
                  <div className="px-4 py-2 border-b border-white/10 bg-cyan-500/10 flex items-center justify-between">
                    <span className="text-xs font-mono text-cyan-400">{rightTitle}</span>
                    <button
                      onClick={() => resolveConflict(currentConflict.id, 'right')}
                      className="px-2 py-1 text-[10px] font-mono bg-cyan-500/20 border border-cyan-500/30 
                               text-cyan-400 hover:bg-cyan-500/30 transition-colors flex items-center gap-1"
                    >
                      Accept
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto terminal-scrollbar bg-terminal-black/50 p-4">
                    <pre className="text-xs font-mono text-cyan-300 whitespace-pre-wrap">
                      {currentConflict.rightContent}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t-2 border-white/20 bg-terminal-black flex items-center justify-between">
        <div className="text-xs text-terminal-500 font-mono">
          {conflicts.length === 0 
            ? 'Merge completed successfully'
            : `${resolvedCount} of ${conflicts.length} conflicts resolved`
          }
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border-2 border-white/20 text-terminal-300 text-sm font-mono
                     hover:border-white/30 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCompleteMerge}
            className="px-4 py-2 bg-green-500 border-2 border-green-500 text-white text-sm font-mono font-bold
                     hover:bg-green-600 transition-colors flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Complete Merge
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
