import { useState, useEffect, useRef } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Globe, ExternalLink, Brain } from 'lucide-react';

interface AgentBrowsingResultsProps {
  query: string;
  summary: string;
  pages: Array<{
    title: string;
    url: string;
    evelynReaction?: string;
    evelynThought?: string;
    keyPoints: string[];
  }>;
  timestamp: string;
}

export default function AgentBrowsingResults({
  query,
  summary,
  pages,
  timestamp
}: AgentBrowsingResultsProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAllPages, setShowAllPages] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when expanded
  useEffect(() => {
    if (expanded || showAllPages) {
      // Wait for the expansion animation to complete, then scroll
      setTimeout(() => {
        // Scroll to the bottom of the container's parent (the message list)
        const messageList = containerRef.current?.closest('.overflow-y-auto');
        if (messageList) {
          messageList.scrollTo({
            top: messageList.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  }, [expanded, showAllPages]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const visiblePages = showAllPages ? pages : pages.slice(0, 3);

  return (
    <div ref={containerRef} className="my-4 animate-fade-in">
      {/* Badge */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <div className="bg-terminal-900 border border-white/20 px-3 py-1 flex items-center gap-2 text-xs font-mono">
          <Sparkles className="w-3 h-3 text-orange" />
          <span className="text-terminal-400 uppercase">Browsing Results:</span>
          <span className="text-white font-medium">{query}</span>
        </div>
        <span className="text-xs text-gray-500">{formatTime(timestamp)}</span>
      </div>

      {/* Main card */}
      <div className="bg-terminal-900 border-2 border-orange p-5 transition-colors overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-10 h-10 bg-orange/20 border-2 border-orange flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="font-semibold text-white text-sm mb-1">
                Evelyn's Browsing Insights
              </div>
              <div className="text-xs text-gray-400">
                Explored {pages.length} page{pages.length !== 1 ? 's' : ''} across the web
              </div>
            </div>
          </div>

          <button
            onClick={() => setExpanded(!expanded)}
            className="bg-terminal-900 border border-white/20 hover:border-white/30 w-8 h-8 flex items-center justify-center transition-colors flex-shrink-0"
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-white" />
            ) : (
              <ChevronDown className="w-4 h-4 text-white" />
            )}
          </button>
        </div>

        {/* Summary - always visible, truncated */}
        <div className="bg-terminal-black border-2 border-orange p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-orange" />
            <span className="text-xs font-mono font-semibold text-orange uppercase tracking-wide">
              What Evelyn Discovered
            </span>
          </div>
          <div className="text-sm text-gray-200 leading-relaxed">
            {!expanded && summary.length > 300 ? (
              <>
                {summary.slice(0, 300)}...
                <button
                  onClick={() => setExpanded(true)}
                  className="text-orange hover:text-orange-dark ml-1 font-mono"
                >
                  read more
                </button>
              </>
            ) : (
              <div className="whitespace-pre-wrap">{summary}</div>
            )}
          </div>
        </div>

        {/* Pages preview - show 3 by default */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                Pages Visited ({pages.length})
              </span>
            </div>
            {pages.length > 3 && !expanded && (
              <button
                onClick={() => setShowAllPages(!showAllPages)}
                className="text-xs text-orange hover:text-orange-dark transition-colors font-mono"
              >
                {showAllPages ? 'Show less' : `+${pages.length - 3} more`}
              </button>
            )}
          </div>

          <div className="space-y-2">
            {visiblePages.map((page, idx) => (
              <div
                key={idx}
                className="bg-terminal-black border-2 border-white/20 hover:border-white/30 p-3 transition-colors"
              >
                <div className="flex items-start gap-2 mb-2">
                  <div className="w-5 h-5 bg-orange/20 border border-orange flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs text-orange font-mono font-medium">{idx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-white hover:text-orange transition-colors font-medium flex items-center gap-1 group"
                    >
                      <span className="truncate">{page.title}</span>
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </a>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">
                      {new URL(page.url).hostname}
                    </div>
                  </div>
                </div>

                {/* Show reaction if available and expanded */}
                {expanded && page.evelynReaction && (
                  <div className="text-xs text-gray-300 italic mt-2 pl-7">
                    "{page.evelynReaction}"
                  </div>
                )}

                {/* Show key points if expanded */}
                {expanded && page.keyPoints.length > 0 && (
                  <div className="mt-2 pl-7 space-y-1">
                    {page.keyPoints.slice(0, 2).map((point, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-gray-400">
                        <span className="text-orange mt-0.5">•</span>
                        <span className="flex-1">{point}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Expand hint */}
        {!expanded && (
          <div className="text-xs text-center text-gray-500 mt-4">
            Click <ChevronDown className="w-3 h-3 inline text-orange" /> to see full insights and all pages
          </div>
        )}
      </div>
    </div>
  );
}

