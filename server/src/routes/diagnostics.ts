import type { Express } from 'express';
import { openRouterClient } from '../providers/openrouter.js';

export function setupDiagnosticsRoutes(app: Express) {
  // OpenRouter diagnostics
  app.get('/api/diagnostics/openrouter', (req, res) => {
    try {
      const diagnostics = openRouterClient.getDiagnostics();
      // Never expose full API keys or other secrets; getDiagnostics only returns
      // a short prefix for identification plus non-sensitive configuration.
      return res.json(diagnostics);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Diagnostics] Failed to get OpenRouter diagnostics:', message);
      return res.status(500).json({
        error: 'Failed to get OpenRouter diagnostics',
        details: message,
      });
    }
  });
}
