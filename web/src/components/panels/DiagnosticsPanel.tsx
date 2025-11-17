import { useEffect, useState } from 'react';
import { useStore } from '../../state/store';
import { wsClient } from '../../lib/ws';
import MemoryTimeline from './MemoryTimeline';
import { 
  Brain, 
  Activity, 
  Sparkles, 
  User, 
  Database, 
  Lightbulb, 
  Target, 
  Users, 
  TrendingUp, 
  Sprout, 
  Zap,
  Heart,
  MessageCircle,
  Eye,
  FileText,
  Search,
  Settings,
  Moon
} from 'lucide-react';

interface MoodHistory {
  timestamp: Date;
  valence: number;
  arousal: number;
  stance: string;
}

export default function DiagnosticsPanel() {
  // Optimize store selectors - only subscribe to what we need
  const activities = useStore(state => state.activities);
  const personality = useStore(state => state.personality);
  const persona = useStore(state => state.persona);
  const evolutionEvents = useStore(state => state.evolutionEvents);
  const reflectionEvents = useStore(state => state.reflectionEvents);
  const beliefEvents = useStore(state => state.beliefEvents);
  const goalEvents = useStore(state => state.goalEvents);
  
  const [activeTab, setActiveTab] = useState<'thoughts' | 'activities' | 'personality' | 'persona' | 'memories'>('thoughts');
  const [moodHistory, setMoodHistory] = useState<MoodHistory[]>([]);
  const [expandedThought, setExpandedThought] = useState<number | null>(null);

  useEffect(() => {
    wsClient.subscribeDiagnostics();
    fetchPersonality();
    fetchPersona();
    loadActivities();
    
    // Poll for personality updates to track mood changes (reduced to 10s for performance)
    const interval = setInterval(() => {
      fetchPersonality();
      fetchPersona();
    }, 10000);
    
    return () => {
      wsClient.unsubscribeDiagnostics();
      clearInterval(interval);
    };
  }, []);

  const loadActivities = async () => {
    try {
      await useStore.getState().loadActivities();
    } catch (err) {
      console.error('Failed to load activities:', err);
    }
  };

  const fetchPersonality = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/personality');
      const data = await res.json();
      const currentPersonality = useStore.getState().personality;
      
      // Track mood changes
      if (currentPersonality && 
          currentPersonality.mood &&
          data.mood &&
          (currentPersonality.mood.valence !== data.mood.valence ||
           currentPersonality.mood.arousal !== data.mood.arousal ||
           currentPersonality.mood.stance !== data.mood.stance)) {
        setMoodHistory(prev => [...prev.slice(-9), {
          timestamp: new Date(),
          valence: data.mood.valence,
          arousal: data.mood.arousal,
          stance: data.mood.stance
        }]);
      }
      
      useStore.getState().setPersonality(data);
    } catch (err) {
      console.error('Failed to fetch personality:', err);
    }
  };

  const fetchPersona = async () => {
    try {
      await useStore.getState().loadPersona();
      await useStore.getState().loadEvolutionEvents();
    } catch (err) {
      console.error('Failed to fetch persona:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-yellow-400';
      case 'done': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'cancelled': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const getToolIcon = (tool: string) => {
    switch (tool) {
      case 'think': return Brain;
      case 'recall': return Database;
      case 'search': return Search;
      case 'classify': return FileText;
      case 'evolve': return Sparkles;
      case 'dream': return Moon;
      default: return Settings;
    }
  };

  const innerThoughts = activities.filter(a => a.tool === 'think');

  return (
    <div className="flex flex-col h-full terminal-panel">
      {/* Terminal Header */}
      <div className="terminal-header border-b border-cyan-500/30 p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-cyan-400 terminal-glow font-bold monospace">$ evelyn://diagnostics</span>
            {innerThoughts.some(t => t.status === 'running') && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                <span className="text-xs text-cyan-400 monospace">PROCESSING</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-green-400 monospace">ONLINE</span>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2">
          {[
            { id: 'thoughts', label: 'Thoughts', icon: Brain },
            { id: 'activities', label: 'Activities', icon: Activity },
            { id: 'personality', label: 'Personality', icon: Sparkles },
            { id: 'persona', label: 'Persona', icon: User },
            { id: 'memories', label: 'Memories', icon: Database }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
            <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`terminal-button px-3 py-1.5 text-xs font-semibold monospace transition-all ${
                  activeTab === tab.id
                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500'
                    : 'text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10'
              }`}
            >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
            </button>
            );
          })}
        </div>
      </div>

      {/* Content Area - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 terminal-scrollbar">
        {activeTab === 'thoughts' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Inner Thoughts Section */}
            <div className="col-span-full">
              <div className="bg-black/40 border border-cyan-500/30 rounded p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-sm font-bold text-cyan-400 monospace">INNER THOUGHTS</h3>
                  <span className="text-xs text-gray-400 monospace">({innerThoughts.length})</span>
              </div>

              {innerThoughts.length === 0 ? (
                  <div className="text-center py-8">
                    <Brain className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-xs text-gray-400 monospace">No thoughts recorded</p>
                    <p className="text-[10px] text-gray-500 monospace mt-1">Evelyn thinks before responding to complex messages</p>
                </div>
              ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {innerThoughts.slice(0, 20).map((thought) => (
                    <div
                      key={thought.id}
                        className="bg-black/60 border border-cyan-500/20 rounded p-3 hover:border-cyan-500/40 transition-all"
                    >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-1">
                            <Brain className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                            <span className="text-xs font-semibold text-cyan-400 monospace">THINK</span>
                            <span className={`text-[10px] ${getStatusColor(thought.status)} monospace flex items-center gap-1`}>
                                {thought.status === 'running' && (
                                  <div className="w-1 h-1 bg-yellow-400 rounded-full animate-pulse" />
                                )}
                              {thought.status.toUpperCase()}
                              </span>
                          </div>
                              {thought.createdAt && (
                            <span className="text-[9px] text-gray-500 monospace">
                                  {new Date(thought.createdAt).toLocaleTimeString()}
                                </span>
                            )}
                          </div>
                          
                          {/* Display thought text */}
                          {thought.metadata?.thought ? (
                          <p className={`text-xs text-gray-300 leading-relaxed monospace mb-2 ${expandedThought !== thought.id && 'line-clamp-3'}`}>
                            {thought.metadata.thought}
                            </p>
                          ) : thought.outputSummary ? (
                          <p className="text-[11px] text-gray-400 monospace mb-2">
                                {thought.outputSummary}
                              </p>
                          ) : (
                          <p className="text-[11px] text-gray-500 monospace mb-2">
                            Processing...
                            </p>
                          )}

                        {thought.metadata && (
                          <button
                            onClick={() => setExpandedThought(expandedThought === thought.id ? null : thought.id)}
                            className="text-[10px] text-cyan-400 hover:text-cyan-300 monospace font-semibold"
                          >
                            {expandedThought === thought.id ? '▼ HIDE DETAILS' : '▶ VIEW DETAILS'}
                          </button>
                        )}
                        
                        {expandedThought === thought.id && thought.metadata && (
                          <div className="mt-3 pt-3 border-t border-cyan-500/20 space-y-2 animate-fade-in">
                          {/* Analysis Details */}
                            {thought.metadata.context && (
                              <div className="flex items-start gap-2 text-[10px] monospace">
                                <span className="text-gray-500 w-20 flex-shrink-0">CONTEXT:</span>
                                <span className="text-cyan-400 font-semibold uppercase">
                                  {thought.metadata.context.replace(/_/g, ' ')}
                                    {thought.metadata.contextConfidence && (
                                    <span className="text-gray-500 ml-2">
                                      ({(thought.metadata.contextConfidence * 100).toFixed(0)}%)
                                    </span>
                                    )}
                                  </span>
                              </div>
                            )}
                            {thought.metadata.responseApproach && (
                              <div className="flex items-start gap-2 text-[10px] monospace">
                                <span className="text-gray-500 w-20 flex-shrink-0">APPROACH:</span>
                                <span className="text-green-400">{thought.metadata.responseApproach}</span>
                              </div>
                            )}
                            {thought.metadata.emotionalTone && (
                              <div className="flex items-start gap-2 text-[10px] monospace">
                                <span className="text-gray-500 w-20 flex-shrink-0">TONE:</span>
                                <span className="text-pink-400">{thought.metadata.emotionalTone}</span>
                              </div>
                            )}
                            {thought.metadata.responseLength && (
                              <div className="flex items-start gap-2 text-[10px] monospace">
                                <span className="text-gray-500 w-20 flex-shrink-0">LENGTH:</span>
                                <span className="text-amber-400 uppercase">{thought.metadata.responseLength.replace(/_/g, ' ')}</span>
                              </div>
                            )}
                          {thought.metadata.contextReasoning && (
                              <div className="mt-2 pt-2 border-t border-cyan-500/20">
                                <span className="text-[10px] text-gray-500 monospace block mb-1">REASONING:</span>
                                <p className="text-[10px] text-gray-400 monospace leading-relaxed">
                                {thought.metadata.contextReasoning}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              </div>
            </div>

            {/* Mood Evolution Section */}
            <div className="col-span-full">
              <div className="bg-black/40 border border-cyan-500/30 rounded p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-sm font-bold text-cyan-400 monospace">MOOD EVOLUTION</h3>
              </div>

              {personality && personality.mood ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Current Mood */}
                    <div className="bg-black/60 border border-cyan-500/20 rounded p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-semibold text-cyan-400 monospace">CURRENT STATE</span>
                      </div>
                      <p className="text-sm text-cyan-300 mb-3 monospace">"{personality.mood.stance}"</p>
                    
                    <div className="space-y-2">
                      <div>
                          <div className="flex justify-between text-[10px] mb-1 monospace">
                            <span className="text-gray-400">VALENCE</span>
                          <span className={`font-semibold ${personality.mood.valence > 0 ? 'text-green-400' : personality.mood.valence < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                            {personality.mood.valence > 0 ? '+' : ''}{personality.mood.valence.toFixed(2)}
                          </span>
                        </div>
                          <div className="h-1.5 bg-gray-700/50 rounded overflow-hidden">
                          <div
                              className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded transition-all duration-500"
                            style={{ width: `${((personality.mood.valence + 1) / 2) * 100}%` }}
                          />
                        </div>
                      </div>
                      
                      <div>
                          <div className="flex justify-between text-[10px] mb-1 monospace">
                            <span className="text-gray-400">AROUSAL</span>
                          <span className="text-pink-400 font-semibold">{personality.mood.arousal.toFixed(2)}</span>
                        </div>
                          <div className="h-1.5 bg-gray-700/50 rounded overflow-hidden">
                          <div
                              className="h-full bg-gradient-to-r from-cyan-500 to-pink-500 rounded transition-all duration-500"
                            style={{ width: `${personality.mood.arousal * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mood History */}
                  {moodHistory.length > 0 && (
                    <div className="space-y-2">
                        <span className="text-[10px] text-gray-400 font-semibold monospace block">RECENT CHANGES</span>
                      {moodHistory.slice().reverse().slice(0, 5).map((mood, index) => (
                          <div key={index} className="bg-black/60 border border-cyan-500/20 rounded p-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-gray-400 monospace">
                              {new Date(mood.timestamp).toLocaleTimeString()}
                              </span>
                          </div>
                            <p className="text-[11px] text-gray-300 monospace mb-2">"{mood.stance}"</p>
                          <div className="flex gap-2">
                              <div className="flex-1 h-1 bg-gray-700/50 rounded overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded"
                                  style={{ width: `${((mood.valence + 1) / 2) * 100}%` }}
                                />
                              </div>
                              <div className="flex-1 h-1 bg-gray-700/50 rounded overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-cyan-500 to-pink-500 rounded"
                                  style={{ width: `${mood.arousal * 100}%` }}
                                />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                  <div className="text-center py-8 text-gray-400 monospace">
                  <p className="text-sm">Loading mood data...</p>
                </div>
              )}
            </div>
            </div>
          </div>
        )}

        {activeTab === 'activities' && (
          <div className="space-y-3">
            {/* Reflection Events */}
            {reflectionEvents.map((event, index) => {
              const Icon = event.type === 'start' ? Brain : Sparkles;
              return (
              <div
                key={`reflection-${index}`}
                  className="bg-black/40 border-2 border-cyan-500/30 rounded p-4 hover:border-cyan-500/50 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-cyan-400" />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-cyan-400 monospace">
                          {event.type === 'start' ? 'REFLECTION STARTED' : 'REFLECTION COMPLETE'}
                      </span>
                      {event.type === 'start' && (
                          <span className="text-xs text-yellow-400 flex items-center gap-1 monospace">
                          <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
                            PROCESSING
                        </span>
                      )}
                      {event.type === 'complete' && event.duration && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-400 font-semibold monospace">
                          {event.duration}s
                        </span>
                      )}
                    </div>
                    {event.type === 'start' && (
                        <p className="text-xs text-gray-400 monospace">
                        Processing {event.conversationsProcessed} conversations with {event.newMemoriesCount} new memories
                      </p>
                    )}
                    {event.type === 'complete' && (
                      <>
                          <p className="text-xs text-gray-400 mb-2 monospace">{event.summary}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {event.newBeliefs! > 0 && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-semibold monospace">
                                +{event.newBeliefs} BELIEF{event.newBeliefs !== 1 ? 'S' : ''}
                            </span>
                          )}
                          {event.updatedBeliefs! > 0 && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-semibold monospace">
                                ↑{event.updatedBeliefs} BELIEF{event.updatedBeliefs !== 1 ? 'S' : ''}
                            </span>
                          )}
                          {event.newGoals! > 0 && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-300 font-semibold monospace">
                                +{event.newGoals} GOAL{event.newGoals !== 1 ? 'S' : ''}
                            </span>
                          )}
                          {event.updatedGoals! > 0 && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-300 font-semibold monospace">
                                ↑{event.updatedGoals} GOAL{event.updatedGoals !== 1 ? 'S' : ''}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              );
            })}

            {/* Belief Events */}
            {beliefEvents.map((event, index) => (
              <div
                key={`belief-${event.id}`}
                className="bg-black/40 border-2 border-cyan-500/30 rounded p-4 hover:border-cyan-500/50 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                      <Lightbulb className="w-5 h-5 text-cyan-400" />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-cyan-400 monospace">
                        NEW BELIEF FORMED
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-semibold monospace">
                        {(event.confidence * 100).toFixed(0)}% CONFIDENCE
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-300 monospace uppercase">
                        {event.subject}
                      </span>
                    </div>
                    <p className="text-xs text-cyan-300 font-medium mb-1.5 monospace">"{event.statement}"</p>
                    <p className="text-xs text-gray-400 monospace">{event.rationale}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* Goal Events */}
            {goalEvents.map((event, index) => (
              <div
                key={`goal-${event.id}`}
                className="bg-black/40 border-2 border-green-500/30 rounded p-4 hover:border-green-500/50 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                      <Target className="w-5 h-5 text-green-400" />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-green-400 monospace">
                        NEW GOAL CREATED
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-400 font-semibold monospace">
                        PRIORITY {event.priority}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-300 monospace uppercase">
                        {event.category}
                      </span>
                    </div>
                    <p className="text-xs text-green-300 font-medium mb-1.5 monospace">{event.title}</p>
                    <p className="text-xs text-gray-400 mb-1.5 monospace">{event.description}</p>
                    <p className="text-xs text-gray-500 monospace">{event.rationale}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* Regular Activities */}
            {activities.length === 0 && reflectionEvents.length === 0 && beliefEvents.length === 0 && goalEvents.length === 0 && (
              <div className="bg-black/40 border border-cyan-500/30 rounded p-8 text-center">
                <Activity className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <div className="text-sm text-gray-400 monospace">No activities recorded</div>
              </div>
            )}
            {activities.slice(0, 20).map((activity) => {
              const Icon = getToolIcon(activity.tool);
              return (
              <div
                key={activity.id}
                  className="bg-black/40 border border-cyan-500/30 rounded p-4 hover:border-cyan-500/50 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-cyan-400" />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-cyan-400 uppercase monospace">
                          {activity.tool === 'think' ? 'INNER THOUGHT' : 
                           activity.tool === 'evolve' ? 'MOOD UPDATE' :
                         activity.tool}
                      </span>
                        <span className={`text-xs ${getStatusColor(activity.status)} flex items-center gap-1 monospace`}>
                        {activity.status === 'running' && (
                          <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
                        )}
                          {activity.status.toUpperCase()}
                      </span>
                      {activity.tool === 'recall' && activity.metadata?.memoryCount !== undefined && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-semibold monospace">
                            {activity.metadata.memoryCount} {activity.metadata.memoryCount === 1 ? 'MEMORY' : 'MEMORIES'}
                        </span>
                      )}
                    </div>
                    {activity.summary && (
                        <p className={`text-xs ${activity.tool === 'think' ? 'text-gray-300' : 'text-gray-400'} monospace`}>
                          {activity.summary}
                      </p>
                    )}
                  </div>
                </div>

                {activity.status === 'running' && (
                    <div className="mt-3 h-1 bg-gray-700/50 rounded overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyan-500 to-pink-500 rounded animate-pulse" style={{ width: '60%' }} />
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}

        {activeTab === 'personality' && personality && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Mood Card */}
            <div className="bg-black/40 border border-cyan-500/30 rounded p-4">
              <h3 className="text-sm font-bold text-cyan-400 mb-4 monospace flex items-center gap-2">
                <Zap className="w-4 h-4" />
                CURRENT MOOD
              </h3>
              
              <div className="bg-black/60 border border-cyan-500/20 rounded p-4 mb-4">
                <p className="text-sm text-cyan-300 mb-3 monospace">"{personality.mood.stance}"</p>
                
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-2 monospace">
                      <span className="text-gray-400">VALENCE</span>
                      <span className="text-white font-semibold">{personality.mood.valence.toFixed(2)}</span>
                    </div>
                    <div className="h-2 bg-gray-700/50 rounded overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded transition-all duration-500"
                        style={{ width: `${((personality.mood.valence + 1) / 2) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-xs mb-2 monospace">
                      <span className="text-gray-400">AROUSAL</span>
                      <span className="text-white font-semibold">{personality.mood.arousal.toFixed(2)}</span>
                    </div>
                    <div className="h-2 bg-gray-700/50 rounded overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-pink-500 rounded transition-all duration-500"
                        style={{ width: `${personality.mood.arousal * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {activeTab === 'persona' && persona && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Relationship Card */}
            <div className="bg-black/40 border border-cyan-500/30 rounded p-4">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-cyan-400 monospace">RELATIONSHIP</h3>
              </div>
              
              <div className="bg-black/60 border border-cyan-500/20 rounded p-4 space-y-3">
                <div className="text-center mb-3">
                  <p className="text-sm text-cyan-300 font-semibold monospace uppercase">{persona.relationship.stage}</p>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-xs mb-1 monospace">
                      <span className="text-gray-400">CLOSENESS</span>
                      <span className="text-white font-semibold">{persona.relationship.closeness.toFixed(2)}</span>
                    </div>
                    <div className="h-2 bg-gray-700/50 rounded overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded transition-all duration-500"
                        style={{ width: `${persona.relationship.closeness * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-xs mb-1 monospace">
                      <span className="text-gray-400">TRUST</span>
                      <span className="text-white font-semibold">{persona.relationship.trust.toFixed(2)}</span>
                    </div>
                    <div className="h-2 bg-gray-700/50 rounded overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded transition-all duration-500"
                        style={{ width: `${persona.relationship.trust * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-xs mb-1 monospace">
                      <span className="text-gray-400">FLIRTATION</span>
                      <span className="text-white font-semibold">{persona.relationship.flirtation.toFixed(2)}</span>
                    </div>
                    <div className="h-2 bg-gray-700/50 rounded overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded transition-all duration-500"
                        style={{ width: `${persona.relationship.flirtation * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Beliefs Card */}
            <div className="bg-black/40 border border-cyan-500/30 rounded p-4">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-cyan-400 monospace">BELIEFS</h3>
                <span className="text-xs text-gray-400 monospace">({persona.beliefs.length})</span>
              </div>
              
              {persona.beliefs.length === 0 ? (
                <div className="bg-black/60 border border-cyan-500/20 rounded p-4 text-center">
                  <p className="text-xs text-gray-400 monospace">No beliefs formed yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto terminal-scrollbar pr-2">
                  {persona.beliefs.slice(0, 5).map((belief) => (
                    <div key={belief.id} className="bg-black/60 border border-cyan-500/20 rounded p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-[10px] text-cyan-400 font-semibold uppercase monospace">{belief.subject}</span>
                        <span className="text-[10px] text-gray-400 monospace">{(belief.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <p className="text-xs text-gray-200 monospace">{belief.statement}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Goals Card */}
            <div className="bg-black/40 border border-cyan-500/30 rounded p-4">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-cyan-400 monospace">GOALS</h3>
                <span className="text-xs text-gray-400 monospace">({persona.goals.length})</span>
              </div>
              
              {persona.goals.length === 0 ? (
                <div className="bg-black/60 border border-cyan-500/20 rounded p-4 text-center">
                  <p className="text-xs text-gray-400 monospace">No goals set yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto terminal-scrollbar pr-2">
                  {persona.goals.map((goal) => (
                    <div key={goal.id} className="bg-black/60 border border-cyan-500/20 rounded p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <p className="text-xs text-white font-semibold monospace">{goal.title}</p>
                          <p className="text-[10px] text-gray-400 mt-1 monospace">{goal.description}</p>
                        </div>
                        <span className="text-[10px] text-cyan-400 font-semibold monospace">{(goal.progress * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-700/50 rounded overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-pink-500 rounded transition-all duration-500"
                          style={{ width: `${goal.progress * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Evolution Events Card */}
            <div className="bg-black/40 border border-cyan-500/30 rounded p-4">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-cyan-400 monospace">RECENT EVOLUTION</h3>
                <span className="text-xs text-gray-400 monospace">({evolutionEvents.length})</span>
              </div>
              
              {evolutionEvents.length === 0 ? (
                <div className="bg-black/60 border border-cyan-500/20 rounded p-4 text-center">
                  <p className="text-xs text-gray-400 monospace">No evolution events yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto terminal-scrollbar pr-2">
                  {evolutionEvents.slice(0, 10).map((event) => (
                    <div key={event.id} className="bg-black/60 border border-cyan-500/20 rounded p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-[10px] text-cyan-400 font-semibold uppercase monospace">{event.type}</span>
                        <span className="text-[10px] text-gray-500 monospace">
                          {new Date(event.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 mb-1 monospace">{event.target}</p>
                      <p className="text-xs text-gray-200 monospace">{event.rationale}</p>
                      {event.delta !== null && (
                        <div className="mt-1">
                          <span className={`text-[10px] font-semibold monospace ${event.delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {event.delta > 0 ? '+' : ''}{event.delta.toFixed(3)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'memories' && (
          <MemoryTimeline />
        )}
      </div>
    </div>
  );
}
