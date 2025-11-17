import { useState, useEffect, useRef } from 'react';
import { Globe, Loader2, CheckCircle2, XCircle, Clock, Eye, AlertTriangle, ExternalLink, Brain, Sparkles, FileText, Search } from 'lucide-react';
import AgentPageCard from './AgentPageCard';

interface AgentSessionInlineProps {
  sessionId: string;
  query: string;
  evelynIntent?: string;
  entryUrl?: string;
  isActive: boolean;
  approved: boolean;
  currentStep: string | null;
  currentDetail: string | null;
  pages: any[];
  pageCount: number;
  maxPages: number;
  error: string | null;
  summary: string | null;
  startedAt: string | null;
}

const STEP_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  planning: { label: 'Planning', icon: Brain, color: 'purple' },
  searching: { label: 'Searching', icon: Search, color: 'blue' },
  navigating: { label: 'Navigating', icon: Globe, color: 'cyan' },
  extracting: { label: 'Reading', icon: FileText, color: 'green' },
  interpreting: { label: 'Understanding', icon: Eye, color: 'amber' },
  deciding_next: { label: 'Deciding', icon: Brain, color: 'purple' },
  summarizing: { label: 'Summarizing', icon: Sparkles, color: 'pink' },
  complete: { label: 'Complete', icon: CheckCircle2, color: 'green' },
  error: { label: 'Error', icon: XCircle, color: 'red' }
};

export default function AgentSessionInline({
  sessionId,
  query,
  evelynIntent,
  entryUrl,
  isActive,
  approved,
  currentStep,
  currentDetail,
  pages,
  pageCount,
  maxPages,
  error,
  summary,
  startedAt
}: AgentSessionInlineProps) {
  const [expanded, setExpanded] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when expanded or when new pages are added
  useEffect(() => {
    if (expanded) {
      setTimeout(() => {
        const messageList = containerRef.current?.closest('.overflow-y-auto');
        if (messageList) {
          messageList.scrollTo({
            top: messageList.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  }, [expanded, pages.length, currentStep]);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isActive || !startedAt) {
      return;
    }

    const startTime = new Date(startedAt).getTime();
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedMs = now - startTime;
      setElapsed(Math.floor(elapsedMs / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, startedAt]);

  const stepConfig = currentStep ? STEP_CONFIG[currentStep] : null;
  const StepIcon = stepConfig?.icon || Globe;
  const isComplete = currentStep === 'complete' || !!summary;
  const hasError = currentStep === 'error' || !!error;

  const getStatusColor = () => {
    if (hasError) return 'red';
    if (isComplete) return 'green';
    if (isActive) return 'cyan';
    if (!approved) return 'amber';
    return 'gray';
  };

  const statusColor = getStatusColor();

  const colorClasses = {
    red: {
      bg: 'from-red-500/10 to-red-600/10',
      border: 'border-red-500/30',
      text: 'text-red-400',
      icon: 'text-red-400',
      pulse: 'bg-red-500'
    },
    green: {
      bg: 'from-green-500/10 to-emerald-600/10',
      border: 'border-green-500/30',
      text: 'text-green-400',
      icon: 'text-green-400',
      pulse: 'bg-green-500'
    },
    cyan: {
      bg: 'from-cyan-500/10 to-blue-600/10',
      border: 'border-cyan-500/30',
      text: 'text-cyan-400',
      icon: 'text-cyan-400',
      pulse: 'bg-cyan-500'
    },
    amber: {
      bg: 'from-amber-500/10 to-orange-600/10',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      icon: 'text-amber-400',
      pulse: 'bg-amber-500'
    },
    gray: {
      bg: 'from-gray-500/10 to-gray-600/10',
      border: 'border-gray-700',
      text: 'text-gray-400',
      icon: 'text-gray-400',
      pulse: 'bg-gray-500'
    }
  };

  const colors = colorClasses[statusColor as keyof typeof colorClasses];

  return (
    <div ref={containerRef} className="my-4 animate-fade-in">
      {/* Query badge */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <div className="glass-dark px-3 py-1 rounded-full flex items-center gap-2 text-xs">
          <Globe className="w-3 h-3 text-cyan-400" />
          <span className="text-gray-400">Browsing:</span>
          <span className="text-white font-medium">{query}</span>
        </div>
        {!approved && (
          <div className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-medium">
            Awaiting approval
          </div>
        )}
      </div>

      {/* Main container */}
      <div className={`bg-gradient-to-br ${colors.bg} rounded-3xl border ${colors.border} p-5 shadow-float hover:shadow-xl transition-all overflow-hidden`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3 flex-1">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg ${isActive && !hasError && !isComplete ? 'animate-pulse' : ''}`}>
              {isActive && !hasError && !isComplete ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : hasError ? (
                <XCircle className="w-5 h-5 text-white" />
              ) : isComplete ? (
                <CheckCircle2 className="w-5 h-5 text-white" />
              ) : (
                <Globe className="w-5 h-5 text-white" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-white text-sm">
                  {hasError ? 'Browsing Error' : isComplete ? 'Browsing Complete' : isActive ? 'Evelyn is exploring...' : 'Browsing Session'}
                </span>
                {stepConfig && !isComplete && !hasError && (
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full bg-${stepConfig.color}-500/20 border border-${stepConfig.color}-500/30`}>
                    <StepIcon className={`w-3 h-3 ${colors.icon}`} />
                    <span className={`text-[10px] font-medium ${colors.text}`}>
                      {stepConfig.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Current detail */}
              {currentDetail && !hasError && (
                <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  {isActive && <div className={`w-1 h-1 rounded-full ${colors.pulse} animate-pulse`} />}
                  {currentDetail}
                </div>
              )}

              {/* Progress indicators */}
              <div className="flex items-center gap-4 mt-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs">
                  <Eye className="w-3 h-3 text-gray-400" />
                  <span className={`font-medium ${colors.text}`}>{pageCount}</span>
                  <span className="text-gray-500">/ {maxPages} pages</span>
                </div>
                {elapsed > 0 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span className={`font-medium ${colors.text}`}>{elapsed}s</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => setExpanded(!expanded)}
            className="glass-dark w-8 h-8 rounded-lg flex items-center justify-center hover:scale-110 transition-transform flex-shrink-0"
          >
            <span className="text-sm text-white">{expanded ? '−' : '+'}</span>
          </button>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="space-y-4 animate-fade-in">
            {/* Evelyn's intent */}
            {evelynIntent && (
              <div className="bg-neutral-800/40 border border-neutral-700 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-semibold text-purple-300">Evelyn's Intent:</span>
                </div>
                <p className="text-sm text-gray-200 leading-relaxed">
                  {evelynIntent}
                </p>
              </div>
            )}

            {/* Entry URL */}
            {entryUrl && (
              <div className="bg-neutral-800/40 border border-neutral-700 rounded-2xl p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-xs font-semibold text-cyan-300">Starting point:</span>
                </div>
                <a
                  href={entryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline break-all"
                >
                  {entryUrl}
                </a>
              </div>
            )}

            {/* Error message */}
            {hasError && error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-red-300 mb-1">
                    Something went wrong
                  </div>
                  <p className="text-sm text-red-200/80 leading-relaxed">
                    {error}
                  </p>
                </div>
              </div>
            )}

            {/* Pages visited */}
            {pages.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-300">
                    Pages Explored ({pages.length}):
                  </span>
                </div>
                <div className="space-y-3">
                  {pages.map((page, idx) => (
                    <AgentPageCard key={idx} {...page} />
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            {summary && (
              <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-semibold text-purple-300">
                    Evelyn's Summary:
                  </span>
                </div>
                <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                  {summary}
                </div>
              </div>
            )}

            {/* Loading state for active browsing */}
            {isActive && !hasError && pages.length === 0 && (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Initializing browsing session...</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Collapse hint */}
        {!expanded && pages.length > 0 && (
          <div className="text-xs text-center text-gray-500 mt-2">
            Click <span className={colors.text}>+</span> to see {pages.length} page{pages.length !== 1 ? 's' : ''} visited
            {summary && ' and summary'}
          </div>
        )}
      </div>
    </div>
  );
}

