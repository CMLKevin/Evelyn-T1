import { useState } from 'react';
import { useStore } from '../../state/store';
import { 
  FileText, 
  Code, 
  Save, 
  Download, 
  History, 
  Plus,
  ChevronDown,
  Clock,
  Check
} from 'lucide-react';
import ShortcutMenu from './ShortcutMenu';
import NewDocumentModal from './NewDocumentModal';
import ExportModal from './ExportModal';

export default function CollaborateToolbar() {
  const { 
    collaborateState,
    updateCollaborateDocumentContent,
    saveCollaborateVersion,
    setCollaborateActivePanel
  } = useStore();

  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');

  const { activeDocument, isSaving, lastSaved } = collaborateState;

  const handleSaveVersion = async () => {
    if (!activeDocument) return;
    await saveCollaborateVersion();
  };

  const handleTitleEdit = () => {
    if (activeDocument) {
      setTitleValue(activeDocument.title);
      setIsEditingTitle(true);
    }
  };

  const handleTitleSave = async () => {
    if (!activeDocument || !titleValue.trim()) {
      setIsEditingTitle(false);
      return;
    }
    // Update document title via API
    try {
      const response = await fetch(`http://localhost:3001/api/collaborate/${activeDocument.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleValue.trim() })
      });
      if (response.ok) {
        const updated = await response.json();
        // Reload document to get updated title
        const { loadCollaborateDocument } = useStore.getState();
        await loadCollaborateDocument(activeDocument.id);
      }
    } catch (error) {
      console.error('Failed to update title:', error);
    }
    setIsEditingTitle(false);
  };

  const getSaveStatus = () => {
    if (isSaving) {
      return (
        <span className="flex items-center gap-1 text-terminal-secondary text-sm">
          <Clock className="w-3 h-3 animate-spin" />
          Saving...
        </span>
      );
    }
    if (lastSaved) {
      const time = new Date(lastSaved).toLocaleTimeString();
      return (
        <span className="flex items-center gap-1 text-terminal-accent text-sm">
          <Check className="w-3 h-3" />
          Saved at {time}
        </span>
      );
    }
    return null;
  };

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 border-b border-terminal-border bg-black/40">
        {/* Left section */}
        <div className="flex items-center gap-4">
          {/* New Document */}
          <button
            onClick={() => setShowNewDoc(true)}
            className="px-3 py-1 bg-terminal-accent/20 hover:bg-terminal-accent/30 
                     border border-terminal-accent rounded text-terminal-accent
                     transition-all duration-200 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New
          </button>

          {/* Document Title */}
          {activeDocument && (
            <div className="flex items-center gap-2">
              {activeDocument.contentType === 'code' ? (
                <Code className="w-4 h-4 text-terminal-secondary" />
              ) : (
                <FileText className="w-4 h-4 text-terminal-secondary" />
              )}
              
              {isEditingTitle ? (
                <input
                  type="text"
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTitleSave();
                    if (e.key === 'Escape') setIsEditingTitle(false);
                  }}
                  className="bg-black border border-terminal-accent px-2 py-1 rounded
                           text-terminal-text focus:outline-none focus:ring-1 focus:ring-terminal-accent"
                  autoFocus
                />
              ) : (
                <button
                  onClick={handleTitleEdit}
                  className="text-terminal-text hover:text-terminal-accent transition-colors"
                >
                  {activeDocument.title}
                </button>
              )}

              {activeDocument.language && (
                <span className="text-xs text-terminal-secondary px-2 py-0.5 
                               bg-terminal-secondary/10 rounded border border-terminal-secondary/30">
                  {activeDocument.language}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Center section - Save Status */}
        <div className="flex-1 flex justify-center">
          {getSaveStatus()}
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2">
          {/* Shortcuts Menu */}
          {activeDocument && (
            <div className="relative">
              <button
                onClick={() => setShowShortcuts(!showShortcuts)}
                className="px-3 py-1 bg-terminal-secondary/20 hover:bg-terminal-secondary/30 
                         border border-terminal-secondary rounded text-terminal-secondary
                         transition-all duration-200 flex items-center gap-2"
              >
                Shortcuts
                <ChevronDown className={`w-4 h-4 transition-transform ${showShortcuts ? 'rotate-180' : ''}`} />
              </button>
              {showShortcuts && (
                <ShortcutMenu onClose={() => setShowShortcuts(false)} />
              )}
            </div>
          )}

          {/* Version History */}
          {activeDocument && (
            <button
              onClick={() => setCollaborateActivePanel('versions')}
              className="p-2 hover:bg-terminal-border rounded transition-colors"
              title="Version History"
            >
              <History className="w-4 h-4 text-terminal-text" />
            </button>
          )}

          {/* Save Version */}
          {activeDocument && (
            <button
              onClick={handleSaveVersion}
              disabled={isSaving}
              className="p-2 hover:bg-terminal-border rounded transition-colors disabled:opacity-50"
              title="Save Version (Ctrl+S)"
            >
              <Save className="w-4 h-4 text-terminal-text" />
            </button>
          )}

          {/* Export */}
          {activeDocument && (
            <button
              onClick={() => setShowExport(true)}
              className="p-2 hover:bg-terminal-border rounded transition-colors"
              title="Export Document"
            >
              <Download className="w-4 h-4 text-terminal-text" />
            </button>
          )}
        </div>
      </div>

      {/* Modals */}
      {showNewDoc && <NewDocumentModal onClose={() => setShowNewDoc(false)} />}
      {showExport && activeDocument && (
        <ExportModal 
          document={activeDocument} 
          onClose={() => setShowExport(false)} 
        />
      )}
    </>
  );
}
