import React from 'react';
import { Code, FileText, Layers } from 'lucide-react';

interface ContentTypeSelectorProps {
  value: 'text' | 'code' | 'mixed';
  onChange: (type: 'text' | 'code' | 'mixed') => void;
  disabled?: boolean;
}

export default function ContentTypeSelector({ value, onChange, disabled }: ContentTypeSelectorProps) {
  const types = [
    { id: 'text' as const, label: 'Text', icon: FileText, description: 'Writing, notes, documents' },
    { id: 'code' as const, label: 'Code', icon: Code, description: 'Programming, scripts' },
    { id: 'mixed' as const, label: 'Mixed', icon: Layers, description: 'Both text and code' }
  ];

  return (
    <div className="flex gap-2">
      {types.map((type) => {
        const Icon = type.icon;
        const isSelected = value === type.id;
        
        return (
          <button
            key={type.id}
            onClick={() => !disabled && onChange(type.id)}
            disabled={disabled}
            className={`
              flex items-center gap-2 px-3 py-2 rounded
              transition-all duration-200
              ${isSelected 
                ? 'bg-terminal-accent/20 border border-terminal-accent text-terminal-accent' 
                : 'bg-terminal-bg/50 border border-terminal-border text-terminal-text hover:border-terminal-accent/50'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            title={type.description}
          >
            <Icon className="w-4 h-4" />
            <span className="text-sm font-medium">{type.label}</span>
          </button>
        );
      })}
    </div>
  );
}
