import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Eye, EyeOff, Maximize2, Minimize2 } from 'lucide-react';

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed' | 'modified';
  lineNumber: { old?: number; new?: number };
  content: string;
  oldContent?: string;
}

interface LiveDiffViewProps {
  original: string;
  current: string;
  pending?: string;
  highlightRange?: { startLine: number; endLine: number };
  language?: string;
  onClose?: () => void;
}

/**
 * Live Diff View - Shows side-by-side comparison of document changes
 * Phase 3 UX improvement for agentic editing
 */
export default function LiveDiffView({
  original,
  current,
  pending,
  highlightRange,
  language,
  onClose
}: LiveDiffViewProps) {
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');
  const [showUnchanged, setShowUnchanged] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  // Compute diff between original and current
  const diffLines = useMemo(() => {
    return computeDiff(original, current);
  }, [original, current]);

  // Stats
  const stats = useMemo(() => {
    let added = 0, removed = 0, modified = 0;
    for (const line of diffLines) {
      if (line.type === 'added') added++;
      else if (line.type === 'removed') removed++;
      else if (line.type === 'modified') modified++;
    }
    return { added, removed, modified, total: diffLines.length };
  }, [diffLines]);

  // Filter lines if not showing unchanged
  const visibleLines = useMemo(() => {
    if (showUnchanged) return diffLines;
    return diffLines.filter(line => line.type !== 'unchanged');
  }, [diffLines, showUnchanged]);

  return (
    <div className={`bg-terminal-black border border-white/10 flex flex-col ${
      isExpanded ? 'fixed inset-4 z-50' : 'h-64'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-terminal-900 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
            Live Diff
          </span>
          
          {/* Stats */}
          <div className="flex items-center gap-2 text-[10px] font-mono">
            {stats.added > 0 && (
              <span className="text-emerald-400">+{stats.added}</span>
            )}
            {stats.removed > 0 && (
              <span className="text-red-400">-{stats.removed}</span>
            )}
            {stats.modified > 0 && (
              <span className="text-yellow-400">~{stats.modified}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* View mode toggle */}
          <button
            onClick={() => setViewMode(viewMode === 'split' ? 'unified' : 'split')}
            className="px-2 py-1 text-[10px] font-mono text-terminal-400 hover:text-white 
                     border border-white/10 hover:border-white/30 transition-colors"
          >
            {viewMode === 'split' ? 'Split' : 'Unified'}
          </button>

          {/* Show/hide unchanged */}
          <button
            onClick={() => setShowUnchanged(!showUnchanged)}
            className="p-1 text-terminal-400 hover:text-white transition-colors"
            title={showUnchanged ? 'Hide unchanged lines' : 'Show unchanged lines'}
          >
            {showUnchanged ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          {/* Expand/collapse */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-terminal-400 hover:text-white transition-colors"
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-terminal-400 hover:text-red-400 transition-colors ml-1"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'split' ? (
          <SplitView lines={visibleLines} highlightRange={highlightRange} />
        ) : (
          <UnifiedView lines={visibleLines} highlightRange={highlightRange} />
        )}
      </div>

      {/* Pending changes indicator */}
      {pending && pending !== current && (
        <div className="px-3 py-1.5 bg-orange/10 border-t border-orange/30">
          <span className="text-[10px] font-mono text-orange">
            ⏳ Pending changes will be applied...
          </span>
        </div>
      )}
    </div>
  );
}

// Split view component
function SplitView({ 
  lines, 
  highlightRange 
}: { 
  lines: DiffLine[]; 
  highlightRange?: { startLine: number; endLine: number };
}) {
  return (
    <div className="flex h-full">
      {/* Original side */}
      <div className="flex-1 border-r border-white/10 overflow-auto">
        <div className="text-[10px] font-mono px-2 py-1 bg-terminal-900/50 text-terminal-500 border-b border-white/5 sticky top-0">
          Original
        </div>
        <div className="font-mono text-[11px]">
          {lines.map((line, idx) => (
            <DiffLineRow
              key={idx}
              line={line}
              side="old"
              isHighlighted={highlightRange && 
                line.lineNumber.old !== undefined &&
                line.lineNumber.old >= highlightRange.startLine && 
                line.lineNumber.old <= highlightRange.endLine}
            />
          ))}
        </div>
      </div>

      {/* Current side */}
      <div className="flex-1 overflow-auto">
        <div className="text-[10px] font-mono px-2 py-1 bg-terminal-900/50 text-terminal-500 border-b border-white/5 sticky top-0">
          Current
        </div>
        <div className="font-mono text-[11px]">
          {lines.map((line, idx) => (
            <DiffLineRow
              key={idx}
              line={line}
              side="new"
              isHighlighted={highlightRange && 
                line.lineNumber.new !== undefined &&
                line.lineNumber.new >= highlightRange.startLine && 
                line.lineNumber.new <= highlightRange.endLine}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Unified view component
function UnifiedView({ 
  lines, 
  highlightRange 
}: { 
  lines: DiffLine[]; 
  highlightRange?: { startLine: number; endLine: number };
}) {
  return (
    <div className="font-mono text-[11px]">
      {lines.map((line, idx) => (
        <div
          key={idx}
          className={`flex ${
            line.type === 'added' ? 'bg-emerald-500/10' :
            line.type === 'removed' ? 'bg-red-500/10' :
            line.type === 'modified' ? 'bg-yellow-500/10' :
            ''
          }`}
        >
          <div className="w-8 text-right pr-2 text-terminal-600 select-none border-r border-white/5">
            {line.lineNumber.old || ''}
          </div>
          <div className="w-8 text-right pr-2 text-terminal-600 select-none border-r border-white/5">
            {line.lineNumber.new || ''}
          </div>
          <div className="w-4 text-center select-none">
            {line.type === 'added' && <span className="text-emerald-400">+</span>}
            {line.type === 'removed' && <span className="text-red-400">-</span>}
            {line.type === 'modified' && <span className="text-yellow-400">~</span>}
          </div>
          <pre className={`flex-1 px-2 whitespace-pre-wrap ${
            line.type === 'added' ? 'text-emerald-300' :
            line.type === 'removed' ? 'text-red-300 line-through' :
            line.type === 'modified' ? 'text-yellow-300' :
            'text-terminal-300'
          }`}>
            {line.content}
          </pre>
        </div>
      ))}
    </div>
  );
}

// Single diff line row
function DiffLineRow({ 
  line, 
  side, 
  isHighlighted 
}: { 
  line: DiffLine; 
  side: 'old' | 'new';
  isHighlighted?: boolean;
}) {
  const showContent = side === 'old' 
    ? line.type !== 'added'
    : line.type !== 'removed';

  const content = side === 'old' && line.oldContent ? line.oldContent : line.content;
  const lineNum = side === 'old' ? line.lineNumber.old : line.lineNumber.new;

  const bgColor = line.type === 'added' && side === 'new' ? 'bg-emerald-500/10' :
                  line.type === 'removed' && side === 'old' ? 'bg-red-500/10' :
                  line.type === 'modified' ? 'bg-yellow-500/10' :
                  '';

  const textColor = line.type === 'added' && side === 'new' ? 'text-emerald-300' :
                    line.type === 'removed' && side === 'old' ? 'text-red-300' :
                    line.type === 'modified' ? 'text-yellow-300' :
                    'text-terminal-300';

  return (
    <div className={`flex ${bgColor} ${isHighlighted ? 'ring-1 ring-orange ring-inset' : ''}`}>
      <div className="w-8 text-right pr-2 text-terminal-600 select-none border-r border-white/5 flex-shrink-0">
        {showContent ? lineNum : ''}
      </div>
      <pre className={`flex-1 px-2 whitespace-pre-wrap ${textColor} ${
        line.type === 'removed' && side === 'old' ? 'line-through opacity-70' : ''
      }`}>
        {showContent ? content : ''}
      </pre>
    </div>
  );
}

// Compute diff between two strings
function computeDiff(original: string, current: string): DiffLine[] {
  const oldLines = original.split('\n');
  const newLines = current.split('\n');
  const result: DiffLine[] = [];

  // Simple LCS-based diff
  const lcs = computeLCS(oldLines, newLines);
  
  let oldIdx = 0;
  let newIdx = 0;
  let oldLineNum = 1;
  let newLineNum = 1;

  for (const match of lcs) {
    // Add removed lines
    while (oldIdx < match.oldIndex) {
      result.push({
        type: 'removed',
        lineNumber: { old: oldLineNum++ },
        content: oldLines[oldIdx],
        oldContent: oldLines[oldIdx]
      });
      oldIdx++;
    }

    // Add added lines
    while (newIdx < match.newIndex) {
      result.push({
        type: 'added',
        lineNumber: { new: newLineNum++ },
        content: newLines[newIdx]
      });
      newIdx++;
    }

    // Add unchanged line
    result.push({
      type: 'unchanged',
      lineNumber: { old: oldLineNum++, new: newLineNum++ },
      content: oldLines[oldIdx]
    });
    oldIdx++;
    newIdx++;
  }

  // Add remaining removed lines
  while (oldIdx < oldLines.length) {
    result.push({
      type: 'removed',
      lineNumber: { old: oldLineNum++ },
      content: oldLines[oldIdx],
      oldContent: oldLines[oldIdx]
    });
    oldIdx++;
  }

  // Add remaining added lines
  while (newIdx < newLines.length) {
    result.push({
      type: 'added',
      lineNumber: { new: newLineNum++ },
      content: newLines[newIdx]
    });
    newIdx++;
  }

  return result;
}

// Compute Longest Common Subsequence
function computeLCS(oldLines: string[], newLines: string[]): { oldIndex: number; newIndex: number }[] {
  const m = oldLines.length;
  const n = newLines.length;
  
  // DP table
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS
  const result: { oldIndex: number; newIndex: number }[] = [];
  let i = m, j = n;

  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ oldIndex: i - 1, newIndex: j - 1 });
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

export { LiveDiffView };
