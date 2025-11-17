import { useStore } from '../../state/store';

export default function ContextUsageIndicator() {
  const { contextUsage } = useStore();

  const tokens = contextUsage?.tokens ?? 0;
  const maxTokens = contextUsage?.maxTokens ?? 150000;
  const percentage = contextUsage?.percentage ?? 0;
  const messageCount = contextUsage?.messageCount ?? 0;
  const rollingWindowSize = contextUsage?.rollingWindowSize ?? 150;
  const windowStatus = contextUsage?.windowStatus ?? 'partial';
  const messageIdsInContext = contextUsage?.messageIdsInContext ?? [];

  const getColorClass = () => {
    if (percentage > 90) return 'text-red-400';
    if (percentage > 75) return 'text-yellow-400';
    if (percentage > 50) return 'text-cyan-400';
    return 'text-green-400';
  };

  const getBarColor = () => {
    if (percentage > 90) return 'bg-red-400';
    if (percentage > 75) return 'bg-yellow-400';
    if (percentage > 50) return 'bg-cyan-400';
    return 'bg-green-400';
  };

  return (
    <div className="flex items-center gap-2 bg-black/60 border border-cyan-500/30 rounded px-3 py-1.5 group hover:border-cyan-500/50 transition-all relative">
      {/* Visual Token Bar */}
      <div className="relative w-16 h-1.5 bg-gray-800 rounded overflow-hidden">
        <div
          className={`h-full ${getBarColor()} rounded transition-all duration-500`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {/* Stats (minimal) */}
      <div className="flex items-center gap-2 monospace">
        <span className={`text-[10px] font-bold ${getColorClass()} transition-colors`}>
          {(tokens / 1000).toFixed(1)}K
        </span>
        <span className="text-[9px] text-gray-600">/</span>
        <span className="text-[10px] text-gray-500">150K</span>
      </div>

      {/* Window status indicator */}
      <div className="flex items-center gap-1">
        <span className={`text-[9px] font-semibold ${windowStatus === 'full' ? 'text-yellow-400' : 'text-cyan-400'}`}>
          {messageCount}/{rollingWindowSize}
        </span>
      </div>

      {/* Tooltip on hover */}
      <div className="hidden group-hover:block absolute top-full mt-2 left-1/2 transform -translate-x-1/2 terminal-panel rounded px-4 py-3 shadow-[0_0_20px_rgba(0,255,255,0.3)] z-50 min-w-[260px] animate-fade-in">
        <div className="space-y-2 monospace text-xs">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">CTX WINDOW</span>
            <span className={`font-bold ${getColorClass()}`}>
              {percentage.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">TOKENS</span>
            <span className="text-white">{tokens.toLocaleString()} / {maxTokens.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">MESSAGES IN CONTEXT</span>
            <span className="text-white">{messageCount} / {rollingWindowSize}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">WINDOW STATUS</span>
            <span className={`font-semibold ${windowStatus === 'full' ? 'text-yellow-400' : 'text-cyan-400'}`}>
              {windowStatus === 'full' ? 'FULL' : 'PARTIAL'}
            </span>
          </div>
          {messageCount === 0 && (
            <div className="border-t border-cyan-500/30 pt-2">
              <p className="text-[9px] text-gray-600 text-center">
                Will update as you chat
              </p>
            </div>
          )}
          {windowStatus === 'full' && (
            <>
              <div className="border-t border-cyan-500/30 pt-2" />
              <div className="text-[9px] text-gray-400 leading-tight">
                <p className="text-yellow-400 font-bold mb-1">ROLLING WINDOW ACTIVE</p>
                <p>Showing most recent {rollingWindowSize} messages. Older messages are preserved in long-term memory.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
