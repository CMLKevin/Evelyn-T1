import { Check, X } from 'lucide-react';
import { useStore } from '../../state/store';

interface InlineSuggestionProps {
  suggestion: {
    id: number;
    title: string;
    description: string;
    lineStart?: number;
    lineEnd?: number;
    charStart?: number;
    charEnd?: number;
  };
}

export default function InlineSuggestion({ suggestion }: InlineSuggestionProps) {
  const { 
    applyCollaborateSuggestion,
    rejectCollaborateSuggestion 
  } = useStore();

  const handleApply = async () => {
    await applyCollaborateSuggestion(suggestion.id);
  };

  const handleReject = async () => {
    await rejectCollaborateSuggestion(suggestion.id);
  };

  // This component is used for visual reference
  // The actual inline decorations are handled by Monaco Editor
  // This is a fallback/tooltip component
  return (
    <div className="inline-suggestion-tooltip pointer-events-auto">
      <div className="bg-terminal-secondary/90 border border-terminal-secondary 
                    rounded shadow-lg p-2 max-w-xs">
        <div className="text-xs font-medium text-white mb-1">
          {suggestion.title}
        </div>
        <div className="text-xs text-gray-200 mb-2">
          {suggestion.description}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleApply}
            className="flex-1 px-2 py-1 bg-green-500/80 hover:bg-green-500 
                     rounded text-white text-xs flex items-center justify-center gap-1"
          >
            <Check className="w-3 h-3" />
            Apply
          </button>
          <button
            onClick={handleReject}
            className="flex-1 px-2 py-1 bg-red-500/80 hover:bg-red-500 
                     rounded text-white text-xs flex items-center justify-center gap-1"
          >
            <X className="w-3 h-3" />
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
