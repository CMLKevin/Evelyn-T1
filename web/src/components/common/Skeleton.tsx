import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animate?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animate = true
}) => {
  const baseClasses = 'bg-white/5';
  const shimmerClasses = animate ? 'skeleton-shimmer' : '';
  
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg'
  };

  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${shimmerClasses} ${className}`}
      style={style}
    />
  );
};

// Task Card Skeleton for CollaborationTimeline
export const TaskCardSkeleton: React.FC = () => (
  <div className="border rounded-lg bg-white/5 border-white/10 overflow-hidden">
    <div className="p-4">
      <div className="flex items-start gap-3">
        <Skeleton variant="circular" width={20} height={20} />
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton width={200} height={16} />
            <Skeleton width={60} height={20} />
            <Skeleton width={80} height={16} />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton width={80} height={20} />
            <Skeleton width={150} height={16} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Skeleton width={60} height={12} />
              <Skeleton width={100} height={12} />
            </div>
            <Skeleton width="100%" height={6} />
          </div>
        </div>
        <Skeleton variant="circular" width={16} height={16} />
      </div>
    </div>
  </div>
);

// Subtask Skeleton for CollaborationTimeline
export const SubtaskSkeleton: React.FC = () => (
  <div className="p-3 border rounded-lg bg-white/5 border-white/10">
    <div className="flex items-start gap-2">
      <Skeleton variant="circular" width={20} height={20} />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Skeleton width={150} height={14} />
          <Skeleton width={60} height={18} />
          <Skeleton width={70} height={18} />
          <Skeleton width={50} height={18} />
        </div>
        <Skeleton width="90%" height={12} />
        <Skeleton width="100%" height={4} />
      </div>
    </div>
  </div>
);

// Suggestion Card Skeleton for SuggestionsPanel
export const SuggestionCardSkeleton: React.FC = () => (
  <div className="p-4 border rounded-lg bg-white/5 border-white/10">
    <div className="flex items-start justify-between mb-3">
      <div className="flex-1 space-y-2">
        <Skeleton width={250} height={16} />
        <Skeleton width="80%" height={12} />
      </div>
      <Skeleton width={60} height={24} />
    </div>
    <div className="space-y-2 mb-3">
      <Skeleton width="100%" height={12} />
      <Skeleton width="95%" height={12} />
      <Skeleton width="85%" height={12} />
    </div>
    <div className="flex items-center gap-2">
      <Skeleton width={100} height={28} />
      <Skeleton width={80} height={28} />
    </div>
  </div>
);

// Tier Section Skeleton for SuggestionsPanel
export const TierSectionSkeleton: React.FC = () => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <Skeleton width={120} height={20} />
      <Skeleton width={40} height={20} />
    </div>
    <SuggestionCardSkeleton />
    <SuggestionCardSkeleton />
  </div>
);

// File Tree Item Skeleton for FileExplorer
export const FileTreeItemSkeleton: React.FC<{ indent?: number }> = ({ indent = 0 }) => (
  <div className="py-1.5 px-2" style={{ paddingLeft: `${indent * 16 + 8}px` }}>
    <div className="flex items-center gap-2">
      <Skeleton variant="circular" width={16} height={16} />
      <Skeleton width={150} height={14} />
      <Skeleton width={40} height={16} className="ml-auto" />
    </div>
  </div>
);

// File Explorer Skeleton
export const FileExplorerSkeleton: React.FC = () => (
  <div className="space-y-1">
    <FileTreeItemSkeleton indent={0} />
    <FileTreeItemSkeleton indent={1} />
    <FileTreeItemSkeleton indent={1} />
    <FileTreeItemSkeleton indent={2} />
    <FileTreeItemSkeleton indent={2} />
    <FileTreeItemSkeleton indent={1} />
    <FileTreeItemSkeleton indent={0} />
    <FileTreeItemSkeleton indent={1} />
    <FileTreeItemSkeleton indent={1} />
  </div>
);

// Code Editor Skeleton
export const CodeEditorSkeleton: React.FC = () => (
  <div className="h-full bg-[#1e1e1e] p-4 space-y-2">
    {/* Line numbers and code lines */}
    {[...Array(20)].map((_, i) => (
      <div key={i} className="flex items-center gap-4">
        <Skeleton width={30} height={16} />
        <Skeleton 
          width={`${Math.random() * 40 + 40}%`} 
          height={16} 
        />
      </div>
    ))}
  </div>
);

// Timeline Event Skeleton
export const TimelineEventSkeleton: React.FC = () => (
  <div className="flex gap-4 p-3">
    <div className="flex flex-col items-center">
      <Skeleton variant="circular" width={32} height={32} />
      <Skeleton width={2} height={60} className="mt-2" />
    </div>
    <div className="flex-1 space-y-2">
      <Skeleton width={200} height={16} />
      <Skeleton width="90%" height={12} />
      <Skeleton width={120} height={12} />
    </div>
  </div>
);

// Generic List Skeleton
export const ListSkeleton: React.FC<{ count?: number; itemHeight?: number }> = ({ 
  count = 5, 
  itemHeight = 60 
}) => (
  <div className="space-y-2">
    {[...Array(count)].map((_, i) => (
      <Skeleton key={i} width="100%" height={itemHeight} />
    ))}
  </div>
);

// Fade In Wrapper for loaded content
interface FadeInProps {
  show: boolean;
  children: React.ReactNode;
  className?: string;
}

export const FadeIn: React.FC<FadeInProps> = ({ show, children, className = '' }) => (
  <div 
    className={`transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0'} ${className}`}
  >
    {children}
  </div>
);
