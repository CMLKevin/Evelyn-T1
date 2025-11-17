import { useStore } from '../../state/store';
import ContextFlowChart from '../context/ContextFlowChart';

export default function ContextPanel() {
  const { contextSnapshot } = useStore();

  if (!contextSnapshot) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="terminal-card max-w-2xl w-full p-8 text-center">
          <div className="text-cyan-400 text-6xl mb-4">⚡</div>
          <h2 className="text-xl font-bold text-cyan-300 mb-2 monospace">
            No Context Snapshot Available
          </h2>
          <p className="text-gray-400 monospace text-sm">
            The context visualization will appear here when Evelyn processes a message.
          </p>
          <p className="text-gray-500 monospace text-xs mt-4">
            Try sending a message to see the live context flow...
          </p>
        </div>
      </div>
    );
  }

  const { mode, sources, totalTokens, maxTokens, percentage, timestamp } = contextSnapshot;

  // Calculate token percentages for each source
  const getPercentage = (tokens: number) => ((tokens / totalTokens) * 100).toFixed(1);

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="terminal-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-cyan-300 monospace">
              Context Snapshot
            </h1>
            <div className="flex items-center gap-4">
              <span className={`px-3 py-1 rounded text-sm monospace font-bold ${
                mode === 'chat' ? 'bg-cyan-500/20 text-cyan-300' :
                mode === 'coding' ? 'bg-purple-500/20 text-purple-300' :
                'bg-blue-500/20 text-blue-300'
              }`}>
                {mode.toUpperCase()}
              </span>
              <span className="text-gray-400 monospace text-sm">
                {new Date(timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>

          {/* Total Token Usage Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm monospace">
              <span className="text-gray-300">Total Context Usage</span>
              <span className="text-cyan-400 font-bold">
                {totalTokens.toLocaleString()} / {maxTokens.toLocaleString()} tokens
              </span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  percentage > 90 ? 'bg-red-500' :
                  percentage > 75 ? 'bg-yellow-500' :
                  'bg-cyan-500'
                }`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
            <div className="text-right text-xs monospace text-gray-500">
              {percentage.toFixed(1)}% capacity
            </div>
          </div>
        </div>

        {/* Context Sources Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* System Prompt */}
          <div className="terminal-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-cyan-300 monospace">System Prompt</h3>
              <span className="text-xs monospace text-gray-400">
                {getPercentage(sources.systemPrompt.tokens)}%
              </span>
            </div>
            <div className="text-2xl font-bold text-white monospace">
              {sources.systemPrompt.tokens.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400 monospace">
              {sources.systemPrompt.length} characters
            </div>
          </div>

          {/* Personality */}
          <div className="terminal-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-purple-300 monospace">Personality</h3>
              <span className="text-xs monospace text-gray-400">
                {getPercentage(sources.personality.tokens)}%
              </span>
            </div>
            <div className="text-2xl font-bold text-white monospace">
              {sources.personality.tokens.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400 monospace space-y-1">
              <div>{sources.personality.beliefs.length} beliefs</div>
              <div>{sources.personality.goals.length} goals</div>
              <div>{sources.personality.threads.length} threads</div>
            </div>
          </div>

          {/* Memories */}
          <div className="terminal-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-green-300 monospace">Memories</h3>
              <span className="text-xs monospace text-gray-400">
                {getPercentage(sources.memories.tokens)}%
              </span>
            </div>
            <div className="text-2xl font-bold text-white monospace">
              {sources.memories.tokens.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400 monospace">
              {sources.memories.count} memories
            </div>
          </div>

          {/* Search Results */}
          <div className="terminal-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-yellow-300 monospace">Search Results</h3>
              <span className="text-xs monospace text-gray-400">
                {getPercentage(sources.searchResults.tokens)}%
              </span>
            </div>
            <div className="text-2xl font-bold text-white monospace">
              {sources.searchResults.tokens.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400 monospace">
              {sources.searchResults.recent} recent searches
            </div>
          </div>

          {/* Codebase */}
          <div className="terminal-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-blue-300 monospace">Codebase</h3>
              <span className="text-xs monospace text-gray-400">
                {getPercentage(sources.codebase.tokens)}%
              </span>
            </div>
            <div className="text-2xl font-bold text-white monospace">
              {sources.codebase.tokens.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400 monospace">
              {sources.codebase.active ? `${sources.codebase.files} files` : 'Inactive'}
            </div>
          </div>

          {/* Conversation */}
          <div className="terminal-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-pink-300 monospace">Conversation</h3>
              <span className="text-xs monospace text-gray-400">
                {getPercentage(sources.conversation.tokens)}%
              </span>
            </div>
            <div className="text-2xl font-bold text-white monospace">
              {sources.conversation.tokens.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400 monospace">
              {sources.conversation.messageCount} messages ({sources.conversation.windowStatus})
            </div>
          </div>

          {/* Inner Thought */}
          {sources.innerThought && (
            <div className="terminal-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-orange-300 monospace">Inner Thought</h3>
                <span className="text-xs monospace text-gray-400">
                  {getPercentage(sources.innerThought.tokens)}%
                </span>
              </div>
              <div className="text-2xl font-bold text-white monospace">
                {sources.innerThought.tokens.toLocaleString()}
              </div>
              <div className="text-xs text-gray-400 monospace">
                {sources.innerThought.tone}
              </div>
            </div>
          )}
        </div>

        {/* Flowchart Visualization */}
        <div className="terminal-card p-6 space-y-4">
          <h3 className="text-lg font-bold text-cyan-300 monospace border-b border-cyan-500/30 pb-2">
            Context Flow Visualization
          </h3>
          <ContextFlowChart snapshot={contextSnapshot} />
        </div>

        {/* Detailed Sections */}
        <div className="space-y-4">
          {/* Personality Details */}
          <div className="terminal-card p-6 space-y-4">
            <h3 className="text-lg font-bold text-purple-300 monospace border-b border-purple-500/30 pb-2">
              Personality Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm text-gray-400 monospace mb-2">Mood</h4>
                <div className="text-sm monospace space-y-1">
                  <div>Valence: <span className="text-cyan-400">{sources.personality.mood.valence.toFixed(2)}</span></div>
                  <div>Arousal: <span className="text-cyan-400">{sources.personality.mood.arousal.toFixed(2)}</span></div>
                  <div>Stance: <span className="text-cyan-400">{sources.personality.mood.stance}</span></div>
                </div>
              </div>
              <div>
                <h4 className="text-sm text-gray-400 monospace mb-2">Relationship</h4>
                <div className="text-sm monospace space-y-1">
                  <div>Stage: <span className="text-cyan-400">{sources.personality.relationship.stage}</span></div>
                  <div>Closeness: <span className="text-cyan-400">{sources.personality.relationship.closeness.toFixed(2)}</span></div>
                  <div>Trust: <span className="text-cyan-400">{sources.personality.relationship.trust.toFixed(2)}</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Memory Types */}
          {Object.keys(sources.memories.types).length > 0 && (
            <div className="terminal-card p-6 space-y-4">
              <h3 className="text-lg font-bold text-green-300 monospace border-b border-green-500/30 pb-2">
                Memory Distribution
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(sources.memories.types).map(([type, count]) => (
                  <div key={type} className="bg-gray-800/50 rounded p-3">
                    <div className="text-xs text-gray-400 monospace mb-1">{type}</div>
                    <div className="text-lg font-bold text-green-400 monospace">{count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
