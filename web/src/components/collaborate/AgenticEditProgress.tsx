import { useState, useEffect, useMemo } from 'react';
import { Code2, Brain, Wrench, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, FileEdit, Search, MousePointer2, MapPin, Eye, Target, AlertTriangle, Sparkles, GitCompare } from 'lucide-react';
import { wsClient } from '../../lib/ws';
import { getPersonalityMessage, getToolMessage, getResultMessage, getCompletionMessage } from '../../lib/evelynPersonality';

interface StructuredThought {
  observation: string;
  plan: string;
  risk: 'low' | 'medium' | 'high';
  toolChoice: string;
  confidence: number;
}

interface AgenticIteration {
  step: number;
  think: string;
  structuredThought?: StructuredThought;
  toolCall?: {
    tool: string;
    params: Record<string, any>;
  };
  toolResult?: any;
  goalStatus: 'in_progress' | 'achieved' | 'blocked';
  subGoalId?: string;
}

interface CursorPresence {
  action: 'idle' | 'thinking' | 'reading' | 'typing' | 'selecting' | 'searching';
  cursor?: { line: number; column: number };
  targetDescription?: string;
}

interface AgenticEditProgressProps {
  activity: {
    id: number;
    tool: string;
    status: 'running' | 'done' | 'error';
    summary?: string;
    metadata?: {
      changes?: number;
      iterations?: number;
      goalAchieved?: boolean;
      currentIteration?: number;
      goal?: string;
      agenticProgress?: {
        iterations: AgenticIteration[];
        currentStep: number;
        totalSteps: number;
        goal: string;
      };
    };
  };
  onJumpToCursor?: (line: number) => void;
}

export default function AgenticEditProgress({ activity, onJumpToCursor }: AgenticEditProgressProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [cursorPresence, setCursorPresence] = useState<CursorPresence | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  
  const { status, metadata } = activity;
  const progress = metadata?.agenticProgress;
  const isRunning = status === 'running';
  const isDone = status === 'done';
  const isError = status === 'error';

  // Get current personality message based on state (Phase 3 enhancement)
  const personalityMessage = useMemo(() => {
    if (isDone) {
      return getCompletionMessage(metadata?.changes || 0, metadata?.iterations || 0);
    }
    if (isError) {
      return getPersonalityMessage('error');
    }
    if (cursorPresence) {
      switch (cursorPresence.action) {
        case 'thinking': return getPersonalityMessage('thinking');
        case 'searching': return getPersonalityMessage('searching');
        case 'reading': return getPersonalityMessage('reading');
        case 'typing': return getPersonalityMessage('editing');
        case 'selecting': return getPersonalityMessage('editing');
        default: return getPersonalityMessage('thinking');
      }
    }
    if (isRunning) {
      return getPersonalityMessage('thinking');
    }
    return null;
  }, [isDone, isError, isRunning, cursorPresence, metadata?.changes, metadata?.iterations]);

  // Listen for cursor presence updates
  useEffect(() => {
    const socket = wsClient.socket;
    if (!socket || !isRunning) return;

    const handlePresence = (data: CursorPresence) => {
      setCursorPresence(data);
    };

    socket.on('collaborate:evelyn_presence', handlePresence);
    socket.on('collaborate:cursor_move', (data: any) => {
      setCursorPresence({
        action: data.action,
        cursor: { line: data.line, column: data.column }
      });
    });

    return () => {
      socket.off('collaborate:evelyn_presence', handlePresence);
      socket.off('collaborate:cursor_move');
    };
  }, [isRunning]);

  // Clear presence when done
  useEffect(() => {
    if (!isRunning) {
      setCursorPresence(null);
    }
  }, [isRunning]);

  // Debug logging
  console.log('[AgenticEditProgress] Rendering with activity:', activity);
  console.log('[AgenticEditProgress] Progress data:', progress);

  // Tool icon mapping
  const getToolIcon = (toolName: string) => {
    switch (toolName) {
      case 'read_file':
        return <FileEdit className="w-3 h-3" />;
      case 'write_to_file':
      case 'replace_in_file':
        return <Code2 className="w-3 h-3" />;
      case 'search_files':
        return <Search className="w-3 h-3" />;
      default:
        return <Wrench className="w-3 h-3" />;
    }
  };

  // Status color mapping
  const getStatusStyles = () => {
    if (isDone) {
      return {
        bg: 'bg-emerald-500/5',
        border: 'border-emerald-500',
        text: 'text-emerald-400',
        icon: <CheckCircle2 className="w-4 h-4" />
      };
    }
    if (isError) {
      return {
        bg: 'bg-red-500/5',
        border: 'border-red-500',
        text: 'text-red-400',
        icon: <XCircle className="w-4 h-4" />
      };
    }
    return {
      bg: 'bg-orange/5',
      border: 'border-orange',
      text: 'text-orange',
      icon: <Loader2 className="w-4 h-4 animate-spin" />
    };
  };

  const styles = getStatusStyles();

  return (
    <div className={`mb-4 animate-fade-in-down border-2 ${styles.border} ${styles.bg}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b-2 border-current/20">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className={styles.text}>
                {styles.icon}
              </div>
              <span className={`text-sm font-mono font-bold uppercase tracking-wider ${styles.text}`}>
                Agentic Code Editor
              </span>
              {isRunning && progress && (
                <span className="px-2 py-0.5 bg-terminal-900 border border-white/20 text-terminal-300 text-[10px] font-mono font-medium">
                  Step {progress.currentStep}/{progress.totalSteps}
                </span>
              )}
            </div>
            
            {progress?.goal && (
              <div className="flex items-start gap-2">
                <Brain className={`w-3.5 h-3.5 mt-0.5 ${styles.text}`} />
                <p className="text-sm text-white/90 font-medium">
                  Goal: {progress.goal}
                </p>
              </div>
            )}

            {/* Personality Message (Phase 3 enhancement) */}
            {personalityMessage && (
              <div className="flex items-center gap-2 mt-2">
                <Sparkles className={`w-3.5 h-3.5 ${styles.text}`} />
                <p className={`text-xs font-mono ${styles.text}`}>
                  {personalityMessage}
                </p>
              </div>
            )}

            {!isRunning && activity.summary && !personalityMessage && (
              <p className="text-xs text-white/70 mt-2">
                {activity.summary}
              </p>
            )}

            {/* Cursor Position Indicator */}
            {isRunning && cursorPresence && (
              <div className="mt-3 flex items-center gap-3">
                <div className="flex items-center gap-2 px-2 py-1 bg-terminal-900 border border-orange/30">
                  <MousePointer2 className="w-3 h-3 text-orange animate-pulse" />
                  <span className="text-[10px] font-mono text-orange">
                    {cursorPresence.action === 'thinking' && 'Thinking...'}
                    {cursorPresence.action === 'reading' && 'Reading'}
                    {cursorPresence.action === 'typing' && 'Typing'}
                    {cursorPresence.action === 'selecting' && 'Selecting'}
                    {cursorPresence.action === 'searching' && 'Searching'}
                  </span>
                  {cursorPresence.cursor && (
                    <span className="text-[10px] font-mono text-terminal-400">
                      Line {cursorPresence.cursor.line}
                    </span>
                  )}
                </div>
                {cursorPresence.cursor && onJumpToCursor && (
                  <button
                    onClick={() => onJumpToCursor(cursorPresence.cursor!.line)}
                    className="flex items-center gap-1 px-2 py-1 bg-orange/10 border border-orange/30 
                             text-orange text-[10px] font-mono hover:bg-orange/20 transition-colors"
                  >
                    <MapPin className="w-3 h-3" />
                    Jump to cursor
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 hover:bg-terminal-800 border border-white/20 hover:border-white/30 transition-colors duration-150 group"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-terminal-400 group-hover:text-white transition-colors" />
            ) : (
              <ChevronDown className="w-4 h-4 text-terminal-400 group-hover:text-white transition-colors" />
            )}
          </button>
        </div>
      </div>

      {/* Iterations (Cursor-style) */}
      {isExpanded && progress?.iterations && progress.iterations.length > 0 && (
        <div className="px-4 py-3 space-y-3">
          {progress.iterations.map((iteration, idx) => {
            const isCurrentStep = isRunning && idx === progress.iterations.length - 1;
            const isCompleted = iteration.goalStatus === 'achieved' || idx < progress.iterations.length - 1;

            return (
              <div
                key={iteration.step}
                className={`border-l-2 pl-4 py-2 transition-all duration-200 ${
                  isCurrentStep
                    ? 'border-orange animate-pulse-border'
                    : isCompleted
                    ? 'border-emerald-500'
                    : 'border-terminal-700'
                }`}
              >
                {/* Step header */}
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-5 h-5 flex items-center justify-center border ${
                    isCurrentStep
                      ? 'bg-orange/10 border-orange text-orange'
                      : isCompleted
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                      : 'bg-terminal-900 border-white/20 text-terminal-500'
                  }`}>
                    <span className="text-[10px] font-mono font-bold">{iteration.step}</span>
                  </div>
                  <span className={`text-xs font-mono font-medium uppercase tracking-wider ${
                    isCurrentStep ? 'text-orange' : isCompleted ? 'text-emerald-400' : 'text-terminal-500'
                  }`}>
                    {isCurrentStep ? 'Thinking...' : isCompleted ? 'Completed' : 'Pending'}
                  </span>
                </div>

                {/* Structured Think section (Phase 1 enhancement) */}
                {iteration.structuredThought ? (
                  <div className="mb-2 space-y-2">
                    {/* Observation */}
                    <div>
                      <div className="flex items-start gap-2 mb-1">
                        <Eye className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-400">
                          Observation
                        </span>
                      </div>
                      <div className="ml-5 pl-3 border-l border-blue-400/30">
                        <p className="text-xs text-white/80 leading-relaxed font-mono">
                          {iteration.structuredThought.observation}
                        </p>
                      </div>
                    </div>
                    
                    {/* Plan */}
                    <div>
                      <div className="flex items-start gap-2 mb-1">
                        <Target className="w-3.5 h-3.5 text-purple-400 mt-0.5 flex-shrink-0" />
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-400">
                          Plan
                        </span>
                        {/* Risk badge */}
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 ${
                          iteration.structuredThought.risk === 'low' 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : iteration.structuredThought.risk === 'medium'
                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {iteration.structuredThought.risk.toUpperCase()} RISK
                        </span>
                      </div>
                      <div className="ml-5 pl-3 border-l border-purple-400/30">
                        <p className="text-xs text-white/80 leading-relaxed font-mono">
                          {iteration.structuredThought.plan}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : iteration.think && (
                  /* Fallback to plain think */
                  <div className="mb-2">
                    <div className="flex items-start gap-2 mb-1">
                      <Brain className="w-3.5 h-3.5 text-purple-400 mt-0.5 flex-shrink-0" />
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-400">
                        Think
                      </span>
                    </div>
                    <div className="ml-5 pl-3 border-l border-purple-400/30">
                      <p className="text-xs text-white/80 leading-relaxed font-mono">
                        {iteration.think}
                      </p>
                    </div>
                  </div>
                )}

                {/* Tool call section */}
                {iteration.toolCall && (
                  <div className="mb-2">
                    <div className="flex items-start gap-2 mb-1">
                      <div className="text-cyan-400 mt-0.5">
                        {getToolIcon(iteration.toolCall.tool)}
                      </div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400">
                        Tool: {iteration.toolCall.tool}
                      </span>
                    </div>
                    <div className="ml-5 pl-3 border-l border-cyan-400/30">
                      <div className="bg-terminal-black/50 border border-white/10 px-3 py-2">
                        <code className="text-[11px] font-mono text-terminal-300">
                          {iteration.toolCall.params && typeof iteration.toolCall.params === 'object' ? (
                            Object.entries(iteration.toolCall.params).map(([key, value]) => (
                              <div key={key} className="mb-1">
                                <span className="text-cyan-400">{key}:</span>{' '}
                                <span className="text-white/70">
                                  {typeof value === 'string' && value.length > 60
                                    ? value.slice(0, 60) + '...'
                                    : String(value)}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="text-terminal-500">No parameters</div>
                          )}
                        </code>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tool result */}
                {iteration.toolResult && (
                  <div>
                    <div className="flex items-start gap-2 mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5" />
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                        Result
                      </span>
                    </div>
                    <div className="ml-5 pl-3 border-l border-emerald-400/30">
                      <div className={`border px-3 py-2 ${
                        iteration.toolResult.success 
                          ? 'bg-emerald-500/5 border-emerald-500/20'
                          : 'bg-red-500/5 border-red-500/20'
                      }`}>
                        <p className={`text-[11px] font-mono ${
                          iteration.toolResult.success ? 'text-emerald-300' : 'text-red-300'
                        }`}>
                          {iteration.toolResult.success 
                            ? iteration.toolResult.message || 'Success'
                            : iteration.toolResult.error || 'Failed'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Summary footer when complete */}
          {isDone && metadata?.changes !== undefined && (
            <div className="pt-3 border-t border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono text-emerald-400">
                  {metadata.changes} change{metadata.changes !== 1 ? 's' : ''} applied
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-terminal-500">
                  {metadata.iterations} iteration{metadata.iterations !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Simple progress bar when collapsed or no detailed progress */}
      {(!isExpanded || !progress?.iterations) && isRunning && (
        <div className="px-4 py-3">
          <div className="h-1 bg-terminal-900 overflow-hidden">
            <div className="h-full bg-orange animate-pulse-slow" style={{ width: '60%' }} />
          </div>
        </div>
      )}
    </div>
  );
}
