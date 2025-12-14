/**
 * Edit Summary Modal
 * 
 * Comprehensive summary shown after an agentic edit completes.
 * Shows stats, diff preview, iteration timeline, and action buttons.
 */

import { useState, useMemo } from 'react';
import { 
  X, Check, Undo2, GitCompare, Clock, Zap, 
  FileEdit, Target, ChevronDown, ChevronUp,
  CheckCircle2, AlertCircle, Activity, Brain
} from 'lucide-react';
import type { AgenticIteration, EditPlan, EditChange } from '../../types/agentic';
import LiveDiffView from './LiveDiffView';

interface EditStats {
  totalIterations: number;
  totalChanges: number;
  linesAdded: number;
  linesRemoved: number;
  charactersChanged: number;
  toolCallsCount: number;
  averageIterationTime: number;
  duration: number;
}

interface EditSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  onReject: () => void;
  
  // Edit data
  success: boolean;
  goal: string;
  summary: string;
  originalContent: string;
  editedContent: string;
  changes: EditChange[];
  iterations: AgenticIteration[];
  plan?: EditPlan;
  stats: EditStats;
}

export default function EditSummaryModal({
  isOpen,
  onClose,
  onAccept,
  onReject,
  success,
  goal,
  summary,
  originalContent,
  editedContent,
  changes,
  iterations,
  plan,
  stats
}: EditSummaryModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'diff' | 'timeline'>('overview');
  const [expandedIteration, setExpandedIteration] = useState<number | null>(null);

  if (!isOpen) return null;

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    const secs = Math.floor(ms / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    return `${mins}m ${secs % 60}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-terminal-900 border-2 border-white/20 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            {success ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            ) : (
              <AlertCircle className="w-6 h-6 text-red-400" />
            )}
            <div>
              <h2 className="text-lg font-mono font-bold text-white">
                Edit {success ? 'Complete' : 'Failed'}
              </h2>
              <p className="text-xs font-mono text-terminal-400">{goal}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-terminal-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {(['overview', 'diff', 'timeline'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-mono transition-colors ${
                activeTab === tab
                  ? 'text-white border-b-2 border-orange bg-white/5'
                  : 'text-terminal-400 hover:text-white'
              }`}
            >
              {tab === 'overview' && <Activity className="w-4 h-4 inline mr-2" />}
              {tab === 'diff' && <GitCompare className="w-4 h-4 inline mr-2" />}
              {tab === 'timeline' && <Clock className="w-4 h-4 inline mr-2" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'overview' && (
            <OverviewTab
              summary={summary}
              stats={stats}
              changes={changes}
              plan={plan}
              formatDuration={formatDuration}
            />
          )}
          
          {activeTab === 'diff' && (
            <div className="h-96">
              <LiveDiffView
                original={originalContent}
                current={editedContent}
              />
            </div>
          )}
          
          {activeTab === 'timeline' && (
            <TimelineTab
              iterations={iterations}
              expandedIteration={expandedIteration}
              setExpandedIteration={setExpandedIteration}
              formatDuration={formatDuration}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-terminal-950/50">
          <div className="flex items-center gap-3 text-xs font-mono text-terminal-500">
            <span>{stats.totalIterations} iterations</span>
            <span>•</span>
            <span>{stats.totalChanges} changes</span>
            <span>•</span>
            <span>{formatDuration(stats.duration)}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={onReject}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 
                       text-red-400 font-mono text-sm hover:bg-red-500/20 transition-colors"
            >
              <Undo2 className="w-4 h-4" />
              Reject Changes
            </button>
            <button
              onClick={onAccept}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 
                       text-emerald-400 font-mono text-sm hover:bg-emerald-500/20 transition-colors"
            >
              <Check className="w-4 h-4" />
              Accept Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Overview Tab
function OverviewTab({
  summary,
  stats,
  changes,
  plan,
  formatDuration
}: {
  summary: string;
  stats: EditStats;
  changes: EditChange[];
  plan?: EditPlan;
  formatDuration: (ms: number) => string;
}) {
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="p-4 bg-terminal-950 border border-white/10">
        <p className="text-sm font-mono text-white/90">{summary}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<Zap className="w-4 h-4" />}
          label="Duration"
          value={formatDuration(stats.duration)}
          color="text-orange"
        />
        <StatCard
          icon={<Activity className="w-4 h-4" />}
          label="Iterations"
          value={stats.totalIterations.toString()}
          color="text-blue-400"
        />
        <StatCard
          icon={<FileEdit className="w-4 h-4" />}
          label="Changes"
          value={stats.totalChanges.toString()}
          color="text-emerald-400"
        />
        <StatCard
          icon={<Clock className="w-4 h-4" />}
          label="Avg/Step"
          value={formatDuration(stats.averageIterationTime)}
          color="text-purple-400"
        />
      </div>

      {/* Line changes */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-mono text-sm">+{stats.linesAdded}</span>
          <span className="text-xs font-mono text-terminal-500">lines added</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-red-400 font-mono text-sm">-{stats.linesRemoved}</span>
          <span className="text-xs font-mono text-terminal-500">lines removed</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-yellow-400 font-mono text-sm">{stats.charactersChanged}</span>
          <span className="text-xs font-mono text-terminal-500">chars changed</span>
        </div>
      </div>

      {/* Plan completion */}
      {plan && (
        <div className="space-y-2">
          <h3 className="text-xs font-mono font-bold text-terminal-400 uppercase tracking-wider">
            Goal Progress
          </h3>
          <div className="space-y-1">
            {plan.subGoals.map((goal, i) => (
              <div key={goal.id} className="flex items-center gap-2 text-sm font-mono">
                {goal.status === 'completed' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : goal.status === 'blocked' ? (
                  <AlertCircle className="w-4 h-4 text-red-400" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-terminal-500" />
                )}
                <span className={goal.status === 'completed' ? 'text-terminal-400' : 'text-white'}>
                  {goal.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Changes list */}
      {changes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-mono font-bold text-terminal-400 uppercase tracking-wider">
            Changes Made
          </h3>
          <div className="space-y-1">
            {changes.map((change, i) => (
              <div key={i} className="flex items-start gap-2 text-sm font-mono">
                <FileEdit className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                <span className="text-white/80">{change.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Stat Card
function StatCard({
  icon,
  label,
  value,
  color
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="p-4 bg-terminal-950 border border-white/10">
      <div className={`flex items-center gap-2 mb-2 ${color}`}>
        {icon}
        <span className="text-[10px] font-mono uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-xl font-mono font-bold text-white">{value}</span>
    </div>
  );
}

// Timeline Tab
function TimelineTab({
  iterations,
  expandedIteration,
  setExpandedIteration,
  formatDuration
}: {
  iterations: AgenticIteration[];
  expandedIteration: number | null;
  setExpandedIteration: (idx: number | null) => void;
  formatDuration: (ms: number) => string;
}) {
  return (
    <div className="space-y-2">
      {iterations.map((iteration, idx) => (
        <div
          key={iteration.id || idx}
          className="border border-white/10 bg-terminal-950"
        >
          <div
            className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5"
            onClick={() => setExpandedIteration(expandedIteration === idx ? null : idx)}
          >
            <div className={`w-8 h-8 flex items-center justify-center border ${
              iteration.goalStatus === 'completed' ? 'border-emerald-500 text-emerald-400' :
              iteration.goalStatus === 'blocked' ? 'border-red-500 text-red-400' :
              'border-orange text-orange'
            }`}>
              <span className="text-sm font-mono font-bold">{iteration.step}</span>
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                {iteration.toolCall && (
                  <span className="text-xs font-mono text-cyan-400 px-1.5 py-0.5 bg-cyan-500/10 border border-cyan-500/30">
                    {iteration.toolCall.tool}
                  </span>
                )}
                {iteration.toolResult && (
                  <span className={`text-xs font-mono px-1.5 py-0.5 ${
                    iteration.toolResult.success 
                      ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30'
                      : 'text-red-400 bg-red-500/10 border border-red-500/30'
                  }`}>
                    {iteration.toolResult.success ? '✓ Success' : '✗ Failed'}
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-terminal-400 mt-1 line-clamp-1">
                {iteration.think}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-terminal-500">
                {formatDuration(iteration.duration)}
              </span>
              {expandedIteration === idx ? (
                <ChevronUp className="w-4 h-4 text-terminal-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-terminal-500" />
              )}
            </div>
          </div>
          
          {expandedIteration === idx && (
            <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-3">
              {/* Structured thought */}
              {iteration.structuredThought && (
                <div className="space-y-2">
                  <div>
                    <span className="text-[10px] font-mono text-blue-400 uppercase">Observation</span>
                    <p className="text-sm font-mono text-white/80">{iteration.structuredThought.observation}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-purple-400 uppercase">Plan</span>
                    <p className="text-sm font-mono text-white/80">{iteration.structuredThought.plan}</p>
                  </div>
                </div>
              )}
              
              {/* Plain think fallback */}
              {!iteration.structuredThought && iteration.think && (
                <div>
                  <span className="text-[10px] font-mono text-purple-400 uppercase">Think</span>
                  <p className="text-sm font-mono text-white/80">{iteration.think}</p>
                </div>
              )}
              
              {/* Tool call details */}
              {iteration.toolCall && (
                <div>
                  <span className="text-[10px] font-mono text-cyan-400 uppercase">Tool Params</span>
                  <pre className="text-xs font-mono text-terminal-300 bg-terminal-black p-2 overflow-auto">
                    {JSON.stringify(iteration.toolCall.params, null, 2)}
                  </pre>
                </div>
              )}
              
              {/* Tool result */}
              {iteration.toolResult && (
                <div>
                  <span className="text-[10px] font-mono text-emerald-400 uppercase">Result</span>
                  <p className={`text-sm font-mono ${
                    iteration.toolResult.success ? 'text-emerald-300' : 'text-red-300'
                  }`}>
                    {iteration.toolResult.message}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export { EditSummaryModal };
