/**
 * Settings Helper
 * 
 * Provides access to user settings throughout the backend.
 */

import { db } from '../db/client.js';

export type LLMModel = 'x-ai/grok-4.1-fast:free' | 'anthropic/claude-opus-4.5';

export interface AppSettings {
  id: number;
  thoughtVerbosity: string;
  memoryPrivacyDefault: string;
  dreamSchedule: string | null;
  enableDiagnostics: boolean;
  searchPreference: string;
  includeCodebaseContext: boolean;
  webSearchProvider: 'grok' | 'perplexity';
  llmModel: LLMModel;
  conversationsSinceReflection: number;
  lastReflectionAt: Date | null;
  customSettings: string | null;
  version: number;
  updatedAt: Date;
}

const DEFAULT_SETTINGS: Omit<AppSettings, 'id' | 'updatedAt'> = {
  thoughtVerbosity: 'medium',
  memoryPrivacyDefault: 'public',
  dreamSchedule: null,
  enableDiagnostics: true,
  searchPreference: 'auto',
  includeCodebaseContext: false,
  webSearchProvider: 'grok',
  llmModel: 'x-ai/grok-4.1-fast:free',
  conversationsSinceReflection: 0,
  lastReflectionAt: null,
  customSettings: null,
  version: 1,
};

// Cache settings to avoid repeated DB queries
let cachedSettings: AppSettings | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30000; // 30 seconds

/**
 * Get current application settings
 */
export async function getSettings(): Promise<AppSettings> {
  // Return cached if still valid
  if (cachedSettings && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedSettings;
  }
  
  try {
    let settings = await db.settings.findFirst();
    
    if (!settings) {
      // Create with defaults - webSearchProvider will use schema default ('grok')
      settings = await db.settings.create({
        data: {
          thoughtVerbosity: DEFAULT_SETTINGS.thoughtVerbosity,
          memoryPrivacyDefault: DEFAULT_SETTINGS.memoryPrivacyDefault,
          enableDiagnostics: DEFAULT_SETTINGS.enableDiagnostics,
          searchPreference: DEFAULT_SETTINGS.searchPreference,
          includeCodebaseContext: DEFAULT_SETTINGS.includeCodebaseContext,
        }
      });
    }
    
    // Update cache
    cachedSettings = settings as AppSettings;
    cacheTimestamp = Date.now();
    
    return cachedSettings;
  } catch (error) {
    console.error('[Settings] Failed to fetch settings:', error);
    // Return defaults if DB fails
    return {
      ...DEFAULT_SETTINGS,
      id: 0,
      updatedAt: new Date(),
    } as AppSettings;
  }
}

/**
 * Invalidate settings cache (call after settings update)
 */
export function invalidateSettingsCache(): void {
  cachedSettings = null;
  cacheTimestamp = 0;
}

/**
 * Check if Grok tools should be used for search
 */
export async function shouldUseGrokTools(): Promise<boolean> {
  const settings = await getSettings();
  return settings.webSearchProvider === 'grok';
}

/**
 * Check if Perplexity should be used for search
 */
export async function shouldUsePerplexity(): Promise<boolean> {
  const settings = await getSettings();
  return settings.webSearchProvider === 'perplexity';
}

/**
 * Get the web search provider
 */
export async function getWebSearchProvider(): Promise<'grok' | 'perplexity'> {
  const settings = await getSettings();
  return (settings.webSearchProvider as 'grok' | 'perplexity') || 'grok';
}

/**
 * Get the primary LLM model
 */
export async function getLLMModel(): Promise<LLMModel> {
  const settings = await getSettings();
  return (settings.llmModel as LLMModel) || 'x-ai/grok-4.1-fast:free';
}
