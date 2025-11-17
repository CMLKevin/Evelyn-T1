import { useEffect, useState, useMemo } from 'react';
import { useStore } from '../../state/store';
import { Brain, Sparkles, Heart, Zap, Target, TrendingUp, MessageCircle, Eye } from 'lucide-react';

interface Activity {
  id: number;
  tool: string;
  status: string;
  metadata?: {
    thought?: string;
    context?: string;
    contextConfidence?: number;
    contextReasoning?: string;
    responseApproach?: string;
    emotionalTone?: string;
    responseLength?: string;
    complexity?: string;
    memoryGuidance?: any;
    moodImpact?: any;
  };
  createdAt?: string;
}

const CONTEXT_COLORS = {
  casual: 'from-blue-500 to-cyan-500',
  deep_discussion: 'from-purple-500 to-indigo-500',
  flirty: 'from-pink-500 to-rose-500',
  emotional_support: 'from-amber-500 to-orange-500',
  intellectual_debate: 'from-violet-500 to-purple-500',
  playful: 'from-green-500 to-teal-500',
  vulnerable: 'from-red-500 to-pink-500'
};

const CONTEXT_ICONS = {
  casual: MessageCircle,
  deep_discussion: Brain,
  flirty: Heart,
  emotional_support: Heart,
  intellectual_debate: Zap,
  playful: Sparkles,
  vulnerable: Eye
};

export default function ThinkingPanel() {
  // Optimize store selector - only subscribe to activities
  const activities = useStore(state => state.activities);
  const [activeThinking, setActiveThinking] = useState<Activity | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Memoize sorted thinking activities
  const latestThinking = useMemo(() => {
    const thinkActivities = activities.filter(a => a.tool === 'think');
    if (thinkActivities.length === 0) return null;
    
    // Sort by ID (or createdAt if available) to get the truly latest activity
    const sortedActivities = [...thinkActivities].sort((a, b) => {
      // Use createdAt if available, otherwise fall back to ID
      if (a.createdAt && b.createdAt) {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return b.id - a.id;
    });
    return sortedActivities[0]; // First item is now the most recent
  }, [activities]);

  // Update active thinking when latest changes
  useEffect(() => {
    setActiveThinking(latestThinking);
  }, [latestThinking]);

  // Timer for running thinking
  useEffect(() => {
    if (!activeThinking || activeThinking.status !== 'running') {
      setElapsed(0);
      return;
    }

    const startTime = activeThinking.createdAt ? new Date(activeThinking.createdAt).getTime() : Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedMs = now - startTime;
      setElapsed(elapsedMs / 1000);
    }, 100);

    return () => clearInterval(interval);
  }, [activeThinking]);

  if (!activeThinking) {
    return null;
  }

  const { metadata, status } = activeThinking;
  const contextType = (metadata?.context || 'casual') as keyof typeof CONTEXT_COLORS;
  const ContextIcon = CONTEXT_ICONS[contextType] || Brain;
  const contextColor = CONTEXT_COLORS[contextType] || CONTEXT_COLORS.casual;

  const isRunning = status === 'running';
  const isDone = status === 'done';

  return (
    <div className="w-80 flex-shrink-0 h-full">
      {/* Main Thinking Card */}
      <div className="terminal-panel h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className={`terminal-header bg-gradient-to-r ${contextColor} relative`}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative flex items-center justify-between p-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                {isRunning && (
                  <div className="absolute inset-0 bg-white rounded-full animate-ping opacity-75" />
                )}
                <div className="relative w-10 h-10 rounded bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                  <ContextIcon className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <div className="font-bold text-white text-sm monospace">THINKING</div>
                <div className="text-xs text-white/80 capitalize monospace">
                  {metadata?.context?.replace(/_/g, ' ') || 'processing'}
                </div>
              </div>
            </div>
            {isRunning && (
              <div className="text-xs text-white/90 font-mono bg-white/10 px-2 py-1 rounded border border-white/20">
                {elapsed.toFixed(1)}s
              </div>
            )}
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 terminal-scrollbar">
          {/* Context Confidence */}
          {metadata?.contextConfidence !== undefined && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs monospace">
                <span className="text-gray-400">CONFIDENCE</span>
                <span className="text-white font-semibold">
                  {Math.round(metadata.contextConfidence * 100)}%
                </span>
              </div>
              <div className="h-1.5 bg-white/5 rounded overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${contextColor} transition-all duration-500 ease-out`}
                  style={{ width: `${metadata.contextConfidence * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Inner Thought */}
          {metadata?.thought && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-semibold text-purple-400 uppercase tracking-wide monospace">
                  Inner Thought
                </span>
              </div>
              <div className="bg-black/40 rounded border border-purple-500/20 p-3">
                <p className="text-sm text-gray-200 italic leading-relaxed monospace">
                  "{metadata.thought}"
                </p>
              </div>
            </div>
          )}

          {/* Response Approach */}
          {metadata?.responseApproach && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wide monospace">
                  Approach
                </span>
              </div>
              <div className="bg-black/40 rounded border border-cyan-500/20 p-3">
                <p className="text-sm text-gray-200 leading-relaxed monospace">
                  {metadata.responseApproach}
                </p>
              </div>
            </div>
          )}

          {/* Metadata Grid */}
          {(metadata?.emotionalTone || metadata?.complexity || metadata?.responseLength) && (
            <div className="grid grid-cols-2 gap-3">
              {metadata?.emotionalTone && (
                <div className="bg-black/40 rounded border border-pink-500/20 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Heart className="w-3.5 h-3.5 text-pink-400" />
                    <span className="text-[10px] font-semibold text-pink-400 uppercase tracking-wide monospace">
                      Tone
                    </span>
                  </div>
                  <p className="text-xs text-white capitalize monospace">
                    {metadata.emotionalTone}
                  </p>
                </div>
              )}

              {metadata?.responseLength && (
                <div className="bg-black/40 rounded border border-amber-500/20 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide monospace">
                      Length
                    </span>
                  </div>
                  <p className="text-xs font-semibold capitalize monospace text-amber-400">
                    {metadata.responseLength.replace(/_/g, ' ')}
                  </p>
                </div>
              )}

              {metadata?.complexity && (
                <div className="bg-black/40 rounded border border-purple-500/20 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wide monospace">
                      Level
                    </span>
                  </div>
                  <p className="text-xs font-semibold capitalize monospace text-purple-400">
                    {metadata.complexity}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Memory Guidance */}
          {metadata?.memoryGuidance && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide monospace">
                  Memory
                </span>
              </div>
              <div className="bg-black/40 rounded border border-amber-500/20 p-3 space-y-2">
                <div className="flex items-center justify-between monospace">
                  <span className="text-xs text-gray-400">Store</span>
                  <span className={`text-xs font-semibold ${metadata.memoryGuidance.shouldStore ? 'text-green-400' : 'text-gray-500'}`}>
                    {metadata.memoryGuidance.shouldStore ? 'YES' : 'NO'}
                  </span>
                </div>
                {metadata.memoryGuidance.additionalContext && (
                  <p className="text-xs text-gray-300 leading-relaxed monospace">
                    {metadata.memoryGuidance.additionalContext}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Status Indicator */}
          {isDone && (
            <div className="flex items-center gap-2 justify-center pt-2">
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              <span className="text-xs text-green-400 font-medium monospace">
                COMPLETE
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
