import { useState, KeyboardEvent, useRef, useEffect, useCallback } from 'react';
import { wsClient } from '../../lib/ws';
import { useStore } from '../../state/store';
import { Globe, Send, Terminal, HelpCircle } from 'lucide-react';

export default function MessageInput() {
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Optimize store selectors
  const connected = useStore(state => state.connected);
  const addMessage = useStore(state => state.addMessage);
  const agentSession = useStore(state => state.agentSession);
  const currentMessage = useStore(state => state.currentMessage);
  const addToHistory = useStore(state => state.addToHistory);
  const navigateHistory = useStore(state => state.navigateHistory);
  const resetHistoryIndex = useStore(state => state.resetHistoryIndex);
  const agenticMode = useStore(state => state.agenticMode);

  const handleBrowse = useCallback(() => {
    if (!input.trim() || !connected) return;
    
    // Don't allow browsing while Evelyn is responding
    if (currentMessage) {
      console.log('[Browse] Cannot start browsing while Evelyn is responding');
      return;
    }
    
    addToHistory(input.trim());
    wsClient.startAgentSession(input.trim());
    setInput('');
    resetHistoryIndex();
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, connected, currentMessage, addToHistory, resetHistoryIndex]);

  const handleSend = useCallback(() => {
    if (!input.trim() || !connected) return;

    const userMessage = {
      id: Date.now(),
      role: 'user' as const,
      content: input.trim(),
      createdAt: new Date().toISOString()
    };

    addMessage(userMessage);
    addToHistory(input.trim());
    wsClient.sendMessage(input.trim());
    setInput('');
    resetHistoryIndex();
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, connected, addMessage, addToHistory, resetHistoryIndex]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorAtStart = textarea.selectionStart === 0 && textarea.selectionEnd === 0;
    const cursorAtEnd = textarea.selectionStart === input.length && textarea.selectionEnd === input.length;

    // Command history navigation
    if (e.key === 'ArrowUp' && cursorAtStart && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const historyEntry = navigateHistory('up');
      if (historyEntry !== null) {
        setInput(historyEntry);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = historyEntry.length;
            textareaRef.current.selectionEnd = historyEntry.length;
          }
        }, 0);
      }
      return;
    }

    if (e.key === 'ArrowDown' && cursorAtEnd && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const historyEntry = navigateHistory('down');
      if (historyEntry !== null) {
        setInput(historyEntry);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = historyEntry.length;
            textareaRef.current.selectionEnd = historyEntry.length;
          }
        }, 0);
      }
      return;
    }

    // Send message
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }

    // Clear input
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
      e.preventDefault();
      setInput('');
      resetHistoryIndex();
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      return;
    }

    // Help
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      setShowHelp(!showHelp);
      return;
    }
  }, [input, navigateHistory, handleSend, resetHistoryIndex, showHelp]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    resetHistoryIndex();
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [resetHistoryIndex]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const charLimit = 2000;
  const charPercentage = (input.length / charLimit) * 100;

  return (
    <div className="px-5 py-4 border-t-2 border-white/20">
      <div className={`relative group border-2 transition-colors duration-150 ${
        isFocused ? 'border-orange' : 'border-white/20 hover:border-white/30'
      }`}>
        {/* Textarea */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={connected ? `Message Evelyn...` : 'Connecting...'}
            disabled={!connected}
            maxLength={charLimit}
            className="w-full px-4 py-3 bg-terminal-black border-none text-white placeholder-terminal-500 text-sm font-mono resize-none focus:outline-none transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed min-h-[80px] max-h-[200px]"
            rows={1}
          />
          
          
          {/* Character counter */}
          {charPercentage > 70 && (
            <div className="absolute top-3 right-3">
              <span className={`text-xs font-mono px-2 py-0.5 border ${
                charPercentage > 95 ? 'bg-red-500/10 text-red-500 border-red-500' : 
                charPercentage > 85 ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500' : 
                'bg-orange/10 text-orange border-orange'
              }`}>
                {charLimit - input.length}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 flex items-center justify-between border-t-2 border-white/20 bg-terminal-dark">
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            {!connected ? (
              <span className="text-red-300 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-red-400 animate-pulse" />
                Reconnecting...
              </span>
            ) : agentSession.sessionId && !agentSession.approved ? (
              <span className="text-yellow-300 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-yellow-400 animate-pulse" />
                Waiting for approval...
              </span>
            ) : agentSession.isActive ? (
              <span className="text-cyan-300 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-cyan-400 animate-pulse" />
                Browsing...
              </span>
            ) : (
              <>
                <span className="text-zinc-600">
                  <kbd className="px-1.5 py-0.5 bg-terminal-900 border border-white/20 text-terminal-400 font-mono text-[10px]">Enter</kbd> send
                </span>
                <span className="text-zinc-600">
                  <kbd className="px-1.5 py-0.5 bg-terminal-900 border border-white/20 text-terminal-400 font-mono text-[10px]">Shift+Enter</kbd> newline
                </span>
                <button
                  onClick={() => setShowHelp(!showHelp)}
                  className="text-zinc-500 hover:text-white transition-colors flex items-center gap-1"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>help</span>
                </button>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Browse Button - only shown in agentic mode */}
            {agenticMode && (
              <button
                onClick={handleBrowse}
                disabled={!input.trim() || !connected || agentSession.isActive || !!currentMessage}
                className="px-3 py-1.5 bg-terminal-900 hover:bg-terminal-800 border-2 border-white/20 hover:border-white/30 text-terminal-300 hover:text-white text-sm font-mono transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                title={currentMessage ? "Wait for Evelyn to finish responding" : "Start agentic web browsing"}
              >
                <Globe className="w-4 h-4" />
                <span>Browse</span>
              </button>
            )}

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={!input.trim() || !connected}
              className="px-4 py-1.5 bg-orange hover:bg-orange-dark border-2 border-orange text-white text-sm font-mono uppercase tracking-wide transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </button>
          </div>
        </div>
      </div>

      {/* Help Panel */}
      {showHelp && (
        <div className="mt-4 px-4 py-3 bg-terminal-900 border-2 border-white/20 animate-fade-in">
          <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
            <h3 className="text-sm font-mono font-bold uppercase tracking-wide text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-orange" />
              Keyboard Shortcuts
            </h3>
            <button
              onClick={() => setShowHelp(false)}
              className="text-terminal-500 hover:text-white text-xs font-mono transition-colors"
            >
              close
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <kbd className="px-1.5 py-0.5 bg-terminal-900 border border-white/20 text-terminal-400 font-mono text-[10px]">Enter</kbd>
              <span className="text-zinc-500 ml-2">Send message</span>
            </div>
            <div>
              <kbd className="px-1.5 py-0.5 bg-terminal-900 border border-white/20 text-terminal-400 font-mono text-[10px]">Shift+Enter</kbd>
              <span className="text-zinc-500 ml-2">New line</span>
            </div>
            <div>
              <kbd className="px-1.5 py-0.5 bg-terminal-900 border border-white/20 text-terminal-400 font-mono text-[10px]">↑</kbd>
              <span className="text-zinc-500 ml-2">Previous message</span>
            </div>
            <div>
              <kbd className="px-1.5 py-0.5 bg-terminal-900 border border-white/20 text-terminal-400 font-mono text-[10px]">↓</kbd>
              <span className="text-zinc-500 ml-2">Next message</span>
            </div>
            <div>
              <kbd className="px-1.5 py-0.5 bg-terminal-900 border border-white/20 text-terminal-400 font-mono text-[10px]">Ctrl+L</kbd>
              <span className="text-zinc-500 ml-2">Clear input</span>
            </div>
            <div>
              <kbd className="px-1.5 py-0.5 bg-terminal-900 border border-white/20 text-terminal-400 font-mono text-[10px]">Ctrl+K</kbd>
              <span className="text-zinc-500 ml-2">Command palette</span>
            </div>
            <div>
              <kbd className="px-1.5 py-0.5 bg-terminal-900 border border-white/20 text-terminal-400 font-mono text-[10px]">Ctrl+F</kbd>
              <span className="text-zinc-500 ml-2">Search messages</span>
            </div>
            <div>
              <kbd className="px-1.5 py-0.5 bg-terminal-900 border border-white/20 text-terminal-400 font-mono text-[10px]">Ctrl+/</kbd>
              <span className="text-zinc-500 ml-2">Toggle help</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
