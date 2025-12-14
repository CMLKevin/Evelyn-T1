import { FC, HTMLAttributes, ReactNode } from 'react';

export type AvatarVariant = 'ai' | 'user' | 'default';
export type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AvatarVariant;
  size?: AvatarSize;
  src?: string;
  alt?: string;
  icon?: ReactNode;
  fallback?: string;
}

export const Avatar: FC<AvatarProps> = ({
  variant = 'default',
  size = 'md',
  src,
  alt,
  icon,
  fallback,
  className = '',
  ...props
}) => {
  // Base styles - softer border for glass look
  const baseStyles = 'flex items-center justify-center overflow-hidden border transition-all duration-200';

  const variantStyles: Record<AvatarVariant, string> = {
    ai: 'bg-orange/15 border-orange/60',
    user: 'bg-cyan-500/15 border-cyan-500/60',
    default: 'bg-surface-3 border-white/15',
  };

  // Size-based radius: larger avatars get more rounding
  const sizeStyles: Record<AvatarSize, string> = {
    sm: 'w-6 h-6 rounded-md',
    md: 'w-8 h-8 rounded-lg',
    lg: 'w-12 h-12 rounded-xl',
  };
  
  const iconSizeStyles: Record<AvatarSize, string> = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6',
  };
  
  const textSizeStyles: Record<AvatarSize, string> = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
  };
  
  const iconColorStyles: Record<AvatarVariant, string> = {
    ai: 'text-orange',
    user: 'text-cyan-500',
    default: 'text-terminal-400',
  };
  
  return (
    <div 
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {src ? (
        <img src={src} alt={alt || 'Avatar'} className="w-full h-full object-cover" />
      ) : icon ? (
        <div className={`${iconSizeStyles[size]} ${iconColorStyles[variant]}`}>
          {icon}
        </div>
      ) : fallback ? (
        <span className={`${textSizeStyles[size]} font-mono font-bold uppercase ${iconColorStyles[variant]}`}>
          {fallback}
        </span>
      ) : null}
    </div>
  );
};
