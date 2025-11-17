import { shortcutManager, Shortcut } from './keyboardShortcuts';
import { useEffect } from 'react';

export type ModalContext = 
  | 'code-actions'
  | 'conflict-resolution'
  | 'file-rename'
  | 'file-delete'
  | 'search'
  | 'settings'
  | 'none';

interface ModalShortcutConfig {
  context: ModalContext;
  shortcuts: Shortcut[];
  onEnter?: () => void;
  onEscape?: () => void;
  onTab?: (direction: 'forward' | 'backward') => void;
}

class ModalShortcutManager {
  private static instance: ModalShortcutManager;
  private currentContext: ModalContext = 'none';
  private contextShortcuts: Map<ModalContext, Shortcut[]> = new Map();
  private cleanupFunctions: Map<ModalContext, string[]> = new Map();

  private constructor() {
    this.setupDefaultModalShortcuts();
  }

  static getInstance(): ModalShortcutManager {
    if (!ModalShortcutManager.instance) {
      ModalShortcutManager.instance = new ModalShortcutManager();
    }
    return ModalShortcutManager.instance;
  }

  private setupDefaultModalShortcuts(): void {
    // Code Actions Modal
    this.registerModalShortcuts({
      context: 'code-actions',
      shortcuts: [
        {
          id: 'modal.code-actions.up',
          key: 'ArrowUp',
          modifiers: [],
          description: 'Navigate up',
          category: 'view',
          context: ['code-actions'],
          action: () => this.handleNavigate('up')
        },
        {
          id: 'modal.code-actions.down',
          key: 'ArrowDown',
          modifiers: [],
          description: 'Navigate down',
          category: 'view',
          context: ['code-actions'],
          action: () => this.handleNavigate('down')
        },
        {
          id: 'modal.code-actions.execute',
          key: 'Enter',
          modifiers: [],
          description: 'Execute action',
          category: 'view',
          context: ['code-actions'],
          action: () => this.handleEnter()
        }
      ],
      onEscape: () => this.handleEscape()
    });

    // Conflict Resolution Modal
    this.registerModalShortcuts({
      context: 'conflict-resolution',
      shortcuts: [
        {
          id: 'modal.conflict.accept-current',
          key: '1',
          modifiers: [],
          description: 'Accept current version',
          category: 'view',
          context: ['conflict-resolution'],
          action: () => this.handleConflictChoice('current')
        },
        {
          id: 'modal.conflict.accept-incoming',
          key: '2',
          modifiers: [],
          description: 'Accept incoming version',
          category: 'view',
          context: ['conflict-resolution'],
          action: () => this.handleConflictChoice('incoming')
        },
        {
          id: 'modal.conflict.accept-both',
          key: '3',
          modifiers: [],
          description: 'Accept both versions',
          category: 'view',
          context: ['conflict-resolution'],
          action: () => this.handleConflictChoice('both')
        },
        {
          id: 'modal.conflict.manual-resolve',
          key: '4',
          modifiers: [],
          description: 'Manual resolve',
          category: 'view',
          context: ['conflict-resolution'],
          action: () => this.handleConflictChoice('manual')
        }
      ],
      onEscape: () => this.handleEscape()
    });

    // File Rename Modal
    this.registerModalShortcuts({
      context: 'file-rename',
      shortcuts: [
        {
          id: 'modal.rename.accept',
          key: 'Enter',
          modifiers: [],
          description: 'Accept rename',
          category: 'view',
          context: ['file-rename'],
          action: () => this.handleEnter()
        }
      ],
      onEscape: () => this.handleEscape()
    });

    // File Delete Modal
    this.registerModalShortcuts({
      context: 'file-delete',
      shortcuts: [
        {
          id: 'modal.delete.confirm',
          key: 'Enter',
          modifiers: [],
          description: 'Confirm delete',
          category: 'view',
          context: ['file-delete'],
          action: () => this.handleEnter()
        }
      ],
      onEscape: () => this.handleEscape()
    });

    // Search Modal
    this.registerModalShortcuts({
      context: 'search',
      shortcuts: [
        {
          id: 'modal.search.next',
          key: 'ArrowDown',
          modifiers: [],
          description: 'Next result',
          category: 'view',
          context: ['search'],
          action: () => this.handleNavigate('down')
        },
        {
          id: 'modal.search.previous',
          key: 'ArrowUp',
          modifiers: [],
          description: 'Previous result',
          category: 'view',
          context: ['search'],
          action: () => this.handleNavigate('up')
        },
        {
          id: 'modal.search.select',
          key: 'Enter',
          modifiers: [],
          description: 'Select result',
          category: 'view',
          context: ['search'],
          action: () => this.handleEnter()
        }
      ],
      onEscape: () => this.handleEscape(),
      onTab: (direction) => this.handleTab(direction)
    });

    // Settings Modal
    this.registerModalShortcuts({
      context: 'settings',
      shortcuts: [
        {
          id: 'modal.settings.save',
          key: 's',
          modifiers: ['ctrl'],
          description: 'Save settings',
          category: 'view',
          context: ['settings'],
          action: () => this.handleSave()
        },
        {
          id: 'modal.settings.reset',
          key: 'r',
          modifiers: ['ctrl'],
          description: 'Reset settings',
          category: 'view',
          context: ['settings'],
          action: () => this.handleReset()
        }
      ],
      onEscape: () => this.handleEscape()
    });
  }

  registerModalShortcuts(config: ModalShortcutConfig): void {
    const { context, shortcuts, onEnter, onEscape, onTab } = config;
    
    // Store callbacks
    this.contextCallbacks.set(context, { onEnter, onEscape, onTab });
    
    // Store shortcuts
    this.contextShortcuts.set(context, shortcuts);
  }

  // Context management
  setActiveContext(context: ModalContext): void {
    // Clean up previous context
    this.clearCurrentContext();
    
    this.currentContext = context;
    
    if (context !== 'none') {
      this.activateContext(context);
    }
  }

  getCurrentContext(): ModalContext {
    return this.currentContext;
  }

  private clearCurrentContext(): void {
    if (this.currentContext !== 'none') {
      const cleanup = this.cleanupFunctions.get(this.currentContext);
      if (cleanup) {
        cleanup.forEach(id => shortcutManager.unregister(id));
        this.cleanupFunctions.delete(this.currentContext);
      }
    }
  }

  private activateContext(context: ModalContext): void {
    const shortcuts = this.contextShortcuts.get(context);
    if (!shortcuts) return;

    const cleanup: string[] = [];

    shortcuts.forEach(shortcut => {
      shortcutManager.register({
        ...shortcut,
        context: [context] // Override context to be modal-specific
      });
      cleanup.push(shortcut.id);
    });

    this.cleanupFunctions.set(context, cleanup);
  }

  // Event handlers
  private contextCallbacks: Map<ModalContext, {
    onEnter?: () => void;
    onEscape?: () => void;
    onTab?: (direction: 'forward' | 'backward') => void;
  }> = new Map();

  private handleNavigate(direction: 'up' | 'down'): void {
    // Emit custom event for modal components to listen to
    window.dispatchEvent(new CustomEvent('modal-navigate', { 
      detail: { direction, context: this.currentContext } 
    }));
  }

  private handleEnter(): void {
    const callbacks = this.contextCallbacks.get(this.currentContext);
    if (callbacks?.onEnter) {
      callbacks.onEnter();
    } else {
      window.dispatchEvent(new CustomEvent('modal-enter', { 
        detail: { context: this.currentContext } 
      }));
    }
  }

  private handleEscape(): void {
    const callbacks = this.contextCallbacks.get(this.currentContext);
    if (callbacks?.onEscape) {
      callbacks.onEscape();
    } else {
      window.dispatchEvent(new CustomEvent('modal-escape', { 
        detail: { context: this.currentContext } 
      }));
    }
  }

  private handleTab(direction: 'forward' | 'backward'): void {
    const callbacks = this.contextCallbacks.get(this.currentContext);
    if (callbacks?.onTab) {
      callbacks.onTab(direction);
    } else {
      window.dispatchEvent(new CustomEvent('modal-tab', { 
        detail: { direction, context: this.currentContext } 
      }));
    }
  }

  private handleConflictChoice(choice: 'current' | 'incoming' | 'both' | 'manual'): void {
    window.dispatchEvent(new CustomEvent('conflict-choice', { 
      detail: { choice, context: this.currentContext } 
    }));
  }

  private handleSave(): void {
    window.dispatchEvent(new CustomEvent('modal-save', { 
      detail: { context: this.currentContext } 
    }));
  }

  private handleReset(): void {
    window.dispatchEvent(new CustomEvent('modal-reset', { 
      detail: { context: this.currentContext } 
    }));
  }

  // Utility methods
  isModalActive(): boolean {
    return this.currentContext !== 'none';
  }

  getActiveShortcuts(): Shortcut[] {
    return this.contextShortcuts.get(this.currentContext) || [];
  }

  // Hook for React components
  createModalHook(context: ModalContext) {
    return (callbacks?: {
      onEnter?: () => void;
      onEscape?: () => void;
      onTab?: (direction: 'forward' | 'backward') => void;
    }) => {
      useEffect(() => {
        if (callbacks) {
          this.contextCallbacks.set(context, callbacks);
        }
        
        this.setActiveContext(context);
        
        return () => {
          this.setActiveContext('none');
        };
      }, [context]);
    };
  }
}

// Export singleton
export const modalShortcutManager = ModalShortcutManager.getInstance();

// React hook
export const useModalShortcuts = (context: ModalContext, callbacks?: {
  onEnter?: () => void;
  onEscape?: () => void;
  onTab?: (direction: 'forward' | 'backward') => void;
}) => {
  useEffect(() => {
    if (callbacks) {
      modalShortcutManager.registerModalShortcuts({
        context,
        shortcuts: [],
        ...callbacks
      });
    }
    
    modalShortcutManager.setActiveContext(context);
    
    return () => {
      modalShortcutManager.setActiveContext('none');
    };
  }, [context]);
};
