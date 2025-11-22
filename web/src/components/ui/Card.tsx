import { FC, HTMLAttributes, ReactNode } from 'react';

export type CardVariant = 'default' | 'glass' | 'elevated' | 'interactive';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  children: ReactNode;
}

export const Card: FC<CardProps> = ({
  variant = 'default',
  children,
  className = '',
  ...props
}) => {
  const baseStyles = 'transition-colors duration-150';
  
  const variantStyles: Record<CardVariant, string> = {
    default: 'px-4 py-3 bg-terminal-900 border-2 border-white/20',
    glass: 'px-4 py-3 bg-terminal-dark border border-white/10',
    elevated: 'px-4 py-3 bg-terminal-900 border-2 border-white/20 shadow-terminal',
    interactive: 'px-4 py-3 bg-terminal-900 border-2 border-white/20 hover:border-white/30 hover:bg-terminal-800 cursor-pointer',
  };
  
  return (
    <div className={`${baseStyles} ${variantStyles[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
};

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const CardHeader: FC<CardHeaderProps> = ({ children, className = '', ...props }) => {
  return (
    <div className={`mb-3 ${className}`} {...props}>
      {children}
    </div>
  );
};

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
}

export const CardTitle: FC<CardTitleProps> = ({ children, className = '', ...props }) => {
  return (
    <h3 className={`text-white font-semibold text-base ${className}`} {...props}>
      {children}
    </h3>
  );
};

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const CardContent: FC<CardContentProps> = ({ children, className = '', ...props }) => {
  return (
    <div className={`text-zinc-400 text-sm ${className}`} {...props}>
      {children}
    </div>
  );
};
