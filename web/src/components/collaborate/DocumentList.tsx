import { useStore } from '../../state/store';
import { FileText, Code, Archive, Trash2, Star, Tag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import DocumentFilterBar from './DocumentFilterBar';

// Helper to safely parse tags (handles both string JSON and array)
function parseTags(tags: string | string[] | undefined | null): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface DocumentListProps {
  searchQuery: string;
}

export default function DocumentList({ searchQuery }: DocumentListProps) {
  const { 
    collaborateState,
    loadCollaborateDocument,
    deleteCollaborateDocument,
    archiveCollaborateDocument,
    toggleDocumentFavorite,
    getFilteredDocuments
  } = useStore();

  const { activeDocument } = collaborateState;

  // Get filtered documents from store and apply search query
  const storeFilteredDocuments = getFilteredDocuments();
  const filteredDocuments = storeFilteredDocuments.filter(doc => {
    if (!searchQuery) return doc.status === 'active';
    const query = searchQuery.toLowerCase();
    return (
      doc.status === 'active' &&
      (doc.title.toLowerCase().includes(query) ||
       doc.contentType.toLowerCase().includes(query) ||
       doc.language?.toLowerCase().includes(query) ||
       parseTags(doc.tags).some(tag => tag.toLowerCase().includes(query)))
    );
  });

  const handleDocumentClick = async (docId: number) => {
    await loadCollaborateDocument(docId);
  };

  const handleDeleteDocument = async (e: React.MouseEvent, docId: number) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this document?')) {
      await deleteCollaborateDocument(docId);
    }
  };

  const handleArchiveDocument = async (e: React.MouseEvent, docId: number) => {
    e.stopPropagation();
    await archiveCollaborateDocument(docId);
  };

  const handleToggleFavorite = async (e: React.MouseEvent, docId: number) => {
    e.stopPropagation();
    await toggleDocumentFavorite(docId);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filter Bar */}
      <DocumentFilterBar />
      
      {/* Document List */}
      <div className="flex-1 overflow-y-auto terminal-scrollbar">
        {filteredDocuments.length === 0 ? (
          <div className="flex items-center justify-center h-full text-terminal-secondary text-sm p-8 text-center">
            {searchQuery ? (
              <div>
                <p>No documents found</p>
                <p className="text-xs mt-1 opacity-75">Try a different search term</p>
              </div>
            ) : (
              <div>
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No documents yet</p>
                <p className="text-xs mt-1 opacity-75">Create one to get started</p>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {filteredDocuments.map(doc => (
              <div
                key={doc.id}
                onClick={() => handleDocumentClick(doc.id)}
                className={`px-4 py-3 cursor-pointer transition-colors group relative
                           ${activeDocument?.id === doc.id 
                             ? 'bg-orange/10 border-l-2 border-orange' 
                             : 'hover:bg-terminal-800 border-l-2 border-transparent'}`}
                style={doc.color ? { borderLeftColor: doc.color } : undefined}
              >
                {/* Document Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    {/* Color indicator */}
                    {doc.color && (
                      <div 
                        className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                        style={{ backgroundColor: doc.color }}
                      />
                    )}
                    
                    {/* Content type icon */}
                    {doc.contentType === 'code' ? (
                      <Code className="w-4 h-4 text-cyan-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <FileText className="w-4 h-4 text-terminal-400 flex-shrink-0 mt-0.5" />
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-mono font-medium text-white truncate">
                          {doc.title}
                        </h3>
                        {doc.isFavorite && (
                          <Star className="w-3 h-3 text-orange flex-shrink-0" fill="currentColor" />
                        )}
                      </div>
                      
                      {/* Language badge */}
                      {doc.language && (
                        <span className="inline-block text-[10px] text-terminal-400 px-1.5 py-0.5 
                                       bg-terminal-900 border border-white/20 mt-1 font-mono">
                          {doc.language}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleToggleFavorite(e, doc.id)}
                      className={`p-1 border transition-colors ${
                        doc.isFavorite 
                          ? 'border-orange bg-orange/20 text-orange' 
                          : 'border-white/20 text-terminal-500 hover:border-white/30 hover:text-orange'
                      }`}
                      title={doc.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Star className="w-3 h-3" fill={doc.isFavorite ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={(e) => handleArchiveDocument(e, doc.id)}
                      className="p-1 border border-white/20 text-terminal-500 hover:border-white/30 hover:text-terminal-300 transition-colors"
                      title="Archive"
                    >
                      <Archive className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteDocument(e, doc.id)}
                      className="p-1 border border-white/20 text-terminal-500 hover:border-red-500 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Tags */}
                {(() => {
                  const tags = parseTags(doc.tags);
                  return tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {tags.slice(0, 3).map((tag, idx) => (
                        <span 
                          key={idx}
                          className="px-1.5 py-0.5 bg-terminal-900 border border-white/20 
                                   text-[10px] font-mono text-terminal-400 flex items-center gap-1"
                        >
                          <Tag className="w-2 h-2" />
                          {tag}
                        </span>
                      ))}
                      {tags.length > 3 && (
                        <span className="text-[10px] text-terminal-500 font-mono">
                          +{tags.length - 3} more
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Document Info */}
                <div className="mt-2 text-[11px] text-terminal-500 font-mono">
                  Updated {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
                </div>

                {/* Document Stats */}
                <div className="mt-1 flex items-center gap-3 text-[10px] text-terminal-600 font-mono">
                  {doc.versions && doc.versions.length > 0 && (
                    <span>{doc.versions.length} version{doc.versions.length !== 1 ? 's' : ''}</span>
                  )}
                  {doc.suggestions && doc.suggestions.filter(s => s.status === 'pending').length > 0 && (
                    <span className="text-orange">
                      {doc.suggestions.filter(s => s.status === 'pending').length} suggestion{doc.suggestions.filter(s => s.status === 'pending').length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
