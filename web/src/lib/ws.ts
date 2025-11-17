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

      // Listen for canvas-specific messages
      socketRef.current.on('canvas:update', handleMessage);
      socketRef.current.on('canvas:content_change', handleMessage);

      return () => {
        if (socketRef.current) {
          socketRef.current.off('canvas:update', handleMessage);
          socketRef.current.off('canvas:content_change', handleMessage);
        }
      };
    }
  }, []);

  const sendMessage = (data: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('canvas:message', data);
    }
  };

  return { sendMessage, lastMessage };
}

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

    // Code Canvas events
    this.socket.on('canvas:created', (data: any) => {
      console.log('[WS] Canvas created:', data);
      useStore.getState().createCanvasFromSession(data);
    });

    this.socket.on('canvas:file:generated', (data: any) => {
      console.log('[WS] Canvas file generated:', data);
      const { canvasState } = useStore.getState();
      if (canvasState.activeCanvas?.id === data.canvasId) {
        useStore.getState().loadCanvas(data.canvasId);
      }
    });

    this.socket.on('canvas:generation:progress', (data: any) => {
      console.log('[WS] Canvas generation progress:', data);
      useStore.getState().setGeneratingStatus(true, data.progress);
    });

    this.socket.on('canvas:generation:complete', (data: any) => {
      console.log('[WS] Canvas generation complete:', data);
      useStore.getState().setGeneratingStatus(false, null);
      if (data.canvasId) {
        useStore.getState().loadCanvas(data.canvasId);
      }
    });

    this.socket.on('canvas:suggestion:created', (data: any) => {
      console.log('[WS] Canvas suggestion created:', data);
      const { canvasState } = useStore.getState();
      if (canvasState.activeCanvas?.id === data.canvasId) {
        useStore.getState().loadCanvas(data.canvasId);
      }
    });

    this.socket.on('canvas:task:updated', (data: any) => {
      console.log('[WS] Canvas task updated:', data);
      const { canvasState } = useStore.getState();
      if (canvasState.activeCanvas?.id === data.canvasId) {
        useStore.getState().loadCanvas(data.canvasId);
      }
    });

    this.socket.on('canvas:collaboration:created', (data: any) => {
      console.log('[WS] Canvas collaboration created:', data);
      const { canvasState } = useStore.getState();
      if (canvasState.activeCanvas?.id === data.canvasId) {
        useStore.getState().loadCanvas(data.canvasId);
      }
    });

    // File status tracking events
    this.socket.on('canvas:file:generating', (data: any) => {
      console.log('[WS] File generating:', data);
      useStore.getState().updateFileStatus(data.fileId, {
        status: 'generating'
      });
    });

    this.socket.on('canvas:file:updating', (data: any) => {
      console.log('[WS] File updating:', data);
      useStore.getState().updateFileStatus(data.fileId, {
        status: 'updating',
        linesAdded: data.linesAdded,
        linesRemoved: data.linesRemoved
      });
    });

    this.socket.on('canvas:file:complete', (data: any) => {
      console.log('[WS] File complete:', data);
      useStore.getState().updateFileStatus(data.fileId, {
        status: 'complete',
        linesAdded: data.linesAdded,
        linesRemoved: data.linesRemoved
      });
      // Clear status after 30 seconds
      setTimeout(() => {
        useStore.getState().clearFileStatus(data.fileId);
      }, 30000);
    });

    this.socket.on('canvas:file:error', (data: any) => {
      console.log('[WS] File error:', data);
      useStore.getState().updateFileStatus(data.fileId, {
        status: 'error'
      });
    });

    // Subtask phase tracking events
    this.socket.on('subtask:planning', (data: any) => {
      console.log('[WS] Subtask planning:', data);
      window.dispatchEvent(new CustomEvent('subtask:phase:update', {
        detail: { subtaskId: data.subtaskId, phase: 'planning', progress: 10, estimatedTimeMs: data.estimatedTimeMs }
      }));
    });

    this.socket.on('subtask:generating', (data: any) => {
      console.log('[WS] Subtask generating:', data);
      window.dispatchEvent(new CustomEvent('subtask:phase:update', {
        detail: { subtaskId: data.subtaskId, phase: 'generating', progress: 50, estimatedTimeMs: data.estimatedTimeMs }
      }));
    });

    this.socket.on('subtask:applying', (data: any) => {
      console.log('[WS] Subtask applying:', data);
      window.dispatchEvent(new CustomEvent('subtask:phase:update', {
        detail: { subtaskId: data.subtaskId, phase: 'applying', progress: 85, estimatedTimeMs: data.estimatedTimeMs }
      }));
    });

    this.socket.on('subtask:completed', (data: any) => {
      console.log('[WS] Subtask completed:', data);
      window.dispatchEvent(new CustomEvent('subtask:phase:update', {
        detail: { subtaskId: data.subtaskId, phase: 'complete', progress: 100 }
      }));
      const { canvasState } = useStore.getState();
      if (canvasState.activeCanvas?.id === data.canvasId) {
        useStore.getState().loadCanvas(data.canvasId);
      }
    });

    this.socket.on('subtask:failed', (data: any) => {
      console.log('[WS] Subtask failed:', data);
      const { canvasState } = useStore.getState();
      if (canvasState.activeCanvas?.id === data.canvasId) {
        useStore.getState().loadCanvas(data.canvasId);
      }
    });

    this.socket.on('subtask:progress', (data: any) => {
      console.log('[WS] Subtask progress:', data);
      window.dispatchEvent(new CustomEvent('subtask:phase:update', {
        detail: { 
          subtaskId: data.subtaskId, 
          phase: data.phase, 
          progress: data.progress,
          estimatedTimeMs: data.estimatedTimeMs
        }
      }));
    });

    // Suggestion analyzing events
    this.socket.on('suggestion:analyzing', (data: any) => {
      console.log('[WS] Suggestion analyzing:', data);
      window.dispatchEvent(new CustomEvent('suggestion:analyzing', {
        detail: { 
          canvasId: data.canvasId,
          fileCount: data.fileCount,
          progress: data.progress
        }
      }));
    });

    this.socket.on('suggestion:generated', (data: any) => {
      console.log('[WS] Suggestion generated:', data);
      window.dispatchEvent(new CustomEvent('suggestion:generated', {
        detail: { 
          canvasId: data.canvasId,
          suggestion: data.suggestion,
          tier: data.tier,
          confidence: data.confidence
        }
      }));
      const { canvasState } = useStore.getState();
      if (canvasState.activeCanvas?.id === data.canvasId) {
        useStore.getState().loadCanvas(data.canvasId);
      }
    });

    // Generation phase change events
    this.socket.on('generation:phase_change', (data: any) => {
      console.log('[WS] Generation phase change:', data);
      window.dispatchEvent(new CustomEvent('generation:phase_change', {
        detail: { 
          canvasId: data.canvasId,
          phase: data.phase, // 'planning' | 'generating' | 'applying' | 'complete'
          taskId: data.taskId,
          subtaskId: data.subtaskId
        }
      }));
    });

    this.socket.on('generation:progress_update', (data: any) => {
      console.log('[WS] Generation progress update:', data);
      window.dispatchEvent(new CustomEvent('generation:progress_update', {
        detail: { 
          canvasId: data.canvasId,
          taskId: data.taskId,
          subtaskId: data.subtaskId,
          progress: data.progress, // 0-100
          currentOperation: data.currentOperation,
          estimatedTimeRemainingMs: data.estimatedTimeRemainingMs
        }
      }));
    });

    // ========================================
    // COLLABORATE FEATURE EVENTS
    // ========================================

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
      useStore.getState().setError(data.message);
      useStore.getState().setCollaborateGeneratingStatus(false);
      useStore.getState().setEditMode('user');
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
    
    // Get active canvas ID from store
    const activeCanvasId = useStore.getState().canvasState.activeCanvas?.id;
    
    console.log('[WS] Sending message:', content.slice(0, 50) + '...', activeCanvasId ? `with canvas ${activeCanvasId}` : 'without canvas');
    this.socket.emit('chat:send', { content, privacy, activeCanvasId });
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
}

export const wsClient = new WSClient();
