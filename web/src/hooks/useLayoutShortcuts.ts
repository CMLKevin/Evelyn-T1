import { useEffect } from 'react';
import { useLayoutManager } from '../lib/layoutManager';
import { shortcutManager, Shortcut } from '../lib/keyboardShortcuts';

export const useLayoutShortcuts = () => {
  const {
    togglePanel,
    setLayout,
    currentLayout,
    resetToDefaults
  } = useLayoutManager();

  useEffect(() => {
    // Register layout shortcut actions
    const shortcutIds: string[] = [];

    // Toggle panels
    shortcutManager.register({
      id: 'layout.toggle-left-sidebar',
      key: 'b',
      modifiers: ['ctrl'],
      description: 'Toggle left sidebar',
      category: 'view',
      context: ['global'],
      action: () => {
        togglePanel('leftSidebar');
      }
    });
    shortcutIds.push('layout.toggle-left-sidebar');

    shortcutManager.register({
      id: 'layout.toggle-right-sidebar',
      key: 'b',
      modifiers: ['ctrl', 'shift'],
      description: 'Toggle right sidebar',
      category: 'view',
      context: ['global'],
      action: () => {
        togglePanel('rightSidebar');
      }
    });
    shortcutIds.push('layout.toggle-right-sidebar');

    shortcutManager.register({
      id: 'layout.toggle-bottom-panel',
      key: 'j',
      modifiers: ['ctrl'],
      description: 'Toggle bottom panel',
      category: 'view',
      context: ['global'],
      action: () => {
        togglePanel('bottomPanel');
      }
    });
    shortcutIds.push('layout.toggle-bottom-panel');

    // Focus mode toggle
    shortcutManager.register({
      id: 'layout.focus-mode',
      key: 'm',
      modifiers: ['ctrl', 'shift'],
      description: 'Toggle focus mode',
      category: 'view',
      context: ['global'],
      action: () => {
        if (currentLayout.id === 'focus-mode') {
          setLayout('editor-right');
        } else {
          setLayout('focus-mode');
        }
      }
    });
    shortcutIds.push('layout.focus-mode');

    // Layout presets
    shortcutManager.register({
      id: 'layout.full-editor',
      key: '0',
      modifiers: ['ctrl'],
      description: 'Full editor layout',
      category: 'view',
      context: ['global'],
      action: () => {
        setLayout('full-editor');
      }
    });
    shortcutIds.push('layout.full-editor');

    shortcutManager.register({
      id: 'layout.editor-right',
      key: '1',
      modifiers: ['ctrl'],
      description: 'Editor + right panel layout',
      category: 'view',
      context: ['global'],
      action: () => {
        setLayout('editor-right');
      }
    });
    shortcutIds.push('layout.editor-right');

    shortcutManager.register({
      id: 'layout.editor-left',
      key: '2',
      modifiers: ['ctrl'],
      description: 'Editor + left panel layout',
      category: 'view',
      context: ['global'],
      action: () => {
        setLayout('editor-left');
      }
    });
    shortcutIds.push('layout.editor-left');

    shortcutManager.register({
      id: 'layout.all-panels',
      key: '3',
      modifiers: ['ctrl'],
      description: 'All panels layout',
      category: 'view',
      context: ['global'],
      action: () => {
        setLayout('all-panels');
      }
    });
    shortcutIds.push('layout.all-panels');

    shortcutManager.register({
      id: 'layout.debug-layout',
      key: '4',
      modifiers: ['ctrl'],
      description: 'Debug layout',
      category: 'view',
      context: ['global'],
      action: () => {
        setLayout('debug-layout');
      }
    });
    shortcutIds.push('layout.debug-layout');

    // Panel size adjustments
    shortcutManager.register({
      id: 'layout.increase-left-sidebar',
      key: 'ArrowRight',
      modifiers: ['ctrl', 'alt'],
      description: 'Increase left sidebar width',
      category: 'view',
      context: ['global'],
      action: () => {
        // This would need access to the current size
        // For now, just toggle as a placeholder
        togglePanel('leftSidebar');
      }
    });
    shortcutIds.push('layout.increase-left-sidebar');

    shortcutManager.register({
      id: 'layout.decrease-left-sidebar',
      key: 'ArrowLeft',
      modifiers: ['ctrl', 'alt'],
      description: 'Decrease left sidebar width',
      category: 'view',
      context: ['global'],
      action: () => {
        togglePanel('leftSidebar');
      }
    });
    shortcutIds.push('layout.decrease-left-sidebar');

    // Cleanup on unmount
    return () => {
      shortcutIds.forEach(id => shortcutManager.unregister(id));
    };
  }, [togglePanel, setLayout, currentLayout.id, resetToDefaults]);
};
