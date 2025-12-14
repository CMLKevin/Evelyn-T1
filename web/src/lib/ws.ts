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

  // Note: Collaborate streaming buffer moved to store for visibility and reliability
  // Use store.appendStreamingMessage(), store.completeStreaming(), etc.

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

    // DEBUG: Log ALL incoming events to diagnose agentic event issues
    this.socket.onAny((eventName: string, ...args: any[]) => {
      if (eventName.startsWith('agentic:')) {
        console.log(`[WS] 🔴 RECEIVED agentic event: ${eventName}`, args[0]?.editId || args[0]);
      }
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
      // If a collaborate chat is active, stream tokens into the store
      const store = useStore.getState();
      if (store.collaborateState.isStreaming) {
        store.appendStreamingMessage(token);
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

    // ========================================
    // AGENTIC CODE EDITOR EVENTS
    // ========================================

    this.socket.on('agentic:start', (data: any) => {
      console.log('[WS] 🚀 Agentic edit started:', data);
      console.log('[WS] 🚀 Setting isActive: true, goal:', data.goal);
      const store = useStore.getState();
      // Initialize or update the agentic edit state
      store.setAgenticEditSession({
        editId: data.editId,
        documentId: data.documentId,
        goal: data.goal,
        approach: data.approach,
        estimatedSteps: data.estimatedSteps,
        phase: 'executing',
        progress: 0,
        currentStep: 0,
        iterations: [],
        startTime: data.timestamp,
        isActive: true,
      });
      console.log('[WS] 🚀 Session state set, checking store:', store.collaborateState.agenticEditSession.isActive);
    });

    this.socket.on('agentic:progress', (data: any) => {
      console.log('[WS] 📊 Agentic progress:', data.phase, data.progress + '%');
      const store = useStore.getState();
      store.updateAgenticEditProgress({
        phase: data.phase,
        progress: data.progress,
        currentStep: data.currentStep,
        totalSteps: data.totalSteps,
        message: data.message,
        currentSubGoal: data.currentSubGoal,
      });
    });

    this.socket.on('agentic:phase', (data: any) => {
      console.log('[WS] 📍 Agentic phase change:', data.phase);
      const store = useStore.getState();
      store.updateAgenticEditProgress({ phase: data.phase, message: data.message });
    });

    this.socket.on('agentic:thinking', (data: any) => {
      console.log('[WS] 💭 Agentic thinking:', data.think?.slice(0, 80));
      const store = useStore.getState();
      store.updateAgenticEditThinking(data.think, data.structuredThought);
    });

    this.socket.on('agentic:iteration', (data: any) => {
      console.log('[WS] 🔄 Agentic iteration:', data.iteration?.step);
      const store = useStore.getState();
      store.addAgenticEditIteration(data.iteration);
    });

    this.socket.on('agentic:iteration:start', (data: any) => {
      console.log('[WS] ▶️ Agentic iteration start:', data.step);
      const store = useStore.getState();
      store.updateAgenticEditProgress({ currentStep: data.step });
    });

    this.socket.on('agentic:tool:call', (data: any) => {
      console.log('[WS] 🔧 Agentic tool call:', data.toolCall?.tool);
      const store = useStore.getState();
      store.updateAgenticEditToolCall(data.toolCall);
    });

    this.socket.on('agentic:tool:result', (data: any) => {
      console.log('[WS] ✅ Agentic tool result:', data.result?.success);
      const store = useStore.getState();
      store.updateAgenticEditToolResult(data.result);
    });

    this.socket.on('agentic:content', (data: any) => {
      console.log('[WS] 📝 Agentic content change');
      const store = useStore.getState();
      const { collaborateState } = store;
      if (collaborateState.activeDocument?.id === data.documentId) {
        store.updateDocumentContent(data.content);
      }
    });

    this.socket.on('agentic:diff', (data: any) => {
      console.log('[WS] 📊 Agentic diff:', `+${data.linesAdded} -${data.linesRemoved}`);
      const store = useStore.getState();
      store.updateAgenticEditDiff(data);
    });

    this.socket.on('agentic:checkpoint', (data: any) => {
      console.log('[WS] 🔒 Agentic checkpoint:', data.checkpoint?.description);
      const store = useStore.getState();
      store.addAgenticEditCheckpoint(data.checkpoint);
    });

    this.socket.on('agentic:complete', (data: any) => {
      console.log('[WS] ✅ Agentic edit complete:', data.success ? 'SUCCESS' : 'FAILED');
      const store = useStore.getState();
      store.completeAgenticEdit({
        success: data.success,
        summary: data.summary,
        changesCount: data.changesCount,
        iterationsCount: data.iterationsCount,
        duration: data.duration,
      });
    });

    this.socket.on('agentic:error', (data: any) => {
      console.error('[WS] ❌ Agentic edit error:', data.error);
      const store = useStore.getState();
      store.setAgenticEditError(data.error, data.recoverable, data.suggestion);
    });

    this.socket.on('agentic:plan', (data: any) => {
      console.log('[WS] 📋 Agentic plan:', data.plan?.subGoals?.length, 'sub-goals');
      const store = useStore.getState();
      store.setAgenticEditPlan(data.plan);
    });

    this.socket.on('agentic:subgoal', (data: any) => {
      console.log('[WS] 🎯 Agentic sub-goal update:', data.subGoalId, data.status);
      const store = useStore.getState();
      store.updateAgenticSubGoal(data.subGoalId, data.status);
    });

    this.socket.on('agentic:verification', (data: any) => {
      console.log('[WS] 🔍 Agentic verification:', data.verification?.syntaxValid ? 'passed' : 'warnings');
      // Verification data is informational - can be added to store if needed
    });

    this.socket.on('agentic:content:incremental', (data: any) => {
      console.log('[WS] 📝 Agentic incremental change at', data.position);
      // Incremental changes can be used for live typing effect in future
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
      // Accumulate collaborate response tokens in the store for visibility
      useStore.getState().appendStreamingMessage(token);
    });

    this.socket.on('collaborate:split', () => {
      // Preserve split markers as paragraph breaks in the final message
      useStore.getState().appendStreamingMessage('\n\n');
    });

    this.socket.on('collaborate:complete', () => {
      // Clear any pending timeout
      this.clearOperationTimeout('collaborate_chat');

      const store = useStore.getState();
      const message = store.completeStreaming();
      if (message) {
        store.addCollaborateChatMessage('evelyn', message);
      }
    });

    // Server heartbeat - confirms server is still working on the task
    this.socket.on('collaborate:heartbeat', (data: any) => {
      console.log(`[WS] Heartbeat received for task ${data.taskId}, elapsed: ${data.elapsed}ms`);
      // Reset any pending timeout since server is still active
      // This prevents false timeout errors during long operations
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
      console.log('[WS] 💬 Collaborate message saved:', message.id, message.content?.slice(0, 50));
      const store = useStore.getState();
      
      // Add to main messages store for history
      store.addMessage({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
        auxiliary: message.auxiliary
      });

      // ALWAYS add assistant messages to collaborate chat messages
      if (message.role === 'assistant') {
        console.log('[WS] 💬 Adding to collaborate chat:', message.content?.slice(0, 50));
        store.addCollaborateChatMessage('evelyn', message.content, {
          id: message.id,
          timestamp: message.createdAt
        });
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
      store.clearStreaming();
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

    // ========================================
    // ARTIFACT EVENTS
    // ========================================

    this.socket.on('artifact:created', (data: any) => {
      console.log('[WS] 🎨 Artifact created:', data.artifact?.id);
      const store = useStore.getState();
      store.addArtifact(data.artifact);
    });

    this.socket.on('artifact:updated', (data: any) => {
      console.log('[WS] 🎨 Artifact updated:', data.artifact?.id);
      const store = useStore.getState();
      store.updateArtifact(data.artifact.id, data.artifact);
    });

    this.socket.on('artifact:status', (data: any) => {
      console.log('[WS] 🎨 Artifact status:', data.artifactId, data.status);
      const store = useStore.getState();
      store.updateArtifact(data.artifactId, { status: data.status });
    });

    this.socket.on('artifact:status_changed', (data: any) => {
      console.log('[WS] 🎨 Artifact status changed:', data.artifactId, data.status);
      const store = useStore.getState();
      store.updateArtifact(data.artifactId, {
        status: data.status,
        output: data.output,
        error: data.error
      });
    });

    this.socket.on('artifact:ready', (data: any) => {
      console.log('[WS] 🎨 Artifact ready:', data.artifactId);
      const store = useStore.getState();
      store.updateArtifact(data.artifactId, { status: 'idle' });
    });

    this.socket.on('artifact:error', (data: any) => {
      console.error('[WS] 🎨 Artifact error:', data.artifactId, data.error);
      const store = useStore.getState();
      if (data.artifactId) {
        store.updateArtifact(data.artifactId, { 
          status: 'error', 
          error: data.error 
        });
      }
    });

    // File operation events (multi-file artifacts)
    this.socket.on('artifact:file_updated', (data: any) => {
      console.log('[WS] 📝 File updated:', data.path, 'in', data.artifactId);
      const store = useStore.getState();
      const artifact = store.artifacts.find(a => a.id === data.artifactId);
      if (artifact && artifact.files) {
        const updatedFiles = artifact.files.map(f => 
          f.path === data.path ? { ...f, content: data.content } : f
        );
        store.updateArtifact(data.artifactId, { 
          files: updatedFiles,
          version: data.version 
        });
      }
    });

    this.socket.on('artifact:file_added', (data: any) => {
      console.log('[WS] 📄 File added:', data.file?.path, 'to', data.artifactId);
      const store = useStore.getState();
      const artifact = store.artifacts.find(a => a.id === data.artifactId);
      if (artifact) {
        const newFiles = [...(artifact.files || []), data.file];
        store.updateArtifact(data.artifactId, { 
          files: newFiles,
          version: data.version 
        });
      }
    });

    this.socket.on('artifact:file_deleted', (data: any) => {
      console.log('[WS] 🗑️ File deleted:', data.path, 'from', data.artifactId);
      const store = useStore.getState();
      const artifact = store.artifacts.find(a => a.id === data.artifactId);
      if (artifact && artifact.files) {
        const remainingFiles = artifact.files.filter(f => f.path !== data.path);
        store.updateArtifact(data.artifactId, { 
          files: remainingFiles,
          version: data.version 
        });
      }
    });

    // Unified orchestrator events
    this.socket.on('unified:artifact', (data: any) => {
      console.log('[WS] 🎯 Unified artifact:', data.artifact?.id);
      const store = useStore.getState();
      store.addArtifact(data.artifact);
    });

    this.socket.on('unified:response', (data: any) => {
      console.log('[WS] 🎯 Unified response:', data.index + 1, '/', data.total);
      // For unified responses, we treat them similar to chat tokens
      // but as complete message splits
      if (data.isLast) {
        useStore.getState().finalizeMessages();
      }
    });

    this.socket.on('unified:complete', (data: any) => {
      console.log('[WS] 🎯 Unified complete:', data.totalTimeMs, 'ms');
    });

    this.socket.on('unified:error', (data: any) => {
      console.error('[WS] 🎯 Unified error:', data.error);
      useStore.getState().setError(data.error);
    });

    // Tool execution status events
    this.socket.on('tool:status', (data: any) => {
      console.log(`[WS] 🔧 Tool ${data.tool}: ${data.status} - ${data.summary}`);
      // Can be used to show tool execution status in UI
    });

    this.socket.on('tool:browse_result', (data: any) => {
      console.log('[WS] 🌐 Browse result:', data.url);
    });

    this.socket.on('tool:x_search', (data: any) => {
      console.log('[WS] 🐦 X search result:', data.query);
    });

    // ========================================
    // AGENT PROGRESS EVENTS (inline chat display)
    // ========================================

    this.socket.on('agent:start', (data: any) => {
      console.log('[WS] 🤖 Agent started:', data.id);
      useStore.getState().startAgentProgress(data.id || `progress_${Date.now()}`);
    });

    this.socket.on('agent:thinking', (data: any) => {
      console.log('[WS] 💭 Agent thinking:', data.thought?.slice(0, 50));
      useStore.getState().updateAgentThinking(data.thought || '');
    });

    this.socket.on('agent:tool_start', (data: any) => {
      console.log('[WS] 🔧 Tool starting:', data.tool);
      useStore.getState().addAgentToolCall({
        id: data.id || `tool_${Date.now()}`,
        tool: data.tool,
        params: data.params || {},
        status: 'running',
        startedAt: new Date().toISOString()
      });
    });

    this.socket.on('agent:tool_complete', (data: any) => {
      console.log('[WS] ✅ Tool complete:', data.tool, data.status);
      useStore.getState().updateAgentToolCall(data.id, {
        status: data.status === 'error' ? 'error' : 'success',
        result: data.result,
        error: data.error,
        summary: data.summary,
        completedAt: new Date().toISOString(),
        durationMs: data.durationMs
      });
    });

    this.socket.on('agent:responding', (data: any) => {
      console.log('[WS] 💬 Agent responding');
      useStore.getState().setAgentStatus('responding');
    });

    this.socket.on('agent:complete', (data: any) => {
      console.log('[WS] ✨ Agent complete:', data.messageId);
      useStore.getState().completeAgentProgress(data.messageId);
      // Clear progress after a delay to let user see the completed state
      setTimeout(() => {
        useStore.getState().clearAgentProgress();
      }, 2000);
    });

    this.socket.on('agent:error', (data: any) => {
      console.error('[WS] ❌ Agent error:', data.error);
      const store = useStore.getState();
      if (store.agentProgress) {
        store.setAgentStatus('error');
      }
    });

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

    // Get agentic mode from store
    const { agenticMode } = useStore.getState();

    console.log('[WS] Sending message:', content.slice(0, 50) + '...', `(agenticMode: ${agenticMode})`);
    this.socket.emit('chat:send', { content, privacy, agenticMode });
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
    // Start streaming - this resets the buffer and marks streaming as active
    useStore.getState().startStreaming();

    // Set timeout for this operation
    this.setOperationTimeout('collaborate_chat', WS_TIMEOUTS.COLLABORATE_CHAT, () => {
      useStore.getState().addCollaborateChatMessage('evelyn', 
        'Sorry, the response is taking too long. Please try again or check your connection.'
      );
    });

    // Get agentic mode from store
    const { agenticMode } = useStore.getState();

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
      messageIndex,
      agenticMode
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

  /**
   * Cancel an in-progress collaborate task
   */
  cancelCollaborateTask(documentId: number) {
    if (!this.socket?.connected) {
      console.warn('[WS] Cannot cancel task - not connected');
      return;
    }

    console.log(`[WS] Cancelling collaborate task for document ${documentId}`);

    // Clear any pending timeouts for this operation
    this.clearOperationTimeout('collaborate_agent_task');
    this.clearOperationTimeout('collaborate_chat');

    // Emit cancel event to server
    this.socket.emit('collaborate:cancel', { documentId });

    // Update local state immediately for responsive UI
    const store = useStore.getState();
    const currentSession = store.collaborateState.agenticEditSession;
    store.setAgenticEditSession({
      ...currentSession,
      isActive: false,
      phase: 'error',
      error: 'Cancelled by user',
      duration: currentSession.startTime
        ? Date.now() - currentSession.startTime
        : 0
    });
  }
}


export const wsClient = new WSClient();
