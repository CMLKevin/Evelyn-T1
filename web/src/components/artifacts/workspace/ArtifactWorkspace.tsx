/**
 * ArtifactWorkspace Component
 * 
 * Main workspace for multi-file artifacts, inspired by Manus.
 * Layout: File Explorer | Code Editor | Preview
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  X,
  Code2,
  Eye,
  Play,
  RefreshCw,
  Maximize2,
  Minimize2,
  Download,
  Share2,
  ChevronLeft,
  ChevronRight,
  Terminal,
  ExternalLink,
  PanelLeftClose,
  PanelLeft
} from 'lucide-react';
import { FileExplorer } from './FileExplorer';
import { CodeEditor } from './CodeEditor';
import { ArtifactPreview } from '../ArtifactPreview';
import type { Artifact, ArtifactFile } from '../types';
import { ARTIFACT_TYPE_NAMES, isMultiFileArtifact, getArtifactCode } from '../types';

interface ArtifactWorkspaceProps {
  artifact: Artifact;
  onClose: () => void;
  onRun?: () => void;
  onSave?: (files: ArtifactFile[]) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

type ViewMode = 'code' | 'preview' | 'split';

export function ArtifactWorkspace({
  artifact,
  onClose,
  onRun,
  onSave,
  isCollapsed = false,
  onToggleCollapse
}: ArtifactWorkspaceProps) {
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('code');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFileExplorer, setShowFileExplorer] = useState(true);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  
  // File state
  const [openFilePaths, setOpenFilePaths] = useState<string[]>(() => {
    // Open entry file by default
    if (artifact.files && artifact.files.length > 0) {
      const entryFile = artifact.files.find(f => f.path === artifact.entryFile) || artifact.files[0];
      return [entryFile.path];
    }
    return [];
  });
  const [activeFilePath, setActiveFilePath] = useState<string | null>(() => {
    if (artifact.files && artifact.files.length > 0) {
      const entryFile = artifact.files.find(f => f.path === artifact.entryFile) || artifact.files[0];
      return entryFile.path;
    }
    return null;
  });
  
  // Track modified files locally
  const [modifiedFiles, setModifiedFiles] = useState<Map<string, string>>(new Map());
  
  // Get files with modifications applied
  const files = useMemo(() => {
    if (!artifact.files) return [];
    return artifact.files.map(f => ({
      ...f,
      content: modifiedFiles.get(f.path) ?? f.content,
      isDirty: modifiedFiles.has(f.path)
    }));
  }, [artifact.files, modifiedFiles]);
  
  // Get currently open files
  const openFiles = useMemo((): ArtifactFile[] => {
    return openFilePaths
      .map(path => files.find(f => f.path === path))
      .filter((f): f is ArtifactFile & { isDirty: boolean } => f !== undefined);
  }, [files, openFilePaths]);
  
  // Get active file
  const activeFile = useMemo(() => {
    return files.find(f => f.path === activeFilePath) || null;
  }, [files, activeFilePath]);
  
  // Handlers
  const handleFileSelect = useCallback((path: string) => {
    setActiveFilePath(path);
    if (!openFilePaths.includes(path)) {
      setOpenFilePaths(prev => [...prev, path]);
    }
  }, [openFilePaths]);
  
  const handleFileClose = useCallback((path: string) => {
    setOpenFilePaths(prev => prev.filter(p => p !== path));
    if (activeFilePath === path) {
      const remaining = openFilePaths.filter(p => p !== path);
      setActiveFilePath(remaining.length > 0 ? remaining[remaining.length - 1] : null);
    }
  }, [activeFilePath, openFilePaths]);
  
  const handleFileChange = useCallback((path: string, content: string) => {
    setModifiedFiles(prev => new Map(prev).set(path, content));
  }, []);
  
  const handleSave = useCallback((path: string) => {
    if (onSave && modifiedFiles.size > 0) {
      const updatedFiles = files.map(f => ({
        ...f,
        content: modifiedFiles.get(f.path) ?? f.content
      }));
      onSave(updatedFiles);
      setModifiedFiles(new Map());
    }
  }, [files, modifiedFiles, onSave]);
  
  const handleRun = useCallback(() => {
    setConsoleOutput([]);
    setViewMode('preview');
    onRun?.();
  }, [onRun]);
  
  const handleOutput = useCallback((output: string) => {
    setConsoleOutput(prev => [...prev, output]);
    if (!consoleOpen) setConsoleOpen(true);
  }, [consoleOpen]);
  
  // Check if this is a multi-file project
  const isMultiFile = isMultiFileArtifact(artifact);
  
  // Collapsed view
  if (isCollapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className="fixed right-0 top-1/2 -translate-y-1/2 p-2 bg-terminal-dark border-2 border-r-0 border-orange text-orange hover:bg-orange/10 transition-colors z-50"
        title="Expand workspace"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
    );
  }
  
  return (
    <div className={`flex flex-col bg-terminal-black border-l-2 border-white/20 ${isFullscreen ? 'fixed inset-0 z-50' : 'w-[600px] min-w-[400px]'}`}>
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b-2 border-white/20 bg-terminal-dark">
        <div className="flex items-center gap-2">
          {/* Collapse button */}
          <button
            onClick={onToggleCollapse}
            className="p-1.5 hover:bg-white/10 transition-colors"
            title="Collapse"
          >
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          </button>
          
          <div className="w-px h-5 bg-white/20" />
          
          {/* View mode toggle */}
          <div className="flex items-center bg-terminal-900 border border-white/10 rounded">
            <button
              onClick={() => setViewMode('code')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono transition-colors ${
                viewMode === 'code' ? 'bg-orange/20 text-orange' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              Code
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono transition-colors ${
                viewMode === 'preview' ? 'bg-orange/20 text-orange' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Title */}
          <div className="px-3">
            <h3 className="text-white font-medium text-sm">{artifact.title}</h3>
            <p className="text-xs text-zinc-500 font-mono">
              {ARTIFACT_TYPE_NAMES[artifact.type]} • v{artifact.version}
              {isMultiFile && artifact.files && ` • ${artifact.files.length} files`}
            </p>
          </div>
          
          <div className="w-px h-5 bg-white/20 mx-2" />
          
          {/* Actions */}
          <button
            onClick={handleRun}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange/10 border border-orange text-orange hover:bg-orange/20 transition-colors text-xs font-mono"
          >
            <Play className="w-3.5 h-3.5" />
            Run
          </button>
          
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 hover:bg-white/10 transition-colors"
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
            className="p-1.5 hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      </div>
      
      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* File Explorer (for multi-file projects) */}
        {isMultiFile && viewMode === 'code' && showFileExplorer && (
          <div className="w-48 border-r border-white/10 flex-shrink-0">
            <FileExplorer
              files={files}
              activeFilePath={activeFilePath}
              onFileSelect={handleFileSelect}
            />
          </div>
        )}
        
        {/* Code Editor or Preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {viewMode === 'code' ? (
            isMultiFile ? (
              <CodeEditor
                file={activeFile}
                openFiles={openFiles}
                activeFilePath={activeFilePath}
                onFileSelect={handleFileSelect}
                onFileClose={handleFileClose}
                onChange={handleFileChange}
                onSave={handleSave}
              />
            ) : (
              // Simple code view for single-file artifacts
              <div className="h-full overflow-auto p-4 bg-black">
                <pre className="text-sm font-mono text-zinc-300 whitespace-pre-wrap">
                  <code>{getArtifactCode(artifact)}</code>
                </pre>
              </div>
            )
          ) : (
            <ArtifactPreview
              artifact={artifact}
              onOutput={handleOutput}
              onError={(err) => handleOutput(`[error] ${err}`)}
            />
          )}
        </div>
      </div>
      
      {/* Console Panel (collapsible) */}
      {consoleOpen && (
        <div className="border-t border-white/10 bg-black">
          <div className="flex items-center justify-between px-3 py-1 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-xs font-mono text-zinc-400">Console</span>
              {consoleOutput.length > 0 && (
                <span className="px-1.5 py-0.5 bg-orange/20 text-orange text-xs rounded">
                  {consoleOutput.length}
                </span>
              )}
            </div>
            <button
              onClick={() => setConsoleOpen(false)}
              className="p-1 hover:bg-white/10 rounded"
            >
              <X className="w-3 h-3 text-zinc-400" />
            </button>
          </div>
          <div className="h-32 overflow-auto p-2">
            {consoleOutput.length === 0 ? (
              <p className="text-zinc-500 text-xs font-mono">No output</p>
            ) : (
              consoleOutput.map((line, i) => (
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
              ))
            )}
          </div>
        </div>
      )}
      
      {/* Bottom status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-white/10 bg-terminal-dark text-xs font-mono text-zinc-500">
        <div className="flex items-center gap-3">
          {isMultiFile && (
            <button
              onClick={() => setShowFileExplorer(!showFileExplorer)}
              className="flex items-center gap-1 hover:text-zinc-300"
            >
              {showFileExplorer ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeft className="w-3.5 h-3.5" />}
            </button>
          )}
          {activeFile && (
            <span>{activeFile.path}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {modifiedFiles.size > 0 && (
            <span className="text-orange">{modifiedFiles.size} unsaved</span>
          )}
          <button
            onClick={() => setConsoleOpen(!consoleOpen)}
            className="flex items-center gap-1 hover:text-zinc-300"
          >
            <Terminal className="w-3.5 h-3.5" />
            Console
          </button>
        </div>
      </div>
    </div>
  );
}

export default ArtifactWorkspace;
