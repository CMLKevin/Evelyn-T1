import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../state/store';
import { 
  X, 
  Search, 
  FileCode, 
  FileText, 
  Briefcase, 
  Sparkles,
  ChevronRight,
  Component,
  Server,
  TestTube,
  BookOpen,
  Users,
  Mail,
  Star,
  Clock
} from 'lucide-react';

// ========================================
// Types
// ========================================

interface TemplatePlaceholder {
  key: string;
  description: string;
  default?: string;
}

interface Template {
  id: number;
  name: string;
  description: string;
  category: 'code' | 'writing' | 'business' | 'custom';
  contentType: 'text' | 'code' | 'mixed';
  language?: string;
  content: string;
  placeholders: TemplatePlaceholder[];
  icon?: string;
  isBuiltIn: boolean;
  usageCount: number;
}

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (content: string, contentType: 'text' | 'code' | 'mixed', language?: string) => void;
}

// ========================================
// Icon Mapping
// ========================================

const iconMap: Record<string, React.ReactNode> = {
  'Component': <Component className="w-5 h-5" />,
  'Server': <Server className="w-5 h-5" />,
  'FileCode': <FileCode className="w-5 h-5" />,
  'TestTube': <TestTube className="w-5 h-5" />,
  'FileText': <FileText className="w-5 h-5" />,
  'BookOpen': <BookOpen className="w-5 h-5" />,
  'Users': <Users className="w-5 h-5" />,
  'Mail': <Mail className="w-5 h-5" />,
  'Briefcase': <Briefcase className="w-5 h-5" />,
};

const categoryIcons: Record<string, React.ReactNode> = {
  'code': <FileCode className="w-4 h-4" />,
  'writing': <FileText className="w-4 h-4" />,
  'business': <Briefcase className="w-4 h-4" />,
  'custom': <Sparkles className="w-4 h-4" />,
};

// ========================================
// Component
// ========================================

export default function TemplateModal({ isOpen, onClose, onSelectTemplate }: TemplateModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'browse' | 'customize'>('browse');

  // Fetch templates
  useEffect(() => {
    if (!isOpen) return;
    
    const fetchTemplates = async () => {
      setLoading(true);
      try {
        const response = await fetch('http://localhost:3001/api/collaborate/templates');
        if (response.ok) {
          const data = await response.json();
          setTemplates(data);
        }
      } catch (error) {
        console.error('Failed to fetch templates:', error);
      }
      setLoading(false);
    };

    fetchTemplates();
  }, [isOpen]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      const matchesCategory = activeCategory === 'all' || template.category === activeCategory;
      const matchesSearch = !searchQuery || 
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [templates, activeCategory, searchQuery]);

  // Popular templates (by usage count)
  const popularTemplates = useMemo(() => {
    return [...templates].sort((a, b) => b.usageCount - a.usageCount).slice(0, 4);
  }, [templates]);

  // Handle template selection
  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    
    // Initialize placeholder values with defaults
    const defaults: Record<string, string> = {};
    template.placeholders.forEach(p => {
      defaults[p.key] = p.default || '';
    });
    setPlaceholderValues(defaults);
    
    setStep('customize');
  };

  // Apply placeholders to content
  const applyPlaceholders = (content: string, values: Record<string, string>): string => {
    let result = content;
    Object.entries(values).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, value);
    });
    return result;
  };

  // Handle use template
  const handleUseTemplate = () => {
    if (!selectedTemplate) return;
    
    const finalContent = applyPlaceholders(selectedTemplate.content, placeholderValues);
    onSelectTemplate(finalContent, selectedTemplate.contentType, selectedTemplate.language);
    
    // Track usage
    fetch(`http://localhost:3001/api/collaborate/templates/${selectedTemplate.id}/use`, {
      method: 'POST'
    }).catch(console.error);
    
    onClose();
  };

  // Reset state when closing
  const handleClose = () => {
    setStep('browse');
    setSelectedTemplate(null);
    setPlaceholderValues({});
    setSearchQuery('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-terminal-black border-2 border-white/20 w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b-2 border-white/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step === 'customize' && (
              <button
                onClick={() => setStep('browse')}
                className="p-1 hover:bg-terminal-800 border border-white/20 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-terminal-400 rotate-180" />
              </button>
            )}
            <h2 className="text-lg font-mono font-bold text-white">
              {step === 'browse' ? 'Choose a Template' : `Customize: ${selectedTemplate?.name}`}
            </h2>
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-terminal-800 transition-colors">
            <X className="w-5 h-5 text-terminal-400 hover:text-white" />
          </button>
        </div>

        {step === 'browse' ? (
          <>
            {/* Search and Filters */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-terminal-500" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-terminal-black border-2 border-white/20 
                           text-white text-sm font-mono placeholder-terminal-500
                           focus:outline-none focus:border-orange transition-colors"
                />
              </div>
              
              {/* Category Tabs */}
              <div className="flex gap-1">
                {['all', 'code', 'writing', 'business'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-2 text-xs font-mono uppercase border transition-colors flex items-center gap-1.5 ${
                      activeCategory === cat
                        ? 'bg-orange/20 border-orange text-orange'
                        : 'border-white/20 text-terminal-400 hover:border-white/30 hover:text-terminal-300'
                    }`}
                  >
                    {cat !== 'all' && categoryIcons[cat]}
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Template Grid */}
            <div className="flex-1 overflow-y-auto terminal-scrollbar p-6">
              {loading ? (
                <div className="flex items-center justify-center h-32 text-terminal-400">
                  <span className="animate-pulse">Loading templates...</span>
                </div>
              ) : (
                <>
                  {/* Popular Templates */}
                  {activeCategory === 'all' && !searchQuery && popularTemplates.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-terminal-400 mb-3 flex items-center gap-2">
                        <Star className="w-3 h-3" /> Popular
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {popularTemplates.map((template) => (
                          <TemplateCard
                            key={template.id}
                            template={template}
                            onSelect={() => handleSelectTemplate(template)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* All Templates */}
                  <div>
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-terminal-400 mb-3 flex items-center gap-2">
                      <Clock className="w-3 h-3" /> 
                      {activeCategory === 'all' ? 'All Templates' : `${activeCategory} Templates`}
                    </h3>
                    {filteredTemplates.length === 0 ? (
                      <div className="text-center py-8 text-terminal-500">
                        No templates found
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {filteredTemplates.map((template) => (
                          <TemplateCard
                            key={template.id}
                            template={template}
                            onSelect={() => handleSelectTemplate(template)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          /* Customize Step */
          <div className="flex-1 flex overflow-hidden">
            {/* Placeholder Form */}
            <div className="w-1/2 border-r border-white/10 p-6 overflow-y-auto terminal-scrollbar">
              <h3 className="text-sm font-mono font-bold text-white mb-4">
                Customize Placeholders
              </h3>
              <div className="space-y-4">
                {selectedTemplate?.placeholders.map((placeholder) => (
                  <div key={placeholder.key}>
                    <label className="block text-xs font-mono text-terminal-400 mb-1">
                      {placeholder.description}
                    </label>
                    <input
                      type="text"
                      value={placeholderValues[placeholder.key] || ''}
                      onChange={(e) => setPlaceholderValues(prev => ({
                        ...prev,
                        [placeholder.key]: e.target.value
                      }))}
                      placeholder={placeholder.default}
                      className="w-full px-3 py-2 bg-terminal-black border-2 border-white/20 
                               text-white text-sm font-mono placeholder-terminal-600
                               focus:outline-none focus:border-orange transition-colors"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="w-1/2 p-6 flex flex-col">
              <h3 className="text-sm font-mono font-bold text-white mb-4">Preview</h3>
              <div className="flex-1 bg-terminal-900 border border-white/10 p-4 overflow-auto terminal-scrollbar">
                <pre className="text-xs font-mono text-terminal-300 whitespace-pre-wrap">
                  {selectedTemplate && applyPlaceholders(selectedTemplate.content, placeholderValues)}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t-2 border-white/20 flex items-center justify-between">
          <div className="text-xs text-terminal-500 font-mono">
            {step === 'browse' 
              ? `${filteredTemplates.length} templates available`
              : `${selectedTemplate?.placeholders.length || 0} placeholders`
            }
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 border-2 border-white/20 text-terminal-300 text-sm font-mono
                       hover:border-white/30 hover:text-white transition-colors"
            >
              Cancel
            </button>
            {step === 'customize' && (
              <button
                onClick={handleUseTemplate}
                className="px-4 py-2 bg-orange border-2 border-orange text-white text-sm font-mono font-bold
                         hover:bg-orange-dark transition-colors"
              >
                Use Template
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ========================================
// Template Card Component
// ========================================

function TemplateCard({ 
  template, 
  onSelect 
}: { 
  template: Template; 
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="p-4 border-2 border-white/20 hover:border-orange/50 bg-terminal-black/50
               text-left transition-all group hover:bg-terminal-800"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-terminal-900 border border-white/20 text-orange group-hover:bg-orange/10">
          {template.icon && iconMap[template.icon] 
            ? iconMap[template.icon] 
            : categoryIcons[template.category]
          }
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-mono font-bold text-white truncate group-hover:text-orange transition-colors">
            {template.name}
          </h4>
          <p className="text-xs text-terminal-400 mt-1 line-clamp-2">
            {template.description}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="px-1.5 py-0.5 bg-terminal-900 border border-white/20 text-[10px] font-mono text-terminal-400">
              {template.category}
            </span>
            {template.language && (
              <span className="px-1.5 py-0.5 bg-cyan-500/10 border border-cyan-500/30 text-[10px] font-mono text-cyan-400">
                {template.language}
              </span>
            )}
            {template.usageCount > 0 && (
              <span className="text-[10px] font-mono text-terminal-500">
                {template.usageCount} uses
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
