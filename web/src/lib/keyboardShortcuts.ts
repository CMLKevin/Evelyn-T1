/**
 * Centralized Keyboard Shortcut Management System
 * Provides a unified way to handle keyboard shortcuts across the application
 */

export interface Shortcut {
  id: string;
  key: string;
  modifiers?: ('ctrl' | 'alt' | 'shift' | 'meta')[];
  description: string;
  category: 'editor' | 'navigation' | 'file' | 'view' | 'ai' | 'debug';
  action: () => void;
  enabled?: boolean;
  context?: string[]; // Contexts where this shortcut is active
}

export interface ShortcutCategory {
  name: string;
  icon: string;
  shortcuts: Shortcut[];
}

class KeyboardShortcutManager {
  private shortcuts: Map<string, Shortcut> = new Map();
  private activeContexts: Set<string> = new Set(['global']);
  private isPaused: boolean = false;

  /**
   * Register a new keyboard shortcut
   */
  register(shortcut: Shortcut): void {
    this.shortcuts.set(shortcut.id, shortcut);
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregister(id: string): void {
    this.shortcuts.delete(id);
  }

  /**
   * Update an existing shortcut
   */
  update(id: string, updates: Partial<Shortcut>): void {
    const existing = this.shortcuts.get(id);
    if (existing) {
      this.shortcuts.set(id, { ...existing, ...updates });
    }
  }

  /**
   * Enable/disable a shortcut
   */
  setEnabled(id: string, enabled: boolean): void {
    this.update(id, { enabled });
  }

  /**
   * Set active contexts for shortcut filtering
   */
  setActiveContexts(contexts: string[]): void {
    this.activeContexts = new Set(['global', ...contexts]);
  }

  /**
   * Add a context to active contexts
   */
  addContext(context: string): void {
    this.activeContexts.add(context);
  }

  /**
   * Remove a context from active contexts
   */
  removeContext(context: string): void {
    this.activeContexts.delete(context);
  }

  /**
   * Pause/resume all shortcuts
   */
  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
  }

  /**
   * Check if a shortcut should be active in current context
   */
  private isShortcutActive(shortcut: Shortcut): boolean {
    if (this.isPaused) return false;
    if (shortcut.enabled === false) return false;
    
    // If no context specified, it's active everywhere
    if (!shortcut.context || shortcut.context.length === 0) return true;
    
    // Check if any of the shortcut's contexts are active
    return shortcut.context.some(ctx => this.activeContexts.has(ctx));
  }

  /**
   * Handle keyboard event
   */
  handleKeyEvent(event: KeyboardEvent): boolean {
    if (this.isPaused) return false;

    const key = event.key.toLowerCase();
    const modifiers: ('ctrl' | 'alt' | 'shift' | 'meta')[] = [];
    
    if (event.ctrlKey) modifiers.push('ctrl');
    if (event.altKey) modifiers.push('alt');
    if (event.shiftKey) modifiers.push('shift');
    if (event.metaKey) modifiers.push('meta');

    // Find matching shortcut
    for (const shortcut of this.shortcuts.values()) {
      if (!this.isShortcutActive(shortcut)) continue;

      const shortcutKey = shortcut.key.toLowerCase();
      const shortcutModifiers = shortcut.modifiers || [];

      // Check if key and modifiers match
      if (shortcutKey === key && 
          this.arraysEqual(modifiers.sort(), shortcutModifiers.sort())) {
        
        event.preventDefault();
        event.stopPropagation();
        
        try {
          shortcut.action();
          return true;
        } catch (error) {
          console.error(`Error executing shortcut ${shortcut.id}:`, error);
          return false;
        }
      }
    }

    return false;
  }

  /**
   * Get all shortcuts grouped by category
   */
  getShortcutsByCategory(): ShortcutCategory[] {
    const categories: Record<string, ShortcutCategory> = {};

    for (const shortcut of this.shortcuts.values()) {
      if (!categories[shortcut.category]) {
        categories[shortcut.category] = {
          name: this.getCategoryName(shortcut.category),
          icon: this.getCategoryIcon(shortcut.category),
          shortcuts: []
        };
      }
      categories[shortcut.category].shortcuts.push(shortcut);
    }

    return Object.values(categories);
  }

  /**
   * Get shortcuts for a specific category
   */
  getShortcutsByCategoryName(category: string): Shortcut[] {
    return Array.from(this.shortcuts.values())
      .filter(shortcut => shortcut.category === category);
  }

  /**
   * Search shortcuts by description or key
   */
  searchShortcuts(query: string): Shortcut[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.shortcuts.values()).filter(shortcut =>
      shortcut.description.toLowerCase().includes(lowerQuery) ||
      shortcut.key.toLowerCase().includes(lowerQuery) ||
      shortcut.id.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Export shortcuts configuration
   */
  export(): Record<string, Omit<Shortcut, 'action'>> {
    const exported: Record<string, Omit<Shortcut, 'action'>> = {};
    for (const [id, shortcut] of this.shortcuts.entries()) {
      const { action, ...shortcutData } = shortcut;
      exported[id] = shortcutData;
    }
    return exported;
  }

  /**
   * Import shortcuts configuration
   */
  import(config: Record<string, Omit<Shortcut, 'action'>>): void {
    for (const [id, shortcutData] of Object.entries(config)) {
      if (this.shortcuts.has(id)) {
        // Update existing shortcut (but preserve action)
        const existing = this.shortcuts.get(id)!;
        this.shortcuts.set(id, { ...existing, ...shortcutData });
      }
    }
  }

  /**
   * Reset to default shortcuts
   */
  reset(): void {
    this.shortcuts.clear();
    this.registerDefaultShortcuts();
  }

  /**
   * Register default application shortcuts
   */
  registerDefaultShortcuts(): void {
    // Editor shortcuts
    this.register({
      id: 'editor.save',
      key: 's',
      modifiers: ['ctrl'],
      description: 'Save file',
      category: 'editor',
      context: ['editor'],
      action: () => {} // Placeholder - will be overridden by component
    });

    this.register({
      id: 'editor.saveAs',
      key: 's',
      modifiers: ['ctrl', 'shift'],
      description: 'Save file as',
      category: 'editor',
      context: ['editor'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'editor.undo',
      key: 'z',
      modifiers: ['ctrl'],
      description: 'Undo',
      category: 'editor',
      context: ['editor'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'editor.redo',
      key: 'z',
      modifiers: ['ctrl', 'shift'],
      description: 'Redo',
      category: 'editor',
      context: ['editor'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'editor.find',
      key: 'f',
      modifiers: ['ctrl'],
      description: 'Find in file',
      category: 'editor',
      context: ['editor'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'editor.replace',
      key: 'h',
      modifiers: ['ctrl'],
      description: 'Find and replace',
      category: 'editor',
      context: ['editor'],
      action: () => {} // Placeholder
    });

    // Layout management shortcuts
    this.register({
      id: 'layout.toggle-left-sidebar',
      key: 'b',
      modifiers: ['ctrl'],
      description: 'Toggle left sidebar',
      category: 'view',
      context: ['global'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'layout.toggle-right-sidebar',
      key: 'b',
      modifiers: ['ctrl', 'shift'],
      description: 'Toggle right sidebar',
      category: 'view',
      context: ['global'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'layout.toggle-bottom-panel',
      key: 'j',
      modifiers: ['ctrl'],
      description: 'Toggle bottom panel',
      category: 'view',
      context: ['global'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'layout.focus-mode',
      key: 'm',
      modifiers: ['ctrl', 'shift'],
      description: 'Toggle focus mode',
      category: 'view',
      context: ['global'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'layout.full-editor',
      key: '0',
      modifiers: ['ctrl'],
      description: 'Full editor layout',
      category: 'view',
      context: ['global'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'layout.editor-right',
      key: '1',
      modifiers: ['ctrl'],
      description: 'Editor + right panel layout',
      category: 'view',
      context: ['global'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'layout.editor-left',
      key: '2',
      modifiers: ['ctrl'],
      description: 'Editor + left panel layout',
      category: 'view',
      context: ['global'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'layout.all-panels',
      key: '3',
      modifiers: ['ctrl'],
      description: 'All panels layout',
      category: 'view',
      context: ['global'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'layout.debug-layout',
      key: '4',
      modifiers: ['ctrl'],
      description: 'Debug layout',
      category: 'view',
      context: ['global'],
      action: () => {} // Placeholder
    });

    // Navigation shortcuts
    this.register({
      id: 'nav.gotoFile',
      key: 'p',
      modifiers: ['ctrl'],
      description: 'Go to file',
      category: 'navigation',
      context: ['editor'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'nav.gotoSymbol',
      key: 'shift',
      modifiers: ['ctrl'],
      description: 'Go to symbol in file',
      category: 'navigation',
      context: ['editor'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'nav.quickOpen',
      key: 'o',
      modifiers: ['ctrl'],
      description: 'Quick open',
      category: 'navigation',
      action: () => {} // Placeholder
    });

    // View shortcuts
    this.register({
      id: 'view.toggleSidebar',
      key: 'b',
      modifiers: ['ctrl'],
      description: 'Toggle sidebar',
      category: 'view',
      action: () => {} // Placeholder
    });

    this.register({
      id: 'view.toggleTerminal',
      key: '`',
      modifiers: ['ctrl'],
      description: 'Toggle terminal',
      category: 'view',
      action: () => {} // Placeholder
    });

    this.register({
      id: 'view.focusMode',
      key: 'F11',
      description: 'Enter focus mode',
      category: 'view',
      action: () => {} // Placeholder
    });

    // AI shortcuts
    this.register({
      id: 'ai.explain',
      key: 'e',
      modifiers: ['ctrl'],
      description: 'Explain selected code',
      category: 'ai',
      context: ['editor'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'ai.optimize',
      key: 'o',
      modifiers: ['ctrl', 'alt'],
      description: 'Optimize selected code',
      category: 'ai',
      context: ['editor'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'ai.generateTests',
      key: 't',
      modifiers: ['ctrl', 'alt'],
      description: 'Generate tests for selected code',
      category: 'ai',
      context: ['editor'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'ai.refactor',
      key: 'r',
      modifiers: ['ctrl', 'alt'],
      description: 'Refactor selected code',
      category: 'ai',
      context: ['editor'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'ai.chat',
      key: 'i',
      modifiers: ['ctrl'],
      description: 'Open AI chat',
      category: 'ai',
      action: () => {} // Placeholder
    });

    // File shortcuts
    this.register({
      id: 'file.newFile',
      key: 'n',
      modifiers: ['ctrl'],
      description: 'New file',
      category: 'file',
      action: () => {} // Placeholder
    });

    this.register({
      id: 'file.openFile',
      key: 'o',
      modifiers: ['ctrl'],
      description: 'Open file',
      category: 'file',
      action: () => {} // Placeholder
    });

    this.register({
      id: 'file.closeTab',
      key: 'w',
      modifiers: ['ctrl'],
      description: 'Close current tab',
      category: 'file',
      context: ['editor'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'file.closeAllTabs',
      key: 'w',
      modifiers: ['ctrl', 'shift'],
      description: 'Close all tabs',
      category: 'file',
      context: ['editor'],
      action: () => {} // Placeholder
    });

    // Debug shortcuts
    this.register({
      id: 'debug.toggleBreakpoint',
      key: 'F9',
      description: 'Toggle breakpoint',
      category: 'debug',
      context: ['editor'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'debug.start',
      key: 'F5',
      description: 'Start debugging',
      category: 'debug',
      action: () => {} // Placeholder
    });

    this.register({
      id: 'debug.stepOver',
      key: 'F10',
      description: 'Step over',
      category: 'debug',
      action: () => {} // Placeholder
    });

    this.register({
      id: 'debug.stepInto',
      key: 'F11',
      modifiers: ['shift'],
      description: 'Step into',
      category: 'debug',
      action: () => {} // Placeholder
    });

    // Collaborate feature shortcuts
    this.register({
      id: 'collaborate.saveVersion',
      key: 's',
      modifiers: ['ctrl'],
      description: 'Save version',
      category: 'file',
      context: ['collaborate'],
      action: () => {} // Placeholder - will be overridden by component
    });

    this.register({
      id: 'collaborate.openShortcuts',
      key: 'k',
      modifiers: ['ctrl'],
      description: 'Open shortcuts menu',
      category: 'ai',
      context: ['collaborate'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'collaborate.toggleSuggestions',
      key: '/',
      modifiers: ['ctrl'],
      description: 'Toggle suggestions panel',
      category: 'view',
      context: ['collaborate'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'collaborate.toggleVersionHistory',
      key: 'h',
      modifiers: ['ctrl'],
      description: 'Toggle version history',
      category: 'view',
      context: ['collaborate'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'collaborate.exportDocument',
      key: 'e',
      modifiers: ['ctrl'],
      description: 'Export document',
      category: 'file',
      context: ['collaborate'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'collaborate.newDocument',
      key: 'n',
      modifiers: ['ctrl'],
      description: 'New document',
      category: 'file',
      context: ['collaborate'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'collaborate.closeModal',
      key: 'Escape',
      description: 'Close modal/panel',
      category: 'navigation',
      context: ['collaborate'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'collaborate.focusEditor',
      key: 'e',
      modifiers: ['alt'],
      description: 'Focus editor',
      category: 'navigation',
      context: ['collaborate'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'collaborate.focusChat',
      key: 'c',
      modifiers: ['alt'],
      description: 'Focus chat',
      category: 'navigation',
      context: ['collaborate'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'collaborate.applySuggestion',
      key: 'Enter',
      modifiers: ['ctrl'],
      description: 'Apply selected suggestion',
      category: 'ai',
      context: ['collaborate'],
      action: () => {} // Placeholder
    });

    this.register({
      id: 'collaborate.rejectSuggestion',
      key: 'Backspace',
      modifiers: ['ctrl'],
      description: 'Reject selected suggestion',
      category: 'ai',
      context: ['collaborate'],
      action: () => {} // Placeholder
    });
  }

  /**
   * Helper method to compare arrays
   */
  private arraysEqual<T>(a: T[], b: T[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  /**
   * Get display name for category
   */
  private getCategoryName(category: string): string {
    const names: Record<string, string> = {
      editor: 'Editor',
      navigation: 'Navigation',
      file: 'File',
      view: 'View',
      ai: 'AI Assistant',
      debug: 'Debug'
    };
    return names[category] || category;
  }

  /**
   * Get icon for category
   */
  private getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      editor: '✏️',
      navigation: '🧭',
      file: '📄',
      view: '👁️',
      ai: '🤖',
      debug: '🐛'
    };
    return icons[category] || '⚡';
  }
}

// Create singleton instance
export const shortcutManager = new KeyboardShortcutManager();

// Initialize default shortcuts
shortcutManager.registerDefaultShortcuts();

// Helper function to format shortcut for display
export function formatShortcut(shortcut: Shortcut): string {
  const parts: string[] = [];
  
  if (shortcut.modifiers) {
    if (shortcut.modifiers.includes('ctrl')) parts.push('Ctrl');
    if (shortcut.modifiers.includes('alt')) parts.push('Alt');
    if (shortcut.modifiers.includes('shift')) parts.push('Shift');
    if (shortcut.modifiers.includes('meta')) parts.push('Cmd');
  }
  
  // Format special keys
  let key = shortcut.key;
  if (key.length === 1 && key >= 'a' && key <= 'z') {
    key = key.toUpperCase();
  }
  
  parts.push(key);
  
  return parts.join(' + ');
}

// React hook for using shortcuts
export function useKeyboardShortcuts() {
  return {
    register: shortcutManager.register.bind(shortcutManager),
    unregister: shortcutManager.unregister.bind(shortcutManager),
    update: shortcutManager.update.bind(shortcutManager),
    setEnabled: shortcutManager.setEnabled.bind(shortcutManager),
    setActiveContexts: shortcutManager.setActiveContexts.bind(shortcutManager),
    addContext: shortcutManager.addContext.bind(shortcutManager),
    removeContext: shortcutManager.removeContext.bind(shortcutManager),
    pause: shortcutManager.pause.bind(shortcutManager),
    resume: shortcutManager.resume.bind(shortcutManager),
    getShortcutsByCategory: shortcutManager.getShortcutsByCategory.bind(shortcutManager),
    searchShortcuts: shortcutManager.searchShortcuts.bind(shortcutManager),
    export: shortcutManager.export.bind(shortcutManager),
    import: shortcutManager.import.bind(shortcutManager),
    reset: shortcutManager.reset.bind(shortcutManager)
  };
}
