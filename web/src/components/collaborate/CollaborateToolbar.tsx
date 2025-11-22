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
import { Badge } from '../ui';
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
        <span className="flex items-center gap-1.5 text-orange text-sm font-mono">
          <Clock className="w-3.5 h-3.5 animate-spin" />
          Saving...
        </span>
      );
    }
    if (lastSaved) {
      const time = new Date(lastSaved).toLocaleTimeString();
      return (
        <span className="flex items-center gap-1.5 text-green-500 text-sm font-mono">
          <Check className="w-3.5 h-3.5" />
          Saved at {time}
        </span>
      );
    }
    return null;
  };

  return (
    <>
      <div className="flex items-center justify-between px-5 py-3 border-b-2 border-white/20 bg-terminal-dark">
        {/* Left section */}
        <div className="flex items-center gap-4">
          {/* New Document */}
          <button
            onClick={() => setShowNewDoc(true)}
            className="px-3 py-1.5 bg-orange hover:bg-orange-dark border-2 border-orange text-white text-sm font-mono uppercase tracking-wide transition-colors duration-150 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New
          </button>

          {/* Document Title */}
          {activeDocument && (
            <div className="flex items-center gap-2">
              {activeDocument.contentType === 'code' ? (
                <Code className="w-4 h-4 text-orange" />
              ) : (
                <FileText className="w-4 h-4 text-cyan-500" />
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
                  className="px-3 py-1 bg-terminal-black border-2 border-orange text-white font-mono focus:outline-none transition-colors"
                  autoFocus
                />
              ) : (
                <button
                  onClick={handleTitleEdit}
                  className="text-white hover:text-orange transition-colors font-mono font-medium"
                >
                  {activeDocument.title}
                </button>
              )}

              {activeDocument.language && (
                <Badge variant="default" size="sm">
                  {activeDocument.language}
                </Badge>
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
                className="px-3 py-1.5 bg-terminal-900 hover:bg-terminal-800 border-2 border-white/20 hover:border-white/30 text-terminal-300 hover:text-white text-sm font-mono transition-colors duration-150 flex items-center gap-2"
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
              className="p-2 hover:bg-terminal-800 border border-white/20 hover:border-white/30 transition-colors group"
              title="Version History"
            >
              <History className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
            </button>
          )}

          {/* Save Version */}
          {activeDocument && (
            <button
              onClick={handleSaveVersion}
              disabled={isSaving}
              className="p-2 hover:bg-terminal-800 border border-white/20 hover:border-white/30 transition-colors disabled:opacity-50 group"
              title="Save Version (Ctrl+S)"
            >
              <Save className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
            </button>
          )}

          {/* Export */}
          {activeDocument && (
            <button
              onClick={() => setShowExport(true)}
              className="p-2 hover:bg-terminal-800 border border-white/20 hover:border-white/30 transition-colors group"
              title="Export Document"
            >
              <Download className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
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
