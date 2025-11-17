import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useStore } from '../../state/store';

interface DiffViewerProps {
  versionId: number;
  onClose: () => void;
}

export default function DiffViewer({ versionId, onClose }: DiffViewerProps) {
  const { collaborateState } = useStore();
  const [diffData, setDiffData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const { activeDocument } = collaborateState;

  useEffect(() => {
    if (activeDocument) {
      fetchDiff();
    }
  }, [versionId, activeDocument]);

  const fetchDiff = async () => {
    if (!activeDocument) return;

    try {
      const response = await fetch(
        `http://localhost:3001/api/collaborate/${activeDocument.id}/diff?versionId=${versionId}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setDiffData(data);
      }
    } catch (error) {
      console.error('Failed to fetch diff:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderDiffLines = () => {
    if (!diffData || !diffData.diff) return null;

    // Simple diff rendering - in production you'd use a library like diff2html
    const lines = diffData.diff.split('\n');
    
    return lines.map((line: string, index: number) => {
      let className = 'px-3 py-1 font-mono text-xs';
      
      if (line.startsWith('+')) {
        className += ' bg-green-500/10 border-l-2 border-green-500 text-green-400';
      } else if (line.startsWith('-')) {
        className += ' bg-red-500/10 border-l-2 border-red-500 text-red-400 line-through';
      } else if (line.startsWith('@@')) {
        className += ' bg-terminal-border text-terminal-secondary font-semibold';
      } else {
        className += ' text-terminal-text';
      }

      return (
        <div key={index} className={className}>
          <span className="inline-block w-12 text-terminal-secondary opacity-50 mr-2">
            {index + 1}
          </span>
          {line}
        </div>
      );
    });
  };

  return (
    <div className="absolute inset-0 bg-black/95 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-terminal-border">
        <h2 className="text-terminal-text font-semibold">Version Comparison</h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-terminal-border rounded transition-colors"
        >
          <X className="w-4 h-4 text-terminal-text" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-terminal-secondary">Loading diff...</div>
          </div>
        ) : diffData ? (
          <div className="divide-y divide-terminal-border">
            {/* Diff Info */}
            <div className="px-4 py-3 bg-terminal-border/30">
              <div className="text-sm text-terminal-text mb-1">
                Version {diffData.fromVersion} → Version {diffData.toVersion}
              </div>
              <div className="text-xs text-terminal-secondary">
                {diffData.additions || 0} additions, {diffData.deletions || 0} deletions
              </div>
            </div>

            {/* Diff Content */}
            <div className="bg-black">
              {renderDiffLines()}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-terminal-secondary">
            Failed to load diff
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-terminal-border flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-terminal-accent/20 hover:bg-terminal-accent/30 
                   border border-terminal-accent rounded text-terminal-accent
                   transition-all"
        >
          Close
        </button>
      </div>
    </div>
  );
}
