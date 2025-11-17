import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useStore } from '../../state/store';
import { wsClient } from '../../lib/ws';
import { Pause, Play, Download, Trash2, Search, X, AlertCircle, Info, AlertTriangle, Terminal } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';

export default function LogsPanel() {
  // Optimize store selectors - only subscribe to what we need
  const logs = useStore(state => state.logs);
  const logsPaused = useStore(state => state.logsPaused);
  const setLogsPaused = useStore(state => state.setLogsPaused);
  const clearLogs = useStore(state => state.clearLogs);
  const loadLogs = useStore(state => state.loadLogs);
  const activeTab = useStore(state => state.uiState.activeTab);
  
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Debounce search term to prevent excessive filtering
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    // Clear old logs from previous server session
    clearLogs();
    
    // Subscribe to logs (will receive current session logs only)
    wsClient.subscribeLogs();
    
    // Load any logs from current session
    loadLogs();

    return () => {
      wsClient.unsubscribeLogs();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount to reset logs for new server session

  // Scroll to bottom when logs tab is activated
  useEffect(() => {
    if (activeTab === 'logs' && bottomRef.current) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        setAutoScroll(true);
      }, 100);
    }
  }, [activeTab]);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  }, []);

  // Memoize expensive filteredLogs computation with debounced search
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
    if (levelFilter !== 'all' && log.level !== levelFilter) return false;
      if (debouncedSearchTerm && !log.message.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) return false;
    return true;
  });
  }, [logs, levelFilter, debouncedSearchTerm]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-400';
      case 'warn':
        return 'text-yellow-400';
      case 'info':
        return 'text-cyan-400';
      default:
        return 'text-green-400';
    }
  };

  const getLevelBg = (level: string) => {
    switch (level) {
      case 'error':
        return 'bg-red-500/10 border-red-500/40';
      case 'warn':
        return 'bg-yellow-500/10 border-yellow-500/40';
      case 'info':
        return 'bg-cyan-500/10 border-cyan-500/40';
      default:
        return 'bg-green-500/10 border-green-500/40';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'warn':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'info':
        return <Info className="w-4 h-4 text-cyan-400" />;
      default:
        return <Terminal className="w-4 h-4 text-green-400" />;
    }
  };

  // Memoize expensive highlightMessage function
  const highlightMessage = useCallback((message: string) => {
    // Highlight patterns: [text], #numbers, URLs, file paths
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    
    // Patterns to match
    const patterns = [
      { regex: /\[([^\]]+)\]/g, className: 'text-purple-400 font-semibold' }, // [brackets]
      { regex: /#(\d+)/g, className: 'text-pink-400 font-bold' }, // #123
      { regex: /\b(\d+(?:\.\d+)?(?:ms|s|%)?)\b/g, className: 'text-cyan-300' }, // numbers with units
      { regex: /(https?:\/\/[^\s]+)/g, className: 'text-blue-400 underline' }, // URLs
      { regex: /([A-Z][a-zA-Z]+Engine|[A-Z][a-zA-Z]+Manager|[A-Z][a-zA-Z]+Service)/g, className: 'text-yellow-300' }, // Class names
      { regex: /(✓|✗|→|←|↑|↓|✨|🔍|💭|🧠)/g, className: 'text-lg' }, // Emoji/symbols
    ];
    
    // Combine all patterns
    const combinedRegex = new RegExp(
      patterns.map(p => p.regex.source).join('|'),
      'g'
    );
    
    let match;
    const matches: Array<{ index: number; length: number; text: string; pattern: number }> = [];
    
    // Find all matches
    patterns.forEach((pattern, patternIndex) => {
      const regex = new RegExp(pattern.regex);
      let m;
      while ((m = regex.exec(message)) !== null) {
        matches.push({
          index: m.index,
          length: m[0].length,
          text: m[0],
          pattern: patternIndex
        });
      }
    });
    
    // Sort by index
    matches.sort((a, b) => a.index - b.index);
    
    // Build result with non-overlapping matches
    let currentIndex = 0;
    matches.forEach((match, i) => {
      if (match.index >= currentIndex) {
        // Add text before match
        if (match.index > currentIndex) {
          parts.push(
            <span key={`text-${i}`} className="text-gray-300">
              {message.substring(currentIndex, match.index)}
            </span>
          );
        }
        
        // Add matched text with styling
        parts.push(
          <span key={`match-${i}`} className={patterns[match.pattern].className}>
            {match.text}
          </span>
        );
        
        currentIndex = match.index + match.length;
      }
    });
    
    // Add remaining text
    if (currentIndex < message.length) {
      parts.push(
        <span key="text-final" className="text-gray-300">
          {message.substring(currentIndex)}
        </span>
      );
    }
    
    return parts.length > 0 ? parts : <span className="text-gray-300">{message}</span>;
  }, []); // No dependencies - patterns are constant

  const downloadLogs = useCallback(() => {
    const text = filteredLogs
      .map((log) => `[${new Date(log.timestamp).toISOString()}] [${log.level.toUpperCase()}] ${log.message}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evelyn-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredLogs]);

  const copyToClipboard = useCallback(() => {
    const text = filteredLogs
      .map((log) => `[${new Date(log.timestamp).toISOString()}] [${log.level.toUpperCase()}] ${log.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
  }, [filteredLogs]);

  return (
    <div className="flex flex-col h-full terminal-panel">
      {/* Toolbar */}
      <div className="terminal-header border-b border-cyan-500/30 p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search logs..."
              className="w-full bg-black/40 border border-cyan-500/30 rounded px-9 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Level Filter */}
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="bg-black/40 border border-cyan-500/30 rounded px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Levels</option>
            <option value="log">Log</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* Pause/Resume */}
          <button
            onClick={() => setLogsPaused(!logsPaused)}
            className={`terminal-button px-3 py-1.5 ${logsPaused ? 'text-yellow-400' : 'text-green-400'}`}
            title={logsPaused ? 'Resume' : 'Pause'}
          >
            {logsPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>

          {/* Copy */}
          <button
            onClick={copyToClipboard}
            className="terminal-button px-3 py-1.5"
            title="Copy to clipboard"
          >
            <span className="text-sm font-mono">Copy</span>
          </button>

          {/* Download */}
          <button
            onClick={downloadLogs}
            className="terminal-button px-3 py-1.5"
            title="Download logs"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Clear */}
          <button
            onClick={clearLogs}
            className="terminal-button px-3 py-1.5 text-red-400"
            title="Clear logs"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Auto-scroll indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 border border-cyan-500/30 rounded">
            <div className={`w-2 h-2 rounded-full ${autoScroll ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
            <span className="text-xs font-mono text-gray-400">
              {autoScroll ? 'Auto' : 'Manual'}
            </span>
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-xs terminal-scrollbar bg-black/20"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <Terminal className="w-16 h-16 mx-auto mb-3 text-gray-700" />
              <p className="text-sm mb-2 text-cyan-400">No logs to display</p>
              {searchTerm && <p className="text-xs">Try adjusting your search</p>}
            </div>
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div
              key={log.id}
              className={`log-line px-3 py-2 rounded border ${getLevelBg(log.level)} hover:bg-white/10 transition-all duration-200 group ${
                log.level === 'error' ? 'shadow-[0_0_10px_rgba(239,68,68,0.3)]' : ''
              }`}
              style={{
                animation: 'slideInUp 0.2s ease-out',
                animationDelay: `${Math.min(index * 0.01, 0.5)}s`,
                animationFillMode: 'backwards'
              }}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="flex-shrink-0 mt-0.5">
                  {getLevelIcon(log.level)}
                </div>
                
                {/* Timestamp */}
                <span className="text-gray-500 flex-shrink-0 text-[10px] font-bold monospace min-w-[90px]">
                  {new Date(log.timestamp).toLocaleTimeString('en-US', { 
                    hour12: false, 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    second: '2-digit'
                  })}.{String(new Date(log.timestamp).getMilliseconds()).padStart(3, '0')}
                </span>
                
                {/* Level Badge */}
                <span className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  log.level === 'error' ? 'bg-red-500/30 text-red-300 border border-red-500/50' :
                  log.level === 'warn' ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50' :
                  log.level === 'info' ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50' :
                  'bg-green-500/30 text-green-300 border border-green-500/50'
                }`}>
                  {log.level}
                </span>
                
                {/* Message with syntax highlighting */}
                <div className="flex-1 whitespace-pre-wrap break-words leading-relaxed">
                  {highlightMessage(log.message)}
                </div>
                
                {/* Hover indicator */}
                <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-cyan-500 text-[10px]">#{log.id}</span>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Status Bar */}
      <div className="terminal-footer border-t border-cyan-500/30 px-4 py-2 flex items-center justify-between text-xs bg-gradient-to-r from-black/60 to-black/40">
        <div className="flex items-center gap-4">
          <span className="text-gray-400 monospace flex items-center gap-2">
            <Terminal className="w-3 h-3 text-cyan-400" />
            <span className="text-cyan-400 font-bold">{filteredLogs.length}</span>
            <span className="text-gray-600">/</span>
            <span className="text-gray-400">{logs.length}</span>
            <span className="text-gray-500">logs</span>
          </span>
          {logsPaused && (
            <span className="text-yellow-400 animate-pulse flex items-center gap-1 font-semibold">
              <Pause className="w-3 h-3" />
              PAUSED
            </span>
          )}
          {!logsPaused && logs.length > 0 && (
            <span className="text-green-400 flex items-center gap-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-[10px] font-semibold">LIVE</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-gray-500 monospace text-[10px]">
          <span className="flex items-center gap-1">
            <kbd className="terminal-kbd">Ctrl+F</kbd>
            <span>SEARCH</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="terminal-kbd">Ctrl+L</kbd>
            <span>CLEAR</span>
          </span>
        </div>
      </div>
    </div>
  );
}
