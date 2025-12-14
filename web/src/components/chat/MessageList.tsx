import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useStore } from '../../state/store';
import SearchResultBubble from './SearchResultBubble';
import MarkdownRenderer from '../common/MarkdownRenderer';
import AgentSessionInline from '../agent/AgentSessionInline';
import AgentBrowsingResults from '../agent/AgentBrowsingResults';
import AgentProgressInline from '../agent/AgentProgressInline';
import { ArtifactCard } from '../artifacts';
import { Trash2, User, Bot, Copy, Check, Layers, MessageSquare, Sparkles, Box } from 'lucide-react';
import { Avatar } from '../ui';
import { format } from 'date-fns';

export default function MessageList() {
  // Optimize store selectors - only subscribe to what we need
  const messages = useStore(state => state.messages);
  const tempMessages = useStore(state => state.tempMessages);
  const currentMessage = useStore(state => state.currentMessage);
  const searchResults = useStore(state => state.searchResults);
  const agentSession = useStore(state => state.agentSession);
  const browsingResults = useStore(state => state.browsingResults);
  const artifacts = useStore(state => state.artifacts);
  const agentProgress = useStore(state => state.agentProgress);
  const setActiveArtifact = useStore(state => state.setActiveArtifact);
  const runArtifact = useStore(state => state.runArtifact);
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
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(168, 85, 247, 0.3) transparent' }}>
      {messages.length === 0 && !currentMessage && (
        <div className="flex flex-col items-center justify-center h-full animate-fade-in text-center px-4">
          <div className="mb-6 relative">
            <div className="relative p-6 bg-orange/15 border border-orange/50 rounded-2xl">
              <Sparkles className="w-16 h-16 mx-auto text-orange" />
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-2 text-white">
            Welcome to Evelyn
          </h2>
          <p className="text-zinc-400 max-w-md leading-relaxed mb-6 text-sm">
            An evolving AI companion with persistent memory, personality, and deep reflection capabilities.
          </p>

          <div className="flex gap-3 flex-wrap justify-center text-sm">
            <div className="px-4 py-2 bg-surface-2 border border-white/10 rounded-lg">
              <span>💭</span>
              <span className="ml-2 text-terminal-300 font-mono">Inner Thoughts</span>
            </div>
            <div className="px-4 py-2 bg-surface-2 border border-white/10 rounded-lg">
              <span>🧠</span>
              <span className="ml-2 text-terminal-300 font-mono">True Memory</span>
            </div>
            <div className="px-4 py-2 bg-surface-2 border border-white/10 rounded-lg">
              <span>✨</span>
              <span className="ml-2 text-terminal-300 font-mono">Evolves Over Time</span>
            </div>
          </div>

          <div className="mt-8 text-xs text-zinc-600">
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
          let auxData: any = null;

          if (msg.auxiliary) {
            try {
              auxData = typeof msg.auxiliary === 'string' ? JSON.parse(msg.auxiliary) : msg.auxiliary;
            } catch (error) {
              auxData = null;
            }
          }

          const isCollaborateMessage = auxData?.channel === 'collaborate';
          const autoEditSummary = !!auxData?.autoEditSummary;
          const collaborateTitle = auxData?.documentTitle;
          
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
              {/* Modern Message Bubble */}
              <div className="flex items-start gap-3 group animate-fade-in-up">
                {/* Avatar */}
                <Avatar 
                  variant={isUser ? 'user' : 'ai'}
                  size="md"
                  icon={isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                />

                {/* Message Content */}
                <div className="flex-1 min-w-0 space-y-1">
                  {/* Metadata Header */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-white">
                      {isUser ? 'You' : 'Evelyn'}
                    </span>
                    <span className="text-zinc-500">
                      {format(new Date(msg.createdAt), 'HH:mm:ss')}
                    </span>
                    {hasContextData && messageIdsInContext.includes(msg.id) && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-cyan-500/15 border border-cyan-500/50 rounded-sm text-[10px] text-cyan-500 font-mono uppercase" title="In active context window">
                        <Layers className="w-2.5 h-2.5" />
                        <span>CONTEXT</span>
                      </span>
                    )}
                    {isCollaborateMessage && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-orange/15 border border-orange/50 rounded-sm text-[10px] text-orange font-mono uppercase" title="Originated from Collaborate chat">
                        <MessageSquare className="w-2.5 h-2.5" />
                        <span>{collaborateTitle || 'Collaborate'}</span>
                      </span>
                    )}
                    {autoEditSummary && (
                      <span className="px-1.5 py-0.5 bg-green-500/15 border border-green-500/50 rounded-sm text-[10px] text-green-500 font-mono uppercase">
                        Auto Edit
                      </span>
                    )}

                    {/* Actions */}
                    <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleCopy(msg.content, msg.id)}
                        className="p-1.5 bg-surface-2 hover:bg-surface-3 border border-white/15 hover:border-white/25 rounded-md transition-all duration-150 group/btn"
                        title="Copy message"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-zinc-400 group-hover/btn:text-white transition-colors" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        disabled={deletingMessageId === msg.id}
                        className="p-1.5 bg-surface-2 hover:bg-surface-3 border border-white/15 hover:border-red-500/50 rounded-md transition-all duration-150 disabled:opacity-50 group/btn"
                        title="Delete message"
                      >
                        {deletingMessageId === msg.id ? (
                          <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5 text-zinc-400 group-hover/btn:text-red-400 transition-colors" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Message Bubble - Asymmetric rounding */}
                  <div className={`px-4 py-3 border ${isUser ? 'bg-cyan-500/15 border-cyan-500/40 rounded-lg rounded-tl-sm' : 'bg-surface-2 border-white/10 rounded-lg rounded-tr-sm'}`}>
                    <div className="text-white font-semibold text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
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

              {/* Render artifacts associated with this message */}
              {artifacts.filter(art => art.messageId === msg.id).map((artifact) => (
                <div key={artifact.id} className="mt-3 ml-12">
                  <ArtifactCard
                    artifact={artifact}
                    onClick={() => setActiveArtifact(artifact)}
                    onRun={() => runArtifact(artifact.id)}
                  />
                </div>
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
        <div key={`temp-msg-${msg.id}`} className="flex items-start gap-3 animate-fade-in">
          <Avatar
            variant="ai"
            size="md"
            icon={<Sparkles className="w-4 h-4" />}
          />

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-white">Evelyn</span>
              <span className="text-zinc-500">{format(new Date(msg.createdAt), 'HH:mm:ss')}</span>
            </div>

            <div className="px-4 py-3 bg-surface-2 border border-white/10 rounded-lg rounded-tr-sm">
              <div className="text-zinc-200 text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
                <MarkdownRenderer content={msg.content} />
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Agent Progress - shows when Evelyn is thinking/using tools */}
      {agentProgress && agentProgress.status !== 'complete' && (
        <AgentProgressInline
          data={{
            id: agentProgress.id,
            status: agentProgress.status,
            thinking: agentProgress.thinking,
            toolCalls: agentProgress.toolCalls,
            response: agentProgress.response,
            startedAt: agentProgress.startedAt,
            completedAt: agentProgress.completedAt,
            error: agentProgress.error,
            iteration: agentProgress.iteration,
            maxIterations: agentProgress.maxIterations
          }}
          isActive={true}
        />
      )}

      {/* Typing indicator */}
      {currentMessage && (
        <div className="flex items-start gap-3 animate-fade-in">
          <Avatar
            variant="ai"
            size="md"
            icon={<Sparkles className="w-4 h-4" />}
          />

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-white">Evelyn</span>
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 bg-orange rounded-full animate-typing-bounce" />
                <div className="w-2 h-2 bg-orange rounded-full animate-typing-bounce" style={{ animationDelay: '0.2s' }} />
                <div className="w-2 h-2 bg-orange rounded-full animate-typing-bounce" style={{ animationDelay: '0.4s' }} />
              </span>
            </div>

            <div className="px-4 py-3 bg-surface-2 border border-white/10 rounded-lg rounded-tr-sm">
              <div className="text-zinc-200 text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
                <MarkdownRenderer content={currentMessage} />
                <span className="inline-block w-0.5 h-4 bg-orange ml-0.5 rounded-full animate-pulse"></span>
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
