/**
 * AgentProgressInline Component
 * 
 * Shows Evelyn's progress inline in the chat, similar to Manus.
 * Displays thinking, tool usage, and response generation in real-time.
 */

import React, { useState, useEffect } from 'react';
import {
  Brain,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { Avatar } from '../ui';
import { ToolCallCard, ToolCallData, ToolStatus } from './ToolCallCard';

export interface AgentProgressData {
  id: string;
  status: 'thinking' | 'using_tools' | 'responding' | 'complete' | 'error';
  thinking?: string;
  toolCalls: ToolCallData[];
  response?: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
  iteration?: number;
  maxIterations?: number;
}

interface AgentProgressInlineProps {
  data: AgentProgressData;
  isActive?: boolean;
}

// Format elapsed time
function formatElapsed(startedAt: string, completedAt?: string): string {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const elapsed = Math.floor((end - start) / 1000);
  
  if (elapsed < 60) {
    return `${elapsed}s`;
  }
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  return `${minutes}m ${seconds}s`;
}

export function AgentProgressInline({ data, isActive = false }: AgentProgressInlineProps) {
  const [expanded, setExpanded] = useState(true);
  const [elapsed, setElapsed] = useState('0s');
  
  // Update elapsed time
  useEffect(() => {
    if (!isActive || data.completedAt) {
      setElapsed(formatElapsed(data.startedAt, data.completedAt));
      return;
    }
    
    const interval = setInterval(() => {
      setElapsed(formatElapsed(data.startedAt));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isActive, data.startedAt, data.completedAt]);
  
  // Count tool statuses
  const toolStats = {
    total: data.toolCalls.length,
    running: data.toolCalls.filter(t => t.status === 'running').length,
    success: data.toolCalls.filter(t => t.status === 'success').length,
    error: data.toolCalls.filter(t => t.status === 'error').length
  };
  
  // Status display
  const statusDisplay = {
    thinking: { label: 'Thinking...', color: 'text-purple-400', icon: <Brain className="w-4 h-4" /> },
    using_tools: { label: 'Using Tools', color: 'text-orange', icon: <Sparkles className="w-4 h-4" /> },
    responding: { label: 'Responding...', color: 'text-cyan-400', icon: <Sparkles className="w-4 h-4" /> },
    complete: { label: 'Complete', color: 'text-emerald-400', icon: <CheckCircle2 className="w-4 h-4" /> },
    error: { label: 'Error', color: 'text-red-400', icon: <Sparkles className="w-4 h-4" /> }
  }[data.status];
  
  return (
    <div className="flex items-start gap-3 animate-fade-in">
      {/* Avatar */}
      <Avatar 
        variant="ai"
        size="md"
        icon={<Sparkles className="w-4 h-4" />}
      />

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-white text-xs">Evelyn</span>
          
          {/* Status badge */}
          <div className={`flex items-center gap-1.5 px-2 py-0.5 bg-terminal-900 border border-white/20 ${statusDisplay.color}`}>
            {isActive && data.status !== 'complete' ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <span className="w-3 h-3">{statusDisplay.icon}</span>
            )}
            <span className="text-[10px] font-mono uppercase">
              {statusDisplay.label}
            </span>
          </div>
          
          {/* Iteration counter */}
          {data.iteration && data.maxIterations && (
            <span className="text-[10px] font-mono text-zinc-500">
              Step {data.iteration}/{data.maxIterations}
            </span>
          )}
          
          {/* Elapsed time */}
          <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {elapsed}
          </span>
          
          {/* Tool stats */}
          {toolStats.total > 0 && (
            <span className="text-[10px] font-mono text-zinc-500">
              {toolStats.success}/{toolStats.total} tools
            </span>
          )}
        </div>

        {/* Main content card */}
        <div className="border-2 border-white/20 bg-terminal-900">
          {/* Collapsible header */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors text-left"
          >
            <span className="text-zinc-500">
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </span>
            <Brain className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-medium text-white">Agent Progress</span>
            <span className="flex-1" />
            {!expanded && toolStats.total > 0 && (
              <span className="text-[10px] text-zinc-400">
                {toolStats.success} tools completed
              </span>
            )}
          </button>
          
          {/* Expanded content */}
          {expanded && (
            <div className="border-t border-white/10">
              {/* Thinking section */}
              {data.thinking && (
                <div className="px-3 py-2 border-b border-white/10">
                  <div className="flex items-center gap-2 mb-1">
                    <Brain className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-[10px] font-mono text-purple-400 uppercase">Thinking</span>
                  </div>
                  <p className="text-xs text-zinc-300 italic leading-relaxed">
                    "{data.thinking}"
                  </p>
                </div>
              )}
              
              {/* Tool calls section */}
              {data.toolCalls.length > 0 && (
                <div className="px-3 py-2 space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-orange" />
                    <span className="text-[10px] font-mono text-orange uppercase">Tool Usage</span>
                  </div>
                  <div className="space-y-1">
                    {data.toolCalls.map(tool => (
                      <ToolCallCard key={tool.id} data={tool} />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Error message */}
              {data.error && (
                <div className="px-3 py-2 bg-red-500/10 border-t border-red-500/30">
                  <p className="text-xs text-red-400">{data.error}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AgentProgressInline;
