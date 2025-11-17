import { useStore } from '../../state/store';
import { Check, X, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

export default function SuggestionPanel() {
  const { 
    collaborateState,
    applyCollaborateSuggestion,
    rejectCollaborateSuggestion 
  } = useStore();

  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const { currentSuggestions } = collaborateState;

  const pendingSuggestions = currentSuggestions.filter(s => s.status === 'pending');

  const toggleExpanded = (id: number) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const handleApplySuggestion = async (id: number) => {
    await applyCollaborateSuggestion(id);
  };

  const handleRejectSuggestion = async (id: number) => {
    await rejectCollaborateSuggestion(id);
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'bug_fix':
        return 'text-red-400';
      case 'optimization':
        return 'text-yellow-400';
      case 'improvement':
        return 'text-terminal-accent';
      case 'style':
        return 'text-purple-400';
      default:
        return 'text-terminal-secondary';
    }
  };

  const getTypeLabel = (type: string): string => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (pendingSuggestions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-terminal-secondary text-sm p-8 text-center">
        <div>
          <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No suggestions yet</p>
          <p className="text-xs mt-1 opacity-75">Use shortcuts to generate suggestions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="divide-y divide-terminal-border">
      {pendingSuggestions.map(suggestion => {
        const isExpanded = expandedIds.has(suggestion.id);
        
        return (
          <div key={suggestion.id} className="p-4">
            {/* Suggestion Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Lightbulb className="w-4 h-4 text-terminal-accent" />
                  <h3 className="text-sm font-medium text-terminal-text">
                    {suggestion.title}
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`${getTypeColor(suggestion.type)}`}>
                    {getTypeLabel(suggestion.type)}
                  </span>
                  <span className="text-terminal-secondary opacity-75">•</span>
                  <span className="text-terminal-secondary">
                    {Math.round(suggestion.confidence * 100)}% confidence
                  </span>
                </div>
              </div>

              <button
                onClick={() => toggleExpanded(suggestion.id)}
                className="p-1 hover:bg-terminal-border rounded transition-colors"
              >
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-terminal-secondary" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-terminal-secondary" />
                )}
              </button>
            </div>

            {/* Suggestion Description */}
            <p className="text-sm text-terminal-text mb-3">
              {suggestion.description}
            </p>

            {/* Expanded Details */}
            {isExpanded && (
              <div className="space-y-3 mb-3">
                {/* Original Text */}
                {suggestion.originalText && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
                    <div className="text-xs text-red-400 mb-1">Original:</div>
                    <pre className="text-xs text-terminal-text whitespace-pre-wrap font-mono">
                      {suggestion.originalText}
                    </pre>
                  </div>
                )}

                {/* Suggested Text */}
                {suggestion.suggestedText && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded p-2">
                    <div className="text-xs text-green-400 mb-1">Suggested:</div>
                    <pre className="text-xs text-terminal-text whitespace-pre-wrap font-mono">
                      {suggestion.suggestedText}
                    </pre>
                  </div>
                )}

                {/* Evelyn's Thought */}
                {suggestion.evelynThought && (
                  <div className="bg-terminal-secondary/10 border border-terminal-secondary/30 rounded p-2">
                    <div className="text-xs text-terminal-secondary mb-1 flex items-center gap-1">
                      <Lightbulb className="w-3 h-3" />
                      Evelyn's reasoning:
                    </div>
                    <p className="text-xs text-terminal-text italic">
                      {suggestion.evelynThought}
                    </p>
                  </div>
                )}

                {/* Location Info */}
                {suggestion.lineStart && (
                  <div className="text-xs text-terminal-secondary">
                    Location: Line {suggestion.lineStart}
                    {suggestion.lineEnd && suggestion.lineEnd !== suggestion.lineStart && 
                      ` - ${suggestion.lineEnd}`}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleApplySuggestion(suggestion.id)}
                className="flex-1 px-3 py-1.5 bg-terminal-accent/20 hover:bg-terminal-accent/30 
                         border border-terminal-accent rounded text-terminal-accent text-sm
                         transition-all flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Apply
              </button>
              <button
                onClick={() => handleRejectSuggestion(suggestion.id)}
                className="flex-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 
                         border border-red-500 rounded text-red-400 text-sm
                         transition-all flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Reject
              </button>
            </div>

            {/* Timestamp */}
            <div className="mt-2 text-xs text-terminal-secondary opacity-75">
              {formatDistanceToNow(new Date(suggestion.createdAt), { addSuffix: true })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
