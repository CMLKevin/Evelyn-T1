/**
 * ArtifactCard Component
 * 
 * Compact card displayed inline in chat messages.
 * Shows artifact preview thumbnail and basic info.
 * Click to expand in ArtifactPanel.
 */

import React from 'react';
import { 
  Play, 
  Code2, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Component,
  Globe,
  Terminal,
  Image,
  GitBranch,
  FileText,
  Folder,
  Hammer
} from 'lucide-react';
import type { Artifact, ArtifactType } from './types';
import { ARTIFACT_TYPE_NAMES } from './types';

interface ArtifactCardProps {
  artifact: Artifact;
  onClick?: () => void;
  onRun?: () => void;
  compact?: boolean;
}

const TYPE_ICONS: Record<ArtifactType, React.ReactNode> = {
  project: <Folder className="w-4 h-4" />,
  react: <Component className="w-4 h-4" />,
  html: <Globe className="w-4 h-4" />,
  python: <Terminal className="w-4 h-4" />,
  svg: <Image className="w-4 h-4" />,
  mermaid: <GitBranch className="w-4 h-4" />,
  markdown: <FileText className="w-4 h-4" />
};

const STATUS_COLORS: Record<string, string> = {
  idle: 'border-zinc-600 bg-zinc-900/50',
  running: 'border-orange bg-orange/10',
  building: 'border-blue-500 bg-blue-500/10',
  success: 'border-emerald-500 bg-emerald-500/10',
  error: 'border-red-500 bg-red-500/10'
};

export function ArtifactCard({ artifact, onClick, onRun, compact = false }: ArtifactCardProps) {
  const statusColor = STATUS_COLORS[artifact.status];
  
  const handleRunClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRun?.();
  };

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-2 px-3 py-1.5 border-2 ${statusColor} hover:bg-white/5 transition-colors cursor-pointer group`}
      >
        <span className="text-orange">{TYPE_ICONS[artifact.type]}</span>
        <span className="text-sm font-mono text-white/90 group-hover:text-white">
          {artifact.title}
        </span>
        {artifact.status === 'running' && (
          <Loader2 className="w-3 h-3 text-orange animate-spin" />
        )}
        {artifact.status === 'success' && (
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
        )}
        {artifact.status === 'error' && (
          <AlertCircle className="w-3 h-3 text-red-400" />
        )}
      </button>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`border-2 ${statusColor} p-4 cursor-pointer hover:bg-white/5 transition-colors group`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 bg-orange/20 border border-orange">
            <span className="text-orange">{TYPE_ICONS[artifact.type]}</span>
          </div>
          <div className="min-w-0">
            <h4 className="text-white font-medium text-sm truncate group-hover:text-orange transition-colors">
              {artifact.title}
            </h4>
            <p className="text-xs text-zinc-500 font-mono">
              {ARTIFACT_TYPE_NAMES[artifact.type]} • v{artifact.version}
            </p>
          </div>
        </div>
        
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          {artifact.status === 'running' && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-orange/10 border border-orange">
              <Loader2 className="w-3 h-3 text-orange animate-spin" />
              <span className="text-xs text-orange font-mono">Running</span>
            </div>
          )}
          {artifact.status === 'success' && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 border border-emerald-500">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span className="text-xs text-emerald-400 font-mono">Success</span>
            </div>
          )}
          {artifact.status === 'error' && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500">
              <AlertCircle className="w-3 h-3 text-red-400" />
              <span className="text-xs text-red-400 font-mono">Error</span>
            </div>
          )}
        </div>
      </div>

      {/* Preview area */}
      {artifact.preview ? (
        <div 
          className="mb-3 p-2 bg-black/50 border border-white/10 rounded overflow-hidden max-h-32"
          dangerouslySetInnerHTML={{ __html: artifact.preview }}
        />
      ) : (
        <div className="mb-3 p-4 bg-black/50 border border-white/10 flex items-center justify-center">
          <Code2 className="w-8 h-8 text-zinc-600" />
        </div>
      )}

      {/* Error message */}
      {artifact.error && (
        <div className="mb-3 p-2 bg-red-500/10 border border-red-500 text-red-400 text-xs font-mono overflow-hidden">
          {artifact.error.slice(0, 100)}
          {artifact.error.length > 100 && '...'}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleRunClick}
          disabled={artifact.status === 'running'}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange/10 border border-orange text-orange hover:bg-orange/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-mono"
        >
          <Play className="w-3 h-3" />
          Run
        </button>
        <button
          onClick={onClick}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/20 text-white/70 hover:text-white hover:bg-white/10 transition-colors text-xs font-mono"
        >
          <ExternalLink className="w-3 h-3" />
          Open
        </button>
      </div>
    </div>
  );
}

export default ArtifactCard;
