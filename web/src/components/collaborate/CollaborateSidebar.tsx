import { useState } from 'react';
import { useStore } from '../../state/store';
import { FileText, Code, Lightbulb, History, ChevronRight, Search } from 'lucide-react';
import { Badge } from '../ui';
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
      <div className="w-12 border-r-2 border-white/20 bg-terminal-black flex flex-col items-center py-4 gap-4">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 hover:bg-terminal-800 border border-white/20 hover:border-white/30 transition-colors group"
          title="Expand sidebar"
        >
          <ChevronRight className="w-4 h-4 text-terminal-400 group-hover:text-white transition-colors" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 border-r-2 border-white/20 bg-terminal-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-white/20">
        <h2 className="text-white font-mono font-bold uppercase text-sm tracking-wide">Workspace</h2>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 hover:bg-terminal-800 border border-white/20 hover:border-white/30 transition-colors group"
          title="Collapse sidebar"
        >
          <ChevronRight className="w-4 h-4 text-terminal-400 group-hover:text-white transition-colors rotate-180" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b-2 border-white/20">
        <button
          onClick={() => setActiveTab('documents')}
          className={`flex-1 px-4 py-2.5 flex items-center justify-center gap-2 transition-colors relative
                     ${activeTab === 'documents' 
                       ? 'text-orange bg-orange/10' 
                       : 'text-terminal-500 hover:text-terminal-300 hover:bg-terminal-900'}`}
        >
          <FileText className="w-4 h-4" />
          <span className="text-sm font-mono font-medium uppercase">Docs</span>
          {activeTab === 'documents' && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('suggestions')}
          disabled={!activeDocument}
          className={`flex-1 px-4 py-2.5 flex items-center justify-center gap-2 transition-colors
                     relative disabled:opacity-30 disabled:cursor-not-allowed
                     ${activeTab === 'suggestions' 
                       ? 'text-orange bg-orange/10' 
                       : 'text-terminal-500 hover:text-terminal-300 hover:bg-terminal-900'}`}
        >
          <Lightbulb className="w-4 h-4" />
          <span className="text-sm font-mono font-medium uppercase">Ideas</span>
          {pendingSuggestionsCount > 0 && (
            <Badge variant="purple" size="sm">
              {pendingSuggestionsCount}
            </Badge>
          )}
          {activeTab === 'suggestions' && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('versions')}
          disabled={!activeDocument}
          className={`flex-1 px-4 py-2.5 flex items-center justify-center gap-2 transition-colors
                     relative disabled:opacity-30 disabled:cursor-not-allowed
                     ${activeTab === 'versions' 
                       ? 'text-orange bg-orange/10' 
                       : 'text-terminal-500 hover:text-terminal-300 hover:bg-terminal-900'}`}
        >
          <History className="w-4 h-4" />
          <span className="text-sm font-mono font-medium uppercase">History</span>
          {activeTab === 'versions' && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange" />
          )}
        </button>
      </div>

      {/* Search Bar */}
      {activeTab === 'documents' && (
        <div className="px-4 py-3 border-b-2 border-white/20">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-terminal-500" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-terminal-black border-2 border-white/20 hover:border-white/30 focus:border-orange text-white placeholder-terminal-500 text-sm font-mono focus:outline-none transition-colors"
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
