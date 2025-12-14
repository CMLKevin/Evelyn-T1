/**
 * ToolCallCard Component
 * 
 * Displays a single tool call with its status, parameters, and result.
 * Used inline in the chat to show Evelyn's tool usage.
 */

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Globe,
  Code2,
  FileEdit,
  Folder,
  Terminal,
  Sparkles,
  Image,
  MessageSquare
} from 'lucide-react';

export type ToolStatus = 'pending' | 'running' | 'success' | 'error';

export interface ToolCallData {
  id: string;
  tool: string;
  params: Record<string, any>;
  status: ToolStatus;
  result?: any;
  error?: string;
  summary?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

interface ToolCallCardProps {
  data: ToolCallData;
  compact?: boolean;
}

// Tool icons mapping
const TOOL_ICONS: Record<string, React.ReactNode> = {
  web_search: <Search className="w-3.5 h-3.5" />,
  x_search: <MessageSquare className="w-3.5 h-3.5" />,
  browse_url: <Globe className="w-3.5 h-3.5" />,
  create_artifact: <Code2 className="w-3.5 h-3.5" />,
  update_artifact: <Code2 className="w-3.5 h-3.5" />,
  update_artifact_file: <FileEdit className="w-3.5 h-3.5" />,
  add_artifact_file: <Folder className="w-3.5 h-3.5" />,
  delete_artifact_file: <Folder className="w-3.5 h-3.5" />,
  edit_document: <FileEdit className="w-3.5 h-3.5" />,
  run_python: <Terminal className="w-3.5 h-3.5" />,
  think: <Sparkles className="w-3.5 h-3.5" />
};

// Tool display names
const TOOL_NAMES: Record<string, string> = {
  web_search: 'Web Search',
  x_search: 'Search X',
  browse_url: 'Browse URL',
  create_artifact: 'Create Artifact',
  update_artifact: 'Update Artifact',
  update_artifact_file: 'Update File',
  add_artifact_file: 'Add File',
  delete_artifact_file: 'Delete File',
  edit_document: 'Edit Document',
  run_python: 'Run Python',
  think: 'Thinking'
};

// Status styles
const STATUS_STYLES: Record<ToolStatus, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
  pending: {
    bg: 'bg-zinc-500/10',
    border: 'border-zinc-500/30',
    text: 'text-zinc-400',
    icon: <Clock className="w-3.5 h-3.5" />
  },
  running: {
    bg: 'bg-orange/10',
    border: 'border-orange/50',
    text: 'text-orange',
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />
  },
  success: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />
  },
  error: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    icon: <XCircle className="w-3.5 h-3.5" />
  }
};

// Format parameter value for display
function formatParamValue(value: any): string {
  if (typeof value === 'string') {
    if (value.length > 100) {
      return value.slice(0, 100) + '...';
    }
    return value;
  }
  if (Array.isArray(value)) {
    return `[${value.length} items]`;
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value).slice(0, 50) + '...';
  }
  return String(value);
}

// Get main parameter to show in compact mode
function getMainParam(tool: string, params: Record<string, any>): string | null {
  const mainParams: Record<string, string> = {
    web_search: 'query',
    x_search: 'query',
    browse_url: 'url',
    create_artifact: 'title',
    update_artifact: 'artifactId',
    update_artifact_file: 'path',
    add_artifact_file: 'path',
    delete_artifact_file: 'path',
    edit_document: 'goal',
    run_python: 'code'
  };
  
  const key = mainParams[tool];
  if (key && params[key]) {
    return formatParamValue(params[key]);
  }
  return null;
}

export function ToolCallCard({ data, compact = false }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const style = STATUS_STYLES[data.status];
  const toolIcon = TOOL_ICONS[data.tool] || <Code2 className="w-3.5 h-3.5" />;
  const toolName = TOOL_NAMES[data.tool] || data.tool;
  const mainParam = getMainParam(data.tool, data.params);
  
  return (
    <div className={`border ${style.border} ${style.bg} transition-all duration-200`}>
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors"
      >
        {/* Expand/collapse icon */}
        <span className="text-zinc-500">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </span>
        
        {/* Tool icon */}
        <span className={style.text}>{toolIcon}</span>
        
        {/* Tool name */}
        <span className="text-xs font-mono font-medium text-white">
          {toolName}
        </span>
        
        {/* Main parameter preview */}
        {mainParam && (
          <span className="text-xs font-mono text-zinc-500 truncate max-w-[200px]">
            {mainParam}
          </span>
        )}
        
        {/* Spacer */}
        <span className="flex-1" />
        
        {/* Duration */}
        {data.durationMs && (
          <span className="text-[10px] font-mono text-zinc-500">
            {data.durationMs}ms
          </span>
        )}
        
        {/* Status indicator */}
        <span className={`flex items-center gap-1 ${style.text}`}>
          {style.icon}
          <span className="text-[10px] font-mono uppercase">
            {data.status}
          </span>
        </span>
      </button>
      
      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-white/10 px-3 py-2 space-y-2">
          {/* Parameters */}
          {Object.keys(data.params).length > 0 && (
            <div>
              <div className="text-[10px] font-mono text-zinc-500 uppercase mb-1">
                Parameters
              </div>
              <div className="bg-black/30 rounded p-2 space-y-1">
                {Object.entries(data.params).map(([key, value]) => (
                  <div key={key} className="flex gap-2 text-xs font-mono">
                    <span className="text-orange">{key}:</span>
                    <span className="text-zinc-300 break-all">
                      {formatParamValue(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Summary/Result */}
          {data.summary && (
            <div>
              <div className="text-[10px] font-mono text-zinc-500 uppercase mb-1">
                Result
              </div>
              <div className="text-xs text-zinc-300">
                {data.summary}
              </div>
            </div>
          )}
          
          {/* Error */}
          {data.error && (
            <div>
              <div className="text-[10px] font-mono text-red-400 uppercase mb-1">
                Error
              </div>
              <div className="text-xs text-red-300 bg-red-500/10 p-2 rounded">
                {data.error}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ToolCallCard;
