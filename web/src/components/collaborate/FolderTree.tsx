import { useState, useRef, useEffect } from 'react';
import { useStore } from '../../state/store';
import { 
  Folder, 
  FolderOpen, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Edit2, 
  Trash2, 
  FileText,
  Code,
  MoreVertical,
  X,
  Check,
  FolderPlus
} from 'lucide-react';

interface FolderTreeProps {
  onSelectFolder?: (folderId: number | null) => void;
  selectedFolderId?: number | null;
  showDocuments?: boolean;
}

interface FolderItemProps {
  folder: {
    id: number;
    name: string;
    color?: string;
    parentId?: number;
    children?: any[];
  };
  level: number;
  expandedFolders: Set<number>;
  selectedFolderId: number | null;
  onToggleExpand: (id: number) => void;
  onSelect: (id: number | null) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  onMoveDocument: (docId: number, folderId: number | null) => void;
  documents: any[];
  showDocuments: boolean;
}

function FolderItem({
  folder,
  level,
  expandedFolders,
  selectedFolderId,
  onToggleExpand,
  onSelect,
  onRename,
  onDelete,
  onMoveDocument,
  documents,
  showDocuments
}: FolderItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const [showMenu, setShowMenu] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isExpanded = expandedFolders.has(folder.id);
  const isSelected = selectedFolderId === folder.id;
  const folderDocuments = documents.filter(d => d.folderId === folder.id);
  const hasChildren = (folder.children && folder.children.length > 0) || folderDocuments.length > 0;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSaveRename = () => {
    if (editName.trim() && editName !== folder.name) {
      onRename(folder.id, editName.trim());
    }
    setIsEditing(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const docId = e.dataTransfer.getData('documentId');
    if (docId) {
      onMoveDocument(parseInt(docId), folder.id);
    }
  };

  return (
    <div>
      {/* Folder Row */}
      <div
        className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer transition-colors group
                   ${isSelected ? 'bg-orange/20 text-orange' : 'hover:bg-terminal-800 text-terminal-300'}
                   ${isDragOver ? 'bg-cyan-500/20 border border-cyan-500' : ''}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect(folder.id)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Expand/Collapse */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(folder.id);
          }}
          className="p-0.5 hover:bg-white/10 transition-colors"
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )
          ) : (
            <span className="w-3 h-3" />
          )}
        </button>

        {/* Folder Icon */}
        {isExpanded ? (
          <FolderOpen className="w-4 h-4" style={folder.color ? { color: folder.color } : undefined} />
        ) : (
          <Folder className="w-4 h-4" style={folder.color ? { color: folder.color } : undefined} />
        )}

        {/* Folder Name */}
        {isEditing ? (
          <div className="flex-1 flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <input
              ref={inputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveRename();
                if (e.key === 'Escape') setIsEditing(false);
              }}
              onBlur={handleSaveRename}
              className="flex-1 px-1 py-0.5 bg-terminal-black border border-orange text-white 
                       text-xs font-mono focus:outline-none"
            />
            <button onClick={handleSaveRename} className="p-0.5 text-green-500 hover:text-green-400">
              <Check className="w-3 h-3" />
            </button>
            <button onClick={() => setIsEditing(false)} className="p-0.5 text-red-500 hover:text-red-400">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <span className="flex-1 text-xs font-mono truncate">{folder.name}</span>
        )}

        {/* Document Count */}
        {folderDocuments.length > 0 && !isEditing && (
          <span className="text-[10px] text-terminal-500 font-mono">
            {folderDocuments.length}
          </span>
        )}

        {/* Actions Menu */}
        {!isEditing && (
          <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-0.5 hover:bg-white/10 transition-colors"
            >
              <MoreVertical className="w-3 h-3" />
            </button>

            {showMenu && (
              <div 
                className="absolute right-0 top-full mt-1 w-32 bg-terminal-black border-2 border-white/20 
                          z-50 shadow-lg"
                onClick={e => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs font-mono text-terminal-300 
                           hover:bg-terminal-800 flex items-center gap-2"
                >
                  <Edit2 className="w-3 h-3" />
                  Rename
                </button>
                <button
                  onClick={() => {
                    if (confirm('Delete this folder? Documents will be moved to Unfiled.')) {
                      onDelete(folder.id);
                    }
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs font-mono text-red-400 
                           hover:bg-red-500/10 flex items-center gap-2"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div>
          {/* Child Folders */}
          {folder.children?.map((child: any) => (
            <FolderItem
              key={child.id}
              folder={child}
              level={level + 1}
              expandedFolders={expandedFolders}
              selectedFolderId={selectedFolderId}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              onMoveDocument={onMoveDocument}
              documents={documents}
              showDocuments={showDocuments}
            />
          ))}

          {/* Documents in Folder */}
          {showDocuments && folderDocuments.map((doc: any) => (
            <div
              key={doc.id}
              className="flex items-center gap-2 px-2 py-1 hover:bg-terminal-800 cursor-pointer
                       text-terminal-400 hover:text-terminal-300 transition-colors"
              style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('documentId', doc.id.toString());
              }}
            >
              {doc.contentType === 'code' ? (
                <Code className="w-3 h-3 text-cyan-500" />
              ) : (
                <FileText className="w-3 h-3" />
              )}
              <span className="text-xs font-mono truncate">{doc.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FolderTree({ 
  onSelectFolder, 
  selectedFolderId = null,
  showDocuments = false 
}: FolderTreeProps) {
  const { 
    collaborateState, 
    createCollaborateFolder,
    updateCollaborateFolder,
    deleteCollaborateFolder,
    moveDocumentToFolder,
    setCollaborateFilters
  } = useStore();
  
  const { folders, documentList, filters } = collaborateState;
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  // Documents without a folder
  const unfiledDocuments = documentList.filter(d => !d.folderId && d.status === 'active');

  useEffect(() => {
    if (isCreating && newFolderInputRef.current) {
      newFolderInputRef.current.focus();
    }
  }, [isCreating]);

  const handleToggleExpand = (id: number) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectFolder = (id: number | null) => {
    onSelectFolder?.(id);
    setCollaborateFilters({ folderId: id });
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await createCollaborateFolder(newFolderName.trim());
    setNewFolderName('');
    setIsCreating(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropToUnfiled = (e: React.DragEvent) => {
    e.preventDefault();
    const docId = e.dataTransfer.getData('documentId');
    if (docId) {
      moveDocumentToFolder(parseInt(docId), null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-terminal-400">
          Folders
        </h3>
        <button
          onClick={() => setIsCreating(true)}
          className="p-1 border border-white/20 text-terminal-500 hover:border-orange 
                   hover:text-orange transition-colors"
          title="New folder"
        >
          <FolderPlus className="w-3 h-3" />
        </button>
      </div>

      {/* Folder List */}
      <div className="flex-1 overflow-y-auto terminal-scrollbar">
        {/* All Documents */}
        <div
          className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors
                     ${filters.folderId === null && !selectedFolderId 
                       ? 'bg-orange/20 text-orange' 
                       : 'hover:bg-terminal-800 text-terminal-300'}`}
          onClick={() => handleSelectFolder(null)}
        >
          <Folder className="w-4 h-4" />
          <span className="text-xs font-mono">All Documents</span>
          <span className="text-[10px] text-terminal-500 font-mono ml-auto">
            {documentList.filter(d => d.status === 'active').length}
          </span>
        </div>

        {/* Folder Tree */}
        {folders.map(folder => (
          <FolderItem
            key={folder.id}
            folder={folder}
            level={0}
            expandedFolders={expandedFolders}
            selectedFolderId={selectedFolderId ?? filters.folderId}
            onToggleExpand={handleToggleExpand}
            onSelect={handleSelectFolder}
            onRename={(id, name) => updateCollaborateFolder(id, { name })}
            onDelete={deleteCollaborateFolder}
            onMoveDocument={moveDocumentToFolder}
            documents={documentList.filter(d => d.status === 'active')}
            showDocuments={showDocuments}
          />
        ))}

        {/* Unfiled Section */}
        {unfiledDocuments.length > 0 && (
          <div
            className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors mt-2
                       border-t border-white/10
                       ${filters.folderId === -1 
                         ? 'bg-orange/20 text-orange' 
                         : 'hover:bg-terminal-800 text-terminal-400'}`}
            onClick={() => handleSelectFolder(-1)}
            onDragOver={handleDragOver}
            onDrop={handleDropToUnfiled}
          >
            <Folder className="w-4 h-4 opacity-50" />
            <span className="text-xs font-mono italic">Unfiled</span>
            <span className="text-[10px] text-terminal-500 font-mono ml-auto">
              {unfiledDocuments.length}
            </span>
          </div>
        )}

        {/* New Folder Input */}
        {isCreating && (
          <div className="px-3 py-2 flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-orange" />
            <input
              ref={newFolderInputRef}
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewFolderName('');
                }
              }}
              onBlur={() => {
                if (!newFolderName.trim()) {
                  setIsCreating(false);
                }
              }}
              placeholder="Folder name..."
              className="flex-1 px-2 py-1 bg-terminal-black border border-orange text-white 
                       text-xs font-mono placeholder-terminal-500 focus:outline-none"
            />
            <button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim()}
              className="p-1 text-green-500 hover:text-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewFolderName('');
              }}
              className="p-1 text-red-500 hover:text-red-400"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Empty State */}
        {folders.length === 0 && !isCreating && (
          <div className="px-3 py-4 text-center">
            <Folder className="w-8 h-8 mx-auto mb-2 text-terminal-600 opacity-50" />
            <p className="text-xs text-terminal-500 font-mono">No folders yet</p>
            <button
              onClick={() => setIsCreating(true)}
              className="mt-2 text-xs text-orange hover:text-orange-light transition-colors font-mono"
            >
              Create your first folder
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
