import { io, Socket } from 'socket.io-client';
import { useStore } from '../state/store';
import { WS_BASE_URL } from '../config';
import { useState, useEffect, useRef } from 'react';

// React hook for WebSocket usage
export function useWebSocket() {
  const [lastMessage, setLastMessage] = useState<any>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (wsClient.socket) {
      socketRef.current = wsClient.socket;
      
      const handleMessage = (data: any) => {
        setLastMessage(data);
      };

      return () => {
        // Cleanup if needed
      };
    }
  }, []);

  const sendMessage = (data: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('message', data);
    }
  };

  return { sendMessage, lastMessage };
}

// ========================================
// Timeout Configuration
// ========================================
const WS_TIMEOUTS = {
  COLLABORATE_CHAT: 180000,    // 3 minutes for chat response
  COLLABORATE_EDIT: 300000,    // 5 minutes for edit operations
  AGENT_TASK: 300000,          // 5 minutes for agent tasks
  DEFAULT: 60000,              // 1 minute default
} as const;

class WSClient {
  public socket: Socket | null = null;
  private url: string = WS_BASE_URL;
  private isConnecting: boolean = false;
  
  // Batching for performance
  private tokenBuffer: string[] = [];
  private tokenBatchTimeout: NodeJS.Timeout | null = null;
  private logBuffer: any[] = [];
  private logBatchTimeout: NodeJS.Timeout | null = null;
  
  // Message deduplication
  private lastSentMessage: string = '';
  private lastSentTime: number = 0;

  // Collaborate chat streaming buffer (separate from main chat)
  private collaborateStreamingMessage: string = '';
  
  // Active timeouts for cleanup
  private activeTimeouts: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Set a timeout for an operation and execute fallback if not cleared
   */
  private setOperationTimeout(
    operationId: string, 
    timeoutMs: number, 
    onTimeout: () => void
  ): void {
    // Clear any existing timeout for this operation
    this.clearOperationTimeout(operationId);
    
    const timeout = setTimeout(() => {
      console.warn(`[WS] Operation timeout: ${operationId} after ${timeoutMs}ms`);
      this.activeTimeouts.delete(operationId);
      onTimeout();
    }, timeoutMs);
    
    this.activeTimeouts.set(operationId, timeout);
  }

  /**
   * Clear a timeout for an operation (call when operation completes)
   */
  clearOperationTimeout(operationId: string): void {
    const timeout = this.activeTimeouts.get(operationId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeTimeouts.delete(operationId);
    }
  }

  connect() {
    // Prevent duplicate connections - check if already connected or connecting
    if (this.socket?.connected) {
      console.log('[WS] Already connected, skipping duplicate connection');
      return;
    }
    
    if (this.isConnecting) {
      console.log('[WS] Connection in progress, skipping duplicate connection');
      return;
    }

    this.isConnecting = true;
    console.log('[WS] Initiating connection...');
    
    // If socket exists but is not connected, clean it up first
    if (this.socket) {
      console.log('[WS] Cleaning up existing disconnected socket');
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.socket = io(this.url, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity, // Keep trying indefinitely
      reconnectionDelay: 1000, // Start with 1 second
      reconnectionDelayMax: 60000, // Exponential backoff up to 60 seconds
      randomizationFactor: 0.5, // Add jitter to prevent thundering herd
      timeout: 20000 // Connection timeout
    });

    this.socket.on('connect', () => {
      console.log('Connected to Evelyn server');
      this.isConnecting = false;
      useStore.getState().setConnected(true);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.isConnecting = false;
      useStore.getState().setConnected(false);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WS] Connection error:', error.message);
      this.isConnecting = false;
    });

    // Batch token updates for performance
    this.socket.on('chat:token', (token: string) => {
      // If a collaborate chat is active, stream tokens into a separate buffer
      if (this.collaborateStreamingMessage !== '') {
        this.collaborateStreamingMessage += token;
        return;
      }

      this.tokenBuffer.push(token);
      
      // Clear existing timeout
      if (this.tokenBatchTimeout) {
        clearTimeout(this.tokenBatchTimeout);
      }
      
      // Flush immediately if buffer is large, otherwise debounce
      if (this.tokenBuffer.length >= 10) {
        this.flushTokenBuffer();
      } else {
        this.tokenBatchTimeout = setTimeout(() => this.flushTokenBuffer(), 16); // ~60fps
      }
    });

    this.socket.on('chat:split', () => {
      // Flush tokens and create a visual split (new message bubble)
      this.flushTokenBuffer();
      useStore.getState().splitMessage();
    });

    this.socket.on('chat:complete', () => {
      // Flush any remaining tokens before completing
      this.flushTokenBuffer();
      useStore.getState().finalizeMessages();
    });

    this.socket.on('chat:message:saved', (message: any) => {
      // Replace temporary messages with actual saved messages from database
      useStore.getState().replaceTempMessage(message);
    });

    this.socket.on('chat:error', (data: { error: string }) => {
      useStore.getState().setError(data.error);
    });

    this.socket.on('subroutine:status', (data: any) => {
      console.log('[WS] subroutine:status received:', data);
      useStore.getState().updateActivity(data);
    });

    this.socket.on('search:results', (data: any) => {
      console.log('[WS] Search results received:', data);
      useStore.getState().addSearchResult({
        ...data,
        timestamp: new Date().toISOString()
      });
    });

    this.socket.on('dream:status', (data: any) => {
      useStore.getState().updateDreamStatus(data);
    });

    this.socket.on('dream:message', (data: { content: string }) => {
      useStore.getState().addMessage({
        id: Date.now(),
        role: 'assistant',
        content: data.content,
        createdAt: new Date().toISOString()
      });
    });

    this.socket.on('context:usage', (data: any) => {
      useStore.getState().updateContextUsage(data);
    });

    this.socket.on('context:snapshot', (data: any) => {
      console.log('[WS] Context snapshot received:', data);
      useStore.getState().setContextSnapshot(data);
    });

    // Reflection events
    this.socket.on('reflection:start', (data: any) => {
      console.log('[WS] Reflection started:', data);
      useStore.getState().addReflectionEvent({
        type: 'start',
        ...data
      });
    });

    this.socket.on('reflection:complete', (data: any) => {
      console.log('[WS] Reflection complete:', data);
      useStore.getState().addReflectionEvent({
        type: 'complete',
        ...data
      });
    });

    this.socket.on('belief:created', (data: any) => {
      console.log('[WS] New belief created:', data);
      useStore.getState().addBeliefEvent(data);
    });

    this.socket.on('goal:created', (data: any) => {
      console.log('[WS] New goal created:', data);
      useStore.getState().addGoalEvent(data);
    });

    // Agentic browsing events
    this.socket.on('agent:request-approval', (data: any) => {
      console.log('[WS] Agent requesting approval:', data);
      useStore.getState().setAgentApprovalRequest(data);
    });

    this.socket.on('agent:status', (data: any) => {
      console.log('[WS] Agent status:', data);
      useStore.getState().updateAgentStatus(data);
    });

    this.socket.on('agent:page', (data: any) => {
      console.log('[WS] Agent page visit:', data);
      useStore.getState().addAgentPage(data);
    });

    this.socket.on('agent:complete', (data: any) => {
      console.log('[WS] Agent session complete:', data);
      useStore.getState().completeAgentSession(data);
    });

    this.socket.on('agent:browsing-results', (data: any) => {
      console.log('[WS] Agent browsing results:', data);
      useStore.getState().addBrowsingResult(data);
    });

    this.socket.on('agent:error', (data: any) => {
      console.error('[WS] Agent error:', data);
      useStore.getState().setAgentError(data);
    });

    // ========================================
    // COLLABORATE FEATURE EVENTS
    // ========================================

    // Streaming events for collaborate chat (mapped from orchestrator when source === 'collaborate')
    this.socket.on('collaborate:token', (token: string) => {
      // Accumulate collaborate response tokens; UI will render only the final message for now
      this.collaborateStreamingMessage += token;
    });

    this.socket.on('collaborate:split', () => {
      // Preserve split markers as paragraph breaks in the final message
      this.collaborateStreamingMessage += '\n\n';
    });

    this.socket.on('collaborate:complete', () => {
      // Clear any pending timeout
      this.clearOperationTimeout('collaborate_chat');
      
      if (this.collaborateStreamingMessage.trim()) {
        useStore.getState().addCollaborateChatMessage('evelyn', this.collaborateStreamingMessage.trim());
      }
      this.collaborateStreamingMessage = '';
    });
    
    this.socket.on('collaborate:error', (data: any) => {
      // Clear any pending timeout
      this.clearOperationTimeout('collaborate_chat');
      this.clearOperationTimeout('collaborate_agent_task');
      
      console.error('[WS] Collaborate error:', data);
      useStore.getState().addCollaborateChatMessage('evelyn', 
        `Sorry, I encountered an error: ${data.message || 'Unknown error'}. Please try again.`
      );
    });

    this.socket.on('collaborate:user_message_logged', (message: any) => {
      const store = useStore.getState();
      store.addMessage({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
        auxiliary: message.auxiliary
      });
    });

    this.socket.on('collaborate:message:saved', (message: any) => {
      const store = useStore.getState();
      store.addMessage({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
        auxiliary: message.auxiliary
      });

      let auxiliary: any = null;
      if (message.auxiliary) {
        try {
          auxiliary = typeof message.auxiliary === 'string' ? JSON.parse(message.auxiliary) : message.auxiliary;
        } catch (parseError) {
          console.error('[WS] Failed to parse collaborate message auxiliary:', parseError);
        }
      }

      if (auxiliary?.autoEditSummary) {
        const { collaborateState } = store;
        if (collaborateState.activeDocument?.id === auxiliary.documentId) {
          store.addCollaborateChatMessage('evelyn', message.content, {
            id: message.id,
            timestamp: message.createdAt
          });
        }
      }
    });

    this.socket.on('collaborate:document_created', (data: any) => {
      console.log('[WS] Collaborate document created:', data);
      const { collaborateState } = useStore.getState();
      // Reload documents list if needed
      if (collaborateState.documentList.length > 0) {
        useStore.getState().loadCollaborateDocuments();
      }
    });

    this.socket.on('collaborate:content_changed', (data: any) => {
      console.log('[WS] Collaborate content changed:', data);
      const { collaborateState } = useStore.getState();
      if (collaborateState.activeDocument?.id === data.documentId && data.author !== 'user') {
        // Update content from Evelyn's edit
        useStore.getState().updateDocumentContent(data.content);
      }
    });

    this.socket.on('collaborate:task_status', (data: any) => {
      console.log('[WS] Collaborate task status:', data);
      const store = useStore.getState();
      const { collaborateState } = store;

      // Only track tasks for the currently active document
      if (!collaborateState.activeDocument || collaborateState.activeDocument.id !== data.documentId) {
        return;
      }

      const prev = collaborateState.agentTask;
      const isSameTask = prev && prev.taskId === data.taskId;
      const startedAt = isSameTask ? prev.startedAt : (data.timestamp || new Date().toISOString());
      const completedStatuses = ['complete', 'error'];
      const completedAt = completedStatuses.includes(data.status)
        ? (data.timestamp || new Date().toISOString())
        : prev?.completedAt;

      // Clear timeout when task completes or errors
      if (completedStatuses.includes(data.status)) {
        this.clearOperationTimeout('collaborate_agent_task');
      }

      const originMessageIndex =
        typeof data.originMessageIndex === 'number'
          ? data.originMessageIndex
          : prev?.originMessageIndex ?? null;

      store.setCollaborateAgentTask({
        taskId: data.taskId,
        kind: data.kind || prev?.kind || 'custom',
        status: data.status,
        startedAt,
        completedAt,
        steps: data.steps || prev?.steps || [],
        currentStepId: data.currentStepId ?? prev?.currentStepId ?? null,
        error: data.error || null,
        originMessageIndex
      });

      if (data.version) {
        const deduped = collaborateState.versionHistory.filter(v => v.id !== data.version.id);
        store.setVersionHistory([data.version, ...deduped]);
      }

      if (completedStatuses.includes(data.status) && collaborateState.activeDocument?.id === data.documentId) {
        store.setCollaborateIntentDetection(null);
      }
    });

    this.socket.on('collaborate:suggestion_generated', (data: any) => {
      console.log('[WS] Collaborate suggestion generated:', data);
      const { collaborateState } = useStore.getState();
      if (collaborateState.activeDocument?.id === data.documentId) {
        useStore.getState().addSuggestion(data.suggestion);
      }
    });

    this.socket.on('collaborate:suggestions_ready', (data: any) => {
      console.log('[WS] Collaborate suggestions ready:', data);
      const { collaborateState } = useStore.getState();
      if (collaborateState.activeDocument?.id === data.documentId) {
        useStore.getState().setSuggestions(data.suggestions);
      }
      useStore.getState().setCollaborateGeneratingStatus(false);
    });

    this.socket.on('collaborate:suggestion_applied', (data: any) => {
      console.log('[WS] Collaborate suggestion applied:', data);
      const { collaborateState } = useStore.getState();
      if (collaborateState.activeDocument?.id === data.documentId) {
        // Update suggestion status
        useStore.getState().setSuggestions(
          collaborateState.currentSuggestions.map(s => 
            s.id === data.suggestionId ? { ...s, status: 'applied' as const } : s
          )
        );
      }
    });

    this.socket.on('collaborate:version_saved', (data: any) => {
      console.log('[WS] Collaborate version saved:', data);
      useStore.getState().loadVersionHistory();
      useStore.getState().setSavingStatus(false);
    });

    this.socket.on('collaborate:evelyn_editing', (data: any) => {
      console.log('[WS] Evelyn is editing:', data);
      useStore.getState().setCollaborateGeneratingStatus(true, data.shortcutType);
      useStore.getState().setEditMode('evelyn');
    });

    this.socket.on('collaborate:evelyn_typing', (data: any) => {
      console.log('[WS] Evelyn is typing:', data);
      useStore.getState().setEditMode('evelyn');
    });

    this.socket.on('collaborate:analysis_complete', (data: any) => {
      console.log('[WS] Collaborate analysis complete:', data);
      useStore.getState().setCollaborateGeneratingStatus(false);
      useStore.getState().setEditMode('user');
    });

    this.socket.on('collaborate:shortcut_complete', (data: any) => {
      console.log('[WS] Collaborate shortcut complete:', data);
      const { collaborateState } = useStore.getState();
      if (collaborateState.activeDocument?.id === data.documentId) {
        useStore.getState().updateDocumentContent(data.result.content || data.result);
      }
      useStore.getState().setCollaborateGeneratingStatus(false);
      useStore.getState().setEditMode('user');
    });

    this.socket.on('collaborate:error', (data: any) => {
      console.error('[WS] Collaborate error:', data);
      const message = data?.message || 'Collaborate action failed';
      const store = useStore.getState();
      store.setError(message);
      store.setCollaborateGeneratingStatus(false);
      store.setEditMode('user');
      this.collaborateStreamingMessage = '';
      const activeDocId = store.collaborateState.activeDocument?.id;
      if (!data?.documentId || data.documentId === activeDocId) {
        store.setCollaborateIntentDetection(null);
      }
    });

    this.socket.on('collaborate:intent_detected', (data: any) => {
      const store = useStore.getState();
      const { collaborateState } = store;
      if (collaborateState.activeDocument?.id !== data.documentId) {
        return;
      }

      store.setCollaborateIntentDetection({
        intent: data.intent,
        action: data.action,
        confidence: data.confidence,
        instruction: data.instruction,
        autoRunTriggered: !!data.autoRunTriggered,
        detectedAt: data.detectedAt || new Date().toISOString(),
        originMessageIndex: typeof data.originMessageIndex === 'number' ? data.originMessageIndex : null
      });
    });

    // Event logging for debugging (optional - can be enabled/disabled)
    if (process.env.NODE_ENV === 'development') {
      const logEvent = (eventName: string, data: any) => {
        console.log(`[WS Event] ${eventName}:`, {
          timestamp: new Date().toISOString(),
          data
        });
      };

      // Log all WebSocket events for debugging
      this.socket.onAny((eventName, ...args) => {
        if (!eventName.startsWith('logs:')) { // Don't log the frequent log events
          logEvent(eventName, args);
        }
      });
    }

    // Batch log updates for performance
    this.socket.on('logs:line', (data: any) => {
      this.logBuffer.push(data);
      
      // Clear existing timeout
      if (this.logBatchTimeout) {
        clearTimeout(this.logBatchTimeout);
      }
      
      // Flush immediately if buffer is large, otherwise debounce
      if (this.logBuffer.length >= 5) {
        this.flushLogBuffer();
      } else {
        this.logBatchTimeout = setTimeout(() => this.flushLogBuffer(), 50); // 20 updates/sec max
      }
    });
  }

  // Flush batched tokens
  private flushTokenBuffer() {
    if (this.tokenBuffer.length > 0) {
      const combinedTokens = this.tokenBuffer.join('');
      useStore.getState().appendToCurrentMessage(combinedTokens);
      this.tokenBuffer = [];
    }
    if (this.tokenBatchTimeout) {
      clearTimeout(this.tokenBatchTimeout);
      this.tokenBatchTimeout = null;
    }
  }

  // Flush batched logs
  private flushLogBuffer() {
    if (this.logBuffer.length > 0) {
      // Add all logs in batch
      this.logBuffer.forEach(log => {
        useStore.getState().addLogEntry(log);
    });
      this.logBuffer = [];
    }
    if (this.logBatchTimeout) {
      clearTimeout(this.logBatchTimeout);
      this.logBatchTimeout = null;
    }
  }

  disconnect() {
    // Clear any pending timeouts
    if (this.tokenBatchTimeout) {
      clearTimeout(this.tokenBatchTimeout);
      this.tokenBatchTimeout = null;
    }
    if (this.logBatchTimeout) {
      clearTimeout(this.logBatchTimeout);
      this.logBatchTimeout = null;
    }
    
    // Flush any pending batched updates
    this.flushTokenBuffer();
    this.flushLogBuffer();
    
    // Clear buffers to prevent memory leaks
    this.tokenBuffer = [];
    this.logBuffer = [];
    
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnecting = false;
  }

  sendMessage(content: string, privacy?: string) {
    if (!this.socket?.connected) {
      throw new Error('Not connected to server');
    }
    
    // Prevent duplicate messages within 1 second window
    const now = Date.now();
    if (content === this.lastSentMessage && now - this.lastSentTime < 1000) {
      console.warn('[WS] Duplicate message detected and prevented:', content.slice(0, 50));
      return;
    }
    
    // Update deduplication tracking
    this.lastSentMessage = content;
    this.lastSentTime = now;
    
    console.log('[WS] Sending message:', content.slice(0, 50) + '...');
    this.socket.emit('chat:send', { content, privacy });
  }

  subscribeDiagnostics() {
    this.socket?.emit('diagnostics:subscribe');
  }

  unsubscribeDiagnostics() {
    this.socket?.emit('diagnostics:unsubscribe');
  }

  startDream() {
    this.socket?.emit('dream:start');
  }

  cancelDream() {
    this.socket?.emit('dream:cancel');
  }

  // Agentic browsing methods
  startAgentSession(query: string, maxPages?: number, maxDurationMs?: number, userMessageId?: number) {
    if (!this.socket?.connected) {
      throw new Error('Not connected to server');
    }
    this.socket.emit('agent:start', { query, maxPages, maxDurationMs, userMessageId });
  }

  approveAgentSession(sessionId: string) {
    if (!this.socket?.connected) {
      throw new Error('Not connected to server');
    }
    this.socket.emit('agent:approve', { sessionId });
  }

  cancelAgentSession(sessionId: string) {
    if (!this.socket?.connected) {
      throw new Error('Not connected to server');
    }
    this.socket.emit('agent:cancel', { sessionId });
  }

  // Logs methods
  subscribeLogs() {
    this.socket?.emit('logs:subscribe');
  }

  unsubscribeLogs() {
    this.socket?.emit('logs:unsubscribe');
  }

  // ========================================
  // COLLABORATE FEATURE METHODS
  // ========================================

  sendCollaborateChat(
    documentId: number,
    userMessage: string,
    title: string,
    documentContent: string,
    contentType: 'text' | 'code' | 'mixed',
    language: string | null,
    intent?: string,
    messageIndex?: number
  ) {
    if (!this.socket?.connected) {
      throw new Error('Not connected to server');
    }
    // Reset any previous streaming buffer for collaborate chat
    this.collaborateStreamingMessage = '';

    // Set timeout for this operation
    this.setOperationTimeout('collaborate_chat', WS_TIMEOUTS.COLLABORATE_CHAT, () => {
      useStore.getState().addCollaborateChatMessage('evelyn', 
        'Sorry, the response is taking too long. Please try again or check your connection.'
      );
    });

    this.socket.emit('collaborate:chat', {
      documentId,
      message: intent ? `${intent}\n\n${userMessage}` : userMessage,
      document: {
        title,
        content: documentContent,
        contentType,
        language
      },
      intent,
      messageIndex
    });
  }

  createCollaborateDocument(title: string, contentType: 'text' | 'code' | 'mixed', language?: string, initialContent?: string) {
    if (!this.socket?.connected) {
      throw new Error('Not connected to server');
    }
    this.socket.emit('collaborate:create', { title, contentType, language, initialContent });
  }

  editCollaborateDocument(documentId: number, content: string, author: string, editType?: string, position?: any) {
    if (!this.socket?.connected) {
      throw new Error('Not connected to server');
    }
    this.socket.emit('collaborate:edit', { documentId, content, author, editType, position });
  }

  requestCollaborateSuggestions(documentId: number, content: string, category: 'writing' | 'code', selection?: any) {
    if (!this.socket?.connected) {
      throw new Error('Not connected to server');
    }
    this.socket.emit('collaborate:request_suggestions', { documentId, content, category, selection });
  }

  applyCollaborateSuggestion(documentId: number, suggestionId: number) {
    if (!this.socket?.connected) {
      throw new Error('Not connected to server');
    }
    this.socket.emit('collaborate:apply_suggestion', { documentId, suggestionId });
  }

  saveCollaborateVersion(documentId: number, content: string, description?: string, createdBy?: string) {
    if (!this.socket?.connected) {
      throw new Error('Not connected to server');
    }
    this.socket.emit('collaborate:save_version', { 
      documentId, 
      content, 
      description, 
      createdBy: createdBy || 'user' 
    });
  }

  collaborateTyping(documentId: number, author: string) {
    if (!this.socket?.connected) {
      return;
    }
    this.socket.emit('collaborate:typing', { documentId, author });
  }

  applyCollaborateShortcut(documentId: number, shortcutType: string, content: string, options?: any) {
    if (!this.socket?.connected) {
      throw new Error('Not connected to server');
    }
    this.socket.emit('collaborate:shortcut', { documentId, shortcutType, content, options });
  }

  analyzeCollaborateContent(documentId: number, content: string, contentType: string) {
    if (!this.socket?.connected) {
      throw new Error('Not connected to server');
    }
    this.socket.emit('collaborate:analyze', { documentId, content, contentType });
  }

  runCollaborateAgentTask(
    documentId: number,
    instruction: string,
    content: string,
    contentType: 'text' | 'code' | 'mixed',
    language: string | null,
    originMessageIndex?: number | null
  ) {
    if (!this.socket?.connected) {
      throw new Error('Not connected to server');
    }
    
    // Set timeout for agent task
    this.setOperationTimeout('collaborate_agent_task', WS_TIMEOUTS.AGENT_TASK, () => {
      const store = useStore.getState();
      store.setCollaborateAgentTask({
        taskId: 'timeout',
        kind: 'custom',
        status: 'error',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        steps: [],
        currentStepId: null,
        error: 'Task timed out. The operation took too long to complete.',
        originMessageIndex: originMessageIndex ?? undefined
      });
    });
    
    this.socket.emit('collaborate:run_agent_task', {
      documentId,
      instruction,
      content,
      contentType,
      language,
      originMessageIndex
    });
  }
}


export const wsClient = new WSClient();
