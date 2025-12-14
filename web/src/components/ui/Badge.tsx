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
  // Base styles with rounded corners
  const baseStyles = 'inline-flex items-center gap-1 font-mono font-medium uppercase tracking-wide rounded-sm';

  const variantStyles: Record<BadgeVariant, string> = {
    default: 'bg-surface-3 border border-white/15 text-terminal-400',
    success: 'bg-green-500/15 border border-green-500/50 text-green-400',
    warning: 'bg-yellow-500/15 border border-yellow-500/50 text-yellow-400',
    error: 'bg-red-500/15 border border-red-500/50 text-red-400',
    info: 'bg-cyan-500/15 border border-cyan-500/50 text-cyan-400',
    purple: 'bg-orange/15 border border-orange/50 text-orange',
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
