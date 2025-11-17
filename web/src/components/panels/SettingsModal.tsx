import { useState, useEffect } from 'react';

interface Settings {
  thoughtVerbosity: string;
  memoryPrivacyDefault: string;
  enableDiagnostics: boolean;
  searchPreference: string;
  includeCodebaseContext: boolean;
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
    includeCodebaseContext: false
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-discord-gray rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-discord-gray-light">
          <h2 className="text-2xl font-bold">Settings</h2>
        </div>

        <div className="p-6 space-y-6">
          {/* Thought Verbosity */}
          <div>
            <label className="block text-sm font-semibold mb-2">Thought Verbosity</label>
            <select
              value={settings.thoughtVerbosity}
              onChange={(e) => setSettings({ ...settings, thoughtVerbosity: e.target.value })}
              className="w-full bg-discord-dark text-discord-text rounded px-3 py-2 border border-discord-gray-light"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <p className="text-xs text-discord-text-muted mt-1">
              Controls how much detail Evelyn shares about her thinking process
            </p>
          </div>

          {/* Memory Privacy Default */}
          <div>
            <label className="block text-sm font-semibold mb-2">Memory Privacy Default</label>
            <select
              value={settings.memoryPrivacyDefault}
              onChange={(e) => setSettings({ ...settings, memoryPrivacyDefault: e.target.value })}
              className="w-full bg-discord-dark text-discord-text rounded px-3 py-2 border border-discord-gray-light"
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
              <option value="ephemeral">Ephemeral (24h)</option>
            </select>
            <p className="text-xs text-discord-text-muted mt-1">
              Default privacy level for new memories
            </p>
          </div>

          {/* Search Preference */}
          <div>
            <label className="block text-sm font-semibold mb-2">Search Preference</label>
            <select
              value={settings.searchPreference}
              onChange={(e) => setSettings({ ...settings, searchPreference: e.target.value })}
              className="w-full bg-discord-dark text-discord-text rounded px-3 py-2 border border-discord-gray-light"
            >
              <option value="auto">Auto</option>
              <option value="never">Never</option>
              <option value="ask">Ask First</option>
            </select>
            <p className="text-xs text-discord-text-muted mt-1">
              When Evelyn should search for latest information
            </p>
          </div>

          {/* Enable Diagnostics */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableDiagnostics}
                onChange={(e) => setSettings({ ...settings, enableDiagnostics: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm font-semibold">Enable Diagnostics Panel</span>
            </label>
          </div>

          {/* Include Codebase Context */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.includeCodebaseContext}
                onChange={(e) => setSettings({ ...settings, includeCodebaseContext: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm font-semibold">Include Codebase Context in Chat</span>
            </label>
            <p className="text-xs text-discord-text-muted mt-1 ml-6">
              When enabled, Evelyn will have access to files from the currently open Code Canvas in the conversation context (increases token usage)
            </p>
          </div>

          {/* Danger Zone */}
          <div className="border border-discord-red/30 rounded p-4 bg-discord-red/5">
            <h3 className="text-sm font-bold text-discord-red mb-3">Danger Zone</h3>
            <div className="space-y-2">
              <button
                onClick={() => resetPersonality(false)}
                className="w-full bg-discord-red hover:bg-discord-red/80 text-white px-4 py-2 rounded font-medium"
              >
                Reset Personality (Keep Memories)
              </button>
              <button
                onClick={() => resetPersonality(true)}
                className="w-full bg-discord-red hover:bg-discord-red/80 text-white px-4 py-2 rounded font-medium"
              >
                Reset Everything (Delete All Memories)
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-discord-gray-light flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded hover:bg-discord-gray-light"
          >
            Cancel
          </button>
          <button
            onClick={saveSettings}
            className="bg-discord-accent hover:bg-discord-accent-hover px-4 py-2 rounded text-white font-medium"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
