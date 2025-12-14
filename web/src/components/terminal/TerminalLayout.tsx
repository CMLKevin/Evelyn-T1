import { ReactNode } from 'react';
import TerminalHeader from './TerminalHeader';
import StatusLine from './StatusLine';
import Tabs from './Tabs';

interface TerminalLayoutProps {
  children: ReactNode;
}

export default function TerminalLayout({ children }: TerminalLayoutProps) {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-black p-2">
      {/* Floating container with glass effect */}
      <div className="flex-1 flex flex-col rounded-2xl overflow-hidden bg-surface-1 border border-white/8 shadow-2xl">
        <TerminalHeader />
        <Tabs />
        <main className="flex-1 overflow-hidden relative bg-terminal-900">
          {children}
        </main>
        <StatusLine />
      </div>
    </div>
  );
}

