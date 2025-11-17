import { useState } from 'react';
import { useStore } from '../../state/store';
import { FileText, Code, Lightbulb, History, ChevronRight, Search } from 'lucide-react';
import DocumentList from './DocumentList';
import SuggestionPanel from './SuggestionPanel';
import VersionHistory from './VersionHistory';

type SidebarTab = 'documents' | 'suggestions' | 'versions';

export default function CollaborateSidebar() {
  const { collaborateState } = useStore();
  const [activeTab, setActiveTab] = useState<SidebarTab>('documents');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { activeDocument, currentSuggestions } = collaborateState;

  const pendingSuggestionsCount = currentSuggestions.filter(
    s => s.status === 'pending'
  ).length;

  if (isCollapsed) {
    return (
      <div className="w-12 border-r border-terminal-border bg-black/40 flex flex-col items-center py-4 gap-4">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 hover:bg-terminal-border rounded transition-colors"
          title="Expand sidebar"
        >
          <ChevronRight className="w-4 h-4 text-terminal-text" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 border-r border-terminal-border bg-black/40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-terminal-border">
        <h2 className="text-terminal-text font-semibold">Sidebar</h2>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 hover:bg-terminal-border rounded transition-colors"
          title="Collapse sidebar"
        >
          <ChevronRight className="w-4 h-4 text-terminal-text rotate-180" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-terminal-border">
        <button
          onClick={() => setActiveTab('documents')}
          className={`flex-1 px-4 py-2 flex items-center justify-center gap-2 transition-colors
                     ${activeTab === 'documents' 
                       ? 'bg-terminal-accent/20 text-terminal-accent border-b-2 border-terminal-accent' 
                       : 'text-terminal-secondary hover:bg-terminal-border'}`}
        >
          <FileText className="w-4 h-4" />
          <span className="text-sm">Docs</span>
        </button>

        <button
          onClick={() => setActiveTab('suggestions')}
          disabled={!activeDocument}
          className={`flex-1 px-4 py-2 flex items-center justify-center gap-2 transition-colors
                     relative disabled:opacity-50 disabled:cursor-not-allowed
                     ${activeTab === 'suggestions' 
                       ? 'bg-terminal-accent/20 text-terminal-accent border-b-2 border-terminal-accent' 
                       : 'text-terminal-secondary hover:bg-terminal-border'}`}
        >
          <Lightbulb className="w-4 h-4" />
          <span className="text-sm">Ideas</span>
          {pendingSuggestionsCount > 0 && (
            <span className="absolute top-1 right-1 w-5 h-5 bg-terminal-secondary rounded-full 
                           text-xs flex items-center justify-center">
              {pendingSuggestionsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('versions')}
          disabled={!activeDocument}
          className={`flex-1 px-4 py-2 flex items-center justify-center gap-2 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed
                     ${activeTab === 'versions' 
                       ? 'bg-terminal-accent/20 text-terminal-accent border-b-2 border-terminal-accent' 
                       : 'text-terminal-secondary hover:bg-terminal-border'}`}
        >
          <History className="w-4 h-4" />
          <span className="text-sm">History</span>
        </button>
      </div>

      {/* Search Bar */}
      {activeTab === 'documents' && (
        <div className="px-4 py-2 border-b border-terminal-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-terminal-secondary" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-black border border-terminal-border rounded
                       text-terminal-text placeholder-terminal-secondary text-sm
                       focus:outline-none focus:border-terminal-accent"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'documents' && <DocumentList searchQuery={searchQuery} />}
        {activeTab === 'suggestions' && activeDocument && <SuggestionPanel />}
        {activeTab === 'versions' && activeDocument && <VersionHistory />}
      </div>
    </div>
  );
}
