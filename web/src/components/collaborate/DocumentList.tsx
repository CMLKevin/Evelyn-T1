import { useStore } from '../../state/store';
import { FileText, Code, Archive, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface DocumentListProps {
  searchQuery: string;
}

export default function DocumentList({ searchQuery }: DocumentListProps) {
  const { 
    collaborateState,
    loadCollaborateDocument,
    deleteCollaborateDocument,
    archiveCollaborateDocument
  } = useStore();

  const { documentList, activeDocument } = collaborateState;

  // Filter documents based on search query
  const filteredDocuments = documentList.filter(doc => {
    if (!searchQuery) return doc.status === 'active';
    const query = searchQuery.toLowerCase();
    return (
      doc.status === 'active' &&
      (doc.title.toLowerCase().includes(query) ||
       doc.contentType.toLowerCase().includes(query) ||
       doc.language?.toLowerCase().includes(query))
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

  if (filteredDocuments.length === 0) {
    return (
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
    );
  }

  return (
    <div className="divide-y divide-terminal-border">
      {filteredDocuments.map(doc => (
        <div
          key={doc.id}
          onClick={() => handleDocumentClick(doc.id)}
          className={`px-4 py-3 cursor-pointer transition-colors group
                     ${activeDocument?.id === doc.id 
                       ? 'bg-terminal-accent/20 border-l-2 border-terminal-accent' 
                       : 'hover:bg-terminal-border'}`}
        >
          {/* Document Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              {doc.contentType === 'code' ? (
                <Code className="w-4 h-4 text-terminal-secondary flex-shrink-0 mt-0.5" />
              ) : (
                <FileText className="w-4 h-4 text-terminal-secondary flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-terminal-text truncate">
                  {doc.title}
                </h3>
                {doc.language && (
                  <span className="inline-block text-xs text-terminal-secondary px-1.5 py-0.5 
                                 bg-terminal-secondary/10 rounded border border-terminal-secondary/30 mt-1">
                    {doc.language}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => handleArchiveDocument(e, doc.id)}
                className="p-1 hover:bg-terminal-border rounded"
                title="Archive"
              >
                <Archive className="w-3 h-3 text-terminal-secondary" />
              </button>
              <button
                onClick={(e) => handleDeleteDocument(e, doc.id)}
                className="p-1 hover:bg-red-500/20 rounded"
                title="Delete"
              >
                <Trash2 className="w-3 h-3 text-red-500" />
              </button>
            </div>
          </div>

          {/* Document Info */}
          <div className="mt-2 text-xs text-terminal-secondary">
            <p>
              Updated {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
            </p>
          </div>

          {/* Document Stats */}
          <div className="mt-2 flex items-center gap-3 text-xs text-terminal-secondary">
            {doc.versions && doc.versions.length > 0 && (
              <span>{doc.versions.length} version{doc.versions.length !== 1 ? 's' : ''}</span>
            )}
            {doc.suggestions && doc.suggestions.filter(s => s.status === 'pending').length > 0 && (
              <span className="text-terminal-accent">
                {doc.suggestions.filter(s => s.status === 'pending').length} suggestion{doc.suggestions.filter(s => s.status === 'pending').length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
