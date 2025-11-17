import { useEffect, useState } from 'react';
import { useStore } from '../../state/store';
import { wsClient } from '../../lib/ws';
import { Search, Globe, FileText, Eye, Brain, FileCheck, X, Loader2 } from 'lucide-react';

const STEPS = [
  { key: 'searching', label: 'Searching', icon: Search },
  { key: 'navigating', label: 'Visiting', icon: Globe },
  { key: 'extracting', label: 'Extracting', icon: FileText },
  { key: 'interpreting', label: 'Interpreting', icon: Eye },
  { key: 'deciding_next', label: 'Deciding', icon: Brain },
  { key: 'summarizing', label: 'Summarizing', icon: FileCheck }
];

export default function AgentStatusBar() {
  const { agentSession, resetAgentSession } = useStore();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!agentSession.isActive || !agentSession.startedAt) {
      setElapsed(0);
      return;
    }

    const startTime = new Date(agentSession.startedAt).getTime();
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedMs = now - startTime;
      setElapsed(Math.floor(elapsedMs / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [agentSession.isActive, agentSession.startedAt]);

  const handleCancel = () => {
    if (agentSession.sessionId) {
      wsClient.cancelAgentSession(agentSession.sessionId);
    }
    resetAgentSession();
  };

  if (!agentSession.isActive && !agentSession.summary) {
    return null;
  }

  const currentStepIndex = STEPS.findIndex(s => s.key === agentSession.currentStep);
  const isComplete = agentSession.currentStep === 'complete';
  const isError = agentSession.currentStep === 'error';

  return (
    <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-y border-cyan-500/20 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              {agentSession.isActive && !isComplete && !isError && (
                <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
              )}
              {isComplete && (
                <FileCheck className="w-5 h-5 text-green-400" />
              )}
              {isError && (
                <X className="w-5 h-5 text-red-400" />
              )}
            </div>
            <div>
              <div className="text-sm font-medium text-neutral-100">
                {isComplete && 'Browsing Complete'}
                {isError && 'Browsing Error'}
                {!isComplete && !isError && 'Evelyn is browsing...'}
              </div>
              {agentSession.currentDetail && (
                <div className="text-xs text-neutral-400 mt-0.5">
                  {agentSession.currentDetail}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Progress */}
            <div className="text-xs text-neutral-400">
              <span className="text-neutral-200 font-medium">{agentSession.pageCount}</span>
              {' / '}
              <span>{agentSession.maxPages}</span>
              {' pages'}
            </div>

            {/* Time */}
            {elapsed > 0 && (
              <div className="text-xs text-neutral-400">
                <span className="text-neutral-200 font-medium">{elapsed}s</span>
              </div>
            )}

            {/* Cancel */}
            {agentSession.isActive && !isComplete && (
              <button
                onClick={handleCancel}
                className="text-xs px-3 py-1.5 rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-2">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = idx === currentStepIndex;
            const isDone = idx < currentStepIndex || isComplete;
            const isPending = idx > currentStepIndex && !isComplete;

            return (
              <div key={step.key} className="flex items-center flex-1">
                <div
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg transition-all flex-1
                    ${isActive ? 'bg-cyan-500/20 border border-cyan-500/40' : ''}
                    ${isDone ? 'bg-green-500/10 border border-green-500/20' : ''}
                    ${isPending ? 'bg-neutral-800/30 border border-neutral-700' : ''}
                  `}
                >
                  <Icon
                    className={`
                      w-4 h-4 transition-colors
                      ${isActive ? 'text-cyan-400 animate-pulse' : ''}
                      ${isDone ? 'text-green-400' : ''}
                      ${isPending ? 'text-neutral-600' : ''}
                    `}
                  />
                  <span
                    className={`
                      text-xs font-medium transition-colors
                      ${isActive ? 'text-cyan-300' : ''}
                      ${isDone ? 'text-green-300' : ''}
                      ${isPending ? 'text-neutral-600' : ''}
                    `}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`
                      h-px w-2 mx-1 transition-colors
                      ${isDone ? 'bg-green-500/40' : 'bg-neutral-700'}
                    `}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Error message */}
        {isError && agentSession.error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-sm text-red-300">{agentSession.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

