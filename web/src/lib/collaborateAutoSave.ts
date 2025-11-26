import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useStore } from '../state/store';

// ========================================
// Types
// ========================================

export type SaveStatus = 
  | 'saved'           // All changes saved
  | 'saving'          // Currently saving
  | 'unsaved'         // Has unsaved changes
  | 'conflict'        // Version conflict detected
  | 'offline'         // Offline, changes queued
  | 'error'           // Save failed
  | 'paused';         // Paused during AI edits

export interface ConflictInfo {
  localContent: string;
  serverContent: string;
  serverVersion: number;
  localVersion: number;
  conflictedAt: string;
}

export interface AutoSaveState {
  status: SaveStatus;
  lastSaved: string | null;
  lastSavedVersion: number | null;
  isDirty: boolean;
  pendingChanges: number;
  conflict: ConflictInfo | null;
  error: string | null;
}

interface AutoSaveOptions {
  delay?: number;
  maxDelay?: number;
  onSave: (content: string, version?: number) => Promise<{ success: boolean; version?: number; conflict?: boolean; serverContent?: string }>;
  onError?: (error: Error) => void;
  onConflict?: (conflict: ConflictInfo) => void;
}

// ========================================
// Collaborate Auto-Save Hook
// ========================================

export function useCollaborateAutoSave(
  content: string,
  documentId: number | null,
  currentVersion: number | null,
  options: AutoSaveOptions
) {
  const { delay = 2000, maxDelay = 10000, onSave, onError, onConflict } = options;
  
  // State
  const [state, setState] = useState<AutoSaveState>({
    status: 'saved',
    lastSaved: null,
    lastSavedVersion: currentVersion,
    isDirty: false,
    pendingChanges: 0,
    conflict: null,
    error: null
  });
  
  // Refs
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<string>(content);
  const pendingContentRef = useRef<string | null>(null);
  const isPausedRef = useRef<boolean>(false);
  const changeCountRef = useRef<number>(0);
  const offlineQueueRef = useRef<Array<{ content: string; timestamp: number }>>([]);
  
  // Get edit mode from store to detect AI editing
  const editMode = useStore(state => state.collaborateState.editMode);
  
  // Pause auto-save when Evelyn is editing
  useEffect(() => {
    if (editMode === 'evelyn') {
      isPausedRef.current = true;
      setState(prev => ({ ...prev, status: 'paused' }));
    } else if (isPausedRef.current) {
      isPausedRef.current = false;
      // Resume with current content if dirty
      if (pendingContentRef.current) {
        triggerSave(pendingContentRef.current);
      } else {
        setState(prev => prev.status === 'paused' ? { ...prev, status: 'saved' } : prev);
      }
    }
  }, [editMode]);
  
  // Check online status
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Process offline queue
      processOfflineQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setState(prev => ({ ...prev, status: 'offline' }));
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Process offline queue when back online
  const processOfflineQueue = useCallback(async () => {
    if (offlineQueueRef.current.length === 0) return;
    
    // Get the latest queued content
    const latestQueued = offlineQueueRef.current[offlineQueueRef.current.length - 1];
    offlineQueueRef.current = [];
    
    if (latestQueued) {
      await performSave(latestQueued.content);
    }
  }, []);
  
  // Perform the actual save
  const performSave = useCallback(async (contentToSave: string) => {
    if (!documentId || isPausedRef.current) return;
    
    // If offline, queue the save
    if (!isOnline) {
      offlineQueueRef.current.push({ content: contentToSave, timestamp: Date.now() });
      setState(prev => ({ 
        ...prev, 
        status: 'offline',
        pendingChanges: offlineQueueRef.current.length 
      }));
      return;
    }
    
    setState(prev => ({ ...prev, status: 'saving', error: null }));
    
    try {
      const result = await onSave(contentToSave, state.lastSavedVersion ?? undefined);
      
      if (result.conflict && result.serverContent) {
        // Conflict detected
        const conflictInfo: ConflictInfo = {
          localContent: contentToSave,
          serverContent: result.serverContent,
          serverVersion: result.version || 0,
          localVersion: state.lastSavedVersion || 0,
          conflictedAt: new Date().toISOString()
        };
        
        setState(prev => ({
          ...prev,
          status: 'conflict',
          conflict: conflictInfo
        }));
        
        onConflict?.(conflictInfo);
      } else if (result.success) {
        // Success
        lastSavedContentRef.current = contentToSave;
        pendingContentRef.current = null;
        changeCountRef.current = 0;
        
        setState(prev => ({
          ...prev,
          status: 'saved',
          lastSaved: new Date().toISOString(),
          lastSavedVersion: result.version ?? prev.lastSavedVersion,
          isDirty: false,
          pendingChanges: 0,
          conflict: null,
          error: null
        }));
      } else {
        throw new Error('Save failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Save failed';
      setState(prev => ({ ...prev, status: 'error', error: errorMessage }));
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [documentId, isOnline, state.lastSavedVersion, onSave, onConflict, onError]);
  
  // Trigger a save with debouncing
  const triggerSave = useCallback((contentToSave: string) => {
    pendingContentRef.current = contentToSave;
    changeCountRef.current++;
    
    setState(prev => ({
      ...prev,
      isDirty: true,
      status: isPausedRef.current ? 'paused' : (isOnline ? 'unsaved' : 'offline'),
      pendingChanges: changeCountRef.current
    }));
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Don't schedule save if paused
    if (isPausedRef.current) return;
    
    // Set debounced timeout
    timeoutRef.current = setTimeout(() => {
      performSave(contentToSave);
    }, delay);
    
    // Set max delay timeout (force save after maxDelay)
    if (!maxTimeoutRef.current) {
      maxTimeoutRef.current = setTimeout(() => {
        maxTimeoutRef.current = null;
        if (pendingContentRef.current) {
          performSave(pendingContentRef.current);
        }
      }, maxDelay);
    }
  }, [delay, maxDelay, isOnline, performSave]);
  
  // Watch for content changes
  useEffect(() => {
    if (!documentId) return;
    
    // Skip if content matches last saved
    if (content === lastSavedContentRef.current) {
      return;
    }
    
    triggerSave(content);
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, documentId, triggerSave]);
  
  // Reset when document changes
  useEffect(() => {
    lastSavedContentRef.current = content;
    pendingContentRef.current = null;
    changeCountRef.current = 0;
    offlineQueueRef.current = [];
    
    setState({
      status: 'saved',
      lastSaved: null,
      lastSavedVersion: currentVersion,
      isDirty: false,
      pendingChanges: 0,
      conflict: null,
      error: null
    });
    
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (maxTimeoutRef.current) clearTimeout(maxTimeoutRef.current);
    };
  }, [documentId, currentVersion]);
  
  // Force save function
  const forceSave = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (maxTimeoutRef.current) clearTimeout(maxTimeoutRef.current);
    maxTimeoutRef.current = null;
    
    const contentToSave = pendingContentRef.current || content;
    performSave(contentToSave);
  }, [content, performSave]);
  
  // Resolve conflict by choosing a side
  const resolveConflict = useCallback(async (choice: 'local' | 'server' | 'merge', mergedContent?: string) => {
    if (!state.conflict) return;
    
    let contentToSave: string;
    
    switch (choice) {
      case 'local':
        contentToSave = state.conflict.localContent;
        break;
      case 'server':
        contentToSave = state.conflict.serverContent;
        // Update the editor content to server version
        break;
      case 'merge':
        if (!mergedContent) throw new Error('Merged content required');
        contentToSave = mergedContent;
        break;
    }
    
    // Clear conflict and force save with new version
    setState(prev => ({ 
      ...prev, 
      conflict: null,
      lastSavedVersion: state.conflict!.serverVersion // Use server version as base
    }));
    
    await performSave(contentToSave);
    
    return contentToSave;
  }, [state.conflict, performSave]);
  
  // Pause/resume auto-save
  const pause = useCallback(() => {
    isPausedRef.current = true;
    setState(prev => ({ ...prev, status: 'paused' }));
  }, []);
  
  const resume = useCallback(() => {
    isPausedRef.current = false;
    if (pendingContentRef.current) {
      triggerSave(pendingContentRef.current);
    } else {
      setState(prev => prev.status === 'paused' ? { ...prev, status: 'saved' } : prev);
    }
  }, [triggerSave]);
  
  return {
    ...state,
    forceSave,
    resolveConflict,
    pause,
    resume,
    isOnline
  };
}

// Legacy hook for backwards compatibility
export function useAutoSave(
  content: string,
  documentId: number | null,
  options: { delay?: number; onSave: (content: string) => Promise<void>; onError?: (error: Error) => void }
) {
  const { delay = 500, onSave, onError } = options;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContent = useRef<string>('');
  const isSavingRef = useRef<boolean>(false);

  const save = useCallback(async (contentToSave: string) => {
    if (isSavingRef.current || !documentId) return;
    
    try {
      isSavingRef.current = true;
      await onSave(contentToSave);
      lastSavedContent.current = contentToSave;
    } catch (error) {
      if (onError && error instanceof Error) {
        onError(error);
      }
    } finally {
      isSavingRef.current = false;
    }
  }, [documentId, onSave, onError]);

  useEffect(() => {
    if (!documentId) return;
    if (content === lastSavedContent.current) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      save(content);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, documentId, delay, save]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    isSaving: isSavingRef.current,
    lastSavedContent: lastSavedContent.current
  };
}

export function formatSaveTime(timestamp: string | null): string {
  if (!timestamp) return 'Never';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffSeconds < 60) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
}
