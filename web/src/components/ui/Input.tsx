import { FC, InputHTMLAttributes, TextareaHTMLAttributes, ReactNode, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  icon,
  className = '',
  ...props
}, ref) => {
  const baseStyles = 'w-full px-3 py-2 bg-terminal-black border-2 text-white placeholder-terminal-500 text-sm font-mono focus:outline-none focus:border-orange transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed';
  const borderStyles = error ? 'border-red-500' : 'border-white/20 hover:border-white/30';
  
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-xs font-mono font-medium uppercase tracking-wide text-terminal-400 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-terminal-500">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={`${baseStyles} ${borderStyles} ${icon ? 'pl-10' : ''} ${className}`}
          {...props}
        />
      </div>
      {error && (
        <p className="text-xs text-red-500 font-mono">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  label,
  error,
  className = '',
  ...props
}, ref) => {
  const baseStyles = 'w-full px-3 py-2 bg-terminal-black border-2 text-white placeholder-terminal-500 text-sm font-mono focus:outline-none focus:border-orange resize-none transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed';
  const borderStyles = error ? 'border-red-500' : 'border-white/20 hover:border-white/30';
  
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-xs font-mono font-medium uppercase tracking-wide text-terminal-400 mb-1">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        className={`${baseStyles} ${borderStyles} ${className}`}
        {...props}
      />
      {error && (
        <p className="text-xs text-red-500 font-mono">{error}</p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';
