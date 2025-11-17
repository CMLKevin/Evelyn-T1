import { useState, useRef, useEffect } from 'react';
import { useStore } from '../../state/store';
import { Send, ChevronLeft, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function CollaborateChat() {
  const { 
    collaborateState,
    addCollaborateChatMessage 
  } = useStore();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { activeDocument, chatMessages } = collaborateState;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = async () => {
    if (!message.trim() || !activeDocument || isSending) return;

    const userMessage = message.trim();
    setMessage('');
    setIsSending(true);

    // Add user message
    addCollaborateChatMessage('user', userMessage);

    try {
      // Send to backend for Evelyn's response
      const response = await fetch(`http://localhost:3001/api/collaborate/${activeDocument.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage,
          context: {
            content: collaborateState.currentContent,
            contentType: activeDocument.contentType,
            language: activeDocument.language
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        addCollaborateChatMessage('evelyn', data.response);
      } else {
        addCollaborateChatMessage('evelyn', 'Sorry, I encountered an error processing your message.');
      }
    } catch (error) {
      console.error('Chat error:', error);
      addCollaborateChatMessage('evelyn', 'Sorry, I\'m having trouble connecting right now.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isCollapsed) {
    return (
      <div className="w-12 border-l border-terminal-border bg-black/40 flex flex-col items-center py-4">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 hover:bg-terminal-border rounded transition-colors"
          title="Expand chat"
        >
          <ChevronLeft className="w-4 h-4 text-terminal-text" />
        </button>
        <MessageSquare className="w-4 h-4 text-terminal-secondary mt-4" />
      </div>
    );
  }

  return (
    <div className="w-96 border-l border-terminal-border bg-black/40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-terminal-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-terminal-secondary" />
          <h2 className="text-terminal-text font-semibold">Chat with Evelyn</h2>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 hover:bg-terminal-border rounded transition-colors"
          title="Collapse chat"
        >
          <ChevronLeft className="w-4 h-4 text-terminal-text rotate-180" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {!activeDocument ? (
          <div className="text-center text-terminal-secondary text-sm py-8">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Open a document to chat with Evelyn</p>
          </div>
        ) : chatMessages.length === 0 ? (
          <div className="text-center text-terminal-secondary text-sm py-8">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Ask Evelyn about your document</p>
            <p className="text-xs mt-2 opacity-75">
              She has full context of your content
            </p>
          </div>
        ) : (
          chatMessages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col gap-1 ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div className="flex items-center gap-2 text-xs text-terminal-secondary">
                <span className={msg.role === 'evelyn' ? 'text-terminal-secondary' : 'text-terminal-accent'}>
                  {msg.role === 'evelyn' ? 'Evelyn' : 'You'}
                </span>
                <span className="opacity-75">
                  {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
                </span>
              </div>
              <div
                className={`max-w-[85%] px-3 py-2 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-terminal-accent/20 border border-terminal-accent text-terminal-text'
                    : 'bg-terminal-secondary/20 border border-terminal-secondary text-terminal-text'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {activeDocument && (
        <div className="px-4 py-3 border-t border-terminal-border">
          <div className="flex gap-2">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Evelyn anything about this document..."
              disabled={isSending}
              className="flex-1 px-3 py-2 bg-black border border-terminal-border rounded
                       text-terminal-text placeholder-terminal-secondary text-sm
                       focus:outline-none focus:border-terminal-accent resize-none
                       disabled:opacity-50"
              rows={2}
            />
            <button
              onClick={handleSendMessage}
              disabled={!message.trim() || isSending}
              className="px-4 py-2 bg-terminal-accent/20 hover:bg-terminal-accent/30 
                       border border-terminal-accent rounded text-terminal-accent
                       transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center"
            >
              {isSending ? (
                <div className="w-4 h-4 border-2 border-terminal-accent border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-terminal-secondary mt-2 opacity-75">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      )}
    </div>
  );
}
