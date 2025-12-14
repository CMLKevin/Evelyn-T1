/**
 * Unified Orchestrator
 * 
 * Single entry point for all Evelyn interactions. Combines conversation
 * and tool usage into a unified flow. Replaces the dual-path architecture
 * of separate chat and collaborate handlers.
 */

import { Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/client.js';
import { openRouterClient } from '../providers/openrouter.js';
import { memoryEngine } from './memory.js';
import { personalityEngine } from './personality.js';
import { 
  processToolResponse, 
  needsToolProcessing, 
  initializeToolSystem,
  type ToolContext,
  type UnifiedToolResponse,
  type Artifact
} from './tools/index.js';
import { generateUnifiedAgentPrompt } from '../prompts/unifiedAgent.js';
import { Budgeter } from '../utils/budgeter.js';
import { estimateTokens } from '../utils/tokenizer.js';

// ========================================
// Types
// ========================================

export interface UnifiedMessageContext {
  /** Source of the message */
  source: 'chat' | 'collaborate';
  /** Active document if in collaborate context */
  activeDocument?: {
    id: number;
    title: string;
    contentType: 'text' | 'code' | 'mixed';
    language: string | null;
    content: string;
  };
  /** Active artifact if any */
  activeArtifact?: Artifact;
  /** User ID if authenticated */
  userId?: number;
  /** Socket for real-time updates */
  socket?: Socket;
  /** Enable agentic features (tools, artifacts, web search) - default true */
  agenticMode?: boolean;
}

export interface UnifiedOrchestratorResult {
  /** Response text to show user */
  response: string;
  /** Response split into multiple messages */
  responseSplits: string[];
  /** Tool results if any tools were used */
  toolResults: UnifiedToolResponse['toolResults'];
  /** Created/updated artifacts */
  artifacts: Artifact[];
  /** Document changes */
  documentChanges: UnifiedToolResponse['documentChanges'];
  /** Inner thought (for diagnostics) */
  thought?: string;
  /** Total processing time */
  totalTimeMs: number;
  /** Correlation ID for tracing */
  correlationId: string;
}

// ========================================
// Unified Orchestrator Class
// ========================================

export class UnifiedOrchestrator {
  private budgeter: Budgeter;
  private currentSocket: Socket | null = null;
  private initialized = false;

  constructor() {
    this.budgeter = new Budgeter({ inMax: 150000, reserveOut: 0.1 });
  }

  /**
   * Initialize the orchestrator
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await initializeToolSystem();
    this.initialized = true;
    console.log('[UnifiedOrchestrator] ✅ Initialized');
  }

  /**
   * Set the current socket for real-time updates
   */
  setSocket(socket: Socket): void {
    this.currentSocket = socket;
  }

  /**
   * Get a socket getter for tool executors
   */
  private getSocketGetter(): () => Socket | null {
    return () => this.currentSocket;
  }

  /**
   * Handle a user message with unified processing
   */
  async handleMessage(
    content: string,
    context: UnifiedMessageContext
  ): Promise<UnifiedOrchestratorResult> {
    const startTime = Date.now();
    const correlationId = uuidv4();

    console.log(`[UnifiedOrchestrator] 📨 Message received (${context.source})`);
    console.log(`[UnifiedOrchestrator] 🔗 Correlation ID: ${correlationId}`);

    // Ensure initialized
    await this.initialize();

    // Update socket
    if (context.socket) {
      this.currentSocket = context.socket;
    }

    try {
      // Check agentic mode
      const isAgenticMode = context.agenticMode ?? true;
      console.log(`[UnifiedOrchestrator] 🔧 Agentic mode: ${isAgenticMode ? 'ON' : 'OFF'}`);

      // 1. Build initial context for LLM
      const llmContext = await this.buildLLMContext(content, context);

      // CHAT-ONLY MODE: Skip tool loop, direct LLM response
      if (!isAgenticMode) {
        return await this.handleChatOnlyMessage(llmContext, correlationId, startTime, content, context);
      }

      const toolContext: ToolContext = {
        socket: this.getSocketGetter(),
        userId: context.userId,
        activeDocumentId: context.activeDocument?.id,
        activeDocumentContent: context.activeDocument?.content,
        activeArtifactId: context.activeArtifact?.id,
        correlationId
      };

      // Iterative agentic loop
      const MAX_ITERATIONS = 5;
      let iteration = 0;
      let allToolResults: any[] = [];
      let conversationHistory = [...llmContext];
      let finalResponseText = '';
      let responseSplits: string[] = [];
      
      const { parseToolCalls } = await import('./tools/toolParser.js');
      const { executeToolCalls } = await import('./tools/index.js');
      const { getLLMModel } = await import('../utils/settings.js');
      const model = await getLLMModel();
      
      // Emit agent start event
      const progressSocket = this.getSocketGetter()();
      if (progressSocket) {
        progressSocket.emit('agent:start', { id: correlationId });
      }
      
      while (iteration < MAX_ITERATIONS) {
        iteration++;
        console.log(`[UnifiedOrchestrator] 🔄 Iteration ${iteration}/${MAX_ITERATIONS}`);
        
        // Emit thinking event
        if (progressSocket) {
          progressSocket.emit('agent:thinking', { 
            thought: iteration === 1 ? 'Analyzing your request...' : 'Reviewing results and deciding next steps...'
          });
        }
        
        // Call LLM
        let llmResponse = '';
        for await (const token of openRouterClient.streamChat(conversationHistory, model)) {
          llmResponse += token;
        }
        console.log(`[UnifiedOrchestrator] 📝 LLM response: ${llmResponse.length} chars`);
        
        // Check for <response> tag first (direct response to user)
        const responseMatch = llmResponse.match(/<response>([\s\S]*?)<\/response>/i);
        if (responseMatch) {
          finalResponseText = responseMatch[1].trim();
          console.log('[UnifiedOrchestrator] 💬 Got direct response');
          responseSplits = this.splitResponse(finalResponseText);
          
          // Emit responding event
          if (progressSocket) {
            progressSocket.emit('agent:responding', {});
          }
          
          // Stream to user
          await this.streamResponse(finalResponseText, correlationId);
          break;
        }
        
        // Check for tool calls
        const parsed = parseToolCalls(llmResponse);
        if (parsed.toolCalls.length === 0) {
          // No tools and no response tag - use raw text as response
          finalResponseText = llmResponse.replace(/<[^>]+>/g, '').trim() || "hmm, let me think about that...";
          console.log('[UnifiedOrchestrator] 💬 Using raw text as response');
          responseSplits = this.splitResponse(finalResponseText);
          
          // Emit responding event
          if (progressSocket) {
            progressSocket.emit('agent:responding', {});
          }
          
          await this.streamResponse(finalResponseText, correlationId);
          break;
        }
        
        // Execute tool (only first one - one tool per turn)
        const toolCall = parsed.toolCalls[0];
        const toolId = `tool_${Date.now()}`;
        console.log(`[UnifiedOrchestrator] 🔧 Executing tool: ${toolCall.name}`);
        
        // Emit tool start event
        if (progressSocket) {
          progressSocket.emit('agent:tool_start', {
            id: toolId,
            tool: toolCall.name,
            params: toolCall.params
          });
        }
        
        const toolResponse = await executeToolCalls([toolCall], toolContext);
        const toolResult = toolResponse.toolResults[0];
        allToolResults.push(toolResult);
        
        // Emit tool complete event
        if (progressSocket) {
          progressSocket.emit('agent:tool_complete', {
            id: toolId,
            tool: toolResult.toolName,
            status: toolResult.status,
            summary: toolResult.summary,
            error: toolResult.error,
            durationMs: toolResult.executionTimeMs
          });
        }
        
        // Emit tool status (legacy event)
        const socket = this.getSocketGetter()();
        if (socket) {
          socket.emit('tool:status', {
            correlationId,
            tool: toolResult.toolName,
            status: toolResult.status,
            summary: toolResult.summary,
            executionTimeMs: toolResult.executionTimeMs
          });
        }
        
        // Build tool result context for next iteration
        const toolResultText = this.formatToolResult(toolResult);
        
        // Add assistant's tool call and tool result to conversation
        conversationHistory.push({ role: 'assistant' as const, content: llmResponse });
        conversationHistory.push({ role: 'user' as const, content: `Tool result:\n${toolResultText}\n\nYou can use another tool if needed, or respond to the user with <response>your message</response>` });
      }
      
      // If we hit max iterations without a response, force one
      if (!finalResponseText) {
        console.warn('[UnifiedOrchestrator] Max iterations reached - forcing response');
        finalResponseText = "done! let me know if you need anything else";
        responseSplits = [finalResponseText];
        await this.streamResponse(finalResponseText, correlationId);
      }
      
      // Build final response object
      const finalResponse: UnifiedToolResponse = {
        response: finalResponseText,
        toolResults: allToolResults,
        artifacts: allToolResults.filter(r => r.toolName === 'create_artifact' && r.data).map(r => r.data),
        documentChanges: allToolResults.filter(r => r.toolName === 'edit_document' && r.data).map(r => r.data),
        complete: true,
        totalTimeMs: Date.now() - startTime
      };

      // 4. Emit additional events (artifacts, tool status for non-respond tools)
      this.emitEvents(correlationId, finalResponse, responseSplits, context);

      // 5. Emit agent complete event
      if (progressSocket) {
        progressSocket.emit('agent:complete', { 
          correlationId,
          totalTimeMs: Date.now() - startTime
        });
      }

      // 6. Save to database
      await this.saveInteraction(content, finalResponse, context);

      const result: UnifiedOrchestratorResult = {
        response: finalResponse.response,
        responseSplits,
        toolResults: finalResponse.toolResults,
        artifacts: finalResponse.artifacts,
        documentChanges: finalResponse.documentChanges,
        totalTimeMs: Date.now() - startTime,
        correlationId
      };

      console.log(`[UnifiedOrchestrator] ✅ Complete in ${result.totalTimeMs}ms`);
      return result;

    } catch (error) {
      console.error('[UnifiedOrchestrator] ❌ Error:', error);
      
      // Emit agent error event
      const errorSocket = this.getSocketGetter()();
      if (errorSocket) {
        errorSocket.emit('agent:error', { 
          correlationId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      return {
        response: "sorry, something went wrong on my end. can you try again?",
        responseSplits: ["sorry, something went wrong on my end. can you try again?"],
        toolResults: [],
        artifacts: [],
        documentChanges: [],
        totalTimeMs: Date.now() - startTime,
        correlationId
      };
    }
  }

  /**
   * Build the context for LLM call
   */
  private async buildLLMContext(
    userMessage: string,
    context: UnifiedMessageContext
  ): Promise<Array<{ role: 'system' | 'user' | 'assistant'; content: string }>> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    // Build document context string if active
    let documentContext: string | undefined;
    if (context.activeDocument) {
      const doc = context.activeDocument;
      const contentPreview = doc.content.length > 2000 
        ? doc.content.slice(0, 2000) + '\n... (truncated)'
        : doc.content;
      
      documentContext = `Document ID: ${doc.id}
Title: ${doc.title}
Type: ${doc.contentType}
Language: ${doc.language || 'N/A'}
Content:
\`\`\`${doc.language || ''}
${contentPreview}
\`\`\``;
    }

    // Build artifact context string if active
    let artifactContext: string | undefined;
    if (context.activeArtifact) {
      const art = context.activeArtifact;
      artifactContext = `Artifact ID: ${art.id}
Title: ${art.title}
Type: ${art.type}
Status: ${art.status}`;
    }

    // Generate system prompt - respect agentic mode setting
    const isAgenticMode = context.agenticMode ?? true;
    const systemPrompt = generateUnifiedAgentPrompt({
      includePersonality: true,
      includeTools: isAgenticMode,  // No tools in chat-only mode
      activeDocumentContext: documentContext,
      activeArtifactContext: artifactContext
    });

    messages.push({ role: 'system', content: systemPrompt });

    // Add personality context
    const personality = await personalityEngine.getSnapshot();
    if (personality) {
      const moodContext = `Current mood: ${personality.mood.stance} (valence: ${personality.mood.valence.toFixed(2)}, arousal: ${personality.mood.arousal.toFixed(2)})`;
      messages.push({ role: 'system', content: moodContext });
    }

    // Add relevant memories
    const memories = await memoryEngine.retrieve(userMessage, 5);
    if (memories.length > 0) {
      const memoryContext = memories
        .map((m: { text: string }) => `[Memory] ${m.text}`)
        .join('\n');
      messages.push({ role: 'system', content: `Relevant context:\n${memoryContext}` });
    }

    // Add recent conversation history
    const recentMessages = await db.message.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    for (const msg of recentMessages.reverse()) {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      });
    }

    // Add current user message
    messages.push({ role: 'user', content: userMessage });

    // Budget check
    const totalTokens = messages.reduce(
      (sum, msg) => sum + estimateTokens(msg.content),
      0
    );
    console.log(`[UnifiedOrchestrator] 📊 Context tokens: ${totalTokens}`);

    return messages;
  }

  /**
   * Call the LLM with the prepared context
   * Uses regular chat completion - our custom tool system handles tool calls
   */
  private async callLLM(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    context: UnifiedMessageContext
  ): Promise<string> {
    console.log('[UnifiedOrchestrator] 🤖 Calling LLM...');

    // Get selected model from settings
    const { getLLMModel } = await import('../utils/settings.js');
    const model = await getLLMModel();
    
    // Use regular chat completion - our tool system handles respond, create_artifact, etc.
    // No native Grok tools needed since we have our own tool parser
    let fullResponse = '';
    
    for await (const token of openRouterClient.streamChat(messages, model)) {
      fullResponse += token;
    }

    console.log(`[UnifiedOrchestrator] 📝 LLM response: ${fullResponse.length} chars`);
    return fullResponse;
  }

  /**
   * Split response into multiple messages for natural feel
   */
  private splitResponse(response: string): string[] {
    if (!response.includes('{{SPLIT}}')) {
      return [response];
    }

    return response
      .split('{{SPLIT}}')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * Stream response to user with natural typing feel
   */
  private async streamResponse(text: string, correlationId: string): Promise<void> {
    const socket = this.getSocketGetter()();
    if (!socket) return;

    const splits = this.splitResponse(text);
    
    for (let i = 0; i < splits.length; i++) {
      const message = splits[i];
      
      // Stream tokens for typing effect
      const words = message.split(' ');
      for (const word of words) {
        socket.emit('chat:token', word + ' ');
        await new Promise(resolve => setTimeout(resolve, 15)); // Small delay between words
      }
      
      // Emit split marker between messages
      if (i < splits.length - 1) {
        socket.emit('chat:split', { index: i, total: splits.length });
        await new Promise(resolve => setTimeout(resolve, 200)); // Pause between bubbles
      }
    }
    
    socket.emit('chat:complete', { correlationId, messageCount: splits.length });
  }

  /**
   * Format tool result for LLM context
   */
  private formatToolResult(result: any): string {
    let data = '';
    
    if (result.toolName === 'web_search' && result.data) {
      data = `Search results:\n${result.data.answer || result.data.synthesis || JSON.stringify(result.data).slice(0, 3000)}`;
    } else if (result.toolName === 'x_search' && result.data) {
      data = `X/Twitter results:\n${JSON.stringify(result.data.posts || result.data).slice(0, 3000)}`;
    } else if (result.toolName === 'create_artifact' && result.data) {
      data = `Created artifact "${result.data.title}" (type: ${result.data.type}, id: ${result.data.id})`;
    } else if (result.toolName === 'update_artifact' && result.data) {
      data = `Updated artifact (version: ${result.data.version})`;
    } else if (result.toolName === 'edit_document' && result.data) {
      data = `Edited document: ${result.summary}`;
    } else if (result.toolName === 'browse_url' && result.data) {
      data = `Page content from ${result.data.url}:\n${(result.data.content || result.data.text || '').slice(0, 3000)}`;
    } else if (result.toolName === 'run_python' && result.data) {
      data = `Python output:\n${result.data.output || result.data.error || 'No output'}`;
    } else {
      data = result.summary || 'Completed';
    }
    
    return `<tool_result name="${result.toolName}" status="${result.status}">\n${data}\n</tool_result>`;
  }

  /**
   * Emit real-time events to frontend
   */
  private emitEvents(
    correlationId: string,
    response: UnifiedToolResponse,
    splits: string[],
    context: UnifiedMessageContext
  ): void {
    const socket = context.socket || this.currentSocket;
    if (!socket) return;

    // Tool statuses are already emitted during iteration
    // Here we just emit artifacts and document changes

    // Emit artifacts
    for (const artifact of response.artifacts) {
      socket.emit('artifact:created', {
        correlationId,
        artifact,
        autoRun: true
      });
    }

    // Emit document changes
    for (const change of response.documentChanges) {
      socket.emit('document:changed', {
        correlationId,
        ...change
      });
    }
  }

  /**
   * Handle chat-only mode (no tools, direct LLM response)
   */
  private async handleChatOnlyMessage(
    llmContext: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    correlationId: string,
    startTime: number,
    userMessage: string,
    context: UnifiedMessageContext
  ): Promise<UnifiedOrchestratorResult> {
    console.log('[UnifiedOrchestrator] 💬 Chat-only mode - direct LLM call');

    const { getLLMModel } = await import('../utils/settings.js');
    const model = await getLLMModel();

    // Direct LLM call without tool parsing
    let llmResponse = '';
    for await (const token of openRouterClient.streamChat(llmContext, model)) {
      llmResponse += token;
    }

    // Clean up any accidental tool tags (LLM might still try)
    const cleanedResponse = llmResponse
      .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
      .replace(/<response>([\s\S]*?)<\/response>/gi, '$1')
      .trim() || llmResponse.trim();

    const responseSplits = this.splitResponse(cleanedResponse);

    // Stream response to user
    await this.streamResponse(cleanedResponse, correlationId);

    // Emit completion
    const socket = this.getSocketGetter()();
    if (socket) {
      socket.emit('chat:complete', { correlationId, messageCount: responseSplits.length });
    }

    // Save to database
    await this.saveInteraction(userMessage, {
      response: cleanedResponse,
      toolResults: [],
      artifacts: [],
      documentChanges: [],
      complete: true,
      totalTimeMs: Date.now() - startTime
    }, context);

    return {
      response: cleanedResponse,
      responseSplits,
      toolResults: [],
      artifacts: [],
      documentChanges: [],
      totalTimeMs: Date.now() - startTime,
      correlationId
    };
  }

  /**
   * Save interaction to database
   */
  private async saveInteraction(
    userMessage: string,
    response: UnifiedToolResponse,
    context: UnifiedMessageContext
  ): Promise<void> {
    // Save user message
    await db.message.create({
      data: {
        role: 'user',
        content: userMessage
      }
    });

    // Save assistant response
    await db.message.create({
      data: {
        role: 'assistant',
        content: response.response
      }
    });

    // Update mood based on interaction (background, don't await)
    // Small neutral impact by default - actual impact calculated inside
    personalityEngine.updateMood(userMessage, response.response, {
      valenceDelta: 0,
      arousalDelta: 0
    }).catch((e: Error) => {
      console.warn('[UnifiedOrchestrator] Mood update failed:', e.message);
    });
  }
}

// Export singleton instance
export const unifiedOrchestrator = new UnifiedOrchestrator();
