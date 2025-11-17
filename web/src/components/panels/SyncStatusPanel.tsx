import { useState, useEffect } from 'react';
import { useStore } from '../../state/store';

export default function SyncStatusPanel() {
  const { connected, messages, searchResults, activities } = useStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>(new Date().toISOString());

  useEffect(() => {
    // Update timestamp whenever data changes
    setLastUpdate(new Date().toISOString());
  }, [messages.length, searchResults.length, activities.length]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const { loadMessages, loadSearchResults, loadActivities, loadPersona } = useStore.getState();
      await Promise.all([
        loadMessages(),
        loadSearchResults(),
        loadActivities(),
        loadPersona()
      ]);
      setLastUpdate(new Date().toISOString());
      console.log('[SyncStatus] Manual refresh complete');
    } catch (error) {
      console.error('[SyncStatus] Refresh failed:', error);
    }
    setIsRefreshing(false);
  };

  return (
    <div className="glass-strong rounded-3xl p-5 shadow-float animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gradient-purple">Server Status</h2>
        <div className={`w-2 h-2 rounded-full animate-pulse ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
      </div>

      {/* Connection Status */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Connection</span>
          <span className={`text-sm font-medium ${connected ? 'text-green-400' : 'text-red-400'}`}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Data Stats */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Messages</span>
          <span className="text-sm text-white font-medium">{messages.length}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Search Results</span>
          <span className="text-sm text-white font-medium">{searchResults.length}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Activities</span>
          <span className="text-sm text-white font-medium">{activities.length}</span>
        </div>
      </div>

      {/* Last Update */}
      <div className="mb-4 text-sm">
        <span className="text-gray-400">Last Update:</span>
        <div className="text-white mt-1">
          {new Date(lastUpdate).toLocaleString()}
        </div>
      </div>

      {/* Action Button */}
      <div className="space-y-2">
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="w-full glass hover:glass-strong px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-105 disabled:opacity-50"
        >
          <span className="text-sm">
            {isRefreshing ? '🔄 Refreshing...' : '🔄 Refresh from Server'}
          </span>
        </button>
      </div>

      {/* Info */}
      <div className="mt-4 p-3 glass-dark rounded-2xl">
        <div className="text-xs text-gray-400 space-y-1">
          <div>✅ Real-time sync via WebSocket</div>
          <div>✅ Immediate database persistence</div>
          <div>✅ Server-authoritative data</div>
        </div>
      </div>
    </div>
  );
}

