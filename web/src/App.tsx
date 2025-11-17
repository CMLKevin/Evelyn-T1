import { useEffect, lazy, Suspense } from 'react';
import { useStore } from './state/store';
import { wsClient } from './lib/ws';
import TerminalLayout from './components/terminal/TerminalLayout';
import ChatWindow from './components/chat/ChatWindow';
import ThinkingPanel from './components/panels/ThinkingPanel';
import { ToastContainer } from './components/common/Toast';

// Lazy load heavy components for code splitting
const DiagnosticsPanel = lazy(() => import('./components/panels/DiagnosticsPanel'));
const LogsPanel = lazy(() => import('./components/logs/LogsPanel'));
const ContextPanel = lazy(() => import('./components/panels/ContextPanel'));
const CollaboratePanel = lazy(() => import('./components/collaborate/CollaboratePanel'));
const CommandPalette = lazy(() => import('./components/terminal/CommandPalette'));
const QuickSearch = lazy(() => import('./components/terminal/QuickSearch'));
const SettingsModal = lazy(() => import('./components/panels/SettingsModal'));

export default function App() {
  const { 
    loadMessages, 
    loadSearchResults, 
    loadActivities, 
    loadPersona,
    uiState,
    setCommandPaletteOpen,
    setQuickSearchOpen,
    setSettingsModalOpen,
  } = useStore();

  useEffect(() => {
    // Load data from server on connect
    const initializeApp = async () => {
      try {
        await Promise.all([
          loadMessages(),
          loadSearchResults(),
          loadActivities(),
          loadPersona()
        ]);
        
        console.log('[App] All data loaded from server');
      } catch (error) {
        console.error('[App] Initialization error:', error);
      }
    };
    
    // Connect to WebSocket first, then load data
    wsClient.connect();
    initializeApp();
    
    // Don't disconnect on cleanup - let the wsClient manage its lifecycle
    // This prevents issues with React Strict Mode double-mounting
    // The socket will persist across remounts and only disconnect when truly needed
    return () => {
      // Cleanup is handled by the wsClient itself
    };
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command Palette: Ctrl/Cmd + K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }

      // Quick Search: Ctrl/Cmd + F
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setQuickSearchOpen(true);
      }

      // Close modals: Escape
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
        setQuickSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Loading fallback component
  const LoadingFallback = () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-cyan-400 monospace text-sm animate-pulse">
        Loading...
      </div>
    </div>
  );

  const renderContent = () => {
    switch (uiState.activeTab) {
      case 'chat':
        return (
          <div className="flex h-full gap-4 p-4">
            <ThinkingPanel />
            
            <div className="flex-1">
              <ChatWindow />
            </div>
          </div>
        );
      case 'logs':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <LogsPanel />
          </Suspense>
        );
      case 'diagnostics':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <DiagnosticsPanel />
          </Suspense>
        );
      case 'context':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <ContextPanel />
          </Suspense>
        );
      case 'collaborate':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <CollaboratePanel />
          </Suspense>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <TerminalLayout>
        {renderContent()}
      </TerminalLayout>

      {/* Global Modals - lazy loaded */}
      {uiState.commandPaletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette />
        </Suspense>
      )}
      {uiState.quickSearchOpen && (
        <Suspense fallback={null}>
          <QuickSearch />
        </Suspense>
      )}
      {uiState.settingsModalOpen && (
        <Suspense fallback={null}>
          <SettingsModal onClose={() => setSettingsModalOpen(false)} />
        </Suspense>
      )}

      {/* Toast Notifications */}
      <ToastContainer />
    </>
  );
}
