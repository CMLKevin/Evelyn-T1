import { useEffect, useState, useMemo, useCallback } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ContextUsageIndicator from '../common/ContextUsageIndicator';
import AgentApprovalModal from '../agent/AgentApprovalModal';
import { ArtifactPanel, ArtifactWorkspace, isMultiFileArtifact } from '../artifacts';
import { useStore } from '../../state/store';
import { Brain, Sparkles, Zap, MessageSquare } from 'lucide-react';

export default function ChatWindow() {
  const { connected, activities } = useStore();
  const agenticMode = useStore(state => state.agenticMode);
  const setAgenticMode = useStore(state => state.setAgenticMode);
  const toggleAgenticMode = useStore(state => state.toggleAgenticMode);
  const activeArtifact = useStore(state => state.activeArtifact);
  const artifactPanelOpen = useStore(state => state.artifactPanelOpen);
  const setActiveArtifact = useStore(state => state.setActiveArtifact);
  const setArtifactPanelOpen = useStore(state => state.setArtifactPanelOpen);
  const runArtifact = useStore(state => state.runArtifact);
  
  const [artifactPanelCollapsed, setArtifactPanelCollapsed] = useState(false);
  
  const handleCloseArtifact = useCallback(() => {
    setActiveArtifact(null);
    setArtifactPanelOpen(false);
  }, [setActiveArtifact, setArtifactPanelOpen]);
  
  const handleRunArtifact = useCallback(() => {
    if (activeArtifact) {
      runArtifact(activeArtifact.id);
    }
  }, [activeArtifact, runArtifact]);
  const [elapsed, setElapsed] = useState(0);

  // Sync agenticMode from server settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const settings = await res.json();
          if (typeof settings.agenticMode === 'boolean') {
            setAgenticMode(settings.agenticMode);
          }
        }
      } catch (e) {
        console.error('[ChatWindow] Failed to fetch settings:', e);
      }
    };
    fetchSettings();
  }, [setAgenticMode]);

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
    <div className="w-full h-full flex overflow-hidden p-3 gap-3">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-surface-1 border border-white/10 rounded-xl overflow-hidden shadow-lg">
        {/* Glass Title Bar */}
        <div className="glass-header px-5 py-3 flex items-center justify-between rounded-t-xl">
          <div className="flex items-center gap-3">
            {/* Chat Title */}
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-orange/20 border border-orange/60 rounded-lg">
                <Sparkles className="w-4 h-4 text-orange" />
              </div>
              <span className="text-sm font-mono font-bold uppercase tracking-wide text-white">Chat Window</span>
            </div>

            {/* Thinking Indicator */}
            {isThinking && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-orange/15 border border-orange/50 rounded-full animate-fade-in">
                <div className="relative">
                  <div className="absolute inset-0 bg-orange rounded-full animate-ping opacity-75" />
                  <Brain className="w-3.5 h-3.5 text-orange relative" />
                </div>
                <span className="text-xs text-orange font-mono">{elapsed.toFixed(1)}s</span>
              </div>
            )}
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-3">
            {/* Agentic Mode Toggle - Pill shaped */}
            <button
              onClick={toggleAgenticMode}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-full transition-all ${
                agenticMode
                  ? 'bg-orange/20 text-orange border border-orange/50 hover:bg-orange/30'
                  : 'bg-surface-3 text-terminal-400 border border-white/15 hover:bg-surface-4 hover:border-white/25'
              }`}
              title={agenticMode ? 'Agentic mode: ON - Click to disable tools' : 'Agentic mode: OFF - Click to enable tools'}
            >
              {agenticMode ? (
                <>
                  <Zap className="w-3 h-3" />
                  <span>Agentic</span>
                </>
              ) : (
                <>
                  <MessageSquare className="w-3 h-3" />
                  <span>Chat Only</span>
                </>
              )}
            </button>

            {/* Context Usage Indicator */}
            <ContextUsageIndicator />
          </div>
        </div>

        {/* Mode indicator banner when agentic mode is disabled */}
        {!agenticMode && (
          <div className="px-4 py-2 bg-surface-2/80 border-b border-white/8 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-terminal-500" />
            <span className="text-xs text-terminal-500">
              Chat-only mode — Evelyn won't use tools, search, or create artifacts
            </span>
            <button
              onClick={toggleAgenticMode}
              className="ml-auto text-xs text-orange hover:underline"
            >
              Enable agentic mode
            </button>
          </div>
        )}

        {/* Messages */}
        <MessageList />

        {/* Input */}
        <MessageInput />

        {/* Agent Approval Modal */}
        <AgentApprovalModal />
      </div>

      {/* Artifact Panel - shows when an artifact is active */}
      {/* Use ArtifactWorkspace for multi-file projects, ArtifactPanel for single-file */}
      {artifactPanelOpen && activeArtifact && (
        isMultiFileArtifact(activeArtifact) ? (
          <ArtifactWorkspace
            artifact={activeArtifact}
            onClose={handleCloseArtifact}
            onRun={handleRunArtifact}
            isCollapsed={artifactPanelCollapsed}
            onToggleCollapse={() => setArtifactPanelCollapsed(!artifactPanelCollapsed)}
          />
        ) : (
          <ArtifactPanel
            artifact={activeArtifact}
            onClose={handleCloseArtifact}
            onRun={handleRunArtifact}
            isCollapsed={artifactPanelCollapsed}
            onToggleCollapse={() => setArtifactPanelCollapsed(!artifactPanelCollapsed)}
          />
        )
      )}
    </div>
  );
}
