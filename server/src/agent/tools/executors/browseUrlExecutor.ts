/**
 * Browse URL Executor
 * 
 * Browses a URL using the browser agent and extracts content.
 * Wraps the existing browserAgent functionality.
 */

import type { ToolExecutor, ToolContext, ToolResult, BrowseUrlParams } from '../types.js';
import { browserAgent } from '../../browserAgent.js';

export interface BrowseResult {
  url: string;
  title: string;
  content: string;
  screenshot?: string;
  links?: string[];
}

export class BrowseUrlExecutor implements ToolExecutor<BrowseUrlParams, BrowseResult> {
  toolName = 'browse_url' as const;

  validate(params: BrowseUrlParams): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!params.url || typeof params.url !== 'string') {
      errors.push('url is required and must be a string');
    }

    if (params.url) {
      try {
        new URL(params.url);
      } catch {
        errors.push('url must be a valid URL');
      }
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(params: BrowseUrlParams, context: ToolContext): Promise<ToolResult & { data?: BrowseResult }> {
    const startTime = Date.now();
    const { url, extractContent = true, screenshot = false } = params;

    try {
      console.log(`[BrowseUrlExecutor] 🌐 Browsing: ${url}`);

      // Get socket for real-time updates
      const socket = context.socket 
        ? (typeof context.socket === 'function' ? context.socket() : context.socket)
        : undefined;

      if (!socket) {
        return {
          toolName: this.toolName,
          status: 'error',
          error: 'Socket required for browser agent',
          summary: 'Cannot browse without socket connection',
          executionTimeMs: Date.now() - startTime,
          needsFollowUp: false
        };
      }

      // Start browser session - this emits events via socket
      // The browser agent handles the actual browsing asynchronously
      const sessionId = await browserAgent.startSession(socket, {
        initialQuery: `Browse and extract content from: ${url}`,
        maxPages: 1,
        maxDurationMs: 60000
      });

      if (!sessionId) {
        return {
          toolName: this.toolName,
          status: 'error',
          error: 'Failed to start browser session',
          summary: 'Browser session initialization failed',
          executionTimeMs: Date.now() - startTime,
          needsFollowUp: false
        };
      }

      // The browser agent will emit results via socket events
      // We return immediately with the session ID - results come async
      const browseResult: BrowseResult = {
        url,
        title: url,
        content: `Browser session started: ${sessionId}. Results will be streamed via socket events.`
      };

      // Emit result to frontend
      if (socket) {
        socket.emit('tool:browse_result', {
          correlationId: context.correlationId,
          url,
          title: browseResult.title,
          contentLength: browseResult.content.length
        });
      }

      console.log(`[BrowseUrlExecutor] ✅ Browsed: ${browseResult.title}`);

      return {
        toolName: this.toolName,
        status: 'success',
        data: browseResult,
        summary: `Browsed "${browseResult.title}" (${browseResult.content.length} chars)`,
        executionTimeMs: Date.now() - startTime,
        needsFollowUp: false
      };
    } catch (error) {
      console.error('[BrowseUrlExecutor] ❌ Error:', error);
      
      return {
        toolName: this.toolName,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        summary: 'Failed to browse URL',
        executionTimeMs: Date.now() - startTime,
        needsFollowUp: false
      };
    }
  }
}
