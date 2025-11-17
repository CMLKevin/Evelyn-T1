import { Server, Socket } from 'socket.io';
import { orchestrator } from '../agent/orchestrator.js';
import { browserAgent } from '../agent/browserAgent.js';
import { logger } from '../utils/logger.js';
import { db } from '../db/client.js';
import { v4 as uuidv4 } from 'uuid';
import { 
  analyzeContent, 
  generateSuggestions, 
  applyShortcut,
  makeTargetedEdit
} from '../agent/collaborativeAssistant.js';

export function setupWebSocket(io: Server) {
  // Attach logger to WebSocket server
  logger.attachWebSocket(io);
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('chat:send', async (data: { content: string; privacy?: string; activeCanvasId?: number }) => {
      try {
        await orchestrator.handleMessage(socket, data);
      } catch (error) {
        console.error('Chat error:', error);
        socket.emit('chat:error', { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    socket.on('diagnostics:subscribe', () => {
      socket.join('diagnostics');
    });

    socket.on('diagnostics:unsubscribe', () => {
      socket.leave('diagnostics');
    });

    // Logs subscription
    socket.on('logs:subscribe', () => {
      socket.join('logs');
      
      // Send recent logs from current session only (buffer is cleared on server restart)
      const recentLogs = logger.getRecent(300);
      recentLogs.forEach((entry) => {
        socket.emit('logs:line', entry);
      });
    });

    socket.on('logs:unsubscribe', () => {
      socket.leave('logs');
    });

    // Agentic browsing events
    socket.on('agent:start', async (data: { query: string; maxPages?: number; maxDurationMs?: number; userMessageId?: number }) => {
      try {
        console.log(`[WebSocket] agent:start received:`, data);
        const sessionId = await browserAgent.startSession(socket, {
          initialQuery: data.query,
          maxPages: data.maxPages,
          maxDurationMs: data.maxDurationMs,
          userMessageId: data.userMessageId
        });
        console.log(`[WebSocket] Created browsing session: ${sessionId}`);
      } catch (error) {
        console.error('Agent start error:', error);
        socket.emit('agent:error', { 
          message: error instanceof Error ? error.message : 'Failed to start browsing session' 
        });
      }
    });

    socket.on('agent:approve', async (data: { sessionId: string }) => {
      try {
        console.log(`[WebSocket] agent:approve received:`, data);
        await browserAgent.approveSession(socket, data.sessionId);
      } catch (error) {
        console.error('Agent approve error:', error);
        socket.emit('agent:error', { 
          sessionId: data.sessionId,
          message: error instanceof Error ? error.message : 'Failed to approve session' 
        });
      }
    });

    socket.on('agent:cancel', async (data: { sessionId: string }) => {
      try {
        console.log(`[WebSocket] agent:cancel received:`, data);
        await browserAgent.cancelSession(data.sessionId);
        socket.emit('agent:status', {
          sessionId: data.sessionId,
          step: 'cancelled',
          detail: 'Session cancelled by user'
        });
      } catch (error) {
        console.error('Agent cancel error:', error);
      }
    });


    // Agentic Workflow Approval Events
    socket.on('subtask:approve', async (data: { subtaskId: number }) => {
      try {
        console.log(`[WebSocket] subtask:approve received for subtask ${data.subtaskId}`);
        // The agenticWorkflow engine sets up its own listeners dynamically
        // This event will be caught by those listeners
        io.emit('subtask:approve', data);
      } catch (error) {
        console.error('Subtask approve error:', error);
        socket.emit('subtask:error', { 
          subtaskId: data.subtaskId,
          message: error instanceof Error ? error.message : 'Failed to approve subtask' 
        });
      }
    });

    socket.on('subtask:reject', async (data: { subtaskId: number; feedback: string }) => {
      try {
        console.log(`[WebSocket] subtask:reject received for subtask ${data.subtaskId}: ${data.feedback}`);
        // The agenticWorkflow engine sets up its own listeners dynamically
        // This event will be caught by those listeners
        io.emit('subtask:reject', data);
      } catch (error) {
        console.error('Subtask reject error:', error);
        socket.emit('subtask:error', { 
          subtaskId: data.subtaskId,
          message: error instanceof Error ? error.message : 'Failed to reject subtask' 
        });
      }
    });

    socket.on('diff:approve', async (data: { subtaskId: number; diffId?: string }) => {
      try {
        console.log(`[WebSocket] diff:approve received for subtask ${data.subtaskId}`);
        io.emit('diff:approve', data);
      } catch (error) {
        console.error('Diff approve error:', error);
        socket.emit('diff:error', { 
          subtaskId: data.subtaskId,
          message: error instanceof Error ? error.message : 'Failed to approve diff' 
        });
      }
    });

    socket.on('diff:reject', async (data: { subtaskId: number; feedback?: string }) => {
      try {
        console.log(`[WebSocket] diff:reject received for subtask ${data.subtaskId}`);
        io.emit('diff:reject', data);
      } catch (error) {
        console.error('Diff reject error:', error);
        socket.emit('diff:error', { 
          subtaskId: data.subtaskId,
          message: error instanceof Error ? error.message : 'Failed to reject diff' 
        });
      }
    });

    socket.on('subtask:request_manual_edit', async (data: { 
      subtaskId: number;
      fileId: number;
      reason?: string;
    }) => {
      try {
        console.log(`[WebSocket] subtask:request_manual_edit received for subtask ${data.subtaskId}`);
        socket.emit('subtask:manual_edit_requested', {
          subtaskId: data.subtaskId,
          fileId: data.fileId,
          reason: data.reason,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Manual edit request error:', error);
        socket.emit('subtask:error', { 
          subtaskId: data.subtaskId,
          message: error instanceof Error ? error.message : 'Failed to request manual edit' 
        });
      }
    });

    // ========================================
    // COLLABORATE FEATURE EVENTS
    // ========================================

    socket.on('collaborate:create', async (data: { 
      title: string; 
      contentType: string; 
      language?: string;
      initialContent?: string;
    }) => {
      try {
        console.log(`[WebSocket] collaborate:create received:`, data);
        
        const sessionId = uuidv4();
        const document = await db.collaborateDocument.create({
          data: {
            sessionId,
            title: data.title,
            contentType: data.contentType as 'text' | 'code' | 'mixed',
            language: data.language || null,
            status: 'active',
          }
        });

        // Create initial version if content provided
        if (data.initialContent) {
          await db.collaborateVersion.create({
            data: {
              documentId: document.id,
              version: 1,
              content: data.initialContent,
              description: 'Initial version',
              createdBy: 'user',
            }
          });
        }

        socket.emit('collaborate:document_created', {
          documentId: document.id,
          sessionId: document.sessionId,
          title: document.title,
          contentType: document.contentType,
          language: document.language,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Collaborate create error:', error);
        socket.emit('collaborate:error', { 
          message: error instanceof Error ? error.message : 'Failed to create document' 
        });
      }
    });

    socket.on('collaborate:edit', async (data: { 
      documentId: number;
      content: string;
      author: string; // 'user' | 'evelyn'
      editType?: string;
      position?: any;
    }) => {
      try {
        console.log(`[WebSocket] collaborate:edit received for document ${data.documentId}`);
        
        // Record the edit
        await db.collaborateEdit.create({
          data: {
            documentId: data.documentId,
            author: data.author,
            editType: data.editType || 'replace',
            afterText: data.content ? data.content : '',
            position: data.position ? JSON.stringify(data.position) : JSON.stringify({ type: 'full_document' }),
            description: `Edit by ${data.author}`,
          }
        });

        // Update document's lastAccessedAt
        await db.collaborateDocument.update({
          where: { id: data.documentId },
          data: { lastAccessedAt: new Date() }
        });

        // Broadcast to all clients
        io.emit('collaborate:content_changed', {
          documentId: data.documentId,
          content: data.content,
          author: data.author,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Collaborate edit error:', error);
        socket.emit('collaborate:error', { 
          documentId: data.documentId,
          message: error instanceof Error ? error.message : 'Failed to save edit' 
        });
      }
    });

    socket.on('collaborate:request_suggestions', async (data: { 
      documentId: number;
      content: string;
      category: 'writing' | 'code';
      selection?: any;
    }) => {
      try {
        console.log(`[WebSocket] collaborate:request_suggestions for document ${data.documentId}`);
        
        // Indicate Evelyn is analyzing
        socket.emit('collaborate:evelyn_typing', {
          documentId: data.documentId,
          action: 'analyzing'
        });

        const document = await db.collaborateDocument.findUnique({
          where: { id: data.documentId }
        });

        if (!document) {
          throw new Error('Document not found');
        }

        // Generate suggestions using AI
        const suggestions = await generateSuggestions(
          data.documentId, 
          data.content, 
          data.category
        );

        // Store suggestions in database
        const createdSuggestions = await Promise.all(
          suggestions.map((suggestion: any) => 
            db.collaborateSuggestion.create({
              data: {
                documentId: data.documentId,
                type: suggestion.type,
                category: data.category,
                title: suggestion.title,
                description: suggestion.description,
                originalText: suggestion.originalText || null,
                suggestedText: suggestion.suggestedText || null,
                lineStart: suggestion.lineStart || null,
                lineEnd: suggestion.lineEnd || null,
                charStart: suggestion.charStart || null,
                charEnd: suggestion.charEnd || null,
                confidence: suggestion.confidence || 0.8,
                status: 'pending',
                evelynThought: suggestion.evelynThought || null,
              }
            })
          )
        );

        socket.emit('collaborate:suggestions_ready', {
          documentId: data.documentId,
          suggestions: createdSuggestions,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Request suggestions error:', error);
        socket.emit('collaborate:error', { 
          documentId: data.documentId,
          message: error instanceof Error ? error.message : 'Failed to generate suggestions' 
        });
      }
    });

    socket.on('collaborate:apply_suggestion', async (data: { 
      documentId: number;
      suggestionId: number;
    }) => {
      try {
        console.log(`[WebSocket] collaborate:apply_suggestion ${data.suggestionId}`);
        
        const suggestion = await db.collaborateSuggestion.update({
          where: { id: data.suggestionId },
          data: { 
            status: 'applied',
            appliedAt: new Date()
          }
        });

        socket.emit('collaborate:suggestion_applied', {
          documentId: data.documentId,
          suggestionId: data.suggestionId,
          suggestion,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Apply suggestion error:', error);
        socket.emit('collaborate:error', { 
          documentId: data.documentId,
          message: error instanceof Error ? error.message : 'Failed to apply suggestion' 
        });
      }
    });

    socket.on('collaborate:save_version', async (data: { 
      documentId: number;
      content: string;
      description?: string;
      createdBy: string; // 'user' | 'evelyn' | 'collaborative'
    }) => {
      try {
        console.log(`[WebSocket] collaborate:save_version for document ${data.documentId}`);
        
        // Get current version count
        const versionCount = await db.collaborateVersion.count({
          where: { documentId: data.documentId }
        });

        const version = await db.collaborateVersion.create({
          data: {
            documentId: data.documentId,
            version: versionCount + 1,
            content: data.content,
            description: data.description || `Version ${versionCount + 1}`,
            createdBy: data.createdBy,
          }
        });

        socket.emit('collaborate:version_saved', {
          documentId: data.documentId,
          version,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Save version error:', error);
        socket.emit('collaborate:error', { 
          documentId: data.documentId,
          message: error instanceof Error ? error.message : 'Failed to save version' 
        });
      }
    });

    socket.on('collaborate:typing', async (data: { 
      documentId: number;
      author: string;
    }) => {
      try {
        // Broadcast typing indicator to other clients
        socket.broadcast.emit('collaborate:user_typing', {
          documentId: data.documentId,
          author: data.author,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Typing indicator error:', error);
      }
    });

    socket.on('collaborate:shortcut', async (data: { 
      documentId: number;
      shortcutType: string;
      content: string;
      options?: any;
    }) => {
      try {
        console.log(`[WebSocket] collaborate:shortcut ${data.shortcutType} for document ${data.documentId}`);
        
        // Indicate Evelyn is working
        socket.emit('collaborate:evelyn_editing', {
          documentId: data.documentId,
          shortcutType: data.shortcutType
        });

        // Apply the shortcut using AI
        const result = await applyShortcut(
          data.shortcutType,
          data.content,
          data.options || {}
        );

        socket.emit('collaborate:shortcut_complete', {
          documentId: data.documentId,
          shortcutType: data.shortcutType,
          result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Shortcut error:', error);
        socket.emit('collaborate:error', { 
          documentId: data.documentId,
          message: error instanceof Error ? error.message : 'Shortcut failed' 
        });
      }
    });

    socket.on('collaborate:analyze', async (data: { 
      documentId: number;
      content: string;
      contentType: string;
    }) => {
      try {
        console.log(`[WebSocket] collaborate:analyze for document ${data.documentId}`);
        
        socket.emit('collaborate:evelyn_typing', {
          documentId: data.documentId,
          action: 'analyzing'
        });

        const analysis = await analyzeContent(data.content, data.contentType as 'text' | 'code' | 'mixed');

        socket.emit('collaborate:analysis_complete', {
          documentId: data.documentId,
          analysis,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Analysis error:', error);
        socket.emit('collaborate:error', { 
          documentId: data.documentId,
          message: error instanceof Error ? error.message : 'Analysis failed' 
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}
