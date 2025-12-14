import { useEffect } from 'react';
import { useStore } from '../../state/store';
import CollaborateToolbar from './CollaborateToolbar';
import CollaborateSidebar from './CollaborateSidebar';
import CollaborateEditor from './CollaborateEditor';
import CollaborateChat from './CollaborateChat';
import CollaborateErrorBoundary from './CollaborateErrorBoundary';
import { shortcutManager } from '../../lib/keyboardShortcuts';

export default function CollaboratePanel() {
  const { loadCollaborateDocuments } = useStore();

  // Load documents on mount
  useEffect(() => {
    loadCollaborateDocuments();
  }, [loadCollaborateDocuments]);

  // Set up collaborate-specific shortcuts context
  useEffect(() => {
    shortcutManager.addContext('collaborate');
    return () => {
      shortcutManager.removeContext('collaborate');
    };
  }, []);

  return (
    <CollaborateErrorBoundary>
      <div className="w-full h-full flex flex-col p-3 gap-3">
        {/* Floating container with glass effect */}
        <div className="flex-1 flex flex-col rounded-xl overflow-hidden bg-surface-1 border border-white/8 shadow-lg">
          <CollaborateToolbar />

          <div className="flex-1 flex overflow-hidden gap-2 p-2 bg-surface-0">
            {/* Sidebar - Documents & Suggestions */}
            <CollaborateErrorBoundary>
              <div className="rounded-lg overflow-hidden border border-white/8 bg-surface-1">
                <CollaborateSidebar />
              </div>
            </CollaborateErrorBoundary>

            {/* Main Editor */}
            <div className="flex-1 flex flex-col rounded-lg overflow-hidden bg-surface-1 border border-white/8">
              <CollaborateErrorBoundary>
                <CollaborateEditor />
              </CollaborateErrorBoundary>
            </div>

            {/* Evelyn Chat */}
            <CollaborateErrorBoundary>
              <div className="rounded-lg overflow-hidden border border-white/8 bg-surface-1">
                <CollaborateChat />
              </div>
            </CollaborateErrorBoundary>
          </div>
        </div>

        {/* Command Palette is rendered globally in App.tsx */}
      </div>
    </CollaborateErrorBoundary>
  );
}
