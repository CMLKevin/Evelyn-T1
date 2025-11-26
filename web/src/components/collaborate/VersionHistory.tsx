import { useStore } from '../../state/store';
import { Clock, RotateCcw, GitCompare, User, Bot, CheckSquare, Square } from 'lucide-react';
import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import DiffViewer from './DiffViewer';
import ComparisonView from './ComparisonView';

export default function VersionHistory() {
  const { 
    collaborateState,
    loadCollaborateVersionHistory,
    revertCollaborateToVersion 
  } = useStore();

  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareVersions, setCompareVersions] = useState<number[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  const { activeDocument, versionHistory, currentContent } = collaborateState;

  useEffect(() => {
    if (activeDocument) {
      loadCollaborateVersionHistory();
    }
  }, [activeDocument, loadCollaborateVersionHistory]);

  const handleRevert = async (versionId: number) => {
    if (confirm('Are you sure you want to revert to this version? Current changes will be saved as a new version.')) {
      await revertCollaborateToVersion(versionId);
    }
  };

  const handleViewDiff = (versionId: number) => {
    setSelectedVersionId(versionId);
    setShowDiff(true);
  };

  // Toggle version selection for comparison
  const toggleVersionSelection = (versionId: number) => {
    setCompareVersions(prev => {
      if (prev.includes(versionId)) {
        return prev.filter(id => id !== versionId);
      }
      if (prev.length >= 2) {
        return [prev[1], versionId]; // Keep last selected, add new
      }
      return [...prev, versionId];
    });
  };

  // Compare selected versions
  const handleCompareSelected = () => {
    if (compareVersions.length === 2) {
      setShowComparison(true);
    }
  };

  // Compare with current content
  const handleCompareWithCurrent = (versionId: number) => {
    const version = versionHistory.find(v => v.id === versionId);
    if (version) {
      setCompareVersions([versionId]);
      setShowComparison(true);
    }
  };

  // Get content for comparison
  const getComparisonContent = () => {
    if (compareVersions.length === 1) {
      // Compare version with current content
      const version = versionHistory.find(v => v.id === compareVersions[0]);
      return {
        contentA: version?.content || '',
        contentB: currentContent,
        titleA: `Version ${version?.version}`,
        titleB: 'Current'
      };
    } else if (compareVersions.length === 2) {
      // Compare two versions
      const versionA = versionHistory.find(v => v.id === compareVersions[0]);
      const versionB = versionHistory.find(v => v.id === compareVersions[1]);
      return {
        contentA: versionA?.content || '',
        contentB: versionB?.content || '',
        titleA: `Version ${versionA?.version}`,
        titleB: `Version ${versionB?.version}`
      };
    }
    return null;
  };

  const getAuthorIcon = (author: string) => {
    switch (author) {
      case 'evelyn':
        return <Bot className="w-4 h-4 text-terminal-secondary" />;
      case 'user':
        return <User className="w-4 h-4 text-terminal-accent" />;
      case 'collaborative':
        return <GitCompare className="w-4 h-4 text-purple-400" />;
      default:
        return <User className="w-4 h-4 text-terminal-secondary" />;
    }
  };

  const getAuthorLabel = (author: string): string => {
    switch (author) {
      case 'evelyn':
        return 'Evelyn';
      case 'user':
        return 'You';
      case 'collaborative':
        return 'Collaborative';
      default:
        return author;
    }
  };

  if (versionHistory.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-terminal-secondary text-sm p-8 text-center">
        <div>
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No version history yet</p>
          <p className="text-xs mt-1 opacity-75">Save versions to track changes</p>
        </div>
      </div>
    );
  }

  if (showDiff && selectedVersionId) {
    return (
      <DiffViewer
        versionId={selectedVersionId}
        onClose={() => {
          setShowDiff(false);
          setSelectedVersionId(null);
        }}
      />
    );
  }

  // Show ComparisonView
  if (showComparison) {
    const comparisonData = getComparisonContent();
    if (comparisonData) {
      return (
        <ComparisonView
          isOpen={true}
          onClose={() => {
            setShowComparison(false);
            setCompareVersions([]);
            setCompareMode(false);
          }}
          contentA={comparisonData.contentA}
          contentB={comparisonData.contentB}
          titleA={comparisonData.titleA}
          titleB={comparisonData.titleB}
          contentType={activeDocument?.contentType}
        />
      );
    }
  }

  return (
    <div className="divide-y divide-terminal-border">
      {versionHistory.map((version, index) => {
        const isLatest = index === 0;

        return (
          <div key={version.id} className="p-4">
            {/* Version Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-start gap-2">
                {getAuthorIcon(version.createdBy)}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-terminal-text">
                      Version {version.version}
                    </h3>
                    {isLatest && (
                      <span className="text-xs px-1.5 py-0.5 bg-terminal-accent/20 
                                   border border-terminal-accent rounded text-terminal-accent">
                        Latest
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-terminal-secondary mt-0.5">
                    {getAuthorLabel(version.createdBy)} • {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Compare mode checkbox */}
                {compareMode && (
                  <button
                    onClick={() => toggleVersionSelection(version.id)}
                    className={`p-1.5 rounded transition-colors ${
                      compareVersions.includes(version.id)
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'hover:bg-terminal-border text-terminal-500'
                    }`}
                    title={compareVersions.includes(version.id) ? 'Deselect' : 'Select for comparison'}
                  >
                    {compareVersions.includes(version.id) ? (
                      <CheckSquare className="w-3.5 h-3.5" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
                
                {/* Compare with current */}
                {!compareMode && !isLatest && (
                  <button
                    onClick={() => handleCompareWithCurrent(version.id)}
                    className="p-1.5 hover:bg-terminal-border rounded transition-colors"
                    title="Compare with current"
                  >
                    <GitCompare className="w-3.5 h-3.5 text-cyan-400" />
                  </button>
                )}
                
                {!isLatest && (
                  <button
                    onClick={() => handleRevert(version.id)}
                    className="p-1.5 hover:bg-terminal-border rounded transition-colors"
                    title="Revert to this version"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-terminal-accent" />
                  </button>
                )}
              </div>
            </div>

            {/* Description */}
            {version.description && (
              <div className="bg-terminal-border/30 rounded p-2 mb-2">
                <p className="text-xs text-terminal-text">
                  {version.description}
                </p>
              </div>
            )}

            {/* Evelyn's Note */}
            {version.evelynNote && (
              <div className="bg-terminal-secondary/10 border border-terminal-secondary/30 rounded p-2">
                <div className="text-xs text-terminal-secondary mb-1 flex items-center gap-1">
                  <Bot className="w-3 h-3" />
                  Evelyn's note:
                </div>
                <p className="text-xs text-terminal-text italic">
                  {version.evelynNote}
                </p>
              </div>
            )}

            {/* Content Preview */}
            <details className="mt-2">
              <summary className="text-xs text-terminal-secondary cursor-pointer hover:text-terminal-accent transition-colors">
                View content
              </summary>
              <div className="mt-2 bg-black border border-terminal-border rounded p-2 max-h-40 overflow-y-auto">
                <pre className="text-xs text-terminal-text whitespace-pre-wrap font-mono">
                  {version.content.substring(0, 500)}
                  {version.content.length > 500 && '...'}
                </pre>
              </div>
            </details>
          </div>
        );
      })}
    </div>
  );
}
