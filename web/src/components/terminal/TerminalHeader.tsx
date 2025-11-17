import { useStore } from '../../state/store';
import { Settings, Terminal, Cpu } from 'lucide-react';

export default function TerminalHeader() {
  const { connected, setSettingsModalOpen } = useStore();

  return (
    <div className="terminal-header px-4 py-2 flex items-center justify-between select-none">
      <div className="flex items-center gap-3">
        <Terminal className="w-5 h-5 text-cyan-400 terminal-glow" />
        <span className="text-sm font-bold text-cyan-400 terminal-glow">
          EVELYN://TERMINAL
        </span>
        <span className="text-xs text-gray-500">v2.0.0</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} 
               style={{ boxShadow: connected ? '0 0 5px #00ff00' : '0 0 5px #ff0000' }} />
          <span className="text-xs text-gray-400">
            {connected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Cpu className="w-4 h-4" />
          <span className="font-mono">{new Date().toLocaleTimeString('en-US', { hour12: false })}</span>
        </div>

        <button 
          className="terminal-button p-2"
          title="Settings"
          onClick={() => setSettingsModalOpen(true)}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
