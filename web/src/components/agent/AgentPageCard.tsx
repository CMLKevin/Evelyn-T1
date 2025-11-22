import { useState, memo } from 'react';
import { ExternalLink, ChevronDown, ChevronUp, Image as ImageIcon, Brain, Sparkles } from 'lucide-react';

interface AgentPageCardProps {
  url: string;
  title: string;
  keyPoints: string[];
  screenshotBase64?: string;
  favicon?: string;
  timestamp: string;
  evelynThought?: string;
  evelynReaction?: string;
}

const AgentPageCard = memo(function AgentPageCard({
  url,
  title,
  keyPoints,
  screenshotBase64,
  favicon,
  timestamp,
  evelynThought,
  evelynReaction
}: AgentPageCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showScreenshot, setShowScreenshot] = useState(false);

  const domain = new URL(url).hostname;
  const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="bg-terminal-900 border-2 border-white/20 overflow-hidden hover:border-white/30 transition-colors">
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        {/* Favicon */}
        <div className="flex-shrink-0 w-8 h-8 bg-terminal-black border border-white/20 flex items-center justify-center overflow-hidden">
          {favicon ? (
            <img src={favicon} alt="" className="w-5 h-5" onError={(e) => {
              e.currentTarget.style.display = 'none';
            }} />
          ) : (
            <div className="w-4 h-4 bg-cyan-500" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-neutral-100 mb-1 line-clamp-2">
            {title}
          </h3>
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span>{domain}</span>
            <span>•</span>
            <span>{time}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {screenshotBase64 && (
            <button
              onClick={() => setShowScreenshot(!showScreenshot)}
              className="p-1.5 hover:bg-terminal-800 border border-white/20 hover:border-white/30 transition-colors text-terminal-400 hover:text-white"
              title="Toggle screenshot"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
          )}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 hover:bg-terminal-800 border border-white/20 hover:border-cyan-500 transition-colors text-terminal-400 hover:text-cyan-500"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 hover:bg-terminal-800 border border-white/20 hover:border-white/30 transition-colors text-terminal-400 hover:text-white"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Evelyn's Thoughts */}
      {(evelynReaction || evelynThought) && (
        <div className="px-4 pb-3 space-y-2">
          {evelynReaction && (
            <div className="bg-orange/10 border-2 border-orange p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-orange" />
                <span className="text-xs text-orange font-mono font-medium uppercase tracking-wide">Evelyn's Reaction</span>
              </div>
              <p className="text-neutral-200 text-sm italic">"{evelynReaction}"</p>
            </div>
          )}
          {evelynThought && (
            <div className="bg-cyan-500/10 border-2 border-cyan-500 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Brain className="w-3.5 h-3.5 text-cyan-500" />
                <span className="text-xs text-cyan-500 font-mono font-medium uppercase tracking-wide">Evelyn's Thought Process</span>
              </div>
              <p className="text-neutral-200 text-sm">{evelynThought}</p>
            </div>
          )}
        </div>
      )}

      {/* Screenshot */}
      {showScreenshot && screenshotBase64 && (
        <div className="px-4 pb-4">
          <div className="relative overflow-hidden border-2 border-white/20 bg-terminal-black">
            <img
              src={screenshotBase64}
              alt="Page screenshot"
              className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => {
                // Open in modal or new tab
                window.open(screenshotBase64, '_blank');
              }}
            />
          </div>
        </div>
      )}

      {/* Key Points */}
      <div className="px-4 pb-4">
        <div className="space-y-2">
          {keyPoints.slice(0, expanded ? undefined : 3).map((point, idx) => (
            <div key={idx} className="flex items-start gap-2 text-sm">
              <div className="w-1.5 h-1.5 bg-cyan-500 mt-2 flex-shrink-0" />
              <p className="text-neutral-300 flex-1">{point}</p>
            </div>
          ))}
          {!expanded && keyPoints.length > 3 && (
            <button
              onClick={() => setExpanded(true)}
              className="text-xs text-cyan-500 hover:text-cyan-400 ml-3 font-mono"
            >
              +{keyPoints.length - 3} more points
            </button>
          )}
        </div>
      </div>

      {/* Footer badge */}
      <div className="px-4 py-2 bg-terminal-black border-t-2 border-white/20">
        <span className="text-xs text-neutral-500">
          Visited by Evelyn • {keyPoints.length} key points
        </span>
      </div>
    </div>
  );
});

export default AgentPageCard;

