import { useEffect } from 'react';
import { useStore } from '../../state/store';
import { wsClient } from '../../lib/ws';
import { Globe, Clock, Eye } from 'lucide-react';
import { Modal, Button } from '../ui';

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
    <Modal 
      isOpen={true} 
      onClose={handleCancel}
      title="Evelyn wants to browse the web"
      size="lg"
    >
      <div className="space-y-6">
        {/* Evelyn's Intent */}
        {agentSession.evelynIntent && (
          <div className="bg-zinc-900/50 rounded-lg p-4 border border-white/10">
            <h3 className="text-sm font-medium text-zinc-300 mb-2">
              What Evelyn wants to explore:
            </h3>
            <p className="text-white leading-relaxed">
              {agentSession.evelynIntent}
            </p>
          </div>
        )}

        {/* Query */}
        {agentSession.query && (
          <div>
            <h3 className="text-sm font-medium text-zinc-400 mb-2">Your request:</h3>
            <p className="text-zinc-200 bg-zinc-900/30 rounded-lg px-4 py-3 border border-white/10">
              "{agentSession.query}"
            </p>
          </div>
        )}

        {/* Entry URL */}
        {agentSession.entryUrl && (
          <div>
            <h3 className="text-sm font-medium text-zinc-400 mb-2">Starting point:</h3>
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
          <div className="flex items-start gap-3 bg-zinc-900/30 rounded-lg p-4 border border-white/10">
            <Eye className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-zinc-200">
                Up to {agentSession.maxPages} pages
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                Evelyn will browse dynamically
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-zinc-900/30 rounded-lg p-4 border border-white/10">
            <Clock className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-zinc-200">
                ~{agentSession.estimatedTime || 120}s max
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
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
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={handleCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleApprove}>
          Approve & Start
        </Button>
      </div>
    </Modal>
  );
}

