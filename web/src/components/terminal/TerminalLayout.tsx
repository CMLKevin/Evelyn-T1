import { ReactNode } from 'react';
import TerminalHeader from './TerminalHeader';
import StatusLine from './StatusLine';
import Tabs from './Tabs';

interface TerminalLayoutProps {
  children: ReactNode;
}

export default function TerminalLayout({ children }: TerminalLayoutProps) {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <TerminalHeader />
      <Tabs />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
      <StatusLine />
    </div>
  );
}

