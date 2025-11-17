import { useStore } from '../../state/store';
import { Activity, Zap, MessageSquare } from 'lucide-react';

export default function StatusLine() {
  const { messages, activities, connected, uiState } = useStore();

  const getActiveIcon = () => {
    switch (uiState.activeTab) {
      case 'chat':
        return <MessageSquare className="w-3 h-3" />;
      case 'diagnostics':
        return <Activity className="w-3 h-3" />;
      case 'logs':
        return <Zap className="w-3 h-3" />;
      default:
        return null;
    }
  };

  return (
    <div className="status-line">
      <div className="status-line-segment">
        <div className="status-indicator">
          {getActiveIcon()}
          <span className="uppercase">{uiState.activeTab}</span>
        </div>

        {uiState.activeTab === 'chat' && (
          <div className="status-indicator">
            <span>{messages.length} messages</span>
          </div>
        )}

        {uiState.activeTab === 'diagnostics' && (
          <div className="status-indicator">
            <span>{activities.length} activities</span>
          </div>
        )}
      </div>

      <div className="status-line-segment">
        <div className="status-indicator">
          <div className={`status-dot ${connected ? 'online' : 'offline'}`} />
          <span>{connected ? 'ONLINE' : 'OFFLINE'}</span>
        </div>

        <div className="status-indicator">
          <kbd className="terminal-kbd">Ctrl+K</kbd>
          <span>Command Palette</span>
        </div>

        <div className="status-indicator">
          <kbd className="terminal-kbd">Ctrl+/</kbd>
          <span>Help</span>
        </div>
      </div>
    </div>
  );
}

