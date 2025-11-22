import { useEffect, useState, useMemo } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ContextUsageIndicator from '../common/ContextUsageIndicator';
import AgentApprovalModal from '../agent/AgentApprovalModal';
import { useStore } from '../../state/store';
import { Brain, Sparkles } from 'lucide-react';

export default function ChatWindow() {
  const { connected, activities } = useStore();
  const [elapsed, setElapsed] = useState(0);

  // Get latest thinking activity
  const latestThinking = useMemo(() => {
    const thinkActivities = activities.filter(a => a.tool === 'think');
    if (thinkActivities.length === 0) return null;
    
    const sortedActivities = [...thinkActivities].sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return b.id - a.id;
    });
    return sortedActivities[0];
  }, [activities]);

  // Timer for running thinking
  useEffect(() => {
    if (!latestThinking || latestThinking.status !== 'running') {
      setElapsed(0);
      return;
    }

    const startTime = latestThinking.createdAt ? new Date(latestThinking.createdAt).getTime() : Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedMs = now - startTime;
      setElapsed(elapsedMs / 1000);
    }, 100);

    return () => clearInterval(interval);
  }, [latestThinking]);

  const isThinking = latestThinking?.status === 'running';

  return (
    <div className="w-full h-full flex flex-col bg-terminal-900 border-2 border-white/20 overflow-hidden">
      {/* Terminal Title Bar */}
      <div className="px-5 py-3 flex items-center justify-between border-b-2 border-white/20 bg-terminal-dark">
        <div className="flex items-center gap-3">
          {/* Chat Title */}
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-orange/20 border-2 border-orange">
              <Sparkles className="w-4 h-4 text-orange" />
            </div>
            <span className="text-sm font-mono font-bold uppercase tracking-wide text-white">Chat Window</span>
          </div>
          
          {/* Thinking Indicator */}
          {isThinking && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-orange/10 border border-orange animate-fade-in">
              <div className="relative">
                <div className="absolute inset-0 bg-orange animate-ping opacity-75" />
                <Brain className="w-3.5 h-3.5 text-orange relative" />
              </div>
              <span className="text-xs text-orange font-mono">{elapsed.toFixed(1)}s</span>
            </div>
          )}
        </div>

        {/* Context Usage Indicator */}
        <ContextUsageIndicator />
      </div>

      {/* Messages */}
      <MessageList />

      {/* Input */}
      <MessageInput />

      {/* Agent Approval Modal */}
      <AgentApprovalModal />
    </div>
  );
}
