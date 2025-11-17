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
    <div className="w-full h-full flex flex-col terminal-panel rounded overflow-hidden relative z-10">
      {/* Terminal Header */}
      <div className="terminal-header p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-cyan-400 terminal-glow font-bold">$ evelyn://chat</span>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-xs text-gray-400">
              {connected ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>
          
          {/* Compact Thinking Indicator */}
          {isThinking && (
            <div className="flex items-center gap-2 bg-purple-500/20 border border-purple-500/30 rounded px-2 py-1">
              <div className="relative">
                <div className="absolute inset-0 bg-purple-400 rounded-full animate-ping opacity-75" />
                <Brain className="w-3 h-3 text-purple-400 relative" />
              </div>
              <span className="text-xs text-purple-300 font-mono">{elapsed.toFixed(1)}s</span>
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
