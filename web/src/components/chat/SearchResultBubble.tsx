import { useState, memo } from 'react';
import MarkdownRenderer from '../common/MarkdownRenderer';

interface SearchResultBubbleProps {
  query: string;
  originalQuery?: string;
  answer: string;
  citations: string[];
  synthesis: string;
  model: string;
  timestamp: string;
}

const SearchResultBubble = memo(function SearchResultBubble({
  query,
  originalQuery,
  answer,
  citations,
  synthesis,
  model,
  timestamp
}: SearchResultBubbleProps) {
  const [expanded, setExpanded] = useState(false);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const truncateUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url.slice(0, 40) + '...';
    }
  };

  return (
    <div className="my-3 animate-fade-in-up">
      {/* Search query badge */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <div className="px-3 py-1 bg-cyan-500/10 border border-cyan-500 flex items-center gap-2 text-xs font-mono break-words overflow-hidden" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
          <span className="text-cyan-400">🔍 Searched:</span>
          <span className="text-white font-medium">{query}</span>
        </div>
        <span className="text-xs text-zinc-500">{formatTime(timestamp)}</span>
      </div>

      {/* Search result bubble */}
      <div className="p-4 bg-terminal-900 border-2 border-white/20 hover:border-orange transition-colors duration-150 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange/20 border-2 border-orange flex items-center justify-center">
              <span className="text-sm">🌐</span>
            </div>
            <div>
              <div className="font-semibold text-white text-sm">Web Search Results</div>
              <div className="text-xs text-zinc-500">{citations.length} sources • {model}</div>
            </div>
          </div>
          
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-8 h-8 bg-terminal-dark hover:bg-terminal-800 border-2 border-white/20 hover:border-white/30 flex items-center justify-center transition-colors duration-150"
          >
            <span className="text-white text-sm">{expanded ? '−' : '+'}</span>
          </button>
        </div>

        {/* Synthesis (always visible) with markdown support */}
        <div className="text-sm text-white leading-relaxed mb-3 p-3 bg-[#0f0f0f] border-2 border-white/30 break-words overflow-hidden" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
          <MarkdownRenderer content={synthesis} />
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="space-y-3 animate-fade-in">
            {/* Full answer with markdown support */}
            <div className="p-3 bg-[#0f0f0f] border-2 border-white/30 overflow-hidden">
              <div className="text-xs font-mono font-semibold uppercase text-orange mb-2">Detailed Answer:</div>
              <div className="text-sm text-zinc-300 leading-relaxed break-words overflow-hidden" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                <MarkdownRenderer content={answer} />
              </div>
            </div>

            {/* Citations */}
            {citations.length > 0 && (
              <div className="p-3 bg-[#0f0f0f] border-2 border-white/30">
                <div className="text-xs font-mono font-semibold uppercase text-cyan-500 mb-2">
                  Sources ({citations.length}):
                </div>
                <div className="space-y-2">
                  {citations.slice(0, 8).map((citation, idx) => (
                    <a
                      key={idx}
                      href={citation}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-zinc-400 hover:text-orange transition-colors group"
                    >
                      <span className="text-orange font-mono">#{idx + 1}</span>
                      <span className="flex-1 truncate group-hover:underline">
                        {truncateUrl(citation)}
                      </span>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        →
                      </span>
                    </a>
                  ))}
                  {citations.length > 8 && (
                    <div className="text-xs text-zinc-500 italic">
                      +{citations.length - 8} more sources
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Original query if different */}
            {originalQuery && originalQuery !== query && (
              <div className="text-xs text-zinc-500 italic p-2 bg-terminal-dark border border-white/20">
                Original question: "{originalQuery}"
              </div>
            )}
          </div>
        )}

        {/* Expand hint */}
        {!expanded && citations.length > 0 && (
          <div className="text-xs text-center text-zinc-500 mt-2">
            Click <span className="text-orange">+</span> to see full answer and {citations.length} sources
          </div>
        )}
      </div>
    </div>
  );
});

export default SearchResultBubble;

