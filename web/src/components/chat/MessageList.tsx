import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useStore } from '../../state/store';
import SearchResultBubble from './SearchResultBubble';
import MarkdownRenderer from '../common/MarkdownRenderer';
import AgentSessionInline from '../agent/AgentSessionInline';
import AgentBrowsingResults from '../agent/AgentBrowsingResults';
import { Trash2, User, Bot, Copy, Check, Layers } from 'lucide-react';

export default function MessageList() {
  // Optimize store selectors - only subscribe to what we need
  const messages = useStore(state => state.messages);
  const tempMessages = useStore(state => state.tempMessages);
  const currentMessage = useStore(state => state.currentMessage);
  const searchResults = useStore(state => state.searchResults);
  const agentSession = useStore(state => state.agentSession);
  const browsingResults = useStore(state => state.browsingResults);
  const deleteMessage = useStore(state => state.deleteMessage);
  const contextUsage = useStore(state => state.contextUsage);
  
  // Get message IDs that are in the rolling context window
  const messageIdsInContext = contextUsage?.messageIdsInContext ?? [];
  // Only show context indicators if we have valid context data (array with items)
  const hasContextData = messageIdsInContext.length > 0;
  
  const [deletingMessageId, setDeletingMessageId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Optimize auto-scroll - only track essential changes
  const messagesLength = useStore(state => state.messages.length);
  const hasCurrentMessage = useStore(state => !!state.currentMessage);
  const searchResultsLength = useStore(state => state.searchResults.length);
  const agentPagesLength = useStore(state => state.agentSession.pages.length);
  const browsingResultsLength = useStore(state => state.browsingResults.length);

  // Auto-scroll to bottom when content changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesLength, hasCurrentMessage, searchResultsLength, agentPagesLength, browsingResultsLength]);

  const formatTime = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }, []);

  const handleDeleteMessage = useCallback(async (messageId: number) => {
    if (!confirm('Delete this message? This action cannot be undone.')) {
      return;
    }
    
    setDeletingMessageId(messageId);
    try {
      await deleteMessage(messageId);
    } catch (error) {
      console.error('Failed to delete message:', error);
      alert('Failed to delete message. Please try again.');
    } finally {
      setDeletingMessageId(null);
    }
  }, [deleteMessage]);

  const handleCopy = useCallback((content: string, id: number) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 terminal-scrollbar">
      {messages.length === 0 && !currentMessage && (
        <div className="flex flex-col items-center justify-center h-full animate-fade-in text-center">
          <div className="mb-6 text-cyan-400">
            <Bot className="w-20 h-20 mx-auto mb-4 terminal-glow-strong" />
          </div>
          
          <h2 className="text-2xl font-bold mb-3 text-cyan-400 terminal-glow monospace">
            EVELYN TERMINAL v2.0
          </h2>
          <p className="text-gray-400 max-w-md leading-relaxed mb-6 monospace">
            An evolving AI companion with persistent memory, personality, and deep reflection capabilities.
          </p>
          
          <div className="flex gap-3 flex-wrap justify-center monospace text-sm">
            <div className="terminal-panel px-4 py-2">
              <span className="text-purple-400">💭</span>
              <span className="ml-2 text-white">Inner Thoughts</span>
            </div>
            <div className="terminal-panel px-4 py-2">
              <span className="text-green-400">🧠</span>
              <span className="ml-2 text-white">True Memory</span>
            </div>
            <div className="terminal-panel px-4 py-2">
              <span className="text-cyan-400">✨</span>
              <span className="ml-2 text-white">Evolves Over Time</span>
            </div>
          </div>

          <div className="mt-8 text-xs text-gray-600 monospace">
            <p>Type a message below to begin...</p>
          </div>
        </div>
      )}


      {/* Render messages */}
      {(() => {
        // Filter messages first
        const filteredMessages = messages.filter(msg => {
          // Filter out browsing trigger messages
          if (msg.auxiliary) {
            try {
              const aux = typeof msg.auxiliary === 'string' ? JSON.parse(msg.auxiliary) : msg.auxiliary;
              if (aux.type === 'browsing_trigger') {
                return false;
              }
            } catch (e) {
              // If parsing fails, show the message
            }
          }
          return true;
        });

        return filteredMessages.map((msg, index) => {
          const isUser = msg.role === 'user';
          
          // Check if there are any search results that should appear after this message
          const relevantSearchResults = searchResults.filter(sr => {
            const msgTime = new Date(msg.createdAt).getTime();
            const nextMsg = filteredMessages[index + 1];
            const nextMsgTime = nextMsg ? new Date(nextMsg.createdAt).getTime() : Date.now() + 1000000;
            const srTime = new Date(sr.timestamp).getTime();
            return srTime > msgTime && srTime < nextMsgTime;
          });

          return (
            <div key={`msg-group-${msg.id}`}>
              {/* Terminal Prompt Style Message */}
              <div className={`terminal-prompt ${isUser ? 'terminal-prompt-user' : 'terminal-prompt-assistant'} group relative`}>
                <div className="flex items-start gap-3 w-full">
                  {/* Prompt Symbol */}
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {isUser ? (
                      <>
                        <User className="w-5 h-5 text-green-400" />
                        <span className="terminal-prompt-symbol text-green-400 terminal-glow">$</span>
                      </>
                    ) : (
                      <>
                        <Bot className="w-5 h-5 text-purple-400" />
                        <span className="terminal-prompt-symbol text-purple-400 terminal-glow tracking-wide">Evelyn</span>
                      </>
                    )}
                  </div>

                  {/* Message Content */}
                  <div className="flex-1 min-w-0">
                    {/* Metadata */}
                    <div className="flex items-center gap-3 mb-1 text-xs text-gray-500 monospace">
                      <span>{isUser ? 'user' : 'assistant'}</span>
                      <span>{formatTime(msg.createdAt)}</span>
                      {hasContextData && messageIdsInContext.includes(msg.id) && (
                        <span className="flex items-center gap-1 text-[9px] text-cyan-400" title="In active context window">
                          <Layers className="w-2.5 h-2.5" />
                          <span>IN CONTEXT</span>
                        </span>
                      )}
                      
                      {/* Actions (visible on hover) */}
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleCopy(msg.content, msg.id)}
                          className="text-cyan-400 hover:text-cyan-300 transition-colors"
                          title="Copy message"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteMessage(msg.id)}
                          disabled={deletingMessageId === msg.id}
                          className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                          title="Delete message"
                        >
                          {deletingMessageId === msg.id ? (
                            <span className="text-xs animate-spin">⏳</span>
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Message Text */}
                    <div className="terminal-prompt-content text-gray-200 monospace text-sm leading-relaxed">
                      {isUser ? (
                        <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                      ) : (
                        <MarkdownRenderer content={msg.content} />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Render search results that belong after this message */}
              {relevantSearchResults.map((sr) => (
                <SearchResultBubble key={sr.id} {...sr} />
              ))}

              {/* Render browsing results that belong after this message */}
              {browsingResults.filter(br => {
                const msgTime = new Date(msg.createdAt).getTime();
                const nextMsg = filteredMessages[index + 1];
                const nextMsgTime = nextMsg ? new Date(nextMsg.createdAt).getTime() : Date.now() + 1000000;
                const brTime = new Date(br.timestamp).getTime();
                return brTime > msgTime && brTime < nextMsgTime;
              }).map((br) => (
                <AgentBrowsingResults key={br.sessionId} {...br} />
              ))}

              {/* Render inline agent session if it belongs in the timeline */}
              {agentSession.sessionId && (() => {
                const msgTime = new Date(msg.createdAt).getTime();
                const nextMsg = filteredMessages[index + 1];
                const nextMsgTime = nextMsg ? new Date(nextMsg.createdAt).getTime() : Date.now() + 1000000;
                const sessionTime = agentSession.startedAt ? new Date(agentSession.startedAt).getTime() : Date.now();
                
                if (sessionTime > msgTime && sessionTime < nextMsgTime) {
                  return (
                    <AgentSessionInline
                      key={agentSession.sessionId}
                      sessionId={agentSession.sessionId}
                      query={agentSession.query || ''}
                      evelynIntent={agentSession.evelynIntent}
                      entryUrl={agentSession.entryUrl}
                      isActive={agentSession.isActive}
                      approved={agentSession.approved}
                      currentStep={agentSession.currentStep}
                      currentDetail={agentSession.currentDetail}
                      pages={agentSession.pages}
                      pageCount={agentSession.pageCount}
                      maxPages={agentSession.maxPages}
                      error={agentSession.error}
                      summary={agentSession.summary}
                      startedAt={agentSession.startedAt}
                    />
                  );
                }
                return null;
              })()}
            </div>
          );
        });
      })()}

      {/* Render temporary split messages during streaming */}
      {tempMessages.map((msg) => (
        <div key={`temp-msg-${msg.id}`} className="terminal-prompt terminal-prompt-assistant animate-fade-in">
          <div className="flex items-start gap-3 w-full">
            <div className="flex-shrink-0 flex items-center gap-2">
              <Bot className="w-5 h-5 text-purple-400" />
              <span className="terminal-prompt-symbol text-purple-400 terminal-glow tracking-wide">Evelyn</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1 text-xs text-gray-500 monospace">
                <span>assistant</span>
                <span>{formatTime(msg.createdAt)}</span>
              </div>

              <div className="terminal-prompt-content text-gray-200 monospace text-sm leading-relaxed">
                <MarkdownRenderer content={msg.content} />
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Typing indicator */}
      {currentMessage && (
        <div className="terminal-prompt terminal-prompt-assistant animate-fade-in">
          <div className="flex items-start gap-3 w-full">
            <div className="flex-shrink-0 flex items-center gap-2">
              <Bot className="w-5 h-5 text-purple-400" />
              <span className="terminal-prompt-symbol text-purple-400 terminal-glow">evelyn@host:</span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1 text-xs text-gray-500 monospace">
                <span>assistant</span>
                <span className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                  <div className="w-1 h-1 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                  <div className="w-1 h-1 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                  <span className="ml-1">typing</span>
                </span>
              </div>

              <div className="terminal-prompt-content text-gray-200 monospace text-sm leading-relaxed">
                <MarkdownRenderer content={currentMessage} />
                <span className="typing-cursor"></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Show agent session at end if it hasn't been placed in timeline yet */}
      {agentSession.sessionId && !messages.some(msg => {
        const msgTime = new Date(msg.createdAt).getTime();
        const sessionTime = agentSession.startedAt ? new Date(agentSession.startedAt).getTime() : Date.now();
        return sessionTime > msgTime;
      }) && (
        <AgentSessionInline
          sessionId={agentSession.sessionId}
          query={agentSession.query || ''}
          evelynIntent={agentSession.evelynIntent}
          entryUrl={agentSession.entryUrl}
          isActive={agentSession.isActive}
          approved={agentSession.approved}
          currentStep={agentSession.currentStep}
          currentDetail={agentSession.currentDetail}
          pages={agentSession.pages}
          pageCount={agentSession.pageCount}
          maxPages={agentSession.maxPages}
          error={agentSession.error}
          summary={agentSession.summary}
          startedAt={agentSession.startedAt}
        />
      )}

      <div ref={bottomRef} className="h-4" />
    </div>
  );
}
