import { useStore } from '../../state/store';
import ContextFlowChart from '../context/ContextFlowChart';

export default function ContextPanel() {
  const { contextSnapshot } = useStore();

  if (!contextSnapshot) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="max-w-2xl w-full bg-terminal-900 border-2 border-white/20 p-8 text-center">
          <div className="text-orange text-6xl mb-4">⚡</div>
          <h2 className="text-xl font-bold text-white mb-2 font-mono uppercase tracking-wide">
            No Context Snapshot Available
          </h2>
          <p className="text-terminal-300 font-mono text-sm">
            The context visualization will appear here when Evelyn processes a message.
          </p>
          <p className="text-terminal-500 font-mono text-xs mt-4">
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
        <div className="bg-terminal-900 border-2 border-white/20 p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-white font-mono uppercase tracking-wide">
              Context Snapshot
            </h1>
            <div className="flex items-center gap-4">
              <span className={`px-3 py-1 text-sm font-mono font-bold border-2 ${
                mode === 'chat' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500' :
                mode === 'coding' ? 'bg-purple-500/10 text-purple-400 border-purple-500' :
                'bg-blue-500/10 text-blue-400 border-blue-500'
              }`}>
                {mode.toUpperCase()}
              </span>
              <span className="text-terminal-400 font-mono text-sm">
                {new Date(timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>

          {/* Total Token Usage Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-mono uppercase tracking-wide">
              <span className="text-terminal-300">Total Context Usage</span>
              <span className="text-orange font-bold">
                {totalTokens.toLocaleString()} / {maxTokens.toLocaleString()} tokens
              </span>
            </div>
            <div className="w-full bg-terminal-black border-2 border-white/20 h-3 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  percentage > 90 ? 'bg-red-500' :
                  percentage > 75 ? 'bg-yellow-500' :
                  'bg-cyan-500'
                }`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
            <div className="text-right text-xs font-mono text-terminal-500">
              {percentage.toFixed(1)}% capacity
            </div>
          </div>
        </div>

        {/* Context Sources Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* System Prompt */}
          <div className="bg-terminal-900 border-2 border-cyan-500 p-4 space-y-2 hover:border-cyan-400 transition-colors">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-cyan-400 font-mono uppercase tracking-wide">System Prompt</h3>
              <span className="text-xs font-mono text-terminal-400">
                {getPercentage(sources.systemPrompt.tokens)}%
              </span>
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {sources.systemPrompt.tokens.toLocaleString()}
            </div>
            <div className="text-xs text-terminal-400 font-mono">
              {sources.systemPrompt.length} characters
            </div>
          </div>

          {/* Personality */}
          <div className="bg-terminal-900 border-2 border-purple-500 p-4 space-y-2 hover:border-purple-400 transition-colors">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-purple-400 font-mono uppercase tracking-wide">Personality</h3>
              <span className="text-xs font-mono text-terminal-400">
                {getPercentage(sources.personality.tokens)}%
              </span>
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {sources.personality.tokens.toLocaleString()}
            </div>
            <div className="text-xs text-terminal-400 font-mono space-y-1">
              <div>{sources.personality.beliefs.length} beliefs</div>
              <div>{sources.personality.goals.length} goals</div>
              <div>{sources.personality.threads.length} threads</div>
            </div>
          </div>

          {/* Memories */}
          <div className="bg-terminal-900 border-2 border-green-500 p-4 space-y-2 hover:border-green-400 transition-colors">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-green-400 font-mono uppercase tracking-wide">Memories</h3>
              <span className="text-xs font-mono text-terminal-400">
                {getPercentage(sources.memories.tokens)}%
              </span>
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {sources.memories.tokens.toLocaleString()}
            </div>
            <div className="text-xs text-terminal-400 font-mono">
              {sources.memories.count} memories
            </div>
          </div>

          {/* Search Results */}
          <div className="bg-terminal-900 border-2 border-yellow-500 p-4 space-y-2 hover:border-yellow-400 transition-colors">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-yellow-400 font-mono uppercase tracking-wide">Search Results</h3>
              <span className="text-xs font-mono text-terminal-400">
                {getPercentage(sources.searchResults.tokens)}%
              </span>
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {sources.searchResults.tokens.toLocaleString()}
            </div>
            <div className="text-xs text-terminal-400 font-mono">
              {sources.searchResults.recent} recent {sources.searchResults.current && '(active)'}
            </div>
          </div>

          {/* Conversation */}
          <div className="bg-terminal-900 border-2 border-pink-500 p-4 space-y-2 hover:border-pink-400 transition-colors">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-pink-400 font-mono uppercase tracking-wide">Conversation</h3>
              <span className="text-xs font-mono text-terminal-400">
                {getPercentage(sources.conversation.tokens)}%
              </span>
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {sources.conversation.tokens.toLocaleString()}
            </div>
            <div className="text-xs text-terminal-400 font-mono">
              {sources.conversation.messageCount} messages ({sources.conversation.windowStatus})
            </div>
          </div>

          {/* Inner Thought */}
          {sources.innerThought && (
            <div className="bg-terminal-900 border-2 border-orange p-4 space-y-2 hover:border-orange-dark transition-colors">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-orange font-mono uppercase tracking-wide">Inner Thought</h3>
                <span className="text-xs font-mono text-terminal-400">
                  {getPercentage(sources.innerThought.tokens)}%
                </span>
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                {sources.innerThought.tokens.toLocaleString()}
              </div>
              <div className="text-xs text-terminal-400 font-mono">
                {sources.innerThought.tone}
              </div>
            </div>
          )}
        </div>

        {/* Flowchart Visualization */}
        <div className="bg-terminal-900 border-2 border-white/20 p-6 space-y-4">
          <h3 className="text-lg font-bold text-white font-mono uppercase tracking-wide border-b-2 border-white/20 pb-2">
            Context Flow Visualization
          </h3>
          <ContextFlowChart snapshot={contextSnapshot} />
        </div>

        {/* Detailed Sections */}
        <div className="space-y-4">
          {/* Personality Details */}
          <div className="bg-terminal-900 border-2 border-purple-500 p-6 space-y-4">
            <h3 className="text-lg font-bold text-purple-400 font-mono uppercase tracking-wide border-b-2 border-purple-500 pb-2">
              Personality Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-terminal-black border-2 border-white/20 p-4">
                <h4 className="text-sm text-terminal-300 font-mono uppercase tracking-wide mb-2">Mood</h4>
                <div className="text-sm font-mono space-y-1">
                  <div>Valence: <span className="text-purple-400">{sources.personality.mood.valence.toFixed(2)}</span></div>
                  <div>Arousal: <span className="text-purple-400">{sources.personality.mood.arousal.toFixed(2)}</span></div>
                  <div>Stance: <span className="text-purple-400">{sources.personality.mood.stance}</span></div>
                </div>
              </div>
              <div className="bg-terminal-black border-2 border-white/20 p-4">
                <h4 className="text-sm text-terminal-300 font-mono uppercase tracking-wide mb-2">Relationship</h4>
                <div className="text-sm font-mono space-y-1">
                  <div>Stage: <span className="text-purple-400">{sources.personality.relationship.stage}</span></div>
                  <div>Closeness: <span className="text-purple-400">{sources.personality.relationship.closeness.toFixed(2)}</span></div>
                  <div>Trust: <span className="text-purple-400">{sources.personality.relationship.trust.toFixed(2)}</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Memory Types */}
          {Object.keys(sources.memories.types).length > 0 && (
            <div className="bg-terminal-900 border-2 border-green-500 p-6 space-y-4">
              <h3 className="text-lg font-bold text-green-400 font-mono uppercase tracking-wide border-b-2 border-green-500 pb-2">
                Memory Distribution
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(sources.memories.types).map(([type, count]) => (
                  <div key={type} className="bg-terminal-black border-2 border-white/20 p-3">
                    <div className="text-xs text-terminal-400 font-mono uppercase tracking-wide mb-1">{type}</div>
                    <div className="text-lg font-bold text-green-400 font-mono">{count}</div>
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
