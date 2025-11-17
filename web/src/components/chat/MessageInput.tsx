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
    <div className="terminal-footer p-4">
      <div className={`relative bg-black/60 rounded border transition-all ${
        isFocused ? 'border-cyan-500 shadow-[0_0_10px_rgba(0,255,255,0.5)]' : 'border-cyan-500/30'
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
            placeholder={connected ? `$ message evelyn...` : '$ connecting...'}
            disabled={!connected}
            maxLength={charLimit}
            className="w-full bg-transparent text-white px-4 pt-4 pb-3 resize-none outline-none placeholder-gray-600 monospace text-sm leading-relaxed min-h-[80px] max-h-[200px]"
            rows={1}
          />
          
          {/* Character counter - only show when approaching limit */}
          {charPercentage > 70 && (
            <div className="absolute top-3 right-3">
              <span className={`text-xs font-mono ${
                charPercentage > 95 ? 'text-red-400' : charPercentage > 85 ? 'text-yellow-400' : 'text-cyan-400'
              }`}>
                {charLimit - input.length}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-3 flex items-center justify-between border-t border-cyan-500/20 pt-3">
          <div className="flex items-center gap-3 text-xs text-gray-500 monospace">
            {!connected ? (
              <span className="text-red-400 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                RECONNECTING...
              </span>
            ) : agentSession.sessionId && !agentSession.approved ? (
              <span className="text-yellow-400 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
                WAITING FOR APPROVAL...
              </span>
            ) : agentSession.isActive ? (
              <span className="text-cyan-400 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                BROWSING...
              </span>
            ) : (
              <>
                <span>
                  <kbd className="terminal-kbd">Enter</kbd> send
                </span>
                <span>
                  <kbd className="terminal-kbd">Shift+Enter</kbd> newline
                </span>
                <span>
                  <kbd className="terminal-kbd">↑↓</kbd> history
                </span>
                <button
                  onClick={() => setShowHelp(!showHelp)}
                  className="text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>help</span>
                </button>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Browse Button */}
            <button
              onClick={handleBrowse}
              disabled={!input.trim() || !connected || agentSession.isActive || !!currentMessage}
              className="terminal-button disabled:opacity-30 disabled:cursor-not-allowed"
              title={currentMessage ? "Wait for Evelyn to finish responding" : "Start agentic web browsing"}
            >
              <Globe className="w-4 h-4" />
              <span>Browse</span>
            </button>

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={!input.trim() || !connected}
              className="terminal-button disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </button>
          </div>
        </div>
      </div>

      {/* Help Panel */}
      {showHelp && (
        <div className="mt-4 terminal-panel p-4 animate-slide-in-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              Keyboard Shortcuts
            </h3>
            <button
              onClick={() => setShowHelp(false)}
              className="text-gray-400 hover:text-white text-xs"
            >
              close
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-xs monospace">
            <div>
              <kbd className="terminal-kbd">Enter</kbd>
              <span className="text-gray-400 ml-2">Send message</span>
            </div>
            <div>
              <kbd className="terminal-kbd">Shift+Enter</kbd>
              <span className="text-gray-400 ml-2">New line</span>
            </div>
            <div>
              <kbd className="terminal-kbd">↑</kbd>
              <span className="text-gray-400 ml-2">Previous message</span>
            </div>
            <div>
              <kbd className="terminal-kbd">↓</kbd>
              <span className="text-gray-400 ml-2">Next message</span>
            </div>
            <div>
              <kbd className="terminal-kbd">Ctrl+L</kbd>
              <span className="text-gray-400 ml-2">Clear input</span>
            </div>
            <div>
              <kbd className="terminal-kbd">Ctrl+K</kbd>
              <span className="text-gray-400 ml-2">Command palette</span>
            </div>
            <div>
              <kbd className="terminal-kbd">Ctrl+F</kbd>
              <span className="text-gray-400 ml-2">Search messages</span>
            </div>
            <div>
              <kbd className="terminal-kbd">Ctrl+/</kbd>
              <span className="text-gray-400 ml-2">Toggle help</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
