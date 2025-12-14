import { FC, ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'glass';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

export const Button: FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  // Base styles with rounded corners and hover lift
  const baseStyles = 'inline-flex items-center justify-center gap-2 font-mono font-medium uppercase tracking-wide transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-md active:scale-[0.98]';

  const variantStyles: Record<ButtonVariant, string> = {
    primary: 'bg-orange hover:bg-orange-dark text-white border border-orange hover:border-orange-dark shadow-sm hover:shadow-orange-sm hover:-translate-y-0.5',
    secondary: 'bg-surface-2 hover:bg-surface-3 border border-white/15 hover:border-white/25 text-terminal-300 hover:text-white shadow-sm hover:shadow-md hover:-translate-y-0.5',
    ghost: 'hover:bg-white/5 text-terminal-400 hover:text-white border border-transparent hover:border-white/10',
    danger: 'bg-red-600/90 hover:bg-red-600 text-white border border-red-500/50 hover:border-red-500 shadow-sm hover:shadow-md hover:-translate-y-0.5',
    glass: 'bg-glass-dark backdrop-blur-lg border border-white/10 hover:border-white/20 text-terminal-300 hover:text-white hover:-translate-y-0.5 shadow-glass',
  };

  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-[10px]',
    md: 'px-4 py-2 text-xs',
    lg: 'px-6 py-3 text-sm',
  };
  
  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading...</span>
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
};
