import React, { useEffect, useState, useRef } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, Eye, Undo, Clock, Volume2, VolumeX } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
}

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  actions?: ToastAction[];
  metadata?: {
    errorId?: string;
    changeId?: string;
    [key: string]: any;
  };
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
  onHover: (id: string, isHovered: boolean) => void;
}

interface ToastContainerProps {
  maxVisible?: number;
}

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle
};

const colorMap = {
  success: 'bg-green-500/20 border-green-500/50 text-green-300',
  error: 'bg-red-500/20 border-red-500/50 text-red-300',
  info: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
  warning: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'
};

const soundUrls = {
  success: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJiusLBD',
  error: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACFhYWFbF1fdJiusLBD',
  info: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJiusLBD',
  warning: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACFhYWFbF1fdJiusLBD'
};

// Global toast state management
let toastListeners: Array<(toasts: Toast[]) => void> = [];
let toastQueue: Toast[] = [];
let toastHistory: (Toast & { timestamp: number })[] = [];
let soundEnabled = true;

export const toastManager = {
  show: (toast: Omit<Toast, 'id'>) => {
    const newToast: Toast = {
      id: `toast-${Date.now()}-${Math.random()}`,
      duration: 5000,
      ...toast
    };

    // Add to history
    toastHistory.unshift({ ...newToast, timestamp: Date.now() });
    if (toastHistory.length > 50) toastHistory = toastHistory.slice(0, 50);

    // Play sound
    if (soundEnabled && soundUrls[newToast.type]) {
      try {
        const audio = new Audio(soundUrls[newToast.type]);
        audio.volume = 0.3;
        audio.play().catch(() => {}); // Ignore audio play errors
      } catch {}
    }

    // Add to queue
    toastQueue.push(newToast);
    notifyListeners();
  },

  dismiss: (id: string) => {
    toastQueue = toastQueue.filter(t => t.id !== id);
    notifyListeners();
  },

  dismissAll: () => {
    toastQueue = [];
    notifyListeners();
  },

  getHistory: () => toastHistory,

  setSoundEnabled: (enabled: boolean) => {
    soundEnabled = enabled;
  },

  isSoundEnabled: () => soundEnabled,

  subscribe: (listener: (toasts: Toast[]) => void) => {
    toastListeners.push(listener);
    listener(toastQueue);
    return () => {
      toastListeners = toastListeners.filter(l => l !== listener);
    };
  }
};

function notifyListeners() {
  toastListeners.forEach(listener => listener([...toastQueue]));
}

function ToastItem({ toast, onClose, onHover }: ToastProps) {
  const Icon = iconMap[toast.type];
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const duration = toast.duration ?? 5000;
    
    if (duration > 0 && !isHovered) {
      timerRef.current = setTimeout(() => {
        onClose(toast.id);
      }, duration);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [toast.id, toast.duration, onClose, isHovered]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    onHover(toast.id, true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    onHover(toast.id, false);
  };

  return (
    <div
      className={`flex flex-col gap-2 px-4 py-3  border ${colorMap[toast.type]} backdrop-blur-sm shadow-lg animate-slide-in-right transition-all ${
        isHovered ? 'scale-105' : 'scale-100'
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <p className="flex-1 text-sm font-medium">{toast.message}</p>
        <button
          onClick={() => onClose(toast.id)}
          className="flex-shrink-0 p-0.5 hover:bg-white/10 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Action Buttons */}
      {toast.actions && toast.actions.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          {toast.actions.map((action, index) => {
            const ActionIcon = action.icon;
            return (
              <button
                key={index}
                onClick={() => {
                  action.onClick();
                  onClose(toast.id);
                }}
                className="flex items-center gap-1.5 px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs font-medium transition-colors"
              >
                {ActionIcon && <ActionIcon className="w-3.5 h-3.5" />}
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ToastContainer({ maxVisible = 3 }: ToastContainerProps) {
  const [allToasts, setAllToasts] = useState<Toast[]>([]);
  const [hoveredToasts, setHoveredToasts] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(toastManager.isSoundEnabled());

  useEffect(() => {
    return toastManager.subscribe(setAllToasts);
  }, []);

  const handleHover = (id: string, isHovered: boolean) => {
    setHoveredToasts(prev => {
      const next = new Set(prev);
      if (isHovered) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const toggleSound = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    toastManager.setSoundEnabled(newValue);
  };

  // Show only maxVisible toasts that aren't hovered, plus all hovered toasts
  const visibleToasts = allToasts.filter((_, index) => {
    return index < maxVisible || hoveredToasts.has(allToasts[index]?.id);
  });

  const queuedCount = Math.max(0, allToasts.length - maxVisible);
  const history = toastManager.getHistory();

  return (
    <>
      {/* Toast Stack */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md pointer-events-none">
        {/* Queue indicator */}
        {queuedCount > 0 && (
          <div className="pointer-events-auto bg-gray-800/90 border border-white/10  px-3 py-2 backdrop-blur-sm shadow-lg">
            <p className="text-xs text-gray-300">
              +{queuedCount} more notification{queuedCount > 1 ? 's' : ''} queued
            </p>
          </div>
        )}

        {/* Visible toasts */}
        {visibleToasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onClose={toastManager.dismiss} onHover={handleHover} />
          </div>
        ))}

        {/* Controls */}
        {(allToasts.length > 0 || history.length > 0) && (
          <div className="pointer-events-auto flex items-center gap-2">
            {allToasts.length > 0 && (
              <button
                onClick={toastManager.dismissAll}
                className="flex-1 px-3 py-1.5 bg-gray-800/90 hover:bg-gray-700/90 border border-white/10 rounded text-xs font-medium text-gray-300 transition-colors backdrop-blur-sm"
              >
                Dismiss All
              </button>
            )}
            {history.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800/90 hover:bg-gray-700/90 border border-white/10 rounded text-xs font-medium text-gray-300 transition-colors backdrop-blur-sm"
              >
                <Clock className="w-3.5 h-3.5" />
                History
              </button>
            )}
            <button
              onClick={toggleSound}
              className="px-2 py-1.5 bg-gray-800/90 hover:bg-gray-700/90 border border-white/10 rounded text-gray-300 transition-colors backdrop-blur-sm"
              title={soundEnabled ? 'Disable sounds' : 'Enable sounds'}
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* History Panel */}
      {showHistory && (
        <div className="fixed top-4 right-4 z-[60] w-96 max-h-[600px] bg-[#1a1a1a] border border-white/10  shadow-2xl flex flex-col pointer-events-auto">
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-gray-100">Notification History</h3>
              <span className="text-xs text-gray-500">({history.length})</span>
            </div>
            <button
              onClick={() => setShowHistory(false)}
              className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-gray-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* History List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                <Clock className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              history.map((toast) => {
                const Icon = iconMap[toast.type];
                const timeSince = Date.now() - toast.timestamp;
                const minutesAgo = Math.floor(timeSince / 60000);
                const timeStr = minutesAgo < 1
                  ? 'Just now'
                  : minutesAgo < 60
                  ? `${minutesAgo}m ago`
                  : `${Math.floor(minutesAgo / 60)}h ago`;

                return (
                  <div
                    key={toast.id}
                    className={`p-3 rounded border ${colorMap[toast.type]} bg-opacity-50`}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{toast.message}</p>
                        <p className="text-xs text-gray-500 mt-1">{timeStr}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Helper functions for common toast types
export const toast = {
  success: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => {
    toastManager.show({ type: 'success', message, ...options });
  },
  error: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => {
    toastManager.show({ type: 'error', message, ...options });
  },
  info: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => {
    toastManager.show({ type: 'info', message, ...options });
  },
  warning: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => {
    toastManager.show({ type: 'warning', message, ...options });
  }
};
