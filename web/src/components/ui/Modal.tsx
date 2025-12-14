import { FC, ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}) => {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };
  
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`w-full ${sizeStyles[size]} bg-glass-card backdrop-blur-xl border border-white/10 shadow-2xl rounded-xl animate-fade-in-up overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glass Title Bar with gradient */}
        {title && (
          <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-orange/10 to-transparent border-b border-white/10">
            <h2 className="text-white font-mono font-bold text-sm uppercase tracking-wide">{title}</h2>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-md border border-white/10 hover:border-white/20 transition-all group"
            >
              <X className="w-4 h-4 text-terminal-400 group-hover:text-white transition-colors" />
            </button>
          </div>
        )}

        {/* Body with proper padding */}
        <div className="px-6 py-5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-white/10 bg-surface-1/50 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

interface ModalFooterProps {
  children: ReactNode;
}

export const ModalFooter: FC<ModalFooterProps> = ({ children }) => {
  return <>{children}</>;
};
