/**
 * ArtifactPanel Component
 * 
 * Main artifact viewer panel with tabs for Preview, Code, and Console.
 * Displayed alongside the chat when an artifact is active.
 */

import React, { useState, useCallback } from 'react';
import { 
  X, 
  Play, 
  Copy, 
  Download, 
  History,
  Eye,
  Code2,
  Terminal,
  Check,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { ArtifactPreview } from './ArtifactPreview';
import type { Artifact } from './types';
import { ARTIFACT_TYPE_NAMES, ARTIFACT_LANGUAGES, getArtifactCode } from './types';

interface ArtifactPanelProps {
  artifact: Artifact;
  onClose: () => void;
  onRun?: () => void;
  onUpdate?: (code: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

type TabType = 'preview' | 'code' | 'console';

export function ArtifactPanel({ 
  artifact, 
  onClose, 
  onRun, 
  onUpdate,
  isCollapsed = false,
  onToggleCollapse
}: ArtifactPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('preview');
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleOutput = useCallback((output: string) => {
    setConsoleOutput(prev => [...prev, output]);
  }, []);

  const handleCopy = async () => {
    const code = getArtifactCode(artifact);
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = artifact.type === 'project' ? 'zip' :
                artifact.type === 'react' ? 'tsx' : 
                artifact.type === 'html' ? 'html' :
                artifact.type === 'python' ? 'py' :
                artifact.type === 'svg' ? 'svg' :
                artifact.type === 'mermaid' ? 'mmd' : 'md';
    
    const code = getArtifactCode(artifact);
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.title.replace(/\s+/g, '-').toLowerCase()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRun = () => {
    setConsoleOutput([]);
    setActiveTab('preview');
    onRun?.();
  };

  if (isCollapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className="fixed right-0 top-1/2 -translate-y-1/2 p-2 bg-terminal-dark border-2 border-r-0 border-orange text-orange hover:bg-orange/10 transition-colors z-50"
        title="Expand artifact panel"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className={`flex flex-col bg-terminal-black border-l-2 border-white/20 ${isFullscreen ? 'fixed inset-0 z-50' : 'w-[500px]'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-white/20 bg-terminal-dark">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleCollapse}
              className="p-1.5 hover:bg-white/10 border border-transparent hover:border-white/20 transition-colors"
              title="Collapse panel"
            >
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            </button>
            <div className="w-px h-5 bg-white/20" />
          </div>
          <div className="min-w-0">
            <h3 className="text-white font-medium text-sm truncate">{artifact.title}</h3>
            <p className="text-xs text-zinc-500 font-mono">
              {ARTIFACT_TYPE_NAMES[artifact.type]} • v{artifact.version}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 hover:bg-white/10 border border-transparent hover:border-white/20 transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-zinc-400" />
            ) : (
              <Maximize2 className="w-4 h-4 text-zinc-400" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 border border-transparent hover:border-white/20 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-white/10 bg-terminal-900">
        <button
          onClick={() => setActiveTab('preview')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-mono transition-colors border-b-2 ${
            activeTab === 'preview' 
              ? 'border-orange text-orange bg-orange/5' 
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <Eye className="w-4 h-4" />
          Preview
        </button>
        <button
          onClick={() => setActiveTab('code')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-mono transition-colors border-b-2 ${
            activeTab === 'code' 
              ? 'border-orange text-orange bg-orange/5' 
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <Code2 className="w-4 h-4" />
          Code
        </button>
        <button
          onClick={() => setActiveTab('console')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-mono transition-colors border-b-2 ${
            activeTab === 'console' 
              ? 'border-orange text-orange bg-orange/5' 
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <Terminal className="w-4 h-4" />
          Console
          {consoleOutput.length > 0 && (
            <span className="px-1.5 py-0.5 bg-orange/20 text-orange text-xs rounded">
              {consoleOutput.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'preview' && (
          <ArtifactPreview
            artifact={artifact}
            onOutput={handleOutput}
            onError={(err) => setConsoleOutput(prev => [...prev, `[error] ${err}`])}
          />
        )}

        {activeTab === 'code' && (
          <div className="h-full overflow-auto p-4 bg-black">
            <pre className="text-sm font-mono text-zinc-300 whitespace-pre-wrap">
              <code>{getArtifactCode(artifact)}</code>
            </pre>
          </div>
        )}

        {activeTab === 'console' && (
          <div className="h-full overflow-auto p-4 bg-black">
            {consoleOutput.length === 0 ? (
              <p className="text-zinc-500 text-sm font-mono">No console output yet.</p>
            ) : (
              <div className="space-y-1">
                {consoleOutput.map((line, i) => (
                  <div 
                    key={i} 
                    className={`text-xs font-mono ${
                      line.startsWith('[error]') ? 'text-red-400' :
                      line.startsWith('[warn]') ? 'text-yellow-400' :
                      'text-zinc-300'
                    }`}
                  >
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-terminal-dark">
        <div className="flex items-center gap-2">
          <button
            onClick={handleRun}
            disabled={artifact.status === 'running'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange/10 border-2 border-orange text-orange hover:bg-orange/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-mono font-medium"
          >
            <Play className="w-3.5 h-3.5" />
            Run
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/20 text-white/70 hover:text-white hover:bg-white/10 transition-colors text-xs font-mono"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/20 text-white/70 hover:text-white hover:bg-white/10 transition-colors text-xs font-mono"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/20 text-white/70 hover:text-white hover:bg-white/10 transition-colors text-xs font-mono"
            title="View version history"
          >
            <History className="w-3.5 h-3.5" />
            v{artifact.version}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ArtifactPanel;
