import { useState } from 'react';
import { Code2, Brain, Wrench, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, FileEdit, Search } from 'lucide-react';

interface AgenticIteration {
  step: number;
  think: string;
  toolCall?: {
    tool: string;
    params: Record<string, any>;
  };
  toolResult?: any;
  goalStatus: 'in_progress' | 'achieved' | 'blocked';
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
}

export default function AgenticEditProgress({ activity }: AgenticEditProgressProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const { status, metadata } = activity;
  const progress = metadata?.agenticProgress;
  const isRunning = status === 'running';
  const isDone = status === 'done';
  const isError = status === 'error';

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

            {!isRunning && activity.summary && (
              <p className="text-xs text-white/70 mt-2">
                {activity.summary}
              </p>
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

                {/* Think section */}
                {iteration.think && (
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
