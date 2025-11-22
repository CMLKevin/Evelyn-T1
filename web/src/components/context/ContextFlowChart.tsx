import { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { ContextSnapshot } from '../../state/store';
import ContextNodeDetails from './ContextNodeDetails';

interface ContextFlowChartProps {
  snapshot: ContextSnapshot;
}

export default function ContextFlowChart({ snapshot }: ContextFlowChartProps) {
  const { sources, totalTokens, mode } = snapshot;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Calculate positioning for a vertical flow layout
  const leftColumnX = 100;
  const rightColumnX = 600;
  const centerNodeX = 350;
  const spacing = 100;

  // Mode-specific emphasis calculator
  const getNodeEmphasis = useCallback((nodeId: string): number => {
    // Returns emphasis level: 0 (normal), 1 (moderate), 2 (high)
    const emphasisMap: Record<string, Record<string, number>> = {
      chat: {
        'memories': 2,
        'conversation': 2,
        'personality': 1,
        'system-prompt': 0,
        'search': 1,
        'inner-thought': 1,
      },
      coding: {
        'conversation': 2,
        'inner-thought': 2,
        'memories': 1,
        'personality': 1,
        'system-prompt': 0,
        'search': 0,
      },
      browsing: {
        'search': 2,
        'memories': 1,
        'conversation': 2,
        'personality': 1,
        'system-prompt': 0,
        'inner-thought': 1,
      },
    };

    return emphasisMap[mode]?.[nodeId] ?? 0;
  }, [mode]);

  // Create nodes for each context source
  const nodes = useMemo<Node[]>(() => {
    const sourceNodes: Node[] = [];
    let yOffset = 50;

    // Helper to create source nodes with mode-specific emphasis
    const createSourceNode = (
      id: string,
      label: string,
      tokens: number,
      color: string,
      details: string
    ) => {
      const percentage = ((tokens / totalTokens) * 100).toFixed(1);
      const emphasis = getNodeEmphasis(id);
      
      // Calculate dynamic styling based on emphasis
      const borderWidth = emphasis === 2 ? '4px' : emphasis === 1 ? '3px' : '2px';
      const minWidth = emphasis === 2 ? '200px' : emphasis === 1 ? '190px' : '180px';
      const boxShadow = emphasis === 2 
        ? `0 0 20px ${color}60, 0 0 40px ${color}30`
        : emphasis === 1 
        ? `0 0 12px ${color}40`
        : 'none';
      const scale = emphasis === 2 ? 1.05 : emphasis === 1 ? 1.02 : 1;
      
      return {
        id,
        type: 'default',
        position: { x: leftColumnX, y: yOffset },
        data: {
          label: (
            <div className="context-source-node" title={`Click for detailed ${label} information`}>
              <div className="font-bold" style={{ 
                color,
                fontSize: emphasis === 2 ? '0.95rem' : '0.875rem'
              }}>
                {emphasis === 2 && '⭐ '}{label}
              </div>
              <div className="text-xs text-gray-400">{tokens.toLocaleString()} tokens</div>
              <div className="text-xs text-gray-500">{percentage}%</div>
              <div className="text-xs text-gray-600">{details}</div>
            </div>
          ),
        },
        sourcePosition: Position.Right,
        style: {
          background: `${color}${emphasis === 2 ? '25' : emphasis === 1 ? '20' : '15'}`,
          border: `${borderWidth} solid ${color}`,
          borderRadius: '0px',
          padding: '12px',
          minWidth,
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          transform: `scale(${scale})`,
          boxShadow,
          zIndex: emphasis,
        },
      };
    };

    // System Prompt
    sourceNodes.push(
      createSourceNode(
        'system-prompt',
        'System Prompt',
        sources.systemPrompt.tokens,
        '#06b6d4', // cyan
        `${sources.systemPrompt.length} chars`
      )
    );
    yOffset += spacing;

    // Personality
    sourceNodes.push(
      createSourceNode(
        'personality',
        'Personality',
        sources.personality.tokens,
        '#a855f7', // purple
        `${sources.personality.beliefs.length}B ${sources.personality.goals.length}G ${sources.personality.threads.length}T`
      )
    );
    yOffset += spacing;

    // Memories
    sourceNodes.push(
      createSourceNode(
        'memories',
        'Memories',
        sources.memories.tokens,
        '#22c55e', // green
        `${sources.memories.count} memories`
      )
    );
    yOffset += spacing;

    // Search Results
    if (sources.searchResults.tokens > 0) {
      sourceNodes.push(
        createSourceNode(
          'search',
          'Search Results',
          sources.searchResults.tokens,
          '#eab308', // yellow
          `${sources.searchResults.recent} recent${sources.searchResults.current ? ' (active)' : ''}`
        )
      );
      yOffset += spacing;
    }

    // Conversation
    sourceNodes.push(
      createSourceNode(
        'conversation',
        'Conversation',
        sources.conversation.tokens,
        '#ec4899', // pink
        `${sources.conversation.messageCount} msgs (${sources.conversation.windowStatus})`
      )
    );
    yOffset += spacing;

    // Inner Thought
    if (sources.innerThought) {
      sourceNodes.push(
        createSourceNode(
          'inner-thought',
          'Inner Thought',
          sources.innerThought.tokens,
          '#f97316', // orange
          sources.innerThought.tone
        )
      );
      yOffset += spacing;
    }

    // Center aggregation node
    const centerY = (yOffset - spacing) / 2;
    const capacityPercentage = ((totalTokens / snapshot.maxTokens) * 100).toFixed(1);
    sourceNodes.push({
      id: 'context-aggregator',
      type: 'default',
      position: { x: centerNodeX, y: centerY },
      data: {
        label: (
          <div className="text-center" title={`Total context: ${totalTokens.toLocaleString()} / ${snapshot.maxTokens.toLocaleString()} tokens (${capacityPercentage}% capacity)`}>
            <div className="font-bold text-cyan-400 text-lg">Context</div>
            <div className="text-sm text-gray-400">{totalTokens.toLocaleString()}t</div>
            <div className="text-xs text-gray-500">
              {capacityPercentage}%
            </div>
          </div>
        ),
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        background: 'rgba(6, 182, 212, 0.1)',
        border: '3px solid #06b6d4',
        borderRadius: '0px',
        width: '120px',
        height: '120px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
    });

    // Evelyn node
    sourceNodes.push({
      id: 'evelyn',
      type: 'output',
      position: { x: rightColumnX, y: centerY },
      data: {
        label: (
          <div className="text-center" title={`Evelyn processing in ${snapshot.mode} mode`}>
            <div className="font-bold text-cyan-300 text-xl">⚡ Evelyn</div>
            <div className="text-xs text-gray-400 mt-1">{snapshot.mode.toUpperCase()}</div>
          </div>
        ),
      },
      targetPosition: Position.Left,
      style: {
        background: 'rgba(255, 115, 0, 0.1)',
        border: '3px solid #ff7300',
        borderRadius: '0px',
        padding: '16px',
        minWidth: '140px',
        boxShadow: '0 0 20px rgba(255, 115, 0, 0.3)',
      },
    });

    return sourceNodes;
  }, [snapshot, sources, totalTokens]);

  // Create edges connecting sources to aggregator to Evelyn
  const edges = useMemo<Edge[]>(() => {
    const edgeList: Edge[] = [];

    // Helper to calculate edge width based on token percentage
    const getEdgeWidth = (tokens: number) => {
      const percentage = (tokens / totalTokens) * 100;
      return Math.max(2, Math.min(percentage / 5, 15)); // 2-15px width
    };

    const sourceColors: Record<string, string> = {
      'system-prompt': '#06b6d4',
      'personality': '#a855f7',
      'memories': '#22c55e',
      'search': '#eab308',
      'conversation': '#ec4899',
      'inner-thought': '#f97316',
    };

    // Connect each source to the aggregator
    const sourceIds = [
      'system-prompt',
      'personality',
      'memories',
      ...(sources.searchResults.tokens > 0 ? ['search'] : []),
      'conversation',
      ...(sources.innerThought ? ['inner-thought'] : []),
    ];

    const tokenMap: Record<string, number> = {
      'system-prompt': sources.systemPrompt.tokens,
      'personality': sources.personality.tokens,
      'memories': sources.memories.tokens,
      'search': sources.searchResults.tokens,
      'conversation': sources.conversation.tokens,
      'inner-thought': sources.innerThought?.tokens || 0,
    };

    sourceIds.forEach((sourceId) => {
      const tokens = tokenMap[sourceId];
      const color = sourceColors[sourceId];
      const emphasis = getNodeEmphasis(sourceId);
      
      // Emphasized edges are more prominent
      const edgeOpacity = emphasis === 2 ? 0.9 : emphasis === 1 ? 0.75 : 0.6;
      const animationSpeed = emphasis === 2 ? true : emphasis === 1 ? true : true;
      
      edgeList.push({
        id: `${sourceId}-to-aggregator`,
        source: sourceId,
        target: 'context-aggregator',
        type: 'smoothstep',
        animated: animationSpeed,
        style: {
          stroke: color,
          strokeWidth: getEdgeWidth(tokens) * (emphasis === 2 ? 1.3 : emphasis === 1 ? 1.15 : 1),
          opacity: edgeOpacity,
        },
        label: `${tokens.toLocaleString()}t`,
        labelStyle: { 
          fill: color, 
          fontSize: emphasis === 2 ? 11 : 10,
          fontWeight: emphasis === 2 ? 700 : 600,
        },
        labelBgStyle: {
          fill: '#1f2937',
          fillOpacity: 0.8,
        },
      });
    });

    // Connect aggregator to Evelyn
    edgeList.push({
      id: 'aggregator-to-evelyn',
      source: 'context-aggregator',
      target: 'evelyn',
      type: 'smoothstep',
      animated: true,
      style: {
        stroke: '#06b6d4',
        strokeWidth: 8,
        opacity: 0.8,
      },
    });

    return edgeList;
  }, [sources, totalTokens, mode, getNodeEmphasis]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    console.log('[ContextFlowChart] Node clicked:', node.id);
    // Only show details for source nodes, not aggregator or evelyn
    if (node.id !== 'context-aggregator' && node.id !== 'evelyn') {
      setSelectedNodeId(node.id);
    }
  }, []);

  return (
    <>
      <div className="w-full h-[600px] overflow-hidden border-2 border-white/20 bg-terminal-black">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodeClick={onNodeClick}
          fitView
          attributionPosition="bottom-left"
          minZoom={0.5}
          maxZoom={1.5}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        >
          <Background color="#06b6d4" gap={16} size={1} style={{ opacity: 0.1 }} />
          <Controls className="bg-terminal-900 border-2 border-white/20" />
          <MiniMap
            className="bg-terminal-900 border-2 border-white/20"
            nodeColor={(node) => {
              if (node.id === 'evelyn') return '#ff7300';
              if (node.id === 'context-aggregator') return '#06b6d4';
              return '#4b5563';
            }}
          />
        </ReactFlow>
      </div>

      {/* Node Details Modal */}
      {selectedNodeId && (
        <ContextNodeDetails
          nodeId={selectedNodeId}
          snapshot={snapshot}
          onClose={() => setSelectedNodeId(null)}
        />
      )}
    </>
  );
}
