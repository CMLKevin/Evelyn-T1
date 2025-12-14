import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Ensure .env in the server directory is loaded when this module is imported.
// Note: server/src/index.ts already loads dotenv as well; this is a secondary
// safeguard for cases where the provider is used in isolation (e.g. tests).
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverDir = join(__dirname, '..');

dotenv.config({ path: join(serverDir, '.env') });

type OpenRouterModelsConfig = {
  chat: string;
  thinkSimple: string;
  thinkComplex: string;
  agent: string;
  embedding: string;
};

export interface OpenRouterConfig {
  apiKey: string;
  baseUrl: string;
  models: OpenRouterModelsConfig;
  referer: string;
  title: string;
}

export function getSanitizedKeyInfo(apiKey: string | undefined | null): string {
  if (!apiKey) return 'missing';
  const visible = apiKey.slice(0, 8);
  return `${visible}…`;
}

export function getOpenRouterConfig(): OpenRouterConfig {
  const apiKey = process.env.OPENROUTER_API_KEY || '';
  const baseUrl = process.env.OPENROUTER_BASE || 'https://openrouter.ai/api/v1';

  const models: OpenRouterModelsConfig = {
    chat: process.env.MODEL_CHAT || 'x-ai/grok-4.1-fast:free',
    thinkSimple: process.env.MODEL_THINK_SIMPLE || 'x-ai/grok-4.1-fast:free',
    thinkComplex: process.env.MODEL_THINK_COMPLEX || 'x-ai/grok-4.1-fast:free',
    agent: process.env.MODEL_AGENT || 'z-ai/glm-4.5v',
    embedding: process.env.EMBEDDING_MODEL || 'qwen/qwen3-embedding-8b',
  };

  const referer = process.env.OPENROUTER_REFERER || 'https://evelyn-chat.local';
  const title = process.env.OPENROUTER_TITLE || 'Evelyn Agentic AI';

  return {
    apiKey,
    baseUrl,
    models,
    referer,
    title,
  };
}

export function validateOpenRouterConfig(): void {
  const { apiKey, baseUrl } = getOpenRouterConfig();

  if (!apiKey) {
    // Throwing here will fail fast at startup in most scenarios.
    throw new Error('[OpenRouterConfig] OPENROUTER_API_KEY environment variable is required');
  }

  if (/your_openrouter_api_key_here/i.test(apiKey)) {
    console.warn('[OpenRouterConfig] OPENROUTER_API_KEY looks like a placeholder. Please set a real key from https://openrouter.ai/keys');
  }

  if (!baseUrl.startsWith('http')) {
    console.warn(`[OpenRouterConfig] OPENROUTER_BASE does not look like a valid URL: ${baseUrl}`);
  }
}
