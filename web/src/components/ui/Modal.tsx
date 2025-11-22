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
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`w-full ${sizeStyles[size]} bg-terminal-900 border-2 border-white/20 shadow-terminal animate-fade-in-up`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Terminal-style Title Bar */}
        {title && (
          <div className="flex items-center justify-between px-4 py-2 bg-terminal-dark border-b-2 border-white/20">
            <h2 className="text-white font-mono font-bold text-sm uppercase tracking-wide">{title}</h2>
            <button
              onClick={onClose}
              className="px-2 py-1 hover:bg-white/10 border border-white/20 hover:border-white/30 transition-colors group"
            >
              <X className="w-4 h-4 text-terminal-400 group-hover:text-white transition-colors" />
            </button>
          </div>
        )}
        
        {/* Body */}
        <div className="px-6 py-4">
          {children}
        </div>
        
        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t-2 border-white/20 bg-terminal-dark flex justify-end gap-3">
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
