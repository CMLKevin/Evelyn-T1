/**
 * AgenticProgress - Cursor-inspired agentic edit progress indicator
 * 
 * A clean, minimal progress display that shows:
 * - Current phase (thinking, editing, verifying)
 * - Iteration progress
 * - Goal summary
 * - Expandable details
 */

import { useState, useEffect } from 'react';
import { useStore } from '../../state/store';
import { wsClient } from '../../lib/ws';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FileEdit,
  Brain,
  Wrench,
  Code2,
  StopCircle
} from 'lucide-react';

// Phase display config - must match AgenticEditPhase type
const PHASE_CONFIG: Record<string, { icon: typeof Sparkles; label: string; color: string }> = {
  idle: { icon: Sparkles, label: 'Ready', color: 'text-zinc-400' },
  detecting: { icon: Brain, label: 'Detecting Intent', color: 'text-yellow-400' },
  planning: { icon: Brain, label: 'Planning', color: 'text-purple-400' },
  executing: { icon: FileEdit, label: 'Editing', color: 'text-orange' },
  verifying: { icon: Code2, label: 'Verifying', color: 'text-blue-400' },
  complete: { icon: CheckCircle2, label: 'Complete', color: 'text-emerald-400' },
  error: { icon: XCircle, label: 'Error', color: 'text-red-400' },
};

// Tool icons
const TOOL_ICONS: Record<string, typeof FileEdit> = {
  write_to_file: FileEdit,
  replace_in_file: Code2,
  read_file: FileEdit,
  search_files: FileEdit,
};

export default function AgenticProgress() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isDismissed, setIsDismissed] = useState(false);

  // Subscribe directly to the agentic edit session for proper reactivity
  const session = useStore(state => state.collaborateState.agenticEditSession);
  const activeDocument = useStore(state => state.collaborateState.activeDocument);
  const resetSession = useStore(state => state.resetAgenticEditSession);
  
  const {
    isActive,
    phase,
    goal,
    currentStep,
    totalSteps,
    estimatedSteps,
    iterations,
    currentThinking,
    currentToolCall,
    diff,
    startTime,
    duration,
    success,
    error,
    message,
  } = session;

  // Update elapsed time while active
  useEffect(() => {
    if (!isActive || !startTime) {
      setElapsedTime(0);
      return;
    }
    
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isActive, startTime]);

  // Reset dismissed state when a new session starts
  useEffect(() => {
    if (isActive) {
      setIsDismissed(false);
    }
  }, [isActive]);

  // Show if active, recently completed, or error (unless dismissed)
  const shouldShow = !isDismissed && (
    isActive ||
    phase === 'complete' ||
    phase === 'error'
  );

  if (!shouldShow) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    // Optionally reset the session state after a brief delay
    setTimeout(() => resetSession(), 500);
  };

  const handleCancel = () => {
    if (!activeDocument?.id) {
      console.warn('[AgenticProgress] No active document to cancel');
      return;
    }
    console.log(`[AgenticProgress] Cancelling task for document ${activeDocument.id}`);
    wsClient.cancelCollaborateTask(activeDocument.id);
  };

  const phaseConfig = PHASE_CONFIG[phase] || PHASE_CONFIG.idle;
  const PhaseIcon = phaseConfig.icon;
  const steps = totalSteps || estimatedSteps || 5;
  const progressPercent = Math.min((currentStep / steps) * 100, 100);
  const displayTime = duration ? Math.floor(duration / 1000) : elapsedTime;
  const lastIteration = iterations[iterations.length - 1];
  const ToolIcon = currentToolCall?.tool ? (TOOL_ICONS[currentToolCall.tool] || Wrench) : null;

  return (
    <div className="mb-4 animate-fade-in-down">
      <div className={`
        border-2 rounded-lg overflow-hidden transition-all duration-200
        ${phase === 'error' ? 'border-red-500/50 bg-red-500/5' : 
          phase === 'complete' ? 'border-emerald-500/50 bg-emerald-500/5' : 
          'border-orange/50 bg-orange/5'}
      `}>
        {/* Header - Always visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            {/* Status indicator */}
            <div className="relative">
              {isActive ? (
                <Loader2 className={`w-5 h-5 ${phaseConfig.color} animate-spin`} />
              ) : (
                <PhaseIcon className={`w-5 h-5 ${phaseConfig.color}`} />
              )}
            </div>
            
            {/* Phase and goal */}
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${phaseConfig.color}`}>
                  {phaseConfig.label}
                </span>
                {isActive && (
                  <span className="text-xs text-zinc-500">
                    Step {currentStep + 1}/{steps}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 truncate max-w-[300px]">
                {goal || 'Processing...'}
              </p>
            </div>
          </div>
          
          {/* Right side - time, cancel, dismiss, and expand */}
          <div className="flex items-center gap-3">
            {displayTime > 0 && (
              <span className="text-xs text-zinc-500 font-mono">
                {displayTime}s
              </span>
            )}
            {/* Cancel button for active operations */}
            {isActive && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancel();
                }}
                className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors flex items-center gap-1"
                title="Cancel operation"
              >
                <StopCircle className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            )}
            {/* Dismiss button for completed/error states */}
            {!isActive && (phase === 'complete' || phase === 'error') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDismiss();
                }}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="Dismiss"
              >
                <XCircle className="w-4 h-4 text-zinc-500 hover:text-zinc-300" />
              </button>
            )}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-zinc-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-500" />
            )}
          </div>
        </button>
        
        {/* Progress bar */}
        {isActive && (
          <div className="h-1 bg-terminal-800">
            <div 
              className="h-full bg-orange transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
        
        {/* Expanded details */}
        {isExpanded && (
          <div className="px-4 py-3 border-t border-white/10 space-y-3">
            {/* Current action */}
            {isActive && currentToolCall && (
              <div className="flex items-center gap-2 text-sm">
                {ToolIcon && <ToolIcon className="w-4 h-4 text-orange" />}
                <span className="text-zinc-300">
                  Using <code className="text-orange">{currentToolCall.tool}</code>
                </span>
              </div>
            )}
            
            {/* Current thinking */}
            {isActive && currentThinking && (
              <div className="flex items-start gap-2 text-sm">
                <Brain className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                <p className="text-zinc-400 text-xs line-clamp-2">
                  {currentThinking.slice(0, 150)}...
                </p>
              </div>
            )}
            
            {/* Iterations list */}
            {iterations.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-zinc-500 uppercase tracking-wide">
                  Iterations ({iterations.length})
                </p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {iterations.map((iter, i) => (
                    <div 
                      key={i}
                      className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-terminal-800/50"
                    >
                      <span className="text-zinc-500 w-4">{iter.step + 1}.</span>
                      {iter.toolCall ? (
                        <>
                          <Wrench className="w-3 h-3 text-orange" />
                          <span className="text-zinc-300">{iter.toolCall.tool}</span>
                        </>
                      ) : (
                        <>
                          <Brain className="w-3 h-3 text-purple-400" />
                          <span className="text-zinc-400 truncate">Thinking...</span>
                        </>
                      )}
                      {iter.goalStatus === 'achieved' && (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 ml-auto" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Diff summary */}
            {diff && (diff.linesAdded > 0 || diff.linesRemoved > 0) && (
              <div className="flex items-center gap-3 text-xs">
                <span className="text-emerald-400">+{diff.linesAdded}</span>
                <span className="text-red-400">-{diff.linesRemoved}</span>
                <span className="text-zinc-500">lines changed</span>
              </div>
            )}
            
            {/* Error message */}
            {error && (
              <div className="p-2 rounded bg-red-500/10 border border-red-500/30">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
            
            {/* Success message */}
            {phase === 'complete' && success && (
              <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30">
                <p className="text-sm text-emerald-400">
                  {message || `Completed in ${iterations.length} iterations`}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
