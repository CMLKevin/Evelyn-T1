import { useStore } from '../../state/store';
import { useState } from 'react';

export default function Sidebar() {
  const { connected, showDiagnostics, toggleDiagnostics } = useStore();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="w-80 flex flex-col gap-4">
      {/* Profile Card - Glass */}
      <div className="glass-strong rounded-3xl p-6 shadow-float animate-fade-in">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full blur-md group-hover:blur-lg transition-all glow-purple animate-glow-pulse" />
            <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-2xl font-bold shadow-lg ring-4 ring-white/10">
              E
            </div>
            {connected && (
              <div className="absolute bottom-0 right-0 w-5 h-5 bg-green-400 rounded-full border-4 border-gray-900 animate-pulse shadow-lg" />
            )}
          </div>
          
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gradient-purple">Evelyn</h2>
            <p className="text-sm text-gray-400">
              {connected ? (
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  Online
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-gray-400 rounded-full" />
                  Connecting...
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-dark rounded-2xl p-3 text-center">
            <div className="text-2xl font-bold text-gradient-purple">∞</div>
            <div className="text-xs text-gray-400 mt-1">Messages</div>
          </div>
          <div className="glass-dark rounded-2xl p-3 text-center">
            <div className="text-2xl font-bold text-gradient-pink">💭</div>
            <div className="text-xs text-gray-400 mt-1">Thoughts</div>
          </div>
          <div className="glass-dark rounded-2xl p-3 text-center">
            <div className="text-2xl font-bold text-gradient-blue">✨</div>
            <div className="text-xs text-gray-400 mt-1">Evolution</div>
          </div>
        </div>
      </div>

      {/* Navigation Card */}
      <div className="glass-strong rounded-3xl p-4 shadow-float animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="space-y-2">
          <button className="w-full glass-purple hover:glass-strong rounded-2xl p-4 text-left transition-all group hover:scale-105 hover:shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400/20 to-pink-400/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-lg">💬</span>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-white">Direct Message</div>
                <div className="text-xs text-gray-400">Chat with Evelyn</div>
              </div>
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
            </div>
          </button>
        </div>
      </div>

      {/* Controls Card */}
      <div className="glass-strong rounded-3xl p-4 shadow-float animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">
          Controls
        </div>
        <div className="space-y-2">
          <button
            onClick={toggleDiagnostics}
            className="w-full glass hover:glass-strong rounded-2xl p-3 text-left transition-all group hover:scale-105"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center group-hover:rotate-12 transition-transform">
                <span className="text-base">🧠</span>
              </div>
              <span className="text-sm font-medium text-white">
                {showDiagnostics ? 'Hide' : 'Show'} Diagnostics
              </span>
            </div>
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full glass hover:glass-strong rounded-2xl p-3 text-left transition-all group hover:scale-105"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center group-hover:rotate-90 transition-all duration-300">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-white">Settings</span>
            </div>
          </button>
        </div>
      </div>

      {/* User Card */}
      <div className="mt-auto glass-strong rounded-3xl p-4 shadow-float animate-fade-in" style={{ animationDelay: '0.3s' }}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full blur-sm" />
            <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-lg font-bold shadow-lg ring-2 ring-white/10">
              U
            </div>
            <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-400 rounded-full border-2 border-gray-900" />
          </div>
          
          <div className="flex-1">
            <div className="text-sm font-semibold text-white">You</div>
            <div className="text-xs text-gray-400">Online</div>
          </div>

          <div className="flex gap-1">
            <button className="w-8 h-8 glass hover:glass-strong rounded-lg flex items-center justify-center transition-all hover:scale-110">
              <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
