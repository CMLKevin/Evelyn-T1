import { useState } from 'react';
import { X, Download, FileText, Code, File } from 'lucide-react';

interface ExportModalProps {
  document: {
    id: number;
    title: string;
    contentType: string;
    language?: string;
  };
  onClose: () => void;
}

export default function ExportModal({ document, onClose }: ExportModalProps) {
  const [format, setFormat] = useState<string>('txt');
  const [isExporting, setIsExporting] = useState(false);

  const getAvailableFormats = () => {
    if (document.contentType === 'code') {
      const ext = document.language || 'txt';
      return [
        { value: ext, label: `Source Code (.${ext})`, icon: Code },
        { value: 'txt', label: 'Plain Text (.txt)', icon: FileText },
        { value: 'md', label: 'Markdown (.md)', icon: FileText },
        { value: 'html', label: 'HTML (.html)', icon: File },
      ];
    } else {
      return [
        { value: 'txt', label: 'Plain Text (.txt)', icon: FileText },
        { value: 'md', label: 'Markdown (.md)', icon: FileText },
        { value: 'html', label: 'HTML (.html)', icon: File },
        { value: 'pdf', label: 'PDF (via print)', icon: File },
      ];
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(`http://localhost:3001/api/collaborate/${document.id}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = url;
        
        // Determine file extension
        let ext = format;
        if (format === document.language) {
          ext = document.language || 'txt';
        }
        
        a.download = `${document.title}.${ext}`;
        window.document.body.appendChild(a);
        a.click();
        window.document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        // Show success message
        console.log('Export successful');
        onClose();
      } else {
        console.error('Export failed');
      }
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const formats = getAvailableFormats();

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-black border border-terminal-border rounded-lg w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-terminal-border">
          <h2 className="text-terminal-text font-semibold">Export Document</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-terminal-border rounded transition-colors"
          >
            <X className="w-4 h-4 text-terminal-text" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Document Info */}
          <div className="bg-terminal-border/30 rounded p-3">
            <div className="flex items-center gap-2 mb-1">
              {document.contentType === 'code' ? (
                <Code className="w-4 h-4 text-terminal-secondary" />
              ) : (
                <FileText className="w-4 h-4 text-terminal-secondary" />
              )}
              <span className="text-sm font-medium text-terminal-text">
                {document.title}
              </span>
            </div>
            {document.language && (
              <span className="text-xs text-terminal-secondary">
                Language: {document.language}
              </span>
            )}
          </div>

          {/* Format Selection */}
          <div>
            <label className="block text-sm text-terminal-text mb-3">
              Select Export Format
            </label>
            <div className="space-y-2">
              {formats.map((fmt) => {
                const Icon = fmt.icon;
                return (
                  <button
                    key={fmt.value}
                    onClick={() => setFormat(fmt.value)}
                    className={`w-full px-4 py-3 rounded border transition-all flex items-center gap-3
                               ${format === fmt.value
                                 ? 'bg-terminal-accent/20 border-terminal-accent text-terminal-accent'
                                 : 'bg-terminal-border/30 border-terminal-border text-terminal-text hover:bg-terminal-border'}`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{fmt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PDF Note */}
          {format === 'pdf' && (
            <div className="bg-terminal-secondary/10 border border-terminal-secondary/30 rounded p-3 text-xs text-terminal-text">
              <strong>Note:</strong> PDF export will open the print dialog. Select "Save as PDF" as your printer.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-terminal-border flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-terminal-border hover:bg-terminal-border/70 
                     rounded text-terminal-text transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-2 bg-terminal-accent/20 hover:bg-terminal-accent/30 
                     border border-terminal-accent rounded text-terminal-accent
                     transition-all disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-terminal-accent border-t-transparent rounded-full animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
