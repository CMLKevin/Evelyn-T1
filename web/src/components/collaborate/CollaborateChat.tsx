import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useStore } from '../../state/store';
import { Send, ChevronLeft, MessageSquare, Sparkles, X, Copy, ThumbsUp, ThumbsDown, ChevronDown, Lightbulb, Check } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { wsClient } from '../../lib/ws';
import AgenticProgress from './AgenticProgress';

export default function CollaborateChat() {
  const { 
    collaborateState,
    addCollaborateChatMessage,
    activities
  } = useStore();
  const setCollaborateIntentDetection = useStore(state => state.setCollaborateIntentDetection);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'up' | 'down'>>({});
  const [isScrollLocked, setIsScrollLocked] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevMessageCountRef = useRef(0);

  const { activeDocument, chatMessages, agenticEditSession } = collaborateState;

  // Smart auto-scroll: only scroll if user is near bottom
  useEffect(() => {
    const isNewMessage = chatMessages.length > prevMessageCountRef.current;
    prevMessageCountRef.current = chatMessages.length;

    if (isNewMessage) {
      if (!isScrollLocked) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else {
        setHasNewMessages(true);
      }
    }
  }, [chatMessages, isScrollLocked]);

  // Detect scroll position for scroll-to-bottom button and scroll lock
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom && chatMessages.length > 0);
      setIsScrollLocked(!isNearBottom);
      if (isNearBottom) {
        setHasNewMessages(false);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [chatMessages.length]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // Escape to collapse chat
      if (e.key === 'Escape' && !isCollapsed) {
        setIsCollapsed(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCollapsed]);

  // Typing indicator with reduced delay (100ms instead of 500ms)
  useEffect(() => {
    if (isSending) {
      const timer = setTimeout(() => setIsTyping(true), 100);
      return () => clearTimeout(timer);
    } else {
      setIsTyping(false);
    }
  }, [isSending]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCopyMessage = (content: string, messageId: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleFeedback = (messageId: string, rating: 'up' | 'down') => {
    // Prevent duplicate feedback
    if (feedbackGiven[messageId]) return;

    setFeedbackGiven(prev => ({ ...prev, [messageId]: rating }));
    // Could send to server here via wsClient.sendFeedback(messageId, rating)
    console.log(`[CollaborateChat] Feedback for message ${messageId}: ${rating}`);
  };

  const handleQuickAction = (prompt: string) => {
    setMessage(prompt);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleRunAgentTask = () => {
    if (!activeDocument) return;

    const instruction = message.trim() || 'Please analyze and improve this document.';
    const originMessageIndex =
      collaborateState.chatMessages.length > 0
        ? collaborateState.chatMessages.length - 1
        : null;

    wsClient.runCollaborateAgentTask(
      activeDocument.id,
      instruction,
      collaborateState.currentContent,
      activeDocument.contentType,
      activeDocument.language ?? null,
      originMessageIndex
    );
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !activeDocument || isSending) return;

    const userMessage = message.trim();
    setMessage('');
    setIsSending(true);

    // Add user message locally
    const nextMessageIndex = collaborateState.chatMessages.length;
    addCollaborateChatMessage('user', userMessage);

    try {
      // Route collaborate chat through WebSocket orchestrator pipeline
      wsClient.sendCollaborateChat(
        activeDocument.id,
        userMessage,
        activeDocument.title,
        collaborateState.currentContent,
        activeDocument.contentType,
        activeDocument.language ?? null,
        undefined, // intent placeholder
        nextMessageIndex
      );
    } catch (error) {
      console.error('Collaborate chat error:', error);
      addCollaborateChatMessage('evelyn', 'Sorry, I\'m having trouble connecting right now.');
    } finally {
      // For now, we only track send state here; Evelyn's actual response is appended via WS events
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isCollapsed) {
    return (
      <div className="w-14 border-l-2 border-white/20 bg-terminal-black flex flex-col items-center py-6">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2.5 hover:bg-terminal-800 border border-white/20 hover:border-white/30 transition-colors duration-150 group"
          title="Expand chat"
        >
          <ChevronLeft className="w-4 h-4 text-terminal-400 group-hover:text-white transition-colors" />
        </button>
        <div className="mt-6 relative">
          <MessageSquare className="w-5 h-5 text-zinc-600" />
          {chatMessages.length > 0 && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange animate-pulse" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 border-l-2 border-white/20 bg-terminal-black flex flex-col relative">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-5 py-4 border-b-2 border-white/20 bg-terminal-dark">
        <div className="flex items-center gap-3">
          <div className="bg-orange/20 p-2 border-2 border-orange">
            <Sparkles className="w-4 h-4 text-orange" />
          </div>
          <div>
            <h2 className="text-white font-mono font-bold uppercase text-base tracking-wide">Evelyn</h2>
            <p className="text-xs text-terminal-500 font-mono">AI Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeDocument && (
            <button
              onClick={handleRunAgentTask}
              className="px-3 py-1.5 text-xs bg-orange/10 border-2 border-orange text-orange hover:bg-orange/20 hover:border-orange transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed font-mono font-medium uppercase"
              disabled={agenticEditSession.isActive || ['planning', 'executing', 'verifying'].includes(agenticEditSession.phase)}
            >
              Let Evelyn Edit
            </button>
          )}
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-2 hover:bg-terminal-800 border border-white/20 hover:border-white/30 transition-colors duration-150 group"
            title="Collapse chat"
          >
            <ChevronLeft className="w-4 h-4 text-zinc-400 group-hover:text-white rotate-180 transition-colors" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-5 py-6 space-y-6 terminal-scrollbar relative">
        {/* Agentic Code Editor Progress - single unified progress display */}
        {activeDocument && <AgenticProgress />}

        {activeDocument && collaborateState.lastIntentDetection && (
          <div className="mb-4 animate-fade-in-down">
            <div className="px-4 py-3 bg-cyan-500/5 border-2 border-cyan-500">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs font-medium uppercase tracking-wider text-blue-300">
                      {collaborateState.lastIntentDetection.intent.replace(/_/g, ' ')}
                    </span>
                    <span className="px-2 py-0.5 bg-cyan-500/10 border border-cyan-500 text-cyan-500 text-[10px] font-mono font-medium">
                      {Math.round(collaborateState.lastIntentDetection.confidence * 100)}%
                    </span>
                  </div>
                  {collaborateState.lastIntentDetection.instruction && (
                    <p className="text-sm text-white/90">
                      {collaborateState.lastIntentDetection.instruction}
                    </p>
                  )}
                  <p className="text-xs text-zinc-400">
                    {collaborateState.lastIntentDetection.autoRunTriggered
                      ? '✨ Evelyn automatically started working on this.'
                      : '💬 Staying in chat mode for your control.'}
                  </p>
                </div>
                <button
                  onClick={() => setCollaborateIntentDetection(null)}
                  className="p-1 hover:bg-terminal-800 border border-white/20 hover:border-white/30 transition-colors duration-150 group"
                >
                  <X className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
                </button>
              </div>
            </div>
          </div>
        )}

        {!activeDocument ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="mb-4">
              <div className="bg-terminal-900 p-6 border-2 border-white/20">
                <MessageSquare className="w-10 h-10 text-terminal-500" />
              </div>
            </div>
            <h3 className="text-white font-medium text-base mb-2">No Document Open</h3>
            <p className="text-zinc-500 text-sm">Open a document to start chatting with Evelyn</p>
          </div>
        ) : chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="mb-4">
              <div className="bg-orange/10 p-6 border-2 border-orange">
                <Sparkles className="w-10 h-10 text-orange" />
              </div>
            </div>
            <h3 className="text-white font-medium text-base mb-2">Ready to Help</h3>
            <p className="text-zinc-400 text-sm mb-4">
              Ask Evelyn anything about your document
            </p>
            
            {/* Quick Action Suggestions */}
            <div className="flex flex-col gap-2 w-full max-w-xs mt-4">
              <p className="text-xs text-zinc-600 mb-1 flex items-center gap-1 justify-center">
                <Lightbulb className="w-3 h-3" />
                Try asking:
              </p>
              {[
                'Summarize this document',
                'Check for grammar errors',
                'Improve the writing style',
                'Add more examples'
              ].map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickAction(prompt)}
                  className="px-4 py-2.5 bg-terminal-900 border border-white/20 text-terminal-300 text-sm hover:bg-terminal-800 hover:border-orange transition-colors duration-150 text-left group font-mono"
                >
                  <span className="group-hover:text-white transition-colors">{prompt}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          chatMessages.map((msg, idx) => (
            <div
              key={msg.id ?? msg.messageIndex ?? idx}
              className={`flex flex-col gap-2 animate-fade-in-up group/message ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div className="flex items-center gap-2">
                {msg.role === 'evelyn' && (
                  <div className="w-6 h-6 bg-orange/20 border-2 border-orange flex items-center justify-center">
                    <Sparkles className="w-3 h-3 text-orange" />
                  </div>
                )}
                <span className={`text-xs font-mono font-medium ${
                  msg.role === 'evelyn' ? 'text-orange' : 'text-cyan-500'
                }`}>
                  {msg.role === 'evelyn' ? 'Evelyn' : 'You'}
                </span>
                <span 
                  className="text-xs text-zinc-600 cursor-help" 
                  title={format(new Date(msg.timestamp), 'PPpp')}
                >
                  {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
                </span>
              </div>
              <div className="flex items-start gap-2 w-full max-w-[85%]">
                <div
                  className={`flex-1 px-4 py-3 border-2 transition-colors duration-150 ${
                    msg.role === 'user'
                      ? 'bg-cyan-500/20 border-cyan-500 text-white'
                      : 'bg-[#0f0f0f] border-white/30 text-white group-hover/message:border-white/40'
                  }`}
                >
                  <p className="text-sm font-semibold leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
                {/* Message Actions */}
                {msg.role === 'evelyn' && (
                  <div className="flex flex-col gap-1 opacity-0 group-hover/message:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => handleCopyMessage(msg.content, String(msg.id ?? msg.messageIndex ?? idx))}
                      className="p-1.5 bg-terminal-900 hover:bg-terminal-800 border border-white/20 hover:border-white/30 transition-colors duration-150 group/btn"
                      title="Copy message"
                    >
                      {copiedMessageId === String(msg.id ?? msg.messageIndex ?? idx) ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-zinc-400 group-hover/btn:text-white transition-colors" />
                      )}
                    </button>
                    <button
                      onClick={() => handleFeedback(String(msg.id ?? msg.messageIndex ?? idx), 'up')}
                      className={`p-1.5 border transition-colors duration-150 group/btn ${
                        feedbackGiven[String(msg.id ?? msg.messageIndex ?? idx)] === 'up'
                          ? 'bg-emerald-500/20 border-emerald-500'
                          : 'bg-terminal-900 hover:bg-terminal-800 border-white/20 hover:border-green-500'
                      }`}
                      title="Good response"
                      disabled={!!feedbackGiven[String(msg.id ?? msg.messageIndex ?? idx)]}
                    >
                      <ThumbsUp className={`w-3.5 h-3.5 transition-colors ${
                        feedbackGiven[String(msg.id ?? msg.messageIndex ?? idx)] === 'up'
                          ? 'text-emerald-400'
                          : 'text-zinc-400 group-hover/btn:text-emerald-400'
                      }`} />
                    </button>
                    <button
                      onClick={() => handleFeedback(String(msg.id ?? msg.messageIndex ?? idx), 'down')}
                      className={`p-1.5 border transition-colors duration-150 group/btn ${
                        feedbackGiven[String(msg.id ?? msg.messageIndex ?? idx)] === 'down'
                          ? 'bg-red-500/20 border-red-500'
                          : 'bg-terminal-900 hover:bg-terminal-800 border-white/20 hover:border-red-500'
                      }`}
                      title="Bad response"
                      disabled={!!feedbackGiven[String(msg.id ?? msg.messageIndex ?? idx)]}
                    >
                      <ThumbsDown className={`w-3.5 h-3.5 transition-colors ${
                        feedbackGiven[String(msg.id ?? msg.messageIndex ?? idx)] === 'down'
                          ? 'text-red-400'
                          : 'text-zinc-400 group-hover/btn:text-red-400'
                      }`} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        
        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex items-start gap-2 animate-fade-in-up">
            <div className="w-6 h-6 bg-orange/20 border-2 border-orange flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-orange" />
            </div>
            <div className="px-4 py-3 bg-terminal-900 border-2 border-white/20">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-orange animate-typing-bounce" />
                <div className="w-2 h-2 bg-orange animate-typing-bounce" style={{ animationDelay: '0.2s' }} />
                <div className="w-2 h-2 bg-orange animate-typing-bounce" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
        
        {/* New Messages Indicator */}
        {hasNewMessages && isScrollLocked && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-orange/90 px-3 py-1.5 text-xs font-mono text-white z-10 animate-fade-in-up flex items-center gap-2">
            <span>New messages below</span>
            <ChevronDown className="w-3 h-3" />
          </div>
        )}

        {/* Scroll to Bottom Button */}
        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className="fixed bottom-24 right-8 p-3 bg-orange hover:bg-orange-dark border-2 border-orange transition-colors duration-150 z-10 animate-fade-in-up"
            title="Scroll to bottom"
          >
            <ChevronDown className="w-5 h-5 text-white" />
          </button>
        )}
      </div>

      {/* Input */}
      {activeDocument && (
        <div className="px-5 py-4 border-t-2 border-white/20 bg-terminal-dark">
          <div className="flex gap-3">
            <div className="flex-1 relative group">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Evelyn..."
                disabled={isSending}
                className={`w-full px-4 py-3 bg-terminal-black border-2
                         text-white placeholder-terminal-500 text-sm font-mono
                         focus:outline-none focus:border-orange
                         resize-none transition-colors duration-150
                         disabled:opacity-50 disabled:cursor-not-allowed
                         ${isSending ? 'border-orange animate-pulse' : 'border-white/20 group-hover:border-white/30'}`}
                rows={2}
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!message.trim() || isSending}
              className="px-4 py-3 bg-orange hover:bg-orange-dark
                       border-2 border-orange text-white font-mono font-bold uppercase
                       transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center"
            >
              {isSending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-zinc-600">
              <kbd className="px-2 py-0.5 bg-terminal-900 border border-white/20 text-terminal-400 font-mono text-[10px]">Enter</kbd>
              {' '}to send · 
              <kbd className="px-2 py-0.5 bg-terminal-900 border border-white/20 text-terminal-400 font-mono text-[10px]">Shift</kbd>
              {' + '}
              <kbd className="px-2 py-0.5 bg-terminal-900 border border-white/20 text-terminal-400 font-mono text-[10px]">Enter</kbd>
              {' '}for new line
            </p>
            {message.trim() && (
              <span className="text-xs text-zinc-600">{message.trim().length} characters</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
