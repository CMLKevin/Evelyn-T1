import { FC, ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
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
  const baseStyles = 'inline-flex items-center justify-center gap-2 font-mono font-medium uppercase tracking-wide transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2 focus-visible:ring-offset-black';
  
  const variantStyles: Record<ButtonVariant, string> = {
    primary: 'bg-orange hover:bg-orange-dark text-white border-2 border-orange hover:border-orange-dark',
    secondary: 'bg-terminal-900 hover:bg-terminal-800 border-2 border-white/20 hover:border-white/30 text-terminal-300 hover:text-white',
    ghost: 'hover:bg-terminal-900 text-terminal-400 hover:text-white border-2 border-transparent hover:border-white/10',
    danger: 'bg-red-600 hover:bg-red-700 text-white border-2 border-red-600 hover:border-red-700',
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
