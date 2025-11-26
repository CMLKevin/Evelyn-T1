import { useMemo } from 'react';

interface ShortcutHintProps {
  shortcut: string;
  className?: string;
}

/**
 * Displays a keyboard shortcut hint
 * Supports formats like: "⌘K", "⌘S", "⌘⇧P", "Ctrl+K", etc.
 */
export default function ShortcutHint({ shortcut, className = '' }: ShortcutHintProps) {
  // Detect platform
  const isMac = useMemo(() => {
    if (typeof navigator !== 'undefined') {
      return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    }
    return false;
  }, []);

  // Convert shortcut to platform-specific display
  const displayShortcut = useMemo(() => {
    let display = shortcut;
    
    // Replace symbols for non-Mac
    if (!isMac) {
      display = display
        .replace('⌘', 'Ctrl+')
        .replace('⌥', 'Alt+')
        .replace('⇧', 'Shift+')
        .replace('⏎', 'Enter');
    }
    
    return display;
  }, [shortcut, isMac]);

  // Split into individual keys for styling
  const keys = useMemo(() => {
    if (isMac) {
      // Mac uses single characters
      return displayShortcut.split('').filter(k => k.trim());
    } else {
      // Windows/Linux uses + separator
      return displayShortcut.split('+').filter(k => k.trim());
    }
  }, [displayShortcut, isMac]);

  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {keys.map((key, idx) => (
        <kbd
          key={idx}
          className="px-1 py-0.5 bg-terminal-900 border border-white/20 
                   text-[10px] font-mono text-terminal-400 min-w-[18px] text-center"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

/**
 * Inline shortcut display (smaller, for tooltips)
 */
export function InlineShortcut({ shortcut }: { shortcut: string }) {
  const isMac = useMemo(() => {
    if (typeof navigator !== 'undefined') {
      return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    }
    return false;
  }, []);

  const displayShortcut = useMemo(() => {
    let display = shortcut;
    if (!isMac) {
      display = display
        .replace('⌘', 'Ctrl+')
        .replace('⌥', 'Alt+')
        .replace('⇧', 'Shift+')
        .replace('⏎', 'Enter');
    }
    return display;
  }, [shortcut, isMac]);

  return (
    <span className="text-terminal-500 font-mono text-[10px]">
      {displayShortcut}
    </span>
  );
}
