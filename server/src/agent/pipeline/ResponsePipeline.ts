/**
 * Response Pipeline
 * 
 * Handles LLM response generation, streaming, and message persistence.
 * Extracted from the monolithic orchestrator for better separation of concerns.
 */

import { Socket } from 'socket.io';
import { db } from '../../db/client.js';
import { openRouterClient, BASETEN_FP4_PROVIDER } from '../../providers/openrouter.js';
import { estimateTokens } from '../../utils/tokenizer.js';
import { WS_EVENTS, PIPELINE_CONFIG } from '../../constants/index.js';
import { 
  LLMError,
  LLMTimeoutError,
  generateCorrelationId,
  errorLogger 
} from '../errors/index.js';

// ========================================
// Types
// ========================================

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamingOptions {
  socket: Socket;
  eventPrefix: 'chat' | 'collaborate';
  model?: string;
  providerPreferences?: any;
}

export interface MessageMetadata {
  retrievalIds: number[];
  searchUsed: boolean;
  moodSnapshot: any;
  channel: string;
  documentId?: number;
  originUserMessageId: number;
}

export interface StreamResult {
  fullResponse: string;
  messageCount: number;
  tokensOut: number;
  elapsedMs: number;
}

export interface SavedMessage {
  id: number;
  role: string;
  content: string;
  createdAt: Date;
  auxiliary: string;
}

export interface ResponsePipelineResult {
  success: boolean;
  savedMessages: SavedMessage[];
  combinedContent: string;
  primaryMessage: SavedMessage;
  streamResult: StreamResult;
  error?: string;
}

// ========================================
// Response Pipeline Class
// ========================================

export class ResponsePipeline {
  private correlationId: string;
  private readonly SPLIT_MARKER = PIPELINE_CONFIG.SPLIT_MARKER;
  private readonly SPLIT_PATTERN = /\{+SPLIT\}+/g;

  constructor(correlationId?: string) {
    this.correlationId = correlationId || generateCorrelationId();
  }

  /**
   * Execute full response pipeline: stream, split, save
   */
  async execute(
    messages: LLMMessage[],
    userMessageId: number,
    metadata: MessageMetadata,
    options: StreamingOptions
  ): Promise<ResponsePipelineResult> {
    const { socket, eventPrefix } = options;
    const startTime = Date.now();

    try {
      // Stream response from LLM
      const streamResult = await this.streamResponse(messages, options, startTime);

      // Parse into individual messages
      const individualMessages = this.parseMessages(streamResult.fullResponse);
      console.log(`[ResponsePipeline] Split into ${individualMessages.length} individual messages`);

      // Save all messages to database
      const savedMessages = await this.saveMessages(
        individualMessages,
        userMessageId,
        metadata,
        socket,
        eventPrefix
      );

      // Combined content for post-processing
      const combinedContent = individualMessages.join(' ');

      return {
        success: true,
        savedMessages,
        combinedContent,
        primaryMessage: savedMessages[0],
        streamResult
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[ResponsePipeline] Error:', errorMessage);

      socket.emit(`${eventPrefix}:error`, {
        error: errorMessage
      });

      const agentError = new LLMError(
        'Response generation failed',
        undefined,
        {
          operation: 'execute',
          component: 'ResponsePipeline',
          correlationId: this.correlationId
        },
        { originalError: error instanceof Error ? error : undefined }
      );
      errorLogger.log(agentError);

      return {
        success: false,
        savedMessages: [],
        combinedContent: '',
        primaryMessage: {} as SavedMessage,
        streamResult: {
          fullResponse: '',
          messageCount: 0,
          tokensOut: 0,
          elapsedMs: Date.now() - startTime
        },
        error: errorMessage
      };
    }
  }

  /**
   * Stream response from LLM with split marker handling
   */
  async streamResponse(
    messages: LLMMessage[],
    options: StreamingOptions,
    startTime: number
  ): Promise<StreamResult> {
    const { socket, eventPrefix, model, providerPreferences } = options;
    
    const modelToUse = model || 'moonshotai/kimi-k2-0905';
    const provider = providerPreferences || BASETEN_FP4_PROVIDER;

    let fullResponse = '';
    let buffer = '';
    let messageCount = 1;

    try {
      for await (const token of openRouterClient.streamChat(messages, modelToUse, provider)) {
        fullResponse += token;
        buffer += token;

        // Check for split marker
        const markerIndex = buffer.indexOf(this.SPLIT_MARKER);

        if (markerIndex !== -1) {
          // Found split marker - emit content before it
          const beforeMarker = buffer.substring(0, markerIndex).trim();
          if (beforeMarker) {
            socket.emit(`${eventPrefix}:token`, beforeMarker);
          }

          // Signal message split
          socket.emit(`${eventPrefix}:split`);
          messageCount++;

          // Small delay to simulate human typing pause
          await this.humanTypingDelay();

          // Continue with content after marker
          buffer = buffer.substring(markerIndex + this.SPLIT_MARKER.length).trimStart();
          if (buffer) {
            socket.emit(`${eventPrefix}:token`, buffer);
          }
          buffer = '';

        } else if (buffer.length > this.SPLIT_MARKER.length) {
          // Buffer is longer than marker - safe to emit partial content
          const safeLength = buffer.length - this.SPLIT_MARKER.length;
          const safeContent = buffer.substring(0, safeLength);
          if (safeContent) {
            socket.emit(`${eventPrefix}:token`, safeContent);
          }
          buffer = buffer.substring(safeLength);
        }
      }

      // Emit remaining buffer
      if (buffer) {
        socket.emit(`${eventPrefix}:token`, buffer);
      }

      // Send completion signal
      const elapsedMs = Date.now() - startTime;
      const tokensOut = estimateTokens(fullResponse);

      console.log(
        `[ResponsePipeline] ✅ Complete in ${elapsedMs}ms | ` +
        `msgs: ${messageCount} | tokens: ${tokensOut} | length: ${fullResponse.length} chars`
      );

      socket.emit(`${eventPrefix}:complete`);

      return {
        fullResponse,
        messageCount,
        tokensOut,
        elapsedMs
      };

    } catch (error) {
      console.error('[ResponsePipeline] ❌ Streaming error:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Parse full response into individual messages
   */
  parseMessages(fullResponse: string): string[] {
    return fullResponse
      .split(this.SPLIT_PATTERN)
      .map(msg => msg.trim())
      .filter(msg => msg.length > 0);
  }

  /**
   * Save messages to database and emit to frontend
   */
  async saveMessages(
    messageContents: string[],
    userMessageId: number,
    metadata: MessageMetadata,
    socket: Socket,
    eventPrefix: string
  ): Promise<SavedMessage[]> {
    const savedMessages: SavedMessage[] = [];

    for (const content of messageContents) {
      const auxiliary = {
        retrievalIds: metadata.retrievalIds,
        searchUsed: metadata.searchUsed,
        moodSnapshot: metadata.moodSnapshot,
        isMultiMessage: messageContents.length > 1,
        messageIndex: savedMessages.length,
        totalMessages: messageContents.length,
        originUserMessageId: userMessageId,
        channel: metadata.channel,
        ...(metadata.documentId && { documentId: metadata.documentId })
      };

      const message = await db.message.create({
        data: {
          role: 'assistant',
          content,
          tokensOut: estimateTokens(content),
          auxiliary: JSON.stringify(auxiliary)
        }
      });

      savedMessages.push({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
        auxiliary: message.auxiliary || ''
      });

      // Emit saved message to frontend
      socket.emit(`${eventPrefix}:message:saved`, {
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        auxiliary: message.auxiliary
      });
    }

    return savedMessages;
  }

  /**
   * Clean response by removing split markers
   */
  cleanResponse(response: string): string {
    return response.replace(this.SPLIT_PATTERN, '\n\n');
  }

  /**
   * Small delay to simulate human typing between messages
   */
  private async humanTypingDelay(): Promise<void> {
    const delay = 50 + Math.random() * 100;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

// ========================================
// Factory Function
// ========================================

export function createResponsePipeline(correlationId?: string): ResponsePipeline {
  return new ResponsePipeline(correlationId);
}

export default ResponsePipeline;
