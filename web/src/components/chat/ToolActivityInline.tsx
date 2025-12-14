/**
 * ToolActivityInline Component
 * 
 * Shows tool execution status inline in the chat.
 * Used to display running/completed tool activities.
 */

import React from 'react';
import { 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Search,
  Code2,
  FileEdit,
  Globe,
  Box,
  Play,
  Terminal
} from 'lucide-react';

interface ToolActivityInlineProps {
  tool: string;
  status: 'running' | 'done' | 'error' | string;
  summary?: string;
  inputSummary?: string;
  outputSummary?: string;
  executionTimeMs?: number;
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  respond: <Box className="w-4 h-4" />,
  edit_document: <FileEdit className="w-4 h-4" />,
  create_artifact: <Code2 className="w-4 h-4" />,
  update_artifact: <Code2 className="w-4 h-4" />,
  web_search: <Search className="w-4 h-4" />,
  x_search: <Globe className="w-4 h-4" />,
  run_python: <Terminal className="w-4 h-4" />,
  browse_url: <Globe className="w-4 h-4" />,
  think: <Play className="w-4 h-4" />,
};

const TOOL_NAMES: Record<string, string> = {
  respond: 'Responding',
  edit_document: 'Editing Document',
  create_artifact: 'Creating Artifact',
  update_artifact: 'Updating Artifact',
  web_search: 'Searching Web',
  x_search: 'Searching X',
  run_python: 'Running Python',
  browse_url: 'Browsing URL',
  think: 'Thinking',
};

const STATUS_STYLES = {
  running: {
    container: 'border-orange bg-orange/10',
    icon: 'text-orange',
    text: 'text-orange'
  },
  done: {
    container: 'border-emerald-500 bg-emerald-500/10',
    icon: 'text-emerald-400',
    text: 'text-emerald-400'
  },
  error: {
    container: 'border-red-500 bg-red-500/10',
    icon: 'text-red-400',
    text: 'text-red-400'
  }
};

export function ToolActivityInline({ 
  tool, 
  status, 
  summary,
  inputSummary,
  outputSummary,
  executionTimeMs 
}: ToolActivityInlineProps) {
  const normalizedStatus = status === 'done' || status === 'success' ? 'done' : 
                          status === 'error' ? 'error' : 'running';
  const styles = STATUS_STYLES[normalizedStatus];
  const icon = TOOL_ICONS[tool] || <Play className="w-4 h-4" />;
  const toolName = TOOL_NAMES[tool] || tool;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 border-2 ${styles.container} text-sm font-mono`}>
      {/* Status icon */}
      {normalizedStatus === 'running' ? (
        <Loader2 className={`w-4 h-4 animate-spin ${styles.icon}`} />
      ) : normalizedStatus === 'done' ? (
        <CheckCircle2 className={`w-4 h-4 ${styles.icon}`} />
      ) : (
        <AlertCircle className={`w-4 h-4 ${styles.icon}`} />
      )}

      {/* Tool icon */}
      <span className={styles.icon}>{icon}</span>

      {/* Tool name and status */}
      <span className={styles.text}>
        {toolName}
        {normalizedStatus === 'running' && '...'}
      </span>

      {/* Summary or timing */}
      {summary && normalizedStatus !== 'running' && (
        <span className="text-zinc-400 text-xs truncate max-w-[200px]">
          {summary}
        </span>
      )}

      {/* Execution time */}
      {executionTimeMs && normalizedStatus !== 'running' && (
        <span className="text-zinc-500 text-xs">
          ({(executionTimeMs / 1000).toFixed(1)}s)
        </span>
      )}
    </div>
  );
}

export default ToolActivityInline;
