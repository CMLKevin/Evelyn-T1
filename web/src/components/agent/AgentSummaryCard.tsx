import { useState } from 'react';
import { Copy, Check, FileText } from 'lucide-react';

interface AgentSummaryCardProps {
  summary: string;
  pages: Array<{ title: string; url: string; keyPoints: string[] }>;
}

export default function AgentSummaryCard({ summary, pages }: AgentSummaryCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-purple-500/10 border border-cyan-500/30 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-cyan-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-cyan-400" />
          <h3 className="font-semibold text-neutral-100">
            Evelyn's Browsing Summary
          </h3>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-neutral-800/50 hover:bg-neutral-700 transition-colors text-sm text-neutral-300"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-green-400" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Summary Content */}
      <div className="p-6">
        <div className="prose prose-invert prose-sm max-w-none">
          {summary.split('\n\n').map((paragraph, idx) => (
            <p key={idx} className="text-neutral-200 leading-relaxed mb-4 last:mb-0">
              {paragraph}
            </p>
          ))}
        </div>
      </div>

      {/* Pages Visited */}
      {pages.length > 0 && (
        <div className="p-4 border-t border-cyan-500/20 bg-neutral-900/50">
          <h4 className="text-xs font-medium text-neutral-400 mb-3 uppercase tracking-wide">
            Pages Visited ({pages.length})
          </h4>
          <div className="space-y-2">
            {pages.map((page, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 text-sm"
              >
                <span className="text-neutral-500 font-mono mt-0.5">{idx + 1}.</span>
                <div className="flex-1">
                  <a
                    href={page.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 hover:underline line-clamp-1"
                  >
                    {page.title}
                  </a>
                  <div className="text-xs text-neutral-500 mt-0.5 truncate">
                    {new URL(page.url).hostname}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 border-t border-cyan-500/10">
        <p className="text-xs text-neutral-500 text-center">
          Browsing session complete • Stored in Evelyn's memory
        </p>
      </div>
    </div>
  );
}

