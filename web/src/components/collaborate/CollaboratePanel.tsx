import { useEffect } from 'react';
import { useStore } from '../../state/store';
import CollaborateToolbar from './CollaborateToolbar';
import CollaborateSidebar from './CollaborateSidebar';
import CollaborateEditor from './CollaborateEditor';
import CollaborateChat from './CollaborateChat';
import CommandPalette from './CommandPalette';
import CollaborateErrorBoundary from './CollaborateErrorBoundary';
import { shortcutManager } from '../../lib/keyboardShortcuts';

export default function CollaboratePanel() {
  const { 
    loadCollaborateDocuments,
    uiState,
    setCommandPaletteOpen
  } = useStore();

  // Load documents on mount
  useEffect(() => {
    loadCollaborateDocuments();
  }, [loadCollaborateDocuments]);

  // Set up keyboard shortcuts
  useEffect(() => {
    // Add collaborate context
    shortcutManager.addContext('collaborate');
    
    // Handle Cmd/Ctrl+K for command palette
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;
      
      // Cmd/Ctrl+K - Open command palette
      if (modKey && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      
      // Escape - Close command palette
      if (e.key === 'Escape' && uiState.commandPaletteOpen) {
        e.preventDefault();
        setCommandPaletteOpen(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      shortcutManager.removeContext('collaborate');
    };
  }, [setCommandPaletteOpen, uiState.commandPaletteOpen]);

  return (
    <CollaborateErrorBoundary>
      <div className="w-full h-full flex flex-col bg-gradient-to-br from-zinc-950 to-black">
        <CollaborateToolbar />
        
        <div className="flex-1 flex overflow-hidden gap-px bg-white/5">
          {/* Sidebar - Documents & Suggestions */}
          <CollaborateErrorBoundary>
            <CollaborateSidebar />
          </CollaborateErrorBoundary>
          
          {/* Main Editor */}
          <div className="flex-1 flex flex-col bg-zinc-950">
            <CollaborateErrorBoundary>
              <CollaborateEditor />
            </CollaborateErrorBoundary>
          </div>
          
          {/* Evelyn Chat */}
          <CollaborateErrorBoundary>
            <CollaborateChat />
          </CollaborateErrorBoundary>
        </div>
        
        {/* Command Palette */}
        {uiState.commandPaletteOpen && (
          <CommandPalette onClose={() => setCommandPaletteOpen(false)} />
        )}
      </div>
    </CollaborateErrorBoundary>
  );
}
