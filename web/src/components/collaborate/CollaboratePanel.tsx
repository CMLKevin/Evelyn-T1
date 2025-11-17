import { useEffect } from 'react';
import { useStore } from '../../state/store';
import CollaborateToolbar from './CollaborateToolbar';
import CollaborateSidebar from './CollaborateSidebar';
import CollaborateEditor from './CollaborateEditor';
import CollaborateChat from './CollaborateChat';

export default function CollaboratePanel() {
  const { 
    collaborateState,
    loadCollaborateDocuments 
  } = useStore();

  useEffect(() => {
    loadCollaborateDocuments();
  }, [loadCollaborateDocuments]);

  return (
    <div className="w-full h-full flex flex-col terminal-panel">
      <CollaborateToolbar />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Documents & Suggestions */}
        <CollaborateSidebar />
        
        {/* Main Editor */}
        <div className="flex-1 flex flex-col">
          <CollaborateEditor />
        </div>
        
        {/* Evelyn Chat */}
        <CollaborateChat />
      </div>
    </div>
  );
}
