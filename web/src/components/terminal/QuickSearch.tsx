import { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '../../state/store';
import { Search, X, User, Bot } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';

export default function QuickSearch() {
  const messages = useStore(state => state.messages);
  const setQuickSearchOpen = useStore(state => state.setQuickSearchOpen);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Debounce search term for performance
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const filteredMessages = useMemo(() => 
    messages.filter((msg) =>
      msg.content.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    ),
    [messages, debouncedSearchTerm]
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [debouncedSearchTerm]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredMessages.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredMessages[selectedIndex]) {
          // Scroll to message in chat (could be implemented)
          setQuickSearchOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setQuickSearchOpen(false);
        break;
    }
  };

  useEffect(() => {
    if (resultsRef.current) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-cyan-500/30 text-cyan-300 rounded px-1">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div 
      className="terminal-overlay" 
      onClick={() => setQuickSearchOpen(false)}
    >
      <div 
        className="terminal-modal w-full max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-cyan-400 terminal-glow">
            Search Messages
          </h2>
          <button
            onClick={() => setQuickSearchOpen(false)}
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
            placeholder="Search message content..."
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

        <div ref={resultsRef} className="max-h-96 overflow-y-auto terminal-scrollbar space-y-2">
          {searchTerm && filteredMessages.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>No messages found</p>
              <p className="text-sm mt-1">Try a different search term</p>
            </div>
          )}

          {!searchTerm && (
            <div className="text-center py-8 text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Start typing to search messages</p>
            </div>
          )}

          {searchTerm && filteredMessages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`p-4 rounded border transition-all cursor-pointer ${
                  idx === selectedIndex
                    ? 'bg-cyan-500/20 border-cyan-500/50'
                    : 'bg-black/30 border-transparent hover:bg-cyan-500/10'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center ${
                    isUser ? 'bg-green-500/20 text-green-400' : 'bg-purple-500/20 text-purple-400'
                  }`}>
                    {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold ${isUser ? 'text-green-400' : 'text-purple-400'}`}>
                        {isUser ? 'You' : 'Evelyn'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(msg.createdAt).toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-300 leading-relaxed font-mono">
                      {highlightText(
                        msg.content.length > 200 
                          ? msg.content.substring(0, 200) + '...' 
                          : msg.content,
                        searchTerm
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
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
          {searchTerm && (
            <span>{filteredMessages.length} result{filteredMessages.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </div>
  );
}

