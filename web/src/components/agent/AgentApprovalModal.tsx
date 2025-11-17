import { useEffect } from 'react';
import { useStore } from '../../state/store';
import { wsClient } from '../../lib/ws';
import { X, Globe, Clock, Eye } from 'lucide-react';

export default function AgentApprovalModal() {
  const { agentSession, resetAgentSession } = useStore();

  const handleApprove = () => {
    if (agentSession.sessionId) {
      wsClient.approveAgentSession(agentSession.sessionId);
      useStore.setState((state) => ({
        agentSession: {
          ...state.agentSession,
          approved: true,
          isActive: true
        }
      }));
    }
  };

  const handleCancel = () => {
    if (agentSession.sessionId) {
      wsClient.cancelAgentSession(agentSession.sessionId);
    }
    resetAgentSession();
  };

  // Handle ESC key - MUST be before any early returns (Rules of Hooks)
  useEffect(() => {
    // Only add listener if modal should be shown
    if (!agentSession.sessionId || agentSession.approved) {
      return;
    }

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [agentSession.sessionId, agentSession.approved]);

  // Don't show if no session or already approved
  if (!agentSession.sessionId || agentSession.approved) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="p-6 border-b border-neutral-800 flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-neutral-100 flex items-center gap-2">
              <Globe className="w-5 h-5 text-cyan-400" />
              Evelyn wants to browse the web
            </h2>
            <p className="text-sm text-neutral-400 mt-1">
              Review and approve this browsing session
            </p>
          </div>
          <button
            onClick={handleCancel}
            className="text-neutral-400 hover:text-neutral-200 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Evelyn's Intent */}
          {agentSession.evelynIntent && (
            <div className="bg-neutral-800/50 rounded-lg p-4 border border-neutral-700">
              <h3 className="text-sm font-medium text-neutral-300 mb-2">
                What Evelyn wants to explore:
              </h3>
              <p className="text-neutral-100 leading-relaxed">
                {agentSession.evelynIntent}
              </p>
            </div>
          )}

          {/* Query */}
          {agentSession.query && (
            <div>
              <h3 className="text-sm font-medium text-neutral-400 mb-2">Your request:</h3>
              <p className="text-neutral-200 bg-neutral-800/30 rounded px-3 py-2 border border-neutral-700">
                "{agentSession.query}"
              </p>
            </div>
          )}

          {/* Entry URL */}
          {agentSession.entryUrl && (
            <div>
              <h3 className="text-sm font-medium text-neutral-400 mb-2">Starting point:</h3>
              <a
                href={agentSession.entryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 text-sm break-all underline"
              >
                {agentSession.entryUrl}
              </a>
            </div>
          )}

          {/* Session scope */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3 bg-neutral-800/30 rounded-lg p-3 border border-neutral-700">
              <Eye className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-neutral-200">
                  Up to {agentSession.maxPages} pages
                </div>
                <div className="text-xs text-neutral-400 mt-0.5">
                  Evelyn will browse dynamically
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-neutral-800/30 rounded-lg p-3 border border-neutral-700">
              <Clock className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-neutral-200">
                  ~{agentSession.estimatedTime || 120}s max
                </div>
                <div className="text-xs text-neutral-400 mt-0.5">
                  Estimated duration
                </div>
              </div>
            </div>
          </div>

          {/* Privacy note */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <h3 className="text-sm font-medium text-amber-300 mb-1">Privacy & Safety</h3>
            <ul className="text-xs text-amber-200/80 space-y-1">
              <li>• Single approval for this session only</li>
              <li>• All domains allowed (no restrictions)</li>
              <li>• Session ends automatically after time/page limit</li>
              <li>• You can cancel at any time</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-800 flex justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApprove}
            className="px-6 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg shadow-cyan-500/20"
          >
            Approve & Start
          </button>
        </div>
      </div>
    </div>
  );
}

