import { FC, HTMLAttributes, ReactNode } from 'react';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple';
export type BadgeSize = 'sm' | 'md';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
}

export const Badge: FC<BadgeProps> = ({
  variant = 'default',
  size = 'md',
  children,
  className = '',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center gap-1 font-mono font-medium uppercase tracking-wide';
  
  const variantStyles: Record<BadgeVariant, string> = {
    default: 'bg-terminal-900 border border-white/20 text-terminal-400',
    success: 'bg-green-500/10 border border-green-500 text-green-500',
    warning: 'bg-yellow-500/10 border border-yellow-500 text-yellow-500',
    error: 'bg-red-500/10 border border-red-500 text-red-500',
    info: 'bg-cyan-500/10 border border-cyan-500 text-cyan-500',
    purple: 'bg-orange/10 border border-orange text-orange',
  };
  
  const sizeStyles: Record<BadgeSize, string> = {
    sm: 'px-2 py-0.5 text-[9px]',
    md: 'px-2.5 py-0.5 text-[10px]',
  };
  
  return (
    <span className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`} {...props}>
      {children}
    </span>
  );
};

interface StatusDotProps {
  variant?: 'online' | 'offline' | 'away' | 'busy';
  animated?: boolean;
}

export const StatusDot: FC<StatusDotProps> = ({ variant = 'offline', animated = false }) => {
  const variantStyles = {
    online: 'bg-green-500',
    offline: 'bg-terminal-600',
    away: 'bg-yellow-500',
    busy: 'bg-red-500',
  };
  
  return (
    <div className={`w-2 h-2 ${variantStyles[variant]} ${animated ? 'animate-pulse' : ''}`} />
  );
};
