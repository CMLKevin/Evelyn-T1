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
  // Base styles with rounded corners
  const baseStyles = 'transition-all duration-200 rounded-lg';

  const variantStyles: Record<CardVariant, string> = {
    default: 'px-4 py-3 bg-surface-2 border border-white/10',
    glass: 'px-4 py-3 bg-glass-dark backdrop-blur-lg border border-white/8 shadow-glass',
    elevated: 'px-4 py-3 bg-surface-3 border border-white/12 shadow-lg',
    interactive: 'px-4 py-3 bg-surface-2 border border-white/10 hover:border-white/20 hover:bg-surface-3 cursor-pointer hover:-translate-y-0.5 hover:shadow-lg',
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
