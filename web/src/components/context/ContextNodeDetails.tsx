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
              <div className="bg-terminal-black border-2 border-white/20 p-3">
                <div className="text-xs text-terminal-400 font-mono uppercase tracking-wide mb-1">Tokens</div>
                <div className="text-2xl font-bold text-cyan-400 font-mono">{sources.systemPrompt.tokens.toLocaleString()}</div>
              </div>
              <div className="bg-terminal-black border-2 border-white/20 p-3">
                <div className="text-xs text-terminal-400 font-mono uppercase tracking-wide mb-1">Characters</div>
                <div className="text-2xl font-bold text-cyan-400 font-mono">{sources.systemPrompt.length.toLocaleString()}</div>
              </div>
            </div>
            <div className="text-sm text-terminal-300 font-mono">
              The system prompt defines Evelyn's core behavior, personality traits, and interaction guidelines.
              It remains constant across all conversations.
            </div>
          </div>
        );

      case 'personality':
        return (
          <div className="space-y-4">
            <div className="bg-terminal-black border-2 border-purple-500 p-4 space-y-3">
              <h4 className="text-sm font-bold text-purple-400 font-mono uppercase tracking-wide">Mood</h4>
              <div className="grid grid-cols-3 gap-3 text-sm font-mono">
                <div>
                  <div className="text-terminal-400 uppercase tracking-wide">Valence</div>
                  <div className="text-purple-400 font-bold">{sources.personality.mood.valence.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-terminal-400 uppercase tracking-wide">Arousal</div>
                  <div className="text-purple-400 font-bold">{sources.personality.mood.arousal.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-terminal-400 uppercase tracking-wide">Stance</div>
                  <div className="text-purple-400 font-bold">{sources.personality.mood.stance}</div>
                </div>
              </div>
            </div>

            <div className="bg-terminal-black border-2 border-purple-500 p-4 space-y-3">
              <h4 className="text-sm font-bold text-purple-400 font-mono uppercase tracking-wide">Relationship</h4>
              <div className="grid grid-cols-2 gap-3 text-sm font-mono">
                <div>
                  <div className="text-terminal-400 uppercase tracking-wide">Stage</div>
                  <div className="text-purple-400 font-bold">{sources.personality.relationship.stage}</div>
                </div>
                <div>
                  <div className="text-terminal-400 uppercase tracking-wide">Closeness</div>
                  <div className="text-purple-400 font-bold">{sources.personality.relationship.closeness.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-terminal-400 uppercase tracking-wide">Trust</div>
                  <div className="text-purple-400 font-bold">{sources.personality.relationship.trust.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-terminal-400 uppercase tracking-wide">Flirtation</div>
                  <div className="text-purple-400 font-bold">{sources.personality.relationship.flirtation.toFixed(2)}</div>
                </div>
              </div>
            </div>

            <div className="bg-terminal-black border-2 border-purple-500 p-4 space-y-2">
              <h4 className="text-sm font-bold text-purple-400 font-mono uppercase tracking-wide">Beliefs ({sources.personality.beliefs.length})</h4>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {sources.personality.beliefs.map((belief, idx) => (
                  <div key={idx} className="text-xs font-mono bg-terminal-900 border-2 border-white/20 p-2">
                    <div className="text-purple-400 font-bold">{belief.subject}</div>
                    <div className="text-terminal-200">{belief.statement}</div>
                    <div className="text-terminal-500 mt-1">Confidence: {(belief.confidence * 100).toFixed(0)}%</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-terminal-black border-2 border-purple-500 p-4 space-y-2">
              <h4 className="text-sm font-bold text-purple-400 font-mono uppercase tracking-wide">Goals ({sources.personality.goals.length})</h4>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {sources.personality.goals.map((goal, idx) => (
                  <div key={idx} className="text-xs font-mono bg-terminal-900 border-2 border-white/20 p-2">
                    <div className="text-purple-400 font-bold">{goal.title}</div>
                    <div className="text-terminal-200">{goal.description}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="text-terminal-500">{goal.category}</div>
                      <div className="text-terminal-500">Progress: {goal.progress}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-terminal-black border-2 border-purple-500 p-4 space-y-2">
              <h4 className="text-sm font-bold text-purple-400 font-mono uppercase tracking-wide">Emotional Threads ({sources.personality.threads.length})</h4>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {sources.personality.threads.map((thread, idx) => (
                  <div key={idx} className="text-xs font-mono bg-terminal-900 border-2 border-white/20 p-2">
                    <div className="text-purple-400 font-bold">{thread.topic}</div>
                    <div className="text-terminal-200">{thread.context}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="text-terminal-500">{thread.emotion}</div>
                      <div className="text-terminal-500">Intensity: {thread.intensity.toFixed(2)}</div>
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
              <div className="bg-terminal-black border-2 border-white/20 p-3">
                <div className="text-xs text-terminal-400 font-mono uppercase tracking-wide mb-1">Total Count</div>
                <div className="text-2xl font-bold text-green-400 font-mono">{sources.memories.count}</div>
              </div>
              <div className="bg-terminal-black border-2 border-white/20 p-3">
                <div className="text-xs text-terminal-400 font-mono uppercase tracking-wide mb-1">Tokens</div>
                <div className="text-2xl font-bold text-green-400 font-mono">{sources.memories.tokens.toLocaleString()}</div>
              </div>
            </div>

            <div className="bg-terminal-black border-2 border-green-500 p-4 space-y-2">
              <h4 className="text-sm font-bold text-green-400 font-mono uppercase tracking-wide">Memory Types</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(sources.memories.types).map(([type, count]) => (
                  <div key={type} className="bg-terminal-900 border-2 border-white/20 p-2 text-sm font-mono">
                    <div className="text-terminal-400 uppercase tracking-wide">{type}</div>
                    <div className="text-green-400 font-bold">{count}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-terminal-black border-2 border-green-500 p-4 space-y-2">
              <h4 className="text-sm font-bold text-green-400 font-mono uppercase tracking-wide">Memory IDs in Context</h4>
              <div className="max-h-32 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {sources.memories.ids.map((id) => (
                    <span key={id} className="bg-green-500/20 border border-green-500 text-green-400 px-2 py-1 text-xs font-mono">
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
              <div className="bg-terminal-black border-2 border-white/20 p-3">
                <div className="text-xs text-terminal-400 font-mono uppercase tracking-wide mb-1">Recent Searches</div>
                <div className="text-2xl font-bold text-yellow-400 font-mono">{sources.searchResults.recent}</div>
              </div>
              <div className="bg-terminal-black border-2 border-white/20 p-3">
                <div className="text-xs text-terminal-400 font-mono uppercase tracking-wide mb-1">Tokens</div>
                <div className="text-2xl font-bold text-yellow-400 font-mono">{sources.searchResults.tokens.toLocaleString()}</div>
              </div>
            </div>
            <div className="bg-terminal-black border-2 border-yellow-500 p-3">
              <div className="text-xs text-terminal-400 font-mono uppercase tracking-wide mb-1">Status</div>
              <div className="text-sm font-bold text-yellow-400 font-mono">{sources.searchResults.current ? 'Active Search' : 'Recent Only'}</div>
            </div>
            <div className="text-sm text-terminal-300 font-mono">
              Search results provide Evelyn with up-to-date information from the web,
              including citations and synthesized summaries.
            </div>
          </div>
        );

      case 'conversation':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-terminal-black border-2 border-white/20 p-3">
                <div className="text-xs text-terminal-400 font-mono uppercase tracking-wide mb-1">Messages</div>
                <div className="text-2xl font-bold text-pink-400 font-mono">{sources.conversation.messageCount}</div>
              </div>
              <div className="bg-terminal-black border-2 border-white/20 p-3">
                <div className="text-xs text-terminal-400 font-mono uppercase tracking-wide mb-1">Window</div>
                <div className="text-sm font-bold text-pink-400 font-mono">{sources.conversation.windowSize}</div>
              </div>
              <div className="bg-terminal-black border-2 border-white/20 p-3">
                <div className="text-xs text-terminal-400 font-mono uppercase tracking-wide mb-1">Status</div>
                <div className="text-sm font-bold text-pink-400 font-mono">{sources.conversation.windowStatus}</div>
              </div>
            </div>

            <div className="bg-terminal-black border-2 border-pink-500 p-4 space-y-2">
              <h4 className="text-sm font-bold text-pink-400 font-mono uppercase tracking-wide">Message IDs in Context</h4>
              <div className="max-h-32 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {sources.conversation.messageIds.map((id) => (
                    <span key={id} className="bg-pink-500/20 border border-pink-500 text-pink-400 px-2 py-1 text-xs font-mono">
                      #{id}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-terminal-black border-2 border-white/20 p-3">
              <div className="text-xs text-terminal-400 font-mono uppercase tracking-wide mb-1">Tokens</div>
              <div className="text-2xl font-bold text-pink-400 font-mono">{sources.conversation.tokens.toLocaleString()}</div>
            </div>
          </div>
        );

      case 'inner-thought':
        if (!sources.innerThought) return null;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-terminal-black border-2 border-white/20 p-3">
                <div className="text-xs text-terminal-400 font-mono uppercase tracking-wide mb-1">Tone</div>
                <div className="text-lg font-bold text-orange font-mono">{sources.innerThought.tone}</div>
              </div>
              <div className="bg-terminal-black border-2 border-white/20 p-3">
                <div className="text-xs text-terminal-400 font-mono uppercase tracking-wide mb-1">Tokens</div>
                <div className="text-2xl font-bold text-orange font-mono">{sources.innerThought.tokens.toLocaleString()}</div>
              </div>
            </div>

            <div className="bg-terminal-black border-2 border-orange p-4 space-y-2">
              <h4 className="text-sm font-bold text-orange font-mono uppercase tracking-wide">Context</h4>
              <div className="text-sm text-terminal-200 font-mono whitespace-pre-wrap">{sources.innerThought.context}</div>
            </div>

            <div className="bg-terminal-black border-2 border-orange p-4 space-y-2">
              <h4 className="text-sm font-bold text-orange font-mono uppercase tracking-wide">Approach</h4>
              <div className="text-sm text-terminal-200 font-mono whitespace-pre-wrap">{sources.innerThought.approach}</div>
            </div>
          </div>
        );

      default:
        return <div className="text-terminal-400 font-mono">Node details not available</div>;
    }
  };

  const getNodeTitle = () => {
    const titles: Record<string, string> = {
      'system-prompt': 'System Prompt',
      'personality': 'Personality',
      'memories': 'Memories',
      'search': 'Search Results',
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
      'conversation': 'pink',
      'inner-thought': 'orange',
    };
    return colors[nodeId] || 'gray';
  };

  const color = getNodeColor();

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-terminal-900 border-2 max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col"
        style={{ borderColor: `var(--${color}-500)` }}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b-2 border-${color}-500`}>
          <div className="flex items-center gap-3">
            <h2 className={`text-xl font-bold text-${color}-400 font-mono uppercase tracking-wide`}>
              {getNodeTitle()}
            </h2>
            <button
              onClick={() => setDebugMode(!debugMode)}
              className={`px-2 py-1 text-xs font-mono uppercase tracking-wide border-2 transition-colors ${
                debugMode ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500' : 'bg-terminal-black text-terminal-400 border-white/20 hover:border-white/30'
              }`}
            >
              {debugMode ? 'Hide JSON' : 'Debug'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => copyToClipboard(JSON.stringify(snapshot.sources[nodeId as keyof typeof snapshot.sources], null, 2))}
              className="p-2 bg-terminal-black border-2 border-white/20 hover:border-white/30 transition-colors"
              title="Copy JSON"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-terminal-400" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-terminal-black border-2 border-white/20 hover:border-red-500 transition-colors"
            >
              <X className="w-4 h-4 text-terminal-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {debugMode ? (
            <pre className="text-xs font-mono text-terminal-200 bg-terminal-black border-2 border-white/20 p-4 overflow-x-auto">
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
