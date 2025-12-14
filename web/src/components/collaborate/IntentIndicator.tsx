import { useState, useEffect } from 'react';
import { useStore } from '../../state/store';
import { Edit3, MessageCircle, Zap, HelpCircle, CheckCircle2, XCircle } from 'lucide-react';

interface IntentIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export default function IntentIndicator({ className = '', showDetails = true }: IntentIndicatorProps) {
  const { collaborateState } = useStore();
  const { lastIntentDetection } = collaborateState;
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    if (lastIntentDetection) {
      setIsVisible(true);
      // Auto-hide after 15 seconds for low-confidence results (increased from 5s for better UX)
      if (lastIntentDetection.confidence < 0.8) {
        const timer = setTimeout(() => setIsVisible(false), 15000);
        return () => clearTimeout(timer);
      }
    }
  }, [lastIntentDetection]);
  
  if (!lastIntentDetection || !isVisible) {
    return null;
  }
  
  const { intent, confidence, autoRunTriggered, action, instruction } = lastIntentDetection;
  
  // Check for edit intent - 'edit_document' is the actual type, or action is 'edit_document'
  const isEdit = intent === 'edit_document' || action === 'edit_document';
  const isHighConfidence = confidence >= 0.85;
  const isAutoTriggered = autoRunTriggered;
  
  // Determine display style based on confidence
  const getConfidenceColor = () => {
    if (confidence >= 0.90) return 'text-green-400 bg-green-500/10 border-green-500/30';
    if (confidence >= 0.70) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30';
  };
  
  const getIcon = () => {
    if (isEdit) {
      if (isAutoTriggered) return <Zap className="w-3.5 h-3.5" />;
      return <Edit3 className="w-3.5 h-3.5" />;
    }
    return <MessageCircle className="w-3.5 h-3.5" />;
  };
  
  const getLabel = () => {
    if (isEdit) {
      if (isAutoTriggered) return 'Auto-editing';
      return 'Edit detected';
    }
    return 'Chat mode';
  };
  
  return (
    <div className={`flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200 ${className}`}>
      {/* Main indicator badge */}
      <div className={`
        flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium
        border transition-all duration-200
        ${getConfidenceColor()}
      `}>
        {getIcon()}
        <span>{getLabel()}</span>
        
        {/* Confidence percentage */}
        <span className="opacity-60 ml-0.5">
          {Math.round(confidence * 100)}%
        </span>
      </div>
      
      {/* Auto-trigger indicator */}
      {isAutoTriggered && (
        <div className="flex items-center gap-1 text-xs text-green-400 animate-in zoom-in duration-200">
          <CheckCircle2 className="w-3 h-3" />
          <span>Running</span>
        </div>
      )}
      
      {/* Details tooltip */}
      {showDetails && action && (
        <div className="group relative">
          <HelpCircle className="w-3.5 h-3.5 text-zinc-500 cursor-help" />
          <div className="
            absolute bottom-full right-0 mb-2 w-64 p-2 rounded-lg
            bg-zinc-800 border border-zinc-700 text-xs text-zinc-300
            opacity-0 invisible group-hover:opacity-100 group-hover:visible
            transition-all duration-200 z-50
          ">
            <div className="font-medium text-white mb-1">
              {isEdit ? 'Edit Intent' : 'Chat Intent'}
            </div>
            <div className="text-zinc-400 line-clamp-3">
              {action}
            </div>
            {instruction && (
              <div className="mt-1 pt-1 border-t border-zinc-700 text-zinc-500">
                {instruction.slice(0, 100)}...
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Dismiss button */}
      <button 
        onClick={() => setIsVisible(false)}
        className="p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <XCircle className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/**
 * Compact version for the chat input area
 */
export function IntentHint({ message }: { message: string }) {
  const [hint, setHint] = useState<'edit' | 'chat' | null>(null);
  
  useEffect(() => {
    // Quick local pattern check for UI hints
    if (!message.trim()) {
      setHint(null);
      return;
    }
    
    const lower = message.toLowerCase().trim();
    
    // Check for edit patterns
    const editPatterns = [
      /^(please\s+)?(fix|add|remove|change|modify|update|refactor|implement|create|delete)/i,
      /^make\s+(it|this|the)/i,
      /^(can|could|would)\s+you\s+(fix|add|remove|change)/i,
    ];
    
    const notEditPatterns = [
      /^(what|why|how|when|where|who|which)\s+/i,
      /^(explain|describe|tell me)/i,
      /\?$/,
    ];
    
    if (editPatterns.some(p => p.test(lower))) {
      setHint('edit');
    } else if (notEditPatterns.some(p => p.test(lower))) {
      setHint('chat');
    } else {
      setHint(null);
    }
  }, [message]);
  
  if (!hint) return null;
  
  return (
    <div className={`
      absolute right-2 top-1/2 -translate-y-1/2
      flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]
      ${hint === 'edit' 
        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' 
        : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
      }
    `}>
      {hint === 'edit' ? (
        <>
          <Edit3 className="w-2.5 h-2.5" />
          <span>Edit</span>
        </>
      ) : (
        <>
          <MessageCircle className="w-2.5 h-2.5" />
          <span>Chat</span>
        </>
      )}
    </div>
  );
}
