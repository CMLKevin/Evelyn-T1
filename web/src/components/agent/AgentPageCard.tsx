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
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden hover:border-neutral-700 transition-colors">
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        {/* Favicon */}
        <div className="flex-shrink-0 w-8 h-8 bg-neutral-800 rounded flex items-center justify-center overflow-hidden">
          {favicon ? (
            <img src={favicon} alt="" className="w-5 h-5" onError={(e) => {
              e.currentTarget.style.display = 'none';
            }} />
          ) : (
            <div className="w-4 h-4 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-sm" />
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
              className="p-1.5 rounded hover:bg-neutral-800 transition-colors text-neutral-400 hover:text-neutral-200"
              title="Toggle screenshot"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
          )}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded hover:bg-neutral-800 transition-colors text-neutral-400 hover:text-cyan-400"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded hover:bg-neutral-800 transition-colors text-neutral-400 hover:text-neutral-200"
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
            <div className="bg-purple-900/20 border border-purple-700/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs text-purple-300 font-medium uppercase tracking-wide">Evelyn's Reaction</span>
              </div>
              <p className="text-neutral-200 text-sm italic">"{evelynReaction}"</p>
            </div>
          )}
          {evelynThought && (
            <div className="bg-cyan-900/20 border border-cyan-700/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Brain className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs text-cyan-300 font-medium uppercase tracking-wide">Evelyn's Thought Process</span>
              </div>
              <p className="text-neutral-200 text-sm">{evelynThought}</p>
            </div>
          )}
        </div>
      )}

      {/* Screenshot */}
      {showScreenshot && screenshotBase64 && (
        <div className="px-4 pb-4">
          <div className="relative rounded-lg overflow-hidden border border-neutral-700 bg-neutral-800">
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
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-2 flex-shrink-0" />
              <p className="text-neutral-300 flex-1">{point}</p>
            </div>
          ))}
          {!expanded && keyPoints.length > 3 && (
            <button
              onClick={() => setExpanded(true)}
              className="text-xs text-cyan-400 hover:text-cyan-300 ml-3"
            >
              +{keyPoints.length - 3} more points
            </button>
          )}
        </div>
      </div>

      {/* Footer badge */}
      <div className="px-4 py-2 bg-neutral-800/50 border-t border-neutral-800">
        <span className="text-xs text-neutral-500">
          Visited by Evelyn • {keyPoints.length} key points
        </span>
      </div>
    </div>
  );
});

export default AgentPageCard;

