import { useState, useEffect } from 'react';
import { Database, Trash2, CheckSquare, Square } from 'lucide-react';

interface Memory {
  id: number;
  type: string;
  text: string;
  importance: number;
  privacy: string;
  createdAt: string;
}

export default function MemoryTimeline() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    fetchMemories();
  }, [filter]);

  const fetchMemories = async () => {
    try {
      const url = filter === 'all' 
        ? 'http://localhost:3001/api/memories?limit=50' 
        : `http://localhost:3001/api/memories?type=${filter}&limit=50`;
      const res = await fetch(url);
      const data = await res.json();
      setMemories(data);
      setSelectedIds(new Set()); // Clear selection on refresh
    } catch (err) {
      console.error('Failed to fetch memories:', err);
    }
  };

  const deleteMemory = async (id: number) => {
    if (!confirm('Delete this memory? This action cannot be undone.')) {
      return;
    }

    try {
      setIsDeleting(true);
      const res = await fetch(`http://localhost:3001/api/memories/${id}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        setMemories(memories.filter(m => m.id !== id));
        console.log(`Deleted memory #${id}`);
      } else {
        alert('Failed to delete memory');
      }
    } catch (err) {
      console.error('Failed to delete memory:', err);
      alert('Error deleting memory');
    } finally {
      setIsDeleting(false);
    }
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    
    if (!confirm(`Delete ${selectedIds.size} selected memories? This action cannot be undone.`)) {
      return;
    }

    try {
      setIsDeleting(true);
      const res = await fetch('http://localhost:3001/api/memories/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      
      if (res.ok) {
        setMemories(memories.filter(m => !selectedIds.has(m.id)));
        setSelectedIds(new Set());
        console.log(`Bulk deleted ${selectedIds.size} memories`);
      } else {
        alert('Failed to delete memories');
      }
    } catch (err) {
      console.error('Failed to bulk delete:', err);
      alert('Error deleting memories');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelection = (id: number) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const selectAll = () => {
    if (selectedIds.size === memories.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(memories.map(m => m.id)));
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'episodic': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'semantic': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'preference': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'insight': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'plan': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'relational': return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const types = ['all', 'episodic', 'semantic', 'preference', 'insight', 'plan', 'relational'];

  return (
    <div className="space-y-3">
      {/* Filter pills - Sticky at top */}
      <div className="bg-black/40 border border-cyan-500/30 rounded p-3 sticky top-0 z-10 backdrop-blur-xl">
        <div className="flex flex-wrap gap-2 mb-3">
          {types.map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`terminal-button px-3 py-1.5 text-xs font-semibold monospace uppercase transition-all ${
                filter === type
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500'
                  : 'text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Bulk actions */}
        {memories.length > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-cyan-500/20">
            <button
              onClick={selectAll}
              className="terminal-button px-3 py-1.5 text-xs monospace"
            >
              {selectedIds.size === memories.length ? (
                <>
                  <CheckSquare className="w-4 h-4" />
                  <span>DESELECT ALL</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4" />
                  <span>SELECT ALL</span>
                </>
              )}
            </button>
            
            {selectedIds.size > 0 && (
              <>
                <div className="text-xs text-gray-400 monospace">
                  {selectedIds.size} SELECTED
                </div>
                <button
                  onClick={bulkDelete}
                  disabled={isDeleting}
                  className="terminal-button px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/20 disabled:opacity-50 monospace"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeleting ? 'DELETING...' : `DELETE ${selectedIds.size}`}</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Memory cards */}
      {memories.length === 0 ? (
        <div className="bg-black/40 border border-cyan-500/30 rounded p-8 text-center animate-fade-in">
          <Database className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <div className="text-sm text-gray-400 monospace">NO MEMORIES FOUND</div>
          <div className="text-xs text-gray-500 mt-2 monospace">
            Memories will appear here as you chat with Evelyn
          </div>
        </div>
      ) : (
        memories.map((memory, index) => (
          <div
            key={memory.id}
            className={`bg-black/40 border rounded p-4 hover:border-cyan-500/50 transition-all animate-fade-in group ${
              selectedIds.has(memory.id) ? 'border-cyan-500' : 'border-cyan-500/30'
            }`}
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="flex items-start gap-3">
              {/* Checkbox */}
              <button
                onClick={() => toggleSelection(memory.id)}
                className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                  selectedIds.has(memory.id)
                    ? 'bg-cyan-500/20 border-cyan-500'
                    : 'border-gray-600 hover:border-cyan-500'
                }`}
              >
                {selectedIds.has(memory.id) && (
                  <CheckSquare className="w-4 h-4 text-cyan-400" />
                )}
              </button>

              {/* Type badge */}
              <div className={`flex-shrink-0 px-2 py-1 rounded border text-[10px] font-bold uppercase monospace ${getTypeBadgeColor(memory.type)}`}>
                {memory.type}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-px bg-gradient-to-r from-cyan-500/30 to-transparent" />
                  <span className="text-xs text-gray-500 monospace">{(memory.importance * 100).toFixed(0)}%</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium monospace uppercase ${
                    memory.privacy === 'private' ? 'bg-red-500/20 text-red-400' :
                    memory.privacy === 'ephemeral' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {memory.privacy}
                  </span>
                </div>

                {/* Memory text - expandable */}
                <p 
                  className={`text-xs text-gray-300 leading-relaxed cursor-pointer monospace ${
                    expandedId === memory.id ? '' : 'line-clamp-2'
                  }`}
                  onClick={() => setExpandedId(expandedId === memory.id ? null : memory.id)}
                >
                  {memory.text}
                </p>

                {memory.text.length > 150 && (
                  <button
                    onClick={() => setExpandedId(expandedId === memory.id ? null : memory.id)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 mt-1 monospace"
                  >
                    {expandedId === memory.id ? '▼ SHOW LESS' : '▶ SHOW MORE'}
                  </button>
                )}

                <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500 monospace">
                  <span>ID: {memory.id}</span>
                  <span>•</span>
                  <span>{new Date(memory.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Delete button - appears on hover or selection */}
              <button
                onClick={() => deleteMemory(memory.id)}
                disabled={isDeleting}
                className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center transition-all ${
                  selectedIds.has(memory.id) || 'opacity-0 group-hover:opacity-100'
                } bg-black/60 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500 disabled:opacity-50`}
                title="Delete memory"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
