import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useStore } from '../../state/store';
import { Tag, X, Plus, Check } from 'lucide-react';

interface TagManagerProps {
  documentId: number;
  tags: string[];
  onClose?: () => void;
  compact?: boolean;
}

export default function TagManager({ documentId, tags, onClose, compact = false }: TagManagerProps) {
  const { updateDocumentTags, collaborateState } = useStore();
  const { allTags } = collaborateState;
  
  const [localTags, setLocalTags] = useState<string[]>(tags);
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter suggestions based on input
  const suggestions = allTags.filter(
    tag => 
      tag.toLowerCase().includes(inputValue.toLowerCase()) &&
      !localTags.includes(tag)
  );

  const handleAddTag = async (tagToAdd: string) => {
    const trimmedTag = tagToAdd.trim().toLowerCase();
    if (!trimmedTag || localTags.includes(trimmedTag)) return;
    
    const newTags = [...localTags, trimmedTag];
    setLocalTags(newTags);
    setInputValue('');
    setShowSuggestions(false);
    
    setIsSaving(true);
    await updateDocumentTags(documentId, newTags);
    setIsSaving(false);
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const newTags = localTags.filter(t => t !== tagToRemove);
    setLocalTags(newTags);
    
    setIsSaving(true);
    await updateDocumentTags(documentId, newTags);
    setIsSaving(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      handleAddTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && localTags.length > 0) {
      handleRemoveTag(localTags[localTags.length - 1]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      onClose?.();
    }
  };

  // Focus input on mount
  useEffect(() => {
    if (!compact) {
      inputRef.current?.focus();
    }
  }, [compact]);

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1 items-center">
        {localTags.map(tag => (
          <span 
            key={tag}
            className="px-1.5 py-0.5 bg-terminal-900 border border-white/20 
                     text-[10px] font-mono text-terminal-400 flex items-center gap-1 group"
          >
            <Tag className="w-2 h-2" />
            {tag}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveTag(tag);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
            >
              <X className="w-2 h-2" />
            </button>
          </span>
        ))}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose?.();
          }}
          className="px-1.5 py-0.5 border border-dashed border-white/20 
                   text-[10px] font-mono text-terminal-500 hover:text-terminal-300 
                   hover:border-white/30 transition-colors flex items-center gap-1"
        >
          <Plus className="w-2 h-2" />
          Add
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 bg-terminal-black border-2 border-white/20 min-w-[250px]">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-terminal-400">
          Manage Tags
        </h4>
        {isSaving && (
          <span className="text-[10px] text-orange font-mono animate-pulse">Saving...</span>
        )}
      </div>

      {/* Current Tags */}
      <div className="flex flex-wrap gap-1 mb-3 min-h-[24px]">
        {localTags.length === 0 ? (
          <span className="text-xs text-terminal-500 italic">No tags yet</span>
        ) : (
          localTags.map(tag => (
            <span 
              key={tag}
              className="px-2 py-1 bg-orange/20 border border-orange text-orange 
                       text-xs font-mono flex items-center gap-1.5"
            >
              <Tag className="w-3 h-3" />
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))
        )}
      </div>

      {/* Add Tag Input */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Tag className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-terminal-500" />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setShowSuggestions(true);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Add a tag..."
              className="w-full pl-7 pr-3 py-1.5 bg-terminal-black border-2 border-white/20 
                       text-white text-xs font-mono placeholder-terminal-500
                       focus:outline-none focus:border-orange transition-colors"
            />
          </div>
          {inputValue.trim() && (
            <button
              onClick={() => handleAddTag(inputValue)}
              className="px-3 py-1.5 bg-orange hover:bg-orange-dark border-2 border-orange 
                       text-white text-xs font-mono font-bold transition-colors"
            >
              <Check className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Tag Suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-terminal-black 
                        border-2 border-white/20 max-h-32 overflow-y-auto z-50 terminal-scrollbar">
            {suggestions.map(suggestion => (
              <button
                key={suggestion}
                onClick={() => handleAddTag(suggestion)}
                className="w-full px-3 py-1.5 text-left text-xs font-mono text-terminal-300 
                         hover:bg-terminal-800 transition-colors flex items-center gap-2"
              >
                <Tag className="w-3 h-3 text-terminal-500" />
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-3 pt-2 border-t border-white/10">
        <p className="text-[10px] text-terminal-600 font-mono">
          Press <kbd className="px-1 py-0.5 bg-terminal-900 border border-white/20">Enter</kbd> to add • 
          <kbd className="px-1 py-0.5 bg-terminal-900 border border-white/20 ml-1">Esc</kbd> to close
        </p>
      </div>
    </div>
  );
}
