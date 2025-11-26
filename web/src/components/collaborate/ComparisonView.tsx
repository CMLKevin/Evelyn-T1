import { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  GitCompare, 
  Plus, 
  Minus, 
  Equal, 
  Sparkles, 
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Copy,
  Check
} from 'lucide-react';

// ========================================
// Types
// ========================================

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged' | 'modified';
  lineNumber: { left?: number; right?: number };
  content: string;
}

interface DiffHunk {
  startLine: { left: number; right: number };
  endLine: { left: number; right: number };
  lines: DiffLine[];
}

interface ChangeGroup {
  id: string;
  type: 'addition' | 'deletion' | 'modification';
  summary: string;
}

interface ComparisonResult {
  hunks: DiffHunk[];
  changes: ChangeGroup[];
  stats: {
    additions: number;
    deletions: number;
    modifications: number;
    unchanged: number;
  };
  similarity: number;
}

interface AIExplanation {
  summary: string;
  changeExplanations: {
    changeId: string;
    explanation: string;
    impact: 'low' | 'medium' | 'high';
    suggestion?: string;
  }[];
  overallAssessment: string;
}

interface ComparisonViewProps {
  isOpen: boolean;
  onClose: () => void;
  contentA: string;
  contentB: string;
  titleA?: string;
  titleB?: string;
  contentType?: 'text' | 'code' | 'mixed';
  onApplyContent?: (content: string) => void;
}

// ========================================
// Component
// ========================================

export default function ComparisonView({
  isOpen,
  onClose,
  contentA,
  contentB,
  titleA = 'Version A',
  titleB = 'Version B',
  contentType = 'text',
  onApplyContent
}: ComparisonViewProps) {
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [explanation, setExplanation] = useState<AIExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');
  const [copied, setCopied] = useState<'A' | 'B' | null>(null);

  // Fetch comparison when content changes
  useEffect(() => {
    if (!isOpen || !contentA || !contentB) return;

    const fetchComparison = async () => {
      setLoading(true);
      try {
        const response = await fetch('http://localhost:3001/api/collaborate/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contentA, contentB })
        });

        if (response.ok) {
          const data = await response.json();
          setComparison(data.comparison);
        }
      } catch (error) {
        console.error('Failed to compare:', error);
      }
      setLoading(false);
    };

    fetchComparison();
  }, [isOpen, contentA, contentB]);

  // Fetch AI explanation
  const fetchAIExplanation = async () => {
    if (!comparison) return;
    
    setLoadingAI(true);
    try {
      const response = await fetch('http://localhost:3001/api/collaborate/compare/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentA,
          contentB,
          comparison,
          contentType
        })
      });

      if (response.ok) {
        const data = await response.json();
        setExplanation(data);
        setShowAIPanel(true);
      }
    } catch (error) {
      console.error('Failed to get AI explanation:', error);
    }
    setLoadingAI(false);
  };

  // Copy content
  const handleCopy = async (side: 'A' | 'B') => {
    const content = side === 'A' ? contentA : contentB;
    await navigator.clipboard.writeText(content);
    setCopied(side);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b-2 border-white/20 flex items-center justify-between bg-terminal-black">
        <div className="flex items-center gap-3">
          <GitCompare className="w-5 h-5 text-orange" />
          <h2 className="text-lg font-mono font-bold text-white">Compare Versions</h2>
          
          {comparison && (
            <div className="flex items-center gap-3 ml-4">
              <span className="px-2 py-1 bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-mono flex items-center gap-1">
                <Plus className="w-3 h-3" />
                {comparison.stats.additions}
              </span>
              <span className="px-2 py-1 bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-mono flex items-center gap-1">
                <Minus className="w-3 h-3" />
                {comparison.stats.deletions}
              </span>
              <span className="px-2 py-1 bg-terminal-800 border border-white/20 text-terminal-400 text-xs font-mono">
                {(comparison.similarity * 100).toFixed(0)}% similar
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex border border-white/20">
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1.5 text-xs font-mono ${
                viewMode === 'split'
                  ? 'bg-orange/20 text-orange'
                  : 'text-terminal-400 hover:text-white'
              }`}
            >
              Split
            </button>
            <button
              onClick={() => setViewMode('unified')}
              className={`px-3 py-1.5 text-xs font-mono border-l border-white/20 ${
                viewMode === 'unified'
                  ? 'bg-orange/20 text-orange'
                  : 'text-terminal-400 hover:text-white'
              }`}
            >
              Unified
            </button>
          </div>

          {/* AI Explain Button */}
          <button
            onClick={fetchAIExplanation}
            disabled={loadingAI || !comparison}
            className="px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 text-purple-400 
                     text-xs font-mono hover:bg-purple-500/30 transition-colors flex items-center gap-2
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingAI ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            Ask Evelyn
          </button>

          <button onClick={onClose} className="p-1.5 hover:bg-terminal-800 transition-colors">
            <X className="w-5 h-5 text-terminal-400 hover:text-white" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Diff View */}
        <div className={`flex-1 flex ${showAIPanel ? 'pr-0' : ''}`}>
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-terminal-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Comparing...
            </div>
          ) : viewMode === 'split' ? (
            <SplitView
              contentA={contentA}
              contentB={contentB}
              titleA={titleA}
              titleB={titleB}
              comparison={comparison}
              onCopy={handleCopy}
              copied={copied}
            />
          ) : (
            <UnifiedView
              comparison={comparison}
              titleA={titleA}
              titleB={titleB}
            />
          )}
        </div>

        {/* AI Panel */}
        {showAIPanel && explanation && (
          <div className="w-80 border-l-2 border-white/20 bg-terminal-black flex flex-col">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-mono font-bold text-purple-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Evelyn's Analysis
              </h3>
              <button
                onClick={() => setShowAIPanel(false)}
                className="p-1 hover:bg-terminal-800 transition-colors"
              >
                <X className="w-4 h-4 text-terminal-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto terminal-scrollbar p-4 space-y-4">
              {/* Summary */}
              <div>
                <h4 className="text-xs font-mono font-bold text-terminal-400 uppercase mb-2">Summary</h4>
                <p className="text-sm text-white/90">{explanation.summary}</p>
              </div>

              {/* Change Explanations */}
              {explanation.changeExplanations.length > 0 && (
                <div>
                  <h4 className="text-xs font-mono font-bold text-terminal-400 uppercase mb-2">Changes</h4>
                  <div className="space-y-2">
                    {explanation.changeExplanations.map((change, i) => (
                      <div 
                        key={i}
                        className={`p-2 border-l-2 ${
                          change.impact === 'high' ? 'border-red-500 bg-red-500/5' :
                          change.impact === 'medium' ? 'border-orange bg-orange/5' :
                          'border-green-500 bg-green-500/5'
                        }`}
                      >
                        <p className="text-xs text-white/80">{change.explanation}</p>
                        {change.suggestion && (
                          <p className="text-xs text-terminal-500 mt-1 italic">
                            💡 {change.suggestion}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Overall Assessment */}
              <div>
                <h4 className="text-xs font-mono font-bold text-terminal-400 uppercase mb-2">Assessment</h4>
                <p className="text-sm text-white/70">{explanation.overallAssessment}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t-2 border-white/20 bg-terminal-black flex items-center justify-between">
        <div className="text-xs text-terminal-500 font-mono">
          {comparison && `${comparison.hunks.length} difference(s) found`}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border-2 border-white/20 text-terminal-300 text-sm font-mono
                     hover:border-white/30 hover:text-white transition-colors"
          >
            Close
          </button>
          {onApplyContent && (
            <button
              onClick={() => onApplyContent(contentB)}
              className="px-4 py-2 bg-orange border-2 border-orange text-white text-sm font-mono font-bold
                       hover:bg-orange-dark transition-colors"
            >
              Apply {titleB}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ========================================
// Split View
// ========================================

function SplitView({
  contentA,
  contentB,
  titleA,
  titleB,
  comparison,
  onCopy,
  copied
}: {
  contentA: string;
  contentB: string;
  titleA: string;
  titleB: string;
  comparison: ComparisonResult | null;
  onCopy: (side: 'A' | 'B') => void;
  copied: 'A' | 'B' | null;
}) {
  const linesA = contentA.split('\n');
  const linesB = contentB.split('\n');

  return (
    <div className="flex-1 flex">
      {/* Left Side */}
      <div className="flex-1 flex flex-col border-r border-white/10">
        <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between bg-terminal-900">
          <span className="text-xs font-mono text-terminal-400">{titleA}</span>
          <button
            onClick={() => onCopy('A')}
            className="p-1 hover:bg-terminal-800 transition-colors"
            title="Copy content"
          >
            {copied === 'A' ? (
              <Check className="w-3 h-3 text-green-500" />
            ) : (
              <Copy className="w-3 h-3 text-terminal-500" />
            )}
          </button>
        </div>
        <div className="flex-1 overflow-auto terminal-scrollbar bg-terminal-black/50">
          <pre className="p-4 text-xs font-mono">
            {linesA.map((line, i) => {
              const isRemoved = comparison?.hunks.some(h => 
                h.lines.some(l => l.type === 'removed' && l.lineNumber.left === i + 1)
              );
              return (
                <div
                  key={i}
                  className={`flex ${isRemoved ? 'bg-red-500/10' : ''}`}
                >
                  <span className="w-10 text-right pr-3 text-terminal-600 select-none">
                    {i + 1}
                  </span>
                  <span className={isRemoved ? 'text-red-400' : 'text-terminal-300'}>
                    {isRemoved && <Minus className="w-3 h-3 inline mr-1 text-red-500" />}
                    {line || ' '}
                  </span>
                </div>
              );
            })}
          </pre>
        </div>
      </div>

      {/* Right Side */}
      <div className="flex-1 flex flex-col">
        <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between bg-terminal-900">
          <span className="text-xs font-mono text-terminal-400">{titleB}</span>
          <button
            onClick={() => onCopy('B')}
            className="p-1 hover:bg-terminal-800 transition-colors"
            title="Copy content"
          >
            {copied === 'B' ? (
              <Check className="w-3 h-3 text-green-500" />
            ) : (
              <Copy className="w-3 h-3 text-terminal-500" />
            )}
          </button>
        </div>
        <div className="flex-1 overflow-auto terminal-scrollbar bg-terminal-black/50">
          <pre className="p-4 text-xs font-mono">
            {linesB.map((line, i) => {
              const isAdded = comparison?.hunks.some(h => 
                h.lines.some(l => l.type === 'added' && l.lineNumber.right === i + 1)
              );
              return (
                <div
                  key={i}
                  className={`flex ${isAdded ? 'bg-green-500/10' : ''}`}
                >
                  <span className="w-10 text-right pr-3 text-terminal-600 select-none">
                    {i + 1}
                  </span>
                  <span className={isAdded ? 'text-green-400' : 'text-terminal-300'}>
                    {isAdded && <Plus className="w-3 h-3 inline mr-1 text-green-500" />}
                    {line || ' '}
                  </span>
                </div>
              );
            })}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ========================================
// Unified View
// ========================================

function UnifiedView({
  comparison,
  titleA,
  titleB
}: {
  comparison: ComparisonResult | null;
  titleA: string;
  titleB: string;
}) {
  if (!comparison) {
    return (
      <div className="flex-1 flex items-center justify-center text-terminal-500">
        No comparison data
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto terminal-scrollbar bg-terminal-black/50">
      <pre className="p-4 text-xs font-mono">
        {comparison.hunks.map((hunk, hunkIdx) => (
          <div key={hunkIdx} className="mb-4">
            {/* Hunk header */}
            <div className="text-cyan-500 mb-2">
              @@ -{hunk.startLine.left},{hunk.endLine.left - hunk.startLine.left + 1} 
              +{hunk.startLine.right},{hunk.endLine.right - hunk.startLine.right + 1} @@
            </div>
            
            {hunk.lines.map((line, lineIdx) => (
              <div
                key={lineIdx}
                className={`flex ${
                  line.type === 'added' ? 'bg-green-500/10' :
                  line.type === 'removed' ? 'bg-red-500/10' :
                  ''
                }`}
              >
                <span className="w-10 text-right pr-3 text-terminal-600 select-none">
                  {line.lineNumber.left || ''}
                </span>
                <span className="w-10 text-right pr-3 text-terminal-600 select-none">
                  {line.lineNumber.right || ''}
                </span>
                <span className="w-4 text-center">
                  {line.type === 'added' && <span className="text-green-500">+</span>}
                  {line.type === 'removed' && <span className="text-red-500">-</span>}
                  {line.type === 'unchanged' && <span className="text-terminal-600"> </span>}
                </span>
                <span className={
                  line.type === 'added' ? 'text-green-400' :
                  line.type === 'removed' ? 'text-red-400' :
                  'text-terminal-300'
                }>
                  {line.content || ' '}
                </span>
              </div>
            ))}
          </div>
        ))}
      </pre>
    </div>
  );
}
