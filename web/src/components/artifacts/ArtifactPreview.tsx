/**
 * ArtifactPreview Component
 * 
 * Renders artifact content in a sandboxed iframe.
 * Supports React, HTML, SVG, and Mermaid rendering.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import type { Artifact } from './types';
import { getArtifactCode } from './types';

interface ArtifactPreviewProps {
  artifact: Artifact;
  onOutput?: (output: string) => void;
  onError?: (error: string) => void;
  onSuccess?: () => void;
}

// HTML template for React artifacts
const REACT_TEMPLATE = (code: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://esm.sh/react@18"></script>
  <script src="https://esm.sh/react-dom@18"></script>
  <script src="https://esm.sh/@babel/standalone"></script>
  <style>
    body { margin: 0; padding: 16px; background: #0a0a0a; color: white; font-family: system-ui; }
    #root { min-height: 100vh; }
    .error { color: #ef4444; background: #450a0a; padding: 12px; border: 1px solid #ef4444; margin: 8px 0; font-family: monospace; font-size: 12px; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect, useCallback, useMemo, useRef } = React;
    
    // Console override to send output to parent
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    const sendOutput = (type, ...args) => {
      window.parent.postMessage({
        type: 'console',
        level: type,
        args: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))
      }, '*');
    };
    
    console.log = (...args) => { originalLog(...args); sendOutput('log', ...args); };
    console.error = (...args) => { originalError(...args); sendOutput('error', ...args); };
    console.warn = (...args) => { originalWarn(...args); sendOutput('warn', ...args); };
    
    try {
      ${code}
      
      // Try to find and render the component
      const Component = typeof App !== 'undefined' ? App : 
                       typeof Component !== 'undefined' ? Component :
                       typeof Default !== 'undefined' ? Default : null;
      
      if (Component) {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<Component />);
        window.parent.postMessage({ type: 'success' }, '*');
      } else {
        throw new Error('No component found. Export a component as App, Component, or Default.');
      }
    } catch (error) {
      document.getElementById('root').innerHTML = '<div class="error">' + error.message + '</div>';
      window.parent.postMessage({ type: 'error', message: error.message }, '*');
    }
  </script>
</body>
</html>
`;

// HTML template for plain HTML artifacts
const HTML_TEMPLATE = (code: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { margin: 0; padding: 16px; background: #0a0a0a; color: white; font-family: system-ui; }
  </style>
</head>
<body>
  ${code}
  <script>
    // Console override
    const sendOutput = (type, ...args) => {
      window.parent.postMessage({
        type: 'console',
        level: type,
        args: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))
      }, '*');
    };
    
    console.log = (...args) => { sendOutput('log', ...args); };
    console.error = (...args) => { sendOutput('error', ...args); };
    
    window.parent.postMessage({ type: 'success' }, '*');
  </script>
</body>
</html>
`;

// SVG template
const SVG_TEMPLATE = (code: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { margin: 0; padding: 16px; background: #0a0a0a; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    svg { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  ${code}
  <script>window.parent.postMessage({ type: 'success' }, '*');</script>
</body>
</html>
`;

// Mermaid template
const MERMAID_TEMPLATE = (code: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <style>
    body { margin: 0; padding: 16px; background: #0a0a0a; }
    .mermaid { display: flex; justify-content: center; }
  </style>
</head>
<body>
  <div class="mermaid">
${code}
  </div>
  <script>
    mermaid.initialize({ startOnLoad: true, theme: 'dark' });
    setTimeout(() => window.parent.postMessage({ type: 'success' }, '*'), 500);
  </script>
</body>
</html>
`;

// Markdown template
const MARKDOWN_TEMPLATE = (code: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css/github-markdown-dark.min.css">
  <style>
    body { margin: 0; padding: 16px; background: #0a0a0a; }
    .markdown-body { background: transparent; }
  </style>
</head>
<body>
  <div id="content" class="markdown-body"></div>
  <script>
    document.getElementById('content').innerHTML = marked.parse(\`${code.replace(/`/g, '\\`')}\`);
    window.parent.postMessage({ type: 'success' }, '*');
  </script>
</body>
</html>
`;

export function ArtifactPreview({ artifact, onOutput, onError, onSuccess }: ArtifactPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate iframe content based on artifact type
  const getIframeContent = (): string => {
    const code = getArtifactCode(artifact);
    
    switch (artifact.type) {
      case 'project':
      case 'react':
        return REACT_TEMPLATE(code);
      case 'html':
        return HTML_TEMPLATE(code);
      case 'svg':
        return SVG_TEMPLATE(code);
      case 'mermaid':
        return MERMAID_TEMPLATE(code);
      case 'markdown':
        return MARKDOWN_TEMPLATE(code);
      case 'python':
        // Python requires server-side execution
        return `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { margin: 0; padding: 16px; background: #0a0a0a; color: white; font-family: monospace; }
            </style>
          </head>
          <body>
            <p>Python execution requires server-side processing.</p>
            <pre>${artifact.output || 'No output yet.'}</pre>
          </body>
          </html>
        `;
      default:
        return HTML_TEMPLATE(code);
    }
  };

  // Listen for messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'console') {
        const output = `[${event.data.level}] ${event.data.args.join(' ')}`;
        onOutput?.(output);
      } else if (event.data?.type === 'success') {
        setLoading(false);
        setError(null);
        onSuccess?.();
      } else if (event.data?.type === 'error') {
        setLoading(false);
        setError(event.data.message);
        onError?.(event.data.message);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onOutput, onError, onSuccess]);

  // Update iframe content when artifact changes
  useEffect(() => {
    if (iframeRef.current) {
      setLoading(true);
      setError(null);
      
      const content = getIframeContent();
      const blob = new Blob([content], { type: 'text/html' });
      iframeRef.current.src = URL.createObjectURL(blob);
      
      // Timeout for loading
      const timeout = setTimeout(() => {
        if (loading) {
          setLoading(false);
        }
      }, 5000);

      return () => clearTimeout(timeout);
    }
  }, [artifact.code, artifact.type]);

  const handleRefresh = () => {
    if (iframeRef.current) {
      setLoading(true);
      setError(null);
      const content = getIframeContent();
      const blob = new Blob([content], { type: 'text/html' });
      iframeRef.current.src = URL.createObjectURL(blob);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[300px] bg-black border border-white/10">
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <div className="flex items-center gap-2 text-orange">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-mono text-sm">Loading preview...</span>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10 p-4">
          <div className="bg-red-500/10 border border-red-500 p-4 max-w-md">
            <div className="flex items-center gap-2 text-red-400 mb-2">
              <AlertCircle className="w-5 h-5" />
              <span className="font-mono text-sm font-medium">Preview Error</span>
            </div>
            <p className="text-red-300 text-xs font-mono">{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-500 text-red-400 hover:bg-red-500/30 transition-colors text-xs font-mono"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Refresh button */}
      <button
        onClick={handleRefresh}
        className="absolute top-2 right-2 p-1.5 bg-black/50 border border-white/20 text-white/50 hover:text-white hover:bg-black/70 transition-colors z-20"
        title="Refresh preview"
      >
        <RefreshCw className="w-4 h-4" />
      </button>

      {/* Sandboxed iframe */}
      <iframe
        ref={iframeRef}
        title={artifact.title}
        sandbox="allow-scripts allow-forms"
        className="w-full h-full border-0"
        style={{ minHeight: '300px' }}
      />
    </div>
  );
}

export default ArtifactPreview;
