import { useState, useEffect } from 'react';

interface Settings {
  thoughtVerbosity: string;
  memoryPrivacyDefault: string;
  enableDiagnostics: boolean;
  searchPreference: string;
  includeCodebaseContext: boolean;
  webSearchProvider: string;
  llmModel: string;
  agenticMode: boolean;
}

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<Settings>({
    thoughtVerbosity: 'medium',
    memoryPrivacyDefault: 'public',
    enableDiagnostics: true,
    searchPreference: 'auto',
    includeCodebaseContext: false,
    webSearchProvider: 'grok',
    llmModel: 'x-ai/grok-4.1-fast:free',
    agenticMode: true
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/settings');
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const saveSettings = async () => {
    try {
      await fetch('http://localhost:3001/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      onClose();
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  const resetPersonality = async (wipeMemories: boolean) => {
    if (!confirm('Are you sure? This will reset Evelyn\'s personality.' + (wipeMemories ? ' All memories will be deleted.' : ''))) {
      return;
    }
    
    try {
      await fetch('http://localhost:3001/api/personality/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wipeMemories })
      });
      alert('Personality reset successfully');
    } catch (err) {
      console.error('Failed to reset personality:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-glass-card backdrop-blur-xl border border-white/10 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in-up">
        {/* Glass Header */}
        <div className="glass-header px-6 py-4 rounded-t-xl">
          <h2 className="text-xl font-bold font-mono uppercase tracking-wide text-white">Settings</h2>
        </div>

        <div className="p-6 space-y-6">
          {/* Thought Verbosity */}
          <div>
            <label className="block text-xs font-mono font-medium uppercase tracking-wide text-terminal-400 mb-2">Thought Verbosity</label>
            <select
              value={settings.thoughtVerbosity}
              onChange={(e) => setSettings({ ...settings, thoughtVerbosity: e.target.value })}
              className="w-full bg-black/40 backdrop-blur-sm text-white rounded-sm px-3 py-2.5 border border-white/15 hover:border-white/25 focus:border-orange focus:outline-none focus:shadow-[0_0_0_3px_rgba(255,107,53,0.15)] transition-all text-sm font-mono"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <p className="text-xs text-terminal-500 mt-1.5 font-mono">
              Controls how much detail Evelyn shares about her thinking process
            </p>
          </div>

          {/* Memory Privacy Default */}
          <div>
            <label className="block text-xs font-mono font-medium uppercase tracking-wide text-terminal-400 mb-2">Memory Privacy Default</label>
            <select
              value={settings.memoryPrivacyDefault}
              onChange={(e) => setSettings({ ...settings, memoryPrivacyDefault: e.target.value })}
              className="w-full bg-black/40 backdrop-blur-sm text-white rounded-sm px-3 py-2.5 border border-white/15 hover:border-white/25 focus:border-orange focus:outline-none focus:shadow-[0_0_0_3px_rgba(255,107,53,0.15)] transition-all text-sm font-mono"
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
              <option value="ephemeral">Ephemeral (24h)</option>
            </select>
            <p className="text-xs text-terminal-500 mt-1.5 font-mono">
              Default privacy level for new memories
            </p>
          </div>

          {/* Search Preference */}
          <div>
            <label className="block text-xs font-mono font-medium uppercase tracking-wide text-terminal-400 mb-2">Search Preference</label>
            <select
              value={settings.searchPreference}
              onChange={(e) => setSettings({ ...settings, searchPreference: e.target.value })}
              className="w-full bg-black/40 backdrop-blur-sm text-white rounded-sm px-3 py-2.5 border border-white/15 hover:border-white/25 focus:border-orange focus:outline-none focus:shadow-[0_0_0_3px_rgba(255,107,53,0.15)] transition-all text-sm font-mono"
            >
              <option value="auto">Auto</option>
              <option value="never">Never</option>
              <option value="ask">Ask First</option>
            </select>
            <p className="text-xs text-terminal-500 mt-1.5 font-mono">
              When Evelyn should search for latest information
            </p>
          </div>

          {/* LLM Model */}
          <div>
            <label className="block text-xs font-mono font-medium uppercase tracking-wide text-terminal-400 mb-2">LLM Model</label>
            <select
              value={settings.llmModel}
              onChange={(e) => setSettings({ ...settings, llmModel: e.target.value })}
              className="w-full bg-black/40 backdrop-blur-sm text-white rounded-sm px-3 py-2.5 border border-white/15 hover:border-white/25 focus:border-orange focus:outline-none focus:shadow-[0_0_0_3px_rgba(255,107,53,0.15)] transition-all text-sm font-mono"
            >
              <option value="x-ai/grok-4.1-fast:free">Grok 4.1 Fast (Free)</option>
              <option value="anthropic/claude-opus-4.5">Claude Opus 4.5</option>
            </select>
            <p className="text-xs text-terminal-500 mt-1.5 font-mono">
              {settings.llmModel === 'x-ai/grok-4.1-fast:free'
                ? 'Fast responses, free tier, good for general use'
                : 'Most capable model, best for complex tasks (costs credits)'}
            </p>
          </div>

          {/* Web Search Provider */}
          <div>
            <label className="block text-xs font-mono font-medium uppercase tracking-wide text-terminal-400 mb-2">Web Search Provider</label>
            <select
              value={settings.webSearchProvider}
              onChange={(e) => setSettings({ ...settings, webSearchProvider: e.target.value })}
              className="w-full bg-black/40 backdrop-blur-sm text-white rounded-sm px-3 py-2.5 border border-white/15 hover:border-white/25 focus:border-orange focus:outline-none focus:shadow-[0_0_0_3px_rgba(255,107,53,0.15)] transition-all text-sm font-mono"
            >
              <option value="grok">Grok Agent Tools (web + X + code)</option>
              <option value="perplexity">Perplexity Sonar Pro (web only)</option>
            </select>
            <p className="text-xs text-terminal-500 mt-1.5 font-mono">
              {settings.webSearchProvider === 'grok'
                ? 'Native Grok tools: web search, X/Twitter search, Python code execution'
                : 'Perplexity Sonar Pro: Deep web research with citations'}
            </p>
          </div>

          {/* Agentic Mode */}
          <div className="border border-orange/30 rounded-lg p-4 bg-orange/5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.agenticMode}
                onChange={(e) => setSettings({ ...settings, agenticMode: e.target.checked })}
                className="w-5 h-5 accent-orange rounded"
              />
              <div>
                <span className="text-sm font-semibold text-white">Agentic Mode</span>
                <p className="text-xs text-terminal-500 mt-1 font-mono">
                  When enabled, Evelyn can search the web, create interactive demos,
                  edit documents, and execute code. Disable for pure conversation.
                </p>
              </div>
            </label>
          </div>

          {/* Enable Diagnostics */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableDiagnostics}
                onChange={(e) => setSettings({ ...settings, enableDiagnostics: e.target.checked })}
                className="w-4 h-4 accent-orange rounded"
              />
              <span className="text-sm font-semibold text-white">Enable Diagnostics Panel</span>
            </label>
          </div>

          {/* Include Codebase Context */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.includeCodebaseContext}
                onChange={(e) => setSettings({ ...settings, includeCodebaseContext: e.target.checked })}
                className="w-4 h-4 accent-orange rounded"
              />
              <span className="text-sm font-semibold text-white">Include Codebase Context in Chat</span>
            </label>
            <p className="text-xs text-terminal-500 mt-1.5 ml-7 font-mono">
              When enabled, Evelyn will have access to the document content when chatting in the Collaborate panel (increases token usage)
            </p>
          </div>

          {/* Danger Zone */}
          <div className="border border-red-500/30 rounded-lg p-4 bg-red-500/5">
            <h3 className="text-xs font-mono font-bold text-red-400 mb-3 uppercase tracking-wide">Danger Zone</h3>
            <div className="space-y-2">
              <button
                onClick={() => resetPersonality(false)}
                className="w-full bg-red-600/90 hover:bg-red-600 text-white px-4 py-2.5 rounded-md font-medium text-sm transition-all hover:-translate-y-0.5 active:scale-[0.98]"
              >
                Reset Personality (Keep Memories)
              </button>
              <button
                onClick={() => resetPersonality(true)}
                className="w-full bg-red-600/90 hover:bg-red-600 text-white px-4 py-2.5 rounded-md font-medium text-sm transition-all hover:-translate-y-0.5 active:scale-[0.98]"
              >
                Reset Everything (Delete All Memories)
              </button>
            </div>
          </div>
        </div>

        {/* Glass Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-surface-1/50 flex gap-3 justify-end rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-terminal-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={saveSettings}
            className="bg-orange hover:bg-orange-dark px-4 py-2 rounded-md text-white font-medium text-sm transition-all hover:-translate-y-0.5 active:scale-[0.98] shadow-sm"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
