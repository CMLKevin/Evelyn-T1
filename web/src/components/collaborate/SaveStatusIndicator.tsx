import { useState } from 'react';
import { 
  Check, 
  Loader2, 
  AlertCircle, 
  WifiOff, 
  AlertTriangle,
  Pause,
  Clock
} from 'lucide-react';
import { SaveStatus } from '../../lib/collaborateAutoSave';
import { formatDistanceToNow } from 'date-fns';

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  lastSaved: string | null;
  pendingChanges?: number;
  error?: string | null;
  onForceSync?: () => void;
  compact?: boolean;
}

export default function SaveStatusIndicator({
  status,
  lastSaved,
  pendingChanges = 0,
  error,
  onForceSync,
  compact = false
}: SaveStatusIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const getStatusConfig = () => {
    switch (status) {
      case 'saved':
        return {
          icon: Check,
          iconClass: 'text-emerald-400',
          bgClass: 'bg-emerald-500/10 border-emerald-500/30',
          text: 'Saved',
          description: lastSaved 
            ? `Last saved ${formatDistanceToNow(new Date(lastSaved), { addSuffix: true })}`
            : 'All changes saved'
        };
      case 'saving':
        return {
          icon: Loader2,
          iconClass: 'text-cyan-400 animate-spin',
          bgClass: 'bg-cyan-500/10 border-cyan-500/30',
          text: 'Saving...',
          description: 'Saving your changes'
        };
      case 'unsaved':
        return {
          icon: Clock,
          iconClass: 'text-orange',
          bgClass: 'bg-orange/10 border-orange/30',
          text: 'Unsaved',
          description: pendingChanges > 0 
            ? `${pendingChanges} pending change${pendingChanges !== 1 ? 's' : ''}`
            : 'Changes will be saved automatically'
        };
      case 'conflict':
        return {
          icon: AlertTriangle,
          iconClass: 'text-red-400',
          bgClass: 'bg-red-500/10 border-red-500/30',
          text: 'Conflict',
          description: 'Version conflict detected. Click to resolve.'
        };
      case 'offline':
        return {
          icon: WifiOff,
          iconClass: 'text-terminal-500',
          bgClass: 'bg-terminal-800 border-white/20',
          text: 'Offline',
          description: pendingChanges > 0
            ? `${pendingChanges} change${pendingChanges !== 1 ? 's' : ''} queued`
            : 'Changes will sync when online'
        };
      case 'error':
        return {
          icon: AlertCircle,
          iconClass: 'text-red-400',
          bgClass: 'bg-red-500/10 border-red-500/30',
          text: 'Error',
          description: error || 'Save failed. Click to retry.'
        };
      case 'paused':
        return {
          icon: Pause,
          iconClass: 'text-purple-400',
          bgClass: 'bg-purple-500/10 border-purple-500/30',
          text: 'Paused',
          description: 'Auto-save paused while Evelyn is editing'
        };
      default:
        return {
          icon: Check,
          iconClass: 'text-terminal-500',
          bgClass: 'bg-terminal-800 border-white/20',
          text: 'Ready',
          description: ''
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  if (compact) {
    return (
      <div 
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className={`flex items-center gap-1.5 px-2 py-1 border ${config.bgClass} cursor-default`}>
          <Icon className={`w-3 h-3 ${config.iconClass}`} />
          <span className={`text-[10px] font-mono ${config.iconClass}`}>
            {config.text}
          </span>
        </div>
        
        {/* Tooltip */}
        {showTooltip && config.description && (
          <div className="absolute top-full right-0 mt-1 px-2 py-1.5 bg-terminal-black border-2 border-white/20 
                        text-xs font-mono text-terminal-300 whitespace-nowrap z-50 animate-fade-in">
            {config.description}
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      className={`flex items-center gap-2 px-3 py-2 border ${config.bgClass} 
                ${(status === 'conflict' || status === 'error') ? 'cursor-pointer hover:border-white/40' : ''}`}
      onClick={() => {
        if (status === 'error' && onForceSync) {
          onForceSync();
        }
      }}
    >
      <Icon className={`w-4 h-4 ${config.iconClass}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-mono font-bold ${config.iconClass}`}>
          {config.text}
        </p>
        {config.description && (
          <p className="text-[10px] font-mono text-terminal-500 truncate">
            {config.description}
          </p>
        )}
      </div>
      
      {/* Retry button for errors */}
      {status === 'error' && onForceSync && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onForceSync();
          }}
          className="px-2 py-1 text-[10px] font-mono font-bold bg-red-500/20 border border-red-500 
                   text-red-400 hover:bg-red-500/30 transition-colors"
        >
          Retry
        </button>
      )}
      
      {/* Sync button when offline with pending changes */}
      {status === 'offline' && pendingChanges > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 bg-terminal-800 border border-white/20">
          <span className="text-[10px] font-mono text-terminal-400">
            {pendingChanges} queued
          </span>
        </div>
      )}
    </div>
  );
}

// Minimal dot indicator for toolbar
export function SaveStatusDot({ status }: { status: SaveStatus }) {
  const getColor = () => {
    switch (status) {
      case 'saved': return 'bg-emerald-400';
      case 'saving': return 'bg-cyan-400 animate-pulse';
      case 'unsaved': return 'bg-orange animate-pulse';
      case 'conflict': return 'bg-red-400 animate-pulse';
      case 'offline': return 'bg-terminal-500';
      case 'error': return 'bg-red-400';
      case 'paused': return 'bg-purple-400';
      default: return 'bg-terminal-500';
    }
  };

  return (
    <div className={`w-2 h-2 rounded-full ${getColor()}`} title={status} />
  );
}
