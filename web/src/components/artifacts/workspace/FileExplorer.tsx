/**
 * FileExplorer Component
 * 
 * Tree view for browsing project files in multi-file artifacts.
 * Inspired by VS Code and Manus file explorers.
 */

import React, { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  File,
  FileCode,
  FileJson,
  FileText,
  FileType,
  Folder,
  FolderOpen,
  Image,
  Palette,
  Plus,
  MoreHorizontal
} from 'lucide-react';
import type { ArtifactFile } from '../types';

interface FileExplorerProps {
  files: ArtifactFile[];
  activeFilePath: string | null;
  onFileSelect: (path: string) => void;
  onFileCreate?: (path: string) => void;
  onFileDelete?: (path: string) => void;
  onFileRename?: (oldPath: string, newPath: string) => void;
  className?: string;
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  file?: ArtifactFile;
}

// Get icon for file based on extension
function getFileIcon(filename: string): React.ReactNode {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const iconClass = "w-4 h-4";
  
  switch (ext) {
    case 'ts':
    case 'tsx':
      return <FileCode className={`${iconClass} text-blue-400`} />;
    case 'js':
    case 'jsx':
      return <FileCode className={`${iconClass} text-yellow-400`} />;
    case 'json':
      return <FileJson className={`${iconClass} text-yellow-300`} />;
    case 'css':
    case 'scss':
    case 'less':
      return <Palette className={`${iconClass} text-pink-400`} />;
    case 'html':
      return <FileCode className={`${iconClass} text-orange-400`} />;
    case 'md':
    case 'markdown':
      return <FileText className={`${iconClass} text-zinc-400`} />;
    case 'py':
      return <FileType className={`${iconClass} text-green-400`} />;
    case 'svg':
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
      return <Image className={`${iconClass} text-purple-400`} />;
    default:
      return <File className={`${iconClass} text-zinc-500`} />;
  }
}

// Build tree structure from flat file list
function buildFileTree(files: ArtifactFile[]): FileNode[] {
  const root: FileNode[] = [];
  
  // Sort files by path for consistent ordering
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));
  
  for (const file of sortedFiles) {
    if (file.isHidden) continue;
    
    const parts = file.path.split('/');
    let currentLevel = root;
    let currentPath = '';
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = i === parts.length - 1;
      
      let existing = currentLevel.find(n => n.name === part);
      
      if (!existing) {
        existing = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'folder',
          children: isFile ? undefined : [],
          file: isFile ? file : undefined
        };
        currentLevel.push(existing);
      }
      
      if (!isFile && existing.children) {
        currentLevel = existing.children;
      }
    }
  }
  
  // Sort: folders first, then files, alphabetically
  const sortNodes = (nodes: FileNode[]): FileNode[] => {
    return nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    }).map(node => ({
      ...node,
      children: node.children ? sortNodes(node.children) : undefined
    }));
  };
  
  return sortNodes(root);
}

interface FileTreeItemProps {
  node: FileNode;
  depth: number;
  activeFilePath: string | null;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onFileSelect: (path: string) => void;
}

function FileTreeItem({
  node,
  depth,
  activeFilePath,
  expandedFolders,
  onToggleFolder,
  onFileSelect
}: FileTreeItemProps) {
  const isExpanded = expandedFolders.has(node.path);
  const isActive = node.path === activeFilePath;
  const paddingLeft = depth * 12 + 8;
  
  const handleClick = () => {
    if (node.type === 'folder') {
      onToggleFolder(node.path);
    } else {
      onFileSelect(node.path);
    }
  };
  
  return (
    <>
      <button
        onClick={handleClick}
        className={`
          w-full flex items-center gap-1.5 py-1 pr-2 text-left text-sm
          transition-colors hover:bg-white/5 group
          ${isActive ? 'bg-orange/10 text-orange' : 'text-zinc-300'}
        `}
        style={{ paddingLeft: `${paddingLeft}px` }}
      >
        {node.type === 'folder' ? (
          <>
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-zinc-500" />
            ) : (
              <ChevronRight className="w-3 h-3 text-zinc-500" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-orange" />
            ) : (
              <Folder className="w-4 h-4 text-zinc-400" />
            )}
          </>
        ) : (
          <>
            <span className="w-3" /> {/* Spacer for alignment */}
            {getFileIcon(node.name)}
          </>
        )}
        <span className="truncate flex-1 font-mono text-xs">
          {node.name}
        </span>
        {node.file?.isDirty && (
          <span className="w-2 h-2 rounded-full bg-orange" title="Unsaved changes" />
        )}
      </button>
      
      {node.type === 'folder' && isExpanded && node.children && (
        <div>
          {node.children.map(child => (
            <FileTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              activeFilePath={activeFilePath}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              onFileSelect={onFileSelect}
            />
          ))}
        </div>
      )}
    </>
  );
}

export function FileExplorer({
  files,
  activeFilePath,
  onFileSelect,
  onFileCreate,
  className = ''
}: FileExplorerProps) {
  // Track which folders are expanded
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    // Expand all folders by default for small projects
    const folders = new Set<string>();
    files.forEach(file => {
      const parts = file.path.split('/');
      let path = '';
      for (let i = 0; i < parts.length - 1; i++) {
        path = path ? `${path}/${parts[i]}` : parts[i];
        folders.add(path);
      }
    });
    return folders;
  });
  
  const fileTree = useMemo(() => buildFileTree(files), [files]);
  
  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };
  
  return (
    <div className={`flex flex-col h-full bg-terminal-dark ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
          Files
        </span>
        {onFileCreate && (
          <button
            onClick={() => onFileCreate('')}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            title="New file"
          >
            <Plus className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        )}
      </div>
      
      {/* File tree */}
      <div className="flex-1 overflow-auto py-1">
        {fileTree.length === 0 ? (
          <div className="px-3 py-4 text-center text-zinc-500 text-xs">
            No files
          </div>
        ) : (
          fileTree.map(node => (
            <FileTreeItem
              key={node.path}
              node={node}
              depth={0}
              activeFilePath={activeFilePath}
              expandedFolders={expandedFolders}
              onToggleFolder={toggleFolder}
              onFileSelect={onFileSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default FileExplorer;
