import { useState, useMemo } from 'react';
import { X, FileCode, FileText, Briefcase, Sparkles, Plus, Check, AlertCircle } from 'lucide-react';

// ========================================
// Types
// ========================================

interface Placeholder {
  key: string;
  description: string;
  default: string;
}

interface SaveAsTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentContent: string;
  documentTitle: string;
  contentType: 'text' | 'code' | 'mixed';
  language?: string;
}

// ========================================
// Component
// ========================================

export default function SaveAsTemplateModal({ 
  isOpen, 
  onClose, 
  documentContent,
  documentTitle,
  contentType,
  language
}: SaveAsTemplateModalProps) {
  const [name, setName] = useState(documentTitle + ' Template');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'code' | 'writing' | 'business' | 'custom'>('custom');
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([]);
  const [selectedText, setSelectedText] = useState<string>('');
  const [newPlaceholderKey, setNewPlaceholderKey] = useState('');
  const [newPlaceholderDesc, setNewPlaceholderDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-detect potential placeholders (words in {{...}}, ALL_CAPS, or common patterns)
  const suggestedPlaceholders = useMemo(() => {
    const suggestions: string[] = [];
    
    // Find existing {{placeholders}}
    const existingMatches = documentContent.match(/\{\{(\w+)\}\}/g);
    if (existingMatches) {
      existingMatches.forEach(match => {
        const key = match.replace(/[{}]/g, '');
        if (!suggestions.includes(key)) {
          suggestions.push(key);
        }
      });
    }

    // Find ALL_CAPS words that might be constants/placeholders
    const capsMatches = documentContent.match(/\b[A-Z][A-Z_]{2,}\b/g);
    if (capsMatches) {
      capsMatches.slice(0, 5).forEach(match => {
        if (!suggestions.includes(match)) {
          suggestions.push(match);
        }
      });
    }

    return suggestions.slice(0, 8);
  }, [documentContent]);

  // Preview content with placeholders applied
  const previewContent = useMemo(() => {
    let content = documentContent;
    placeholders.forEach(p => {
      const regex = new RegExp(p.default.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      content = content.replace(regex, `{{${p.key}}}`);
    });
    return content;
  }, [documentContent, placeholders]);

  // Add a placeholder
  const addPlaceholder = (key: string, description: string, defaultValue: string) => {
    if (!key.trim()) return;
    
    // Ensure key is valid (alphanumeric + underscore)
    const sanitizedKey = key.trim().replace(/[^a-zA-Z0-9_]/g, '_');
    
    if (placeholders.some(p => p.key === sanitizedKey)) {
      setError(`Placeholder "${sanitizedKey}" already exists`);
      return;
    }

    setPlaceholders([...placeholders, {
      key: sanitizedKey,
      description: description || `${sanitizedKey} value`,
      default: defaultValue || ''
    }]);
    
    setNewPlaceholderKey('');
    setNewPlaceholderDesc('');
    setSelectedText('');
    setError(null);
  };

  // Remove a placeholder
  const removePlaceholder = (key: string) => {
    setPlaceholders(placeholders.filter(p => p.key !== key));
  };

  // Save as template
  const handleSave = async () => {
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3001/api/collaborate/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          category,
          contentType,
          language,
          content: previewContent,
          placeholders
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save template');
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const categoryOptions = [
    { value: 'code', label: 'Code', icon: <FileCode className="w-4 h-4" /> },
    { value: 'writing', label: 'Writing', icon: <FileText className="w-4 h-4" /> },
    { value: 'business', label: 'Business', icon: <Briefcase className="w-4 h-4" /> },
    { value: 'custom', label: 'Custom', icon: <Sparkles className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-terminal-black border-2 border-white/20 w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b-2 border-white/20 flex items-center justify-between">
          <h2 className="text-lg font-mono font-bold text-white">Save as Template</h2>
          <button onClick={onClose} className="p-1 hover:bg-terminal-800 transition-colors">
            <X className="w-5 h-5 text-terminal-400 hover:text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto terminal-scrollbar p-6">
          {/* Error Message */}
          {error && (
            <div className="mb-4 px-4 py-2 bg-red-500/10 border border-red-500 text-red-400 text-sm font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Template Info */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-mono text-terminal-400 mb-1">Template Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-terminal-black border-2 border-white/20 
                         text-white text-sm font-mono placeholder-terminal-600
                         focus:outline-none focus:border-orange transition-colors"
                placeholder="My Awesome Template"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-terminal-400 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-terminal-black border-2 border-white/20 
                         text-white text-sm font-mono placeholder-terminal-600
                         focus:outline-none focus:border-orange transition-colors resize-none"
                placeholder="What is this template for?"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-terminal-400 mb-2">Category</label>
              <div className="flex gap-2">
                {categoryOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setCategory(opt.value as any)}
                    className={`px-3 py-2 border-2 text-sm font-mono flex items-center gap-2 transition-colors ${
                      category === opt.value
                        ? 'bg-orange/20 border-orange text-orange'
                        : 'border-white/20 text-terminal-400 hover:border-white/30'
                    }`}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Placeholders Section */}
          <div className="border-t border-white/10 pt-6">
            <h3 className="text-sm font-mono font-bold text-white mb-4">Define Placeholders</h3>
            <p className="text-xs text-terminal-500 mb-4">
              Mark sections of your document as placeholders that users can customize when using this template.
            </p>

            {/* Suggested Placeholders */}
            {suggestedPlaceholders.length > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-mono text-terminal-400 mb-2">Suggested (click to add)</label>
                <div className="flex flex-wrap gap-2">
                  {suggestedPlaceholders.map(suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => addPlaceholder(suggestion, `${suggestion} value`, suggestion)}
                      disabled={placeholders.some(p => p.key === suggestion)}
                      className={`px-2 py-1 text-xs font-mono border transition-colors ${
                        placeholders.some(p => p.key === suggestion)
                          ? 'border-white/10 text-terminal-600 cursor-not-allowed'
                          : 'border-white/20 text-terminal-400 hover:border-orange hover:text-orange'
                      }`}
                    >
                      {`{{${suggestion}}}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Add Custom Placeholder */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newPlaceholderKey}
                onChange={(e) => setNewPlaceholderKey(e.target.value)}
                placeholder="Placeholder key"
                className="flex-1 px-3 py-2 bg-terminal-black border-2 border-white/20 
                         text-white text-sm font-mono placeholder-terminal-600
                         focus:outline-none focus:border-orange transition-colors"
              />
              <input
                type="text"
                value={newPlaceholderDesc}
                onChange={(e) => setNewPlaceholderDesc(e.target.value)}
                placeholder="Description"
                className="flex-1 px-3 py-2 bg-terminal-black border-2 border-white/20 
                         text-white text-sm font-mono placeholder-terminal-600
                         focus:outline-none focus:border-orange transition-colors"
              />
              <button
                onClick={() => addPlaceholder(newPlaceholderKey, newPlaceholderDesc, newPlaceholderKey)}
                disabled={!newPlaceholderKey.trim()}
                className="px-3 py-2 bg-orange border-2 border-orange text-white font-mono
                         hover:bg-orange-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Current Placeholders */}
            {placeholders.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-mono text-terminal-400">Current Placeholders</label>
                {placeholders.map(p => (
                  <div 
                    key={p.key}
                    className="flex items-center justify-between px-3 py-2 bg-terminal-900 border border-white/10"
                  >
                    <div>
                      <span className="text-orange font-mono text-sm">{`{{${p.key}}}`}</span>
                      <span className="text-terminal-500 text-xs ml-2">→ {p.description}</span>
                    </div>
                    <button
                      onClick={() => removePlaceholder(p.key)}
                      className="text-terminal-500 hover:text-red-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="border-t border-white/10 pt-6 mt-6">
            <h3 className="text-sm font-mono font-bold text-white mb-4">Template Preview</h3>
            <div className="bg-terminal-900 border border-white/10 p-4 max-h-48 overflow-auto terminal-scrollbar">
              <pre className="text-xs font-mono text-terminal-300 whitespace-pre-wrap">
                {previewContent}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t-2 border-white/20 flex items-center justify-between">
          <div className="text-xs text-terminal-500 font-mono">
            {placeholders.length} placeholder{placeholders.length !== 1 ? 's' : ''} defined
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border-2 border-white/20 text-terminal-300 text-sm font-mono
                       hover:border-white/30 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="px-4 py-2 bg-orange border-2 border-orange text-white text-sm font-mono font-bold
                       hover:bg-orange-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center gap-2"
            >
              {saving ? (
                <>Saving...</>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save Template
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
