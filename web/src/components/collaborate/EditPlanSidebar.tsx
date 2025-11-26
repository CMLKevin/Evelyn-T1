import { useState } from 'react';
import { CheckCircle2, Circle, Loader2, XCircle, ChevronRight, Target, Clock, Zap } from 'lucide-react';

interface SubGoal {
  id: string;
  description: string;
  estimatedSteps: number;
  dependencies: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
}

interface EditPlan {
  overallGoal: string;
  subGoals: SubGoal[];
  currentSubGoalId: string | null;
  estimatedTotalSteps: number;
}

interface EditPlanSidebarProps {
  plan: EditPlan | null;
  currentIteration: number;
  totalIterations: number;
  isActive: boolean;
  onGoalClick?: (goalId: string) => void;
}

/**
 * Edit Plan Sidebar - Shows decomposed sub-goals with progress
 * Phase 3 UX improvement for agentic editing
 */
export default function EditPlanSidebar({
  plan,
  currentIteration,
  totalIterations,
  isActive,
  onGoalClick
}: EditPlanSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!plan) {
    return null;
  }

  const completedCount = plan.subGoals.filter(g => g.status === 'completed').length;
  const progress = plan.subGoals.length > 0 
    ? Math.round((completedCount / plan.subGoals.length) * 100)
    : 0;

  return (
    <div className={`bg-terminal-900/50 border-r border-white/10 flex flex-col transition-all duration-200 ${
      isCollapsed ? 'w-10' : 'w-56'
    }`}>
      {/* Header */}
      <div 
        className="flex items-center justify-between px-3 py-2 border-b border-white/10 cursor-pointer hover:bg-white/5"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-orange" />
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Plan
            </span>
          </div>
        )}
        <ChevronRight className={`w-4 h-4 text-terminal-400 transition-transform ${
          isCollapsed ? '' : 'rotate-180'
        }`} />
      </div>

      {!isCollapsed && (
        <>
          {/* Overall Goal */}
          <div className="px-3 py-2 border-b border-white/5">
            <p className="text-[11px] text-white/80 font-mono line-clamp-2">
              {plan.overallGoal}
            </p>
          </div>

          {/* Progress bar */}
          <div className="px-3 py-2 border-b border-white/5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-terminal-500">Progress</span>
              <span className="text-[10px] font-mono text-terminal-400">{progress}%</span>
            </div>
            <div className="h-1.5 bg-terminal-800 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-orange to-emerald-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="px-3 py-2 border-b border-white/5 flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-terminal-500" />
              <span className="text-[10px] font-mono text-terminal-400">
                {currentIteration}/{totalIterations}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-terminal-500" />
              <span className="text-[10px] font-mono text-terminal-400">
                ~{plan.estimatedTotalSteps} steps
              </span>
            </div>
          </div>

          {/* Sub-goals list */}
          <div className="flex-1 overflow-auto py-1">
            {plan.subGoals.map((goal, index) => (
              <SubGoalItem
                key={goal.id}
                goal={goal}
                index={index}
                isCurrent={goal.id === plan.currentSubGoalId}
                onClick={() => onGoalClick?.(goal.id)}
              />
            ))}
          </div>

          {/* Status indicator */}
          {isActive && (
            <div className="px-3 py-2 border-t border-white/10 bg-orange/5">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 text-orange animate-spin" />
                <span className="text-[10px] font-mono text-orange">
                  Editing in progress...
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SubGoalItem({ 
  goal, 
  index, 
  isCurrent,
  onClick 
}: { 
  goal: SubGoal; 
  index: number; 
  isCurrent: boolean;
  onClick?: () => void;
}) {
  const StatusIcon = goal.status === 'completed' ? CheckCircle2 :
                     goal.status === 'in_progress' ? Loader2 :
                     goal.status === 'blocked' ? XCircle :
                     Circle;

  const statusColor = goal.status === 'completed' ? 'text-emerald-400' :
                      goal.status === 'in_progress' ? 'text-orange' :
                      goal.status === 'blocked' ? 'text-red-400' :
                      'text-terminal-500';

  const bgColor = isCurrent ? 'bg-orange/10 border-l-2 border-orange' :
                  goal.status === 'completed' ? 'bg-emerald-500/5' :
                  '';

  return (
    <div
      className={`px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors ${bgColor}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <StatusIcon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${statusColor} ${
          goal.status === 'in_progress' ? 'animate-spin' : ''
        }`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-terminal-500">
              {index + 1}.
            </span>
            <span className={`text-[11px] font-mono truncate ${
              goal.status === 'completed' ? 'text-terminal-400 line-through' :
              isCurrent ? 'text-white' :
              'text-terminal-300'
            }`}>
              {goal.description}
            </span>
          </div>
          
          {/* Dependencies */}
          {goal.dependencies.length > 0 && goal.status === 'pending' && (
            <div className="mt-1 text-[9px] font-mono text-terminal-600">
              Waiting for: {goal.dependencies.join(', ')}
            </div>
          )}
          
          {/* Estimated steps */}
          {goal.status !== 'completed' && (
            <div className="mt-0.5 text-[9px] font-mono text-terminal-600">
              ~{goal.estimatedSteps} step{goal.estimatedSteps !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { EditPlanSidebar };
