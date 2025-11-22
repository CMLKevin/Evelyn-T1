import { useStore } from '../../state/store';
import { Settings, Sparkles, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Badge, StatusDot } from '../ui';

export default function TerminalHeader() {
  const { connected, setSettingsModalOpen } = useStore();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="px-5 py-3 flex items-center justify-between border-b-2 border-white/20 bg-terminal-dark select-none">
      {/* Left: Terminal Title Bar Branding */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-orange/20 p-2 border-2 border-orange">
            <Sparkles className="w-4 h-4 text-orange" />
          </div>
          <div>
            <span className="text-sm font-mono font-bold uppercase tracking-wide text-white">
              Evelyn Terminal
            </span>
            <span className="text-xs text-terminal-500 ml-2 font-mono">v2.0.0</span>
          </div>
        </div>
      </div>

      {/* Right: Status & Actions */}
      <div className="flex items-center gap-3">
        {/* Connection Status */}
        <div className="flex items-center gap-2 px-3 py-1 bg-terminal-900 border border-white/20">
          <StatusDot variant={connected ? 'online' : 'offline'} animated={connected} />
          <span className="text-xs font-mono font-medium text-terminal-400">
            {connected ? 'CONNECTED' : 'OFFLINE'}
          </span>
        </div>

        {/* Time */}
        <div className="flex items-center gap-2 px-3 py-1 bg-terminal-900 border border-white/20">
          <Clock className="w-3.5 h-3.5 text-orange" />
          <span className="text-xs font-mono text-terminal-300">
            {currentTime.toLocaleTimeString('en-US', { hour12: false })}
          </span>
        </div>

        {/* Settings Button */}
        <button 
          className="p-2 hover:bg-white/10 border border-white/20 hover:border-white/30 transition-colors duration-150 group"
          title="Settings"
          onClick={() => setSettingsModalOpen(true)}
        >
          <Settings className="w-4 h-4 text-terminal-400 group-hover:text-white group-hover:rotate-90 transition-all duration-300" />
        </button>
      </div>
    </div>
  );
}
