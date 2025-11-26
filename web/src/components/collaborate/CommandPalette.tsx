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
  X
} from 'lucide-react';

// ========================================
// Command Types
// ========================================

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  category: 'document' | 'edit' | 'ai' | 'navigation' | 'shortcut';
  shortcut?: string;
  action: () => void | Promise<void>;
  disabled?: boolean;
}

interface CommandPaletteProps {
  onClose: () => void;
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
      score += consecutiveMatches * 2; // Bonus for consecutive matches
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
// Command Palette Component
// ========================================

export default function CommandPalette({ onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  
  const {
    collaborateState,
    saveCollaborateVersion,
    setCollaborateActivePanel,
    loadCollaborateDocuments,
    setCollaborateFilters
  } = useStore();
  
  const { activeDocument } = collaborateState;

  // Define all available commands
  const allCommands: CommandItem[] = useMemo(() => [
    // Document commands
    {
      id: 'new-document',
      label: 'New Document',
      description: 'Create a new document',
      icon: <Plus className="w-4 h-4" />,
      category: 'document',
      shortcut: '⌘N',
      action: () => {
        // Trigger new document modal via custom event
        window.dispatchEvent(new CustomEvent('collaborate:new-document'));
        onClose();
      }
    },
    {
      id: 'save-version',
      label: 'Save Version',
      description: 'Save current version',
      icon: <Save className="w-4 h-4" />,
      category: 'document',
      shortcut: '⌘S',
      action: async () => {
        await saveCollaborateVersion();
        onClose();
      },
      disabled: !activeDocument
    },
    {
      id: 'export-document',
      label: 'Export Document',
      description: 'Export as file',
      icon: <Download className="w-4 h-4" />,
      category: 'document',
      shortcut: '⌘E',
      action: () => {
        window.dispatchEvent(new CustomEvent('collaborate:export'));
        onClose();
      },
      disabled: !activeDocument
    },
    
    // Navigation commands
    {
      id: 'show-versions',
      label: 'Version History',
      description: 'View document versions',
      icon: <History className="w-4 h-4" />,
      category: 'navigation',
      shortcut: '⌘H',
      action: () => {
        setCollaborateActivePanel('versions');
        onClose();
      },
      disabled: !activeDocument
    },
    {
      id: 'show-suggestions',
      label: 'Suggestions Panel',
      description: 'View AI suggestions',
      icon: <Lightbulb className="w-4 h-4" />,
      category: 'navigation',
      shortcut: '⌘I',
      action: () => {
        setCollaborateActivePanel('suggestions');
        onClose();
      },
      disabled: !activeDocument
    },
    {
      id: 'show-editor',
      label: 'Editor',
      description: 'Focus on editor',
      icon: <FileText className="w-4 h-4" />,
      category: 'navigation',
      action: () => {
        setCollaborateActivePanel('editor');
        onClose();
      }
    },
    {
      id: 'show-favorites',
      label: 'Show Favorites',
      description: 'Filter to favorite documents',
      icon: <Sparkles className="w-4 h-4" />,
      category: 'navigation',
      action: () => {
        setCollaborateFilters({ showFavoritesOnly: true });
        onClose();
      }
    },
    {
      id: 'show-all',
      label: 'Show All Documents',
      description: 'Clear all filters',
      icon: <FileText className="w-4 h-4" />,
      category: 'navigation',
      action: () => {
        setCollaborateFilters({ 
          showFavoritesOnly: false, 
          contentType: 'all', 
          dateRange: 'all',
          tags: []
        });
        onClose();
      }
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
      disabled: !activeDocument
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
      disabled: !activeDocument || activeDocument.contentType !== 'code'
    },
    {
      id: 'shortcut-shorter',
      label: 'Make Shorter',
      description: 'Reduce text length',
      icon: <Type className="w-4 h-4" />,
      category: 'shortcut',
      action: () => {
        window.dispatchEvent(new CustomEvent('collaborate:shortcut', { detail: { type: 'adjust_length', direction: 'shorter' } }));
        onClose();
      },
      disabled: !activeDocument
    },
    {
      id: 'shortcut-longer',
      label: 'Make Longer',
      description: 'Expand text length',
      icon: <Type className="w-4 h-4" />,
      category: 'shortcut',
      action: () => {
        window.dispatchEvent(new CustomEvent('collaborate:shortcut', { detail: { type: 'adjust_length', direction: 'longer' } }));
        onClose();
      },
      disabled: !activeDocument
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
      disabled: !activeDocument
    },
    {
      id: 'shortcut-comments',
      label: 'Add Code Comments',
      description: 'Add explanatory comments',
      icon: <MessageSquare className="w-4 h-4" />,
      category: 'shortcut',
      action: () => {
        window.dispatchEvent(new CustomEvent('collaborate:shortcut', { detail: { type: 'add_comments' } }));
        onClose();
      },
      disabled: !activeDocument || activeDocument.contentType !== 'code'
    },
    {
      id: 'shortcut-logs',
      label: 'Add Debug Logs',
      description: 'Insert logging statements',
      icon: <FileCode className="w-4 h-4" />,
      category: 'shortcut',
      action: () => {
        window.dispatchEvent(new CustomEvent('collaborate:shortcut', { detail: { type: 'add_logs' } }));
        onClose();
      },
      disabled: !activeDocument || activeDocument.contentType !== 'code'
    },
    
    // AI commands
    {
      id: 'ask-evelyn',
      label: 'Ask Evelyn',
      description: 'Open chat with Evelyn',
      icon: <MessageSquare className="w-4 h-4" />,
      category: 'ai',
      shortcut: '⌘⏎',
      action: () => {
        window.dispatchEvent(new CustomEvent('collaborate:focus-chat'));
        onClose();
      }
    },
    {
      id: 'generate-suggestions',
      label: 'Generate Suggestions',
      description: 'Ask Evelyn for suggestions',
      icon: <Zap className="w-4 h-4" />,
      category: 'ai',
      action: () => {
        window.dispatchEvent(new CustomEvent('collaborate:generate-suggestions'));
        onClose();
      },
      disabled: !activeDocument
    }
  ], [activeDocument, saveCollaborateVersion, setCollaborateActivePanel, setCollaborateFilters, onClose]);

  // Filter and sort commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      return allCommands.filter(cmd => !cmd.disabled);
    }
    
    return allCommands
      .filter(cmd => !cmd.disabled)
      .map(cmd => ({
        ...cmd,
        ...fuzzyMatch(`${cmd.label} ${cmd.description || ''}`, query)
      }))
      .filter(cmd => cmd.match)
      .sort((a, b) => b.score - a.score);
  }, [allCommands, query]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      document: [],
      navigation: [],
      shortcut: [],
      ai: [],
      edit: []
    };
    
    filteredCommands.forEach(cmd => {
      groups[cmd.category]?.push(cmd);
    });
    
    return groups;
  }, [filteredCommands]);

  // Handle keyboard navigation
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

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selectedElement?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Category labels
  const categoryLabels: Record<string, string> = {
    document: 'Documents',
    navigation: 'Navigation',
    shortcut: 'AI Shortcuts',
    ai: 'AI Actions',
    edit: 'Edit'
  };

  let globalIndex = 0;

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-start justify-center pt-[15vh] z-50"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xl bg-terminal-black border-2 border-orange shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b-2 border-white/20">
          <Command className="w-5 h-5 text-orange" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-white text-sm font-mono placeholder-terminal-500 
                     focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <div className="flex items-center gap-1 text-[10px] text-terminal-500 font-mono">
            <kbd className="px-1.5 py-0.5 bg-terminal-900 border border-white/20 rounded">esc</kbd>
            <span>to close</span>
          </div>
        </div>

        {/* Command List */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto terminal-scrollbar">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Search className="w-8 h-8 text-terminal-600 mx-auto mb-2" />
              <p className="text-sm text-terminal-500 font-mono">No commands found</p>
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, commands]) => {
              if (commands.length === 0) return null;
              
              return (
                <div key={category}>
                  {/* Category Header */}
                  <div className="px-4 py-2 bg-terminal-900 border-b border-white/10">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-terminal-500">
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
                                    ? 'bg-orange/20 border-l-2 border-orange' 
                                    : 'hover:bg-terminal-800 border-l-2 border-transparent'}`}
                      >
                        <div className={`${isSelected ? 'text-orange' : 'text-terminal-400'}`}>
                          {cmd.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-mono ${isSelected ? 'text-white' : 'text-terminal-300'}`}>
                            {cmd.label}
                          </p>
                          {cmd.description && (
                            <p className="text-[11px] text-terminal-500 font-mono truncate">
                              {cmd.description}
                            </p>
                          )}
                        </div>
                        {cmd.shortcut && (
                          <kbd className="px-2 py-1 bg-terminal-900 border border-white/20 text-[10px] 
                                        font-mono text-terminal-400">
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
        <div className="px-4 py-2 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[10px] text-terminal-600 font-mono">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-terminal-900 border border-white/20">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-terminal-900 border border-white/20">↵</kbd>
              select
            </span>
          </div>
          <span className="text-[10px] text-terminal-600 font-mono">
            {filteredCommands.length} command{filteredCommands.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
