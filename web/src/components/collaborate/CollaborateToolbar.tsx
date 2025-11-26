import { useState, useCallback } from 'react';
import { useStore } from '../../state/store';
import { 
  FileText, 
  Code, 
  Save, 
  Download, 
  History, 
  Plus,
  ChevronDown
} from 'lucide-react';
import { Badge } from '../ui';
import ShortcutMenu from './ShortcutMenu';
import NewDocumentModal from './NewDocumentModal';
import ExportModal from './ExportModal';
import { SaveStatusDot } from './SaveStatusIndicator';
import ConflictModal from './ConflictModal';
import { useCollaborateAutoSave, ConflictInfo } from '../../lib/collaborateAutoSave';

export default function CollaborateToolbar() {
  const { 
    collaborateState,
    saveCollaborateVersion,
    setCollaborateActivePanel,
    updateDocumentContent
  } = useStore();

  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [showConflict, setShowConflict] = useState(false);

  const { activeDocument, currentContent, versionHistory } = collaborateState;
  
  // Get current version number
  const currentVersion = versionHistory.length > 0 ? versionHistory[0].version : null;
  
  // Auto-save hook with conflict detection
  const autoSaveHandler = useCallback(async (content: string, version?: number) => {
    if (!activeDocument) return { success: false };
    
    try {
      const response = await fetch(`http://localhost:3001/api/collaborate/${activeDocument.id}/save-version`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Expected-Version': version?.toString() || ''
        },
        body: JSON.stringify({ 
          content,
          description: 'Auto-save',
          createdBy: 'user'
        })
      });
      
      if (response.status === 409) {
        // Conflict detected
        const conflictData = await response.json();
        return { 
          success: false, 
          conflict: true, 
          serverContent: conflictData.serverContent,
          version: conflictData.serverVersion
        };
      }
      
      if (response.ok) {
        const result = await response.json();
        return { success: true, version: result.version };
      }
      
      return { success: false };
    } catch (error) {
      console.error('Auto-save error:', error);
      return { success: false };
    }
  }, [activeDocument]);
  
  const handleConflict = useCallback((conflict: ConflictInfo) => {
    setShowConflict(true);
  }, []);
  
  const autoSave = useCollaborateAutoSave(
    currentContent,
    activeDocument?.id ?? null,
    currentVersion,
    {
      delay: 2000,
      maxDelay: 10000,
      onSave: autoSaveHandler,
      onConflict: handleConflict,
      onError: (error) => console.error('Auto-save error:', error)
    }
  );
  
  const handleResolveConflict = async (choice: 'local' | 'server' | 'merge', mergedContent?: string) => {
    const resolvedContent = await autoSave.resolveConflict(choice, mergedContent);
    if (resolvedContent && choice !== 'local') {
      // Update editor with resolved content
      updateDocumentContent(resolvedContent);
    }
    setShowConflict(false);
  };

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
    const statusText = {
      saved: 'Saved',
      saving: 'Saving...',
      unsaved: 'Unsaved',
      conflict: 'Conflict!',
      offline: 'Offline',
      error: 'Error',
      paused: 'Paused'
    };
    
    const statusColor = {
      saved: 'text-emerald-400',
      saving: 'text-cyan-400',
      unsaved: 'text-orange',
      conflict: 'text-red-400',
      offline: 'text-terminal-500',
      error: 'text-red-400',
      paused: 'text-purple-400'
    };
    
    return (
      <div className="flex items-center gap-2">
        <SaveStatusDot status={autoSave.status} />
        <span className={`text-sm font-mono ${statusColor[autoSave.status]}`}>
          {statusText[autoSave.status]}
          {autoSave.lastSaved && autoSave.status === 'saved' && (
            <span className="text-terminal-500 ml-2">
              at {new Date(autoSave.lastSaved).toLocaleTimeString()}
            </span>
          )}
        </span>
      </div>
    );
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
          {/* Command Palette Button */}
          <button
            onClick={() => {
              const { setCommandPaletteOpen } = useStore.getState();
              setCommandPaletteOpen(true);
            }}
            className="px-3 py-1.5 bg-terminal-900 hover:bg-terminal-800 border-2 border-white/20 hover:border-white/30 
                     text-terminal-300 hover:text-white text-sm font-mono transition-colors duration-150 
                     flex items-center gap-2"
            title="Command Palette (⌘K)"
          >
            <span>Commands</span>
            <kbd className="px-1.5 py-0.5 bg-terminal-black border border-white/20 text-[10px] text-terminal-500">⌘K</kbd>
          </button>

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
              title="Version History (⌘H)"
            >
              <History className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
            </button>
          )}

          {/* Save Version */}
          {activeDocument && (
            <button
              onClick={handleSaveVersion}
              disabled={autoSave.status === 'saving'}
              className="p-2 hover:bg-terminal-800 border border-white/20 hover:border-white/30 transition-colors disabled:opacity-50 group"
              title="Save Version (⌘S)"
            >
              <Save className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
            </button>
          )}

          {/* Export */}
          {activeDocument && (
            <button
              onClick={() => setShowExport(true)}
              className="p-2 hover:bg-terminal-800 border border-white/20 hover:border-white/30 transition-colors group"
              title="Export Document (⌘E)"
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
      {showConflict && autoSave.conflict && (
        <ConflictModal
          conflict={autoSave.conflict}
          onResolve={handleResolveConflict}
          onCancel={() => setShowConflict(false)}
        />
      )}
    </>
  );
}
