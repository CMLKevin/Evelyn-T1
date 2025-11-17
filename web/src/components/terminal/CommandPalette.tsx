import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../state/store';
import { 
  MessageSquare, 
  Activity, 
  ScrollText, 
  Globe, 
  Trash2, 
  RefreshCw,
  Eye,
  EyeOff,
  Search,
  X,
  Code2,
  FileCode
} from 'lucide-react';

interface Command {
  id: string;
  label: string;
  icon: any;
  action: () => void;
  category: string;
  subtitle?: string;
}

export default function CommandPalette() {
  const {
    setCommandPaletteOpen,
    setActiveTab,
    clearLogs,
    clearMessages,
    toggleDiagnostics,
    showDiagnostics,
    setQuickSearchOpen,
    canvasState,
    loadCanvas,
  } = useStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build commands array including projects
  const commands: Command[] = [
    // Project commands
    ...canvasState.canvasList.map(canvas => ({
      id: `project-${canvas.id}`,
      label: canvas.title,
      subtitle: `${canvas.codeType} • ${canvas.language} • ${canvas.files?.length || 0} files`,
      icon: FileCode,
      action: () => {
        loadCanvas(canvas.id);
        setActiveTab('chat');
        setCommandPaletteOpen(false);
      },
      category: 'Projects',
    })),
    // Navigation commands
    {
      id: 'nav-chat',
      label: 'Switch to Chat',
      icon: MessageSquare,
      action: () => { setActiveTab('chat'); setCommandPaletteOpen(false); },
      category: 'Navigation',
    },
    {
      id: 'nav-logs',
      label: 'Switch to Logs',
      icon: ScrollText,
      action: () => { setActiveTab('logs'); setCommandPaletteOpen(false); },
      category: 'Navigation',
    },
    {
      id: 'nav-diagnostics',
      label: 'Switch to Diagnostics',
      icon: Activity,
      action: () => { setActiveTab('diagnostics'); setCommandPaletteOpen(false); },
      category: 'Navigation',
    },
    {
      id: 'search',
      label: 'Search Messages',
      icon: Search,
      action: () => { setCommandPaletteOpen(false); setQuickSearchOpen(true); },
      category: 'Actions',
    },
    {
      id: 'toggle-diagnostics',
      label: `${showDiagnostics ? 'Hide' : 'Show'} Diagnostics`,
      icon: showDiagnostics ? EyeOff : Eye,
      action: () => { toggleDiagnostics(); setCommandPaletteOpen(false); },
      category: 'View',
    },
    {
      id: 'clear-logs',
      label: 'Clear Logs',
      icon: Trash2,
      action: () => { 
        if (confirm('Clear all logs?')) {
          clearLogs(); 
          setCommandPaletteOpen(false); 
        }
      },
      category: 'Actions',
    },
    {
      id: 'reload',
      label: 'Reload Page',
      icon: RefreshCw,
      action: () => window.location.reload(),
      category: 'Actions',
    },
  ];

  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cmd.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
        break;
      case 'Escape':
        e.preventDefault();
        setCommandPaletteOpen(false);
        break;
    }
  };

  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) {
      acc[cmd.category] = [];
    }
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);

  return (
    <div 
      className="terminal-overlay" 
      onClick={() => setCommandPaletteOpen(false)}
    >
      <div 
        className="terminal-modal w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-cyan-400 terminal-glow">
            Command Palette
          </h2>
          <button
            onClick={() => setCommandPaletteOpen(false)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="w-full bg-black/60 border border-cyan-500/30 rounded px-12 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto terminal-scrollbar">
          {Object.entries(groupedCommands).map(([category, cmds], catIndex) => (
            <div key={category} className={catIndex > 0 ? 'mt-4' : ''}>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider px-3 py-2">
                {category}
              </div>
              <div className="space-y-1">
                {cmds.map((cmd, idx) => {
                  const globalIndex = filteredCommands.indexOf(cmd);
                  const Icon = cmd.icon;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => cmd.action()}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded transition-all ${
                        globalIndex === selectedIndex
                          ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400'
                          : 'bg-black/30 border border-transparent text-gray-300 hover:bg-cyan-500/10'
                      }`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <div className="flex-1 text-left min-w-0">
                        <div className="font-mono">{cmd.label}</div>
                        {cmd.subtitle && (
                          <div className="text-xs text-gray-500 truncate mt-0.5">{cmd.subtitle}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {filteredCommands.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>No commands found</p>
              <p className="text-sm mt-1">Try a different search term</p>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-cyan-500/30 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="terminal-kbd">↑↓</kbd> Navigate
            </span>
            <span>
              <kbd className="terminal-kbd">Enter</kbd> Select
            </span>
            <span>
              <kbd className="terminal-kbd">Esc</kbd> Close
            </span>
          </div>
          <span>{filteredCommands.length} commands</span>
        </div>
      </div>
    </div>
  );
}
