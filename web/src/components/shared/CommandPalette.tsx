import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useStore } from '../../state/store';
import {
  Command,
  FileText,
  Code,
  Save,
  Download,
  History,
  Plus,
  Sparkles,
  MessageSquare,
  Lightbulb,
  Undo,
  Redo,
  Search,
  Settings,
  Keyboard,
  Wand2,
  Bug,
  FileCode,
  Zap,
  Type,
  Smile,
  X,
  Activity,
  ScrollText,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  Layout,
  Terminal,
  Globe,
  Moon,
  Sun,
} from 'lucide-react';

// ========================================
// Types
// ========================================

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  category: 'app' | 'navigate' | 'document' | 'edit' | 'ai' | 'shortcut' | 'view';
  shortcut?: string;
  action: () => void | Promise<void>;
  disabled?: boolean;
  context?: 'global' | 'collaborate' | 'chat'; // Which context this command is available in
}

interface CommandPaletteProps {
  onClose: () => void;
  context?: 'global' | 'collaborate' | 'chat';
}

// ========================================
// Fuzzy Search
// ========================================

function fuzzyMatch(text: string, query: string): { match: boolean; score: number } {
  if (!query) return { match: true, score: 1 };
  
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  
  // Exact match gets highest score
  if (textLower === queryLower) return { match: true, score: 100 };
  
  // Starts with query gets high score
  if (textLower.startsWith(queryLower)) return { match: true, score: 80 };
  
  // Contains query
  if (textLower.includes(queryLower)) return { match: true, score: 60 };
  
  // Fuzzy character matching
  let queryIndex = 0;
  let score = 0;
  let consecutiveMatches = 0;
  
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      queryIndex++;
      consecutiveMatches++;
      score += consecutiveMatches * 2;
    } else {
      consecutiveMatches = 0;
    }
  }
  
  if (queryIndex === queryLower.length) {
    return { match: true, score };
  }
  
  return { match: false, score: 0 };
}

// ========================================
// Unified Command Palette
// ========================================

export default function CommandPalette({ onClose, context = 'global' }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  
  const {
    // UI state
    uiState,
    setActiveTab,
    showDiagnostics,
    toggleDiagnostics,
    clearLogs,
    setQuickSearchOpen,
    // Collaborate state
    collaborateState,
    saveCollaborateVersion,
    setCollaborateActivePanel,
    setCollaborateFilters,
  } = useStore();
  
  const { activeTab } = uiState;
  const { activeDocument } = collaborateState;
  const isCollaborateContext = context === 'collaborate' || activeTab === 'collaborate';

  // Build all available commands
  const allCommands: CommandItem[] = useMemo(() => {
    const commands: CommandItem[] = [];
    
    // ========================================
    // App-Wide Commands (always available)
    // ========================================
    commands.push(
      {
        id: 'nav-chat',
        label: 'Go to Chat',
        description: 'Open main chat',
        icon: <MessageSquare className="w-4 h-4" />,
        category: 'navigate',
        shortcut: '⌘1',
        action: () => { setActiveTab('chat'); onClose(); },
        context: 'global',
      },
      {
        id: 'nav-collaborate',
        label: 'Go to Collaborate',
        description: 'Open document editor',
        icon: <FileText className="w-4 h-4" />,
        category: 'navigate',
        shortcut: '⌘2',
        action: () => { setActiveTab('collaborate'); onClose(); },
        context: 'global',
      },
      {
        id: 'nav-logs',
        label: 'Go to Logs',
        description: 'View system logs',
        icon: <ScrollText className="w-4 h-4" />,
        category: 'navigate',
        shortcut: '⌘3',
        action: () => { setActiveTab('logs'); onClose(); },
        context: 'global',
      },
      {
        id: 'nav-diagnostics',
        label: 'Go to Diagnostics',
        description: 'System diagnostics',
        icon: <Activity className="w-4 h-4" />,
        category: 'navigate',
        shortcut: '⌘4',
        action: () => { setActiveTab('diagnostics'); onClose(); },
        context: 'global',
      },
      {
        id: 'toggle-diagnostics',
        label: showDiagnostics ? 'Hide Diagnostics Panel' : 'Show Diagnostics Panel',
        description: 'Toggle diagnostics visibility',
        icon: showDiagnostics ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />,
        category: 'view',
        action: () => { toggleDiagnostics(); onClose(); },
        context: 'global',
      },
      {
        id: 'search-messages',
        label: 'Search Messages',
        description: 'Find in conversation',
        icon: <Search className="w-4 h-4" />,
        category: 'app',
        shortcut: '⌘F',
        action: () => { setQuickSearchOpen(true); onClose(); },
        context: 'global',
      },
      {
        id: 'open-settings',
        label: 'Open Settings',
        description: 'Configure Evelyn',
        icon: <Settings className="w-4 h-4" />,
        category: 'app',
        shortcut: '⌘,',
        action: () => { 
          window.dispatchEvent(new CustomEvent('app:open-settings')); 
          onClose(); 
        },
        context: 'global',
      },
      {
        id: 'reload-page',
        label: 'Reload Page',
        description: 'Refresh the application',
        icon: <RefreshCw className="w-4 h-4" />,
        category: 'app',
        shortcut: '⌘R',
        action: () => window.location.reload(),
        context: 'global',
      },
      {
        id: 'clear-logs',
        label: 'Clear Logs',
        description: 'Delete all log entries',
        icon: <Trash2 className="w-4 h-4" />,
        category: 'app',
        action: () => { 
          if (confirm('Clear all logs?')) {
            clearLogs(); 
            onClose(); 
          }
        },
        context: 'global',
      },
    );
    
    // ========================================
    // Collaborate Commands (context-specific)
    // ========================================
    if (isCollaborateContext) {
      commands.push(
        // Document commands
        {
          id: 'new-document',
          label: 'New Document',
          description: 'Create a new document',
          icon: <Plus className="w-4 h-4" />,
          category: 'document',
          shortcut: '⌘N',
          action: () => {
            window.dispatchEvent(new CustomEvent('collaborate:new-document'));
            onClose();
          },
          context: 'collaborate',
        },
        {
          id: 'save-version',
          label: 'Save Version',
          description: 'Save current document version',
          icon: <Save className="w-4 h-4" />,
          category: 'document',
          shortcut: '⌘S',
          action: async () => {
            await saveCollaborateVersion();
            onClose();
          },
          disabled: !activeDocument,
          context: 'collaborate',
        },
        {
          id: 'export-document',
          label: 'Export Document',
          description: 'Download as file',
          icon: <Download className="w-4 h-4" />,
          category: 'document',
          shortcut: '⌘E',
          action: () => {
            window.dispatchEvent(new CustomEvent('collaborate:export'));
            onClose();
          },
          disabled: !activeDocument,
          context: 'collaborate',
        },
        {
          id: 'show-versions',
          label: 'Version History',
          description: 'View document versions',
          icon: <History className="w-4 h-4" />,
          category: 'document',
          shortcut: '⌘H',
          action: () => {
            setCollaborateActivePanel('versions');
            onClose();
          },
          disabled: !activeDocument,
          context: 'collaborate',
        },
        {
          id: 'show-suggestions',
          label: 'Suggestions Panel',
          description: 'View AI suggestions',
          icon: <Lightbulb className="w-4 h-4" />,
          category: 'document',
          shortcut: '⌘I',
          action: () => {
            setCollaborateActivePanel('suggestions');
            onClose();
          },
          disabled: !activeDocument,
          context: 'collaborate',
        },
        {
          id: 'show-favorites',
          label: 'Show Favorites',
          description: 'Filter to starred documents',
          icon: <Sparkles className="w-4 h-4" />,
          category: 'document',
          action: () => {
            setCollaborateFilters({ showFavoritesOnly: true });
            onClose();
          },
          context: 'collaborate',
        },
        
        // AI Shortcuts
        {
          id: 'shortcut-polish',
          label: 'Polish Writing',
          description: 'Improve writing quality',
          icon: <Wand2 className="w-4 h-4" />,
          category: 'shortcut',
          shortcut: '⌘⇧P',
          action: () => {
            window.dispatchEvent(new CustomEvent('collaborate:shortcut', { detail: { type: 'add_polish' } }));
            onClose();
          },
          disabled: !activeDocument,
          context: 'collaborate',
        },
        {
          id: 'shortcut-fix-bugs',
          label: 'Fix Bugs',
          description: 'Find and fix code bugs',
          icon: <Bug className="w-4 h-4" />,
          category: 'shortcut',
          shortcut: '⌘⇧B',
          action: () => {
            window.dispatchEvent(new CustomEvent('collaborate:shortcut', { detail: { type: 'fix_bugs' } }));
            onClose();
          },
          disabled: !activeDocument || activeDocument.contentType !== 'code',
          context: 'collaborate',
        },
        {
          id: 'shortcut-shorter',
          label: 'Make Shorter',
          description: 'Condense the text',
          icon: <Type className="w-4 h-4" />,
          category: 'shortcut',
          action: () => {
            window.dispatchEvent(new CustomEvent('collaborate:shortcut', { detail: { type: 'adjust_length', direction: 'shorter' } }));
            onClose();
          },
          disabled: !activeDocument,
          context: 'collaborate',
        },
        {
          id: 'shortcut-longer',
          label: 'Make Longer',
          description: 'Expand the text',
          icon: <Type className="w-4 h-4" />,
          category: 'shortcut',
          action: () => {
            window.dispatchEvent(new CustomEvent('collaborate:shortcut', { detail: { type: 'adjust_length', direction: 'longer' } }));
            onClose();
          },
          disabled: !activeDocument,
          context: 'collaborate',
        },
        {
          id: 'shortcut-emojis',
          label: 'Add Emojis',
          description: 'Sprinkle in emojis',
          icon: <Smile className="w-4 h-4" />,
          category: 'shortcut',
          action: () => {
            window.dispatchEvent(new CustomEvent('collaborate:shortcut', { detail: { type: 'add_emojis' } }));
            onClose();
          },
          disabled: !activeDocument,
          context: 'collaborate',
        },
        {
          id: 'shortcut-comments',
          label: 'Add Code Comments',
          description: 'Add documentation',
          icon: <MessageSquare className="w-4 h-4" />,
          category: 'shortcut',
          action: () => {
            window.dispatchEvent(new CustomEvent('collaborate:shortcut', { detail: { type: 'add_comments' } }));
            onClose();
          },
          disabled: !activeDocument || activeDocument.contentType !== 'code',
          context: 'collaborate',
        },
        {
          id: 'ask-evelyn',
          label: 'Ask Evelyn',
          description: 'Open chat with Evelyn',
          icon: <Zap className="w-4 h-4" />,
          category: 'ai',
          shortcut: '⌘⏎',
          action: () => {
            window.dispatchEvent(new CustomEvent('collaborate:focus-chat'));
            onClose();
          },
          context: 'collaborate',
        },
        {
          id: 'generate-suggestions',
          label: 'Generate Suggestions',
          description: 'Ask Evelyn for ideas',
          icon: <Lightbulb className="w-4 h-4" />,
          category: 'ai',
          action: () => {
            window.dispatchEvent(new CustomEvent('collaborate:generate-suggestions'));
            onClose();
          },
          disabled: !activeDocument,
          context: 'collaborate',
        },
      );
    }
    
    return commands;
  }, [
    isCollaborateContext, activeDocument, showDiagnostics,
    setActiveTab, toggleDiagnostics, clearLogs, setQuickSearchOpen,
    saveCollaborateVersion, setCollaborateActivePanel, setCollaborateFilters, onClose
  ]);

  // Filter and sort commands
  const filteredCommands = useMemo(() => {
    const enabledCommands = allCommands.filter(cmd => !cmd.disabled);
    
    if (!query.trim()) {
      return enabledCommands;
    }
    
    return enabledCommands
      .map(cmd => ({
        ...cmd,
        ...fuzzyMatch(`${cmd.label} ${cmd.description || ''}`, query)
      }))
      .filter(cmd => cmd.match)
      .sort((a, b) => b.score - a.score);
  }, [allCommands, query]);

  // Group by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      app: [],
      navigate: [],
      view: [],
      document: [],
      shortcut: [],
      ai: [],
      edit: [],
    };
    
    filteredCommands.forEach(cmd => {
      groups[cmd.category]?.push(cmd);
    });
    
    return groups;
  }, [filteredCommands]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [filteredCommands, selectedIndex, onClose]);

  // Reset selection on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Auto-focus
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const categoryLabels: Record<string, string> = {
    app: 'Application',
    navigate: 'Navigation',
    view: 'View',
    document: 'Documents',
    shortcut: 'AI Shortcuts',
    ai: 'AI Actions',
    edit: 'Edit',
  };

  let globalIndex = 0;

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-start justify-center pt-[15vh] z-50"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xl bg-terminal-black border-2 border-cyan-500/50 shadow-2xl shadow-cyan-500/10 rounded-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-cyan-500/30 bg-black/50">
          <Command className="w-5 h-5 text-cyan-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-white text-sm font-mono placeholder-gray-500 focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <div className="flex items-center gap-1 text-[10px] text-gray-500 font-mono">
            <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-gray-400">esc</kbd>
          </div>
        </div>

        {/* Command List */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Search className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-mono">No commands found</p>
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, commands]) => {
              if (commands.length === 0) return null;
              
              return (
                <div key={category}>
                  {/* Category Header */}
                  <div className="px-4 py-2 bg-gray-900/80 border-b border-gray-800">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-500">
                      {categoryLabels[category]}
                    </span>
                  </div>
                  
                  {/* Commands */}
                  {commands.map(cmd => {
                    const currentIndex = globalIndex++;
                    const isSelected = currentIndex === selectedIndex;
                    
                    return (
                      <button
                        key={cmd.id}
                        data-index={currentIndex}
                        onClick={() => cmd.action()}
                        className={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors
                                  ${isSelected 
                                    ? 'bg-cyan-500/20 border-l-2 border-cyan-400' 
                                    : 'hover:bg-gray-800/50 border-l-2 border-transparent'}`}
                      >
                        <div className={`${isSelected ? 'text-cyan-400' : 'text-gray-400'}`}>
                          {cmd.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-mono ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                            {cmd.label}
                          </p>
                          {cmd.description && (
                            <p className="text-[11px] text-gray-500 font-mono truncate">
                              {cmd.description}
                            </p>
                          )}
                        </div>
                        {cmd.shortcut && (
                          <kbd className="px-2 py-1 bg-gray-800 border border-gray-700 text-[10px] font-mono text-gray-400 rounded">
                            {cmd.shortcut}
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-800 bg-gray-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[10px] text-gray-500 font-mono">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-gray-800 border border-gray-700 rounded">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-gray-800 border border-gray-700 rounded">↵</kbd>
              select
            </span>
          </div>
          <span className="text-[10px] text-gray-500 font-mono">
            {filteredCommands.length} command{filteredCommands.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
