import { useStore } from '../../state/store';
import { Activity, Zap, MessageSquare, FileText, Code, Command } from 'lucide-react';
import { Badge, StatusDot } from '../ui';

export default function StatusLine() {
  const { messages, activities, connected, uiState } = useStore();

  const getActiveIcon = () => {
    switch (uiState.activeTab) {
      case 'chat':
        return <MessageSquare className="w-3.5 h-3.5" />;
      case 'diagnostics':
        return <Activity className="w-3.5 h-3.5" />;
      case 'logs':
        return <Zap className="w-3.5 h-3.5" />;
      case 'context':
        return <FileText className="w-3.5 h-3.5" />;
      case 'collaborate':
        return <Code className="w-3.5 h-3.5" />;
      default:
        return null;
    }
  };

  return (
    <div className="glass-footer px-5 py-2.5 flex items-center justify-between select-none rounded-b-2xl">
      {/* Left: Active Tab & Stats */}
      <div className="flex items-center gap-4">
        {/* Active Tab - Pill shaped */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-orange/15 border border-orange/50 rounded-full">
          <div className="text-orange">
            {getActiveIcon()}
          </div>
          <span className="text-xs font-mono font-medium text-white uppercase">
            {uiState.activeTab}
          </span>
        </div>

        {/* Tab-specific Stats */}
        {uiState.activeTab === 'chat' && (
          <Badge variant="default" size="sm">
            {messages.length} messages
          </Badge>
        )}

        {uiState.activeTab === 'diagnostics' && (
          <Badge variant="info" size="sm">
            {activities.length} activities
          </Badge>
        )}
      </div>

      {/* Right: Connection & Shortcuts */}
      <div className="flex items-center gap-4">
        {/* Connection Status - Pill shaped */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-2/80 backdrop-blur-sm border border-white/10 rounded-full">
          <StatusDot variant={connected ? 'online' : 'offline'} animated={connected} />
          <span className="text-xs font-mono font-medium text-terminal-400">
            {connected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        {/* Keyboard Shortcuts */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-surface-2/80 border border-white/15 text-terminal-400 font-mono text-[10px] rounded">
              ⌘K
            </kbd>
            <span className="text-xs text-terminal-600 font-mono">Commands</span>
          </div>

          <div className="w-px h-4 bg-white/15" />

          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-surface-2/80 border border-white/15 text-terminal-400 font-mono text-[10px] rounded">
              ⌘F
            </kbd>
            <span className="text-xs text-terminal-600 font-mono">Search</span>
          </div>
        </div>
      </div>
    </div>
  );
}

