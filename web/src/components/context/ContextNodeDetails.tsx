import { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import type { ContextSnapshot } from '../../state/store';

interface ContextNodeDetailsProps {
  nodeId: string;
  snapshot: ContextSnapshot;
  onClose: () => void;
}

export default function ContextNodeDetails({ nodeId, snapshot, onClose }: ContextNodeDetailsProps) {
  const [copied, setCopied] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderNodeContent = () => {
    const { sources } = snapshot;

    switch (nodeId) {
      case 'system-prompt':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800/50 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Tokens</div>
                <div className="text-2xl font-bold text-cyan-400">{sources.systemPrompt.tokens.toLocaleString()}</div>
              </div>
              <div className="bg-gray-800/50 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Characters</div>
                <div className="text-2xl font-bold text-cyan-400">{sources.systemPrompt.length.toLocaleString()}</div>
              </div>
            </div>
            <div className="text-sm text-gray-400 monospace">
              The system prompt defines Evelyn's core behavior, personality traits, and interaction guidelines.
              It remains constant across all conversations.
            </div>
          </div>
        );

      case 'personality':
        return (
          <div className="space-y-4">
            <div className="bg-gray-800/50 rounded p-4 space-y-3">
              <h4 className="text-sm font-bold text-purple-300">Mood</h4>
              <div className="grid grid-cols-3 gap-3 text-sm monospace">
                <div>
                  <div className="text-gray-400">Valence</div>
                  <div className="text-purple-400 font-bold">{sources.personality.mood.valence.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-gray-400">Arousal</div>
                  <div className="text-purple-400 font-bold">{sources.personality.mood.arousal.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-gray-400">Stance</div>
                  <div className="text-purple-400 font-bold">{sources.personality.mood.stance}</div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded p-4 space-y-3">
              <h4 className="text-sm font-bold text-purple-300">Relationship</h4>
              <div className="grid grid-cols-2 gap-3 text-sm monospace">
                <div>
                  <div className="text-gray-400">Stage</div>
                  <div className="text-purple-400 font-bold">{sources.personality.relationship.stage}</div>
                </div>
                <div>
                  <div className="text-gray-400">Closeness</div>
                  <div className="text-purple-400 font-bold">{sources.personality.relationship.closeness.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-gray-400">Trust</div>
                  <div className="text-purple-400 font-bold">{sources.personality.relationship.trust.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-gray-400">Flirtation</div>
                  <div className="text-purple-400 font-bold">{sources.personality.relationship.flirtation.toFixed(2)}</div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded p-4 space-y-2">
              <h4 className="text-sm font-bold text-purple-300">Beliefs ({sources.personality.beliefs.length})</h4>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {sources.personality.beliefs.map((belief, idx) => (
                  <div key={idx} className="text-xs monospace bg-gray-900/50 p-2 rounded">
                    <div className="text-purple-400 font-bold">{belief.subject}</div>
                    <div className="text-gray-300">{belief.statement}</div>
                    <div className="text-gray-500 mt-1">Confidence: {(belief.confidence * 100).toFixed(0)}%</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-800/50 rounded p-4 space-y-2">
              <h4 className="text-sm font-bold text-purple-300">Goals ({sources.personality.goals.length})</h4>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {sources.personality.goals.map((goal, idx) => (
                  <div key={idx} className="text-xs monospace bg-gray-900/50 p-2 rounded">
                    <div className="text-purple-400 font-bold">{goal.title}</div>
                    <div className="text-gray-300">{goal.description}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="text-gray-500">{goal.category}</div>
                      <div className="text-gray-500">Progress: {goal.progress}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-800/50 rounded p-4 space-y-2">
              <h4 className="text-sm font-bold text-purple-300">Emotional Threads ({sources.personality.threads.length})</h4>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {sources.personality.threads.map((thread, idx) => (
                  <div key={idx} className="text-xs monospace bg-gray-900/50 p-2 rounded">
                    <div className="text-purple-400 font-bold">{thread.topic}</div>
                    <div className="text-gray-300">{thread.context}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="text-gray-500">{thread.emotion}</div>
                      <div className="text-gray-500">Intensity: {thread.intensity.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'memories':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800/50 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Total Count</div>
                <div className="text-2xl font-bold text-green-400">{sources.memories.count}</div>
              </div>
              <div className="bg-gray-800/50 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Tokens</div>
                <div className="text-2xl font-bold text-green-400">{sources.memories.tokens.toLocaleString()}</div>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded p-4 space-y-2">
              <h4 className="text-sm font-bold text-green-300">Memory Types</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(sources.memories.types).map(([type, count]) => (
                  <div key={type} className="bg-gray-900/50 p-2 rounded text-sm monospace">
                    <div className="text-gray-400">{type}</div>
                    <div className="text-green-400 font-bold">{count}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-800/50 rounded p-4 space-y-2">
              <h4 className="text-sm font-bold text-green-300">Memory IDs in Context</h4>
              <div className="max-h-32 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {sources.memories.ids.map((id) => (
                    <span key={id} className="bg-green-500/20 text-green-300 px-2 py-1 rounded text-xs monospace">
                      #{id}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'search':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800/50 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Recent Searches</div>
                <div className="text-2xl font-bold text-yellow-400">{sources.searchResults.recent}</div>
              </div>
              <div className="bg-gray-800/50 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Tokens</div>
                <div className="text-2xl font-bold text-yellow-400">{sources.searchResults.tokens.toLocaleString()}</div>
              </div>
            </div>
            <div className="text-sm text-gray-400 monospace">
              Search results provide Evelyn with up-to-date information from the web,
              including citations and synthesized summaries.
            </div>
          </div>
        );

      case 'codebase':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-800/50 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Files</div>
                <div className="text-2xl font-bold text-blue-400">{sources.codebase.files}</div>
              </div>
              <div className="bg-gray-800/50 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Tokens</div>
                <div className="text-2xl font-bold text-blue-400">{sources.codebase.tokens.toLocaleString()}</div>
              </div>
              <div className="bg-gray-800/50 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Status</div>
                <div className="text-sm font-bold text-blue-400">{sources.codebase.active ? 'Active' : 'Inactive'}</div>
              </div>
            </div>
            <div className="bg-gray-800/50 rounded p-4">
              <div className="text-xs text-gray-400 mb-1">Project</div>
              <div className="text-sm text-blue-400 monospace font-bold">{sources.codebase.project || 'N/A'}</div>
            </div>
          </div>
        );

      case 'conversation':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-800/50 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Messages</div>
                <div className="text-2xl font-bold text-pink-400">{sources.conversation.messageCount}</div>
              </div>
              <div className="bg-gray-800/50 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Window</div>
                <div className="text-sm font-bold text-pink-400">{sources.conversation.windowSize}</div>
              </div>
              <div className="bg-gray-800/50 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Status</div>
                <div className="text-sm font-bold text-pink-400">{sources.conversation.windowStatus}</div>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded p-4 space-y-2">
              <h4 className="text-sm font-bold text-pink-300">Message IDs in Context</h4>
              <div className="max-h-32 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {sources.conversation.messageIds.map((id) => (
                    <span key={id} className="bg-pink-500/20 text-pink-300 px-2 py-1 rounded text-xs monospace">
                      #{id}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded p-3">
              <div className="text-xs text-gray-400 mb-1">Tokens</div>
              <div className="text-2xl font-bold text-pink-400">{sources.conversation.tokens.toLocaleString()}</div>
            </div>
          </div>
        );

      case 'inner-thought':
        if (!sources.innerThought) return null;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800/50 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Tone</div>
                <div className="text-lg font-bold text-orange-400">{sources.innerThought.tone}</div>
              </div>
              <div className="bg-gray-800/50 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Tokens</div>
                <div className="text-2xl font-bold text-orange-400">{sources.innerThought.tokens.toLocaleString()}</div>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded p-4 space-y-2">
              <h4 className="text-sm font-bold text-orange-300">Context</h4>
              <div className="text-sm text-gray-300 monospace whitespace-pre-wrap">{sources.innerThought.context}</div>
            </div>

            <div className="bg-gray-800/50 rounded p-4 space-y-2">
              <h4 className="text-sm font-bold text-orange-300">Approach</h4>
              <div className="text-sm text-gray-300 monospace whitespace-pre-wrap">{sources.innerThought.approach}</div>
            </div>
          </div>
        );

      default:
        return <div className="text-gray-400">Node details not available</div>;
    }
  };

  const getNodeTitle = () => {
    const titles: Record<string, string> = {
      'system-prompt': 'System Prompt',
      'personality': 'Personality',
      'memories': 'Memories',
      'search': 'Search Results',
      'codebase': 'Codebase',
      'conversation': 'Conversation',
      'inner-thought': 'Inner Thought',
    };
    return titles[nodeId] || 'Node Details';
  };

  const getNodeColor = () => {
    const colors: Record<string, string> = {
      'system-prompt': 'cyan',
      'personality': 'purple',
      'memories': 'green',
      'search': 'yellow',
      'codebase': 'blue',
      'conversation': 'pink',
      'inner-thought': 'orange',
    };
    return colors[nodeId] || 'gray';
  };

  const color = getNodeColor();

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div 
        className="terminal-card max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col"
        style={{ borderColor: `var(--${color}-500)` }}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b border-${color}-500/30`}>
          <div className="flex items-center gap-3">
            <h2 className={`text-xl font-bold text-${color}-300 monospace`}>
              {getNodeTitle()}
            </h2>
            <button
              onClick={() => setDebugMode(!debugMode)}
              className={`px-2 py-1 rounded text-xs monospace ${
                debugMode ? 'bg-cyan-500/20 text-cyan-300' : 'bg-gray-700 text-gray-400'
              }`}
            >
              {debugMode ? 'Hide JSON' : 'Debug'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => copyToClipboard(JSON.stringify(snapshot.sources[nodeId as keyof typeof snapshot.sources], null, 2))}
              className="p-2 rounded hover:bg-gray-700 transition-colors"
              title="Copy JSON"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-gray-400" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded hover:bg-gray-700 transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {debugMode ? (
            <pre className="text-xs monospace text-gray-300 bg-gray-900 p-4 rounded overflow-x-auto">
              {JSON.stringify(snapshot.sources[nodeId as keyof typeof snapshot.sources], null, 2)}
            </pre>
          ) : (
            renderNodeContent()
          )}
        </div>
      </div>
    </div>
  );
}
