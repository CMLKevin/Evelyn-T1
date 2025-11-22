import { useStore } from '../../state/store';
import { MessageSquare, Settings as SettingsIcon, Activity, User as UserIcon, Zap, Sparkles } from 'lucide-react';
import { Avatar, Badge, StatusDot } from '../ui';

export default function Sidebar() {
  const { connected, showDiagnostics, toggleDiagnostics, setSettingsModalOpen } = useStore();

  return (
    <div className="w-80 flex flex-col gap-5 p-5 bg-terminal-black border-r-2 border-white/20">
      {/* Evelyn Profile Card */}
      <div className="px-5 py-4 bg-terminal-900 border-2 border-white/20 animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <Avatar 
              variant="ai" 
              size="lg" 
              icon={<Sparkles className="w-6 h-6" />}
            />
            {connected && (
              <div className="absolute -bottom-1 -right-1">
                <StatusDot variant="online" animated />
              </div>
            )}
          </div>
          
          <div className="flex-1">
            <h2 className="text-white font-semibold text-lg">Evelyn</h2>
            <div className="flex items-center gap-2 text-sm">
              <StatusDot variant={connected ? 'online' : 'offline'} animated={connected} />
              <span className="text-terminal-400">
                {connected ? 'Online' : 'Connecting...'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="px-2 py-2 bg-terminal-dark border border-white/20 text-center">
            <div className="text-lg font-bold font-mono text-orange">∞</div>
            <div className="text-[10px] text-terminal-500 mt-0.5 font-mono uppercase">Messages</div>
          </div>
          <div className="px-2 py-2 bg-terminal-dark border border-white/20 text-center">
            <div className="text-lg font-bold font-mono text-cyan-500">💭</div>
            <div className="text-[10px] text-terminal-500 mt-0.5 font-mono uppercase">Thoughts</div>
          </div>
          <div className="px-2 py-2 bg-terminal-dark border border-white/20 text-center">
            <div className="text-lg font-bold font-mono text-orange">✨</div>
            <div className="text-[10px] text-terminal-500 mt-0.5 font-mono uppercase">Active</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="space-y-2 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <button className="w-full px-4 py-3 bg-orange/10 border-2 border-orange hover:bg-orange/20 hover:border-orange-dark transition-colors duration-150 group">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange/20 border border-orange">
              <MessageSquare className="w-4 h-4 text-orange" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-mono font-medium text-white text-sm uppercase tracking-wide">Direct Message</div>
              <div className="text-xs text-terminal-500">Chat with Evelyn</div>
            </div>
            <Badge variant="purple" size="sm">Active</Badge>
          </div>
        </button>
      </div>

      {/* Controls Section */}
      <div className="space-y-3 animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="px-3 text-[10px] font-mono font-semibold text-terminal-600 uppercase tracking-wider border-b border-white/10 pb-2">
          System
        </div>
        <div className="space-y-2">
          <button
            onClick={toggleDiagnostics}
            className="w-full px-4 py-3 bg-terminal-900 hover:bg-terminal-800 border-2 border-white/20 hover:border-white/30 transition-colors duration-150 group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange/10 border border-orange">
                <Activity className="w-4 h-4 text-orange" />
              </div>
              <span className="text-sm font-mono font-medium text-terminal-300 group-hover:text-white transition-colors">
                {showDiagnostics ? 'Hide' : 'Show'} Diagnostics
              </span>
            </div>
          </button>

          <button
            onClick={() => setSettingsModalOpen(true)}
            className="w-full px-4 py-3 bg-terminal-900 hover:bg-terminal-800 border-2 border-white/20 hover:border-white/30 transition-colors duration-150 group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/10 border border-cyan-500">
                <SettingsIcon className="w-4 h-4 text-cyan-500" />
              </div>
              <span className="text-sm font-mono font-medium text-terminal-300 group-hover:text-white transition-colors">
                Settings
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* User Profile (Bottom) */}
      <div className="mt-auto px-4 py-3 bg-terminal-900 border-2 border-white/20 animate-fade-in" style={{ animationDelay: '0.3s' }}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar 
              variant="user" 
              size="md" 
              icon={<UserIcon className="w-4 h-4" />}
            />
            <div className="absolute -bottom-0.5 -right-0.5">
              <StatusDot variant="online" />
            </div>
          </div>
          
          <div className="flex-1">
            <div className="text-sm font-mono font-medium text-white">You</div>
            <div className="text-xs text-terminal-500">Online</div>
          </div>

          <button className="p-2 hover:bg-white/10 border border-white/20 hover:border-white/30 transition-colors duration-150 group">
            <Zap className="w-4 h-4 text-terminal-500 group-hover:text-white transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
}
