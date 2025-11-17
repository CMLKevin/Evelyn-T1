import { useEffect, useRef, useCallback } from 'react';

interface AutoSaveOptions {
  delay?: number;
  onSave: (content: string) => Promise<void>;
  onError?: (error: Error) => void;
}

export function useAutoSave(
  content: string,
  documentId: number | null,
  options: AutoSaveOptions
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
    // Don't auto-save if no document is active
    if (!documentId) return;

    // Don't save if content hasn't changed
    if (content === lastSavedContent.current) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for debounced save
    timeoutRef.current = setTimeout(() => {
      save(content);
    }, delay);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, documentId, delay, save]);

  // Cleanup on unmount
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
