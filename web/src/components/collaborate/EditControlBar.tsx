/**
 * Edit Control Bar
 * 
 * Floating control bar that appears during and after agentic edits.
 * Provides quick actions: undo, redo, accept, reject, retry.
 */

import { useState, useEffect } from 'react';
import { 
  Undo2, Redo2, Check, X, RefreshCw, 
  Pause, Play, Eye, EyeOff, Clock,
  ChevronUp, ChevronDown, History, GitCompare
} from 'lucide-react';

interface EditControlBarProps {
  isEditing: boolean;
  editPhase: 'idle' | 'detecting' | 'planning' | 'executing' | 'verifying' | 'complete' | 'error';
  canUndo: boolean;
  canRedo: boolean;
  hasChanges: boolean;
  editDuration?: number;
  changesCount?: number;
  onUndo?: () => void;
  onRedo?: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  onRetry?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onToggleDiff?: () => void;
  onViewHistory?: () => void;
  showDiff?: boolean;
  isPaused?: boolean;
}

export default function EditControlBar({
  isEditing,
  editPhase,
  canUndo,
  canRedo,
  hasChanges,
  editDuration,
  changesCount,
  onUndo,
  onRedo,
  onAccept,
  onReject,
  onRetry,
  onPause,
  onResume,
  onToggleDiff,
  onViewHistory,
  showDiff = false,
  isPaused = false,
}: EditControlBarProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Update elapsed time during editing
  useEffect(() => {
    if (!isEditing) return;
    
    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isEditing]);

  // Don't show if idle and no changes
  if (editPhase === 'idle' && !hasChanges) {
    return null;
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const phaseLabel = {
    idle: '',
    detecting: 'Analyzing...',
    planning: 'Planning...',
    executing: 'Editing...',
    verifying: 'Verifying...',
    complete: 'Complete',
    error: 'Error',
  }[editPhase];

  const phaseColor = {
    idle: 'text-terminal-500',
    detecting: 'text-purple-400',
    planning: 'text-blue-400',
    executing: 'text-orange',
    verifying: 'text-cyan-400',
    complete: 'text-emerald-400',
    error: 'text-red-400',
  }[editPhase];

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-3 py-2 bg-terminal-900 border-2 border-orange 
                   text-orange font-mono text-xs hover:bg-orange/10 transition-colors shadow-lg"
        >
          <ChevronUp className="w-4 h-4" />
          <span>Edit Controls</span>
          {isEditing && (
            <span className="w-2 h-2 bg-orange rounded-full animate-pulse" />
          )}
        </button>
      </div>
    );
  }

  // Position the control bar centered in the editor area (between sidebar and chat panel)
  // Sidebar is ~280px, chat panel is ~384px (w-96), so offset from center by ~52px to the left
  return (
    <div className="fixed bottom-4 z-50" style={{ left: 'calc(50% - 52px)', transform: 'translateX(-50%)' }}>
      <div className="bg-terminal-900/95 backdrop-blur-sm border-2 border-white/20 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
          <div className="flex items-center gap-3">
            {/* Status indicator */}
            {isEditing && (
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${phaseColor.replace('text-', 'bg-')} animate-pulse`} />
                <span className={`text-xs font-mono font-bold ${phaseColor}`}>
                  {phaseLabel}
                </span>
              </div>
            )}
            
            {/* Timer */}
            {isEditing && (
              <div className="flex items-center gap-1 text-terminal-500">
                <Clock className="w-3 h-3" />
                <span className="text-[10px] font-mono">{formatTime(elapsedTime)}</span>
              </div>
            )}

            {/* Changes count */}
            {hasChanges && changesCount !== undefined && (
              <span className="text-[10px] font-mono text-emerald-400 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/30">
                {changesCount} change{changesCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 hover:bg-white/10 transition-colors"
          >
            <ChevronDown className="w-4 h-4 text-terminal-500" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 px-3 py-2">
          {/* Undo/Redo */}
          <div className="flex items-center border-r border-white/10 pr-2 mr-2">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`p-2 transition-colors ${
                canUndo 
                  ? 'hover:bg-white/10 text-white' 
                  : 'text-terminal-600 cursor-not-allowed'
              }`}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={`p-2 transition-colors ${
                canRedo 
                  ? 'hover:bg-white/10 text-white' 
                  : 'text-terminal-600 cursor-not-allowed'
              }`}
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* During editing: Pause/Resume */}
          {isEditing && (
            <div className="flex items-center border-r border-white/10 pr-2 mr-2">
              {isPaused ? (
                <button
                  onClick={onResume}
                  className="p-2 hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                  title="Resume"
                >
                  <Play className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={onPause}
                  className="p-2 hover:bg-yellow-500/20 text-yellow-400 transition-colors"
                  title="Pause"
                >
                  <Pause className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* View controls */}
          <div className="flex items-center border-r border-white/10 pr-2 mr-2">
            <button
              onClick={onToggleDiff}
              className={`p-2 transition-colors ${
                showDiff 
                  ? 'bg-cyan-500/20 text-cyan-400' 
                  : 'hover:bg-white/10 text-terminal-400'
              }`}
              title="Toggle Diff View"
            >
              <GitCompare className="w-4 h-4" />
            </button>
            <button
              onClick={onViewHistory}
              className="p-2 hover:bg-white/10 text-terminal-400 transition-colors"
              title="View History"
            >
              <History className="w-4 h-4" />
            </button>
          </div>

          {/* Accept/Reject (after edit complete) */}
          {editPhase === 'complete' && hasChanges && (
            <div className="flex items-center gap-1">
              <button
                onClick={onReject}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/30 
                         text-red-400 text-xs font-mono hover:bg-red-500/20 transition-colors"
              >
                <X className="w-3 h-3" />
                Reject
              </button>
              <button
                onClick={onAccept}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 
                         text-emerald-400 text-xs font-mono hover:bg-emerald-500/20 transition-colors"
              >
                <Check className="w-3 h-3" />
                Accept
              </button>
            </div>
          )}

          {/* Error state */}
          {editPhase === 'error' && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange/10 border border-orange/30 
                       text-orange text-xs font-mono hover:bg-orange/20 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          )}
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="px-3 py-1.5 border-t border-white/5 bg-terminal-950/50">
          <div className="flex items-center justify-center gap-4 text-[9px] font-mono text-terminal-600">
            <span><kbd className="px-1 bg-terminal-800 rounded">⌘Z</kbd> undo</span>
            <span><kbd className="px-1 bg-terminal-800 rounded">⌘⇧Z</kbd> redo</span>
            <span><kbd className="px-1 bg-terminal-800 rounded">⌘D</kbd> diff</span>
            <span><kbd className="px-1 bg-terminal-800 rounded">Esc</kbd> cancel</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export { EditControlBar };
