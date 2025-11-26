import { useState } from 'react';
import { useStore } from '../../state/store';
import { 
  Star, 
  Filter, 
  SortAsc, 
  SortDesc, 
  FileText, 
  Code, 
  Calendar,
  X,
  ChevronDown,
  Tag
} from 'lucide-react';

export default function DocumentFilterBar() {
  const { collaborateState, setCollaborateFilters } = useStore();
  const { filters, allTags } = collaborateState;
  
  const [showFilters, setShowFilters] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  const hasActiveFilters = 
    filters.showFavoritesOnly || 
    filters.contentType !== 'all' || 
    filters.dateRange !== 'all' || 
    filters.tags.length > 0;

  const clearAllFilters = () => {
    setCollaborateFilters({
      tags: [],
      contentType: 'all',
      dateRange: 'all',
      showFavoritesOnly: false,
      folderId: null
    });
  };

  const toggleTag = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag];
    setCollaborateFilters({ tags: newTags });
  };

  const toggleSort = () => {
    setCollaborateFilters({ 
      sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' 
    });
  };

  return (
    <div className="border-b-2 border-white/20">
      {/* Main filter bar */}
      <div className="px-4 py-2 flex items-center gap-2">
        {/* Favorites toggle */}
        <button
          onClick={() => setCollaborateFilters({ showFavoritesOnly: !filters.showFavoritesOnly })}
          className={`p-1.5 border transition-colors ${
            filters.showFavoritesOnly
              ? 'bg-orange/20 border-orange text-orange'
              : 'border-white/20 text-terminal-500 hover:border-white/30 hover:text-terminal-300'
          }`}
          title="Show favorites only"
        >
          <Star className="w-3.5 h-3.5" fill={filters.showFavoritesOnly ? 'currentColor' : 'none'} />
        </button>

        {/* Filter dropdown toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-1.5 border transition-colors flex items-center gap-1 ${
            hasActiveFilters
              ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
              : 'border-white/20 text-terminal-500 hover:border-white/30 hover:text-terminal-300'
          }`}
          title="Filter options"
        >
          <Filter className="w-3.5 h-3.5" />
          {hasActiveFilters && (
            <span className="text-[10px] font-mono font-bold">
              {(filters.showFavoritesOnly ? 1 : 0) + 
               (filters.contentType !== 'all' ? 1 : 0) + 
               (filters.dateRange !== 'all' ? 1 : 0) + 
               filters.tags.length}
            </span>
          )}
        </button>

        {/* Sort options */}
        <div className="flex items-center gap-1 ml-auto">
          <select
            value={filters.sortBy}
            onChange={(e) => setCollaborateFilters({ sortBy: e.target.value as any })}
            className="px-2 py-1 bg-terminal-black border border-white/20 hover:border-white/30 
                     text-terminal-300 text-xs font-mono focus:outline-none focus:border-orange 
                     transition-colors cursor-pointer"
          >
            <option value="modified">Modified</option>
            <option value="created">Created</option>
            <option value="name">Name</option>
            <option value="type">Type</option>
          </select>
          
          <button
            onClick={toggleSort}
            className="p-1.5 border border-white/20 text-terminal-500 hover:border-white/30 
                     hover:text-terminal-300 transition-colors"
            title={filters.sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          >
            {filters.sortOrder === 'asc' ? (
              <SortAsc className="w-3.5 h-3.5" />
            ) : (
              <SortDesc className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded filters panel */}
      {showFilters && (
        <div className="px-4 py-3 border-t border-white/10 space-y-3 animate-fade-in-down">
          {/* Content Type Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-terminal-500 font-mono w-16">Type:</span>
            <div className="flex gap-1">
              {(['all', 'text', 'code', 'mixed'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setCollaborateFilters({ contentType: type })}
                  className={`px-2 py-1 text-xs font-mono border transition-colors flex items-center gap-1 ${
                    filters.contentType === type
                      ? 'bg-orange/20 border-orange text-orange'
                      : 'border-white/20 text-terminal-400 hover:border-white/30 hover:text-terminal-300'
                  }`}
                >
                  {type === 'text' && <FileText className="w-3 h-3" />}
                  {type === 'code' && <Code className="w-3 h-3" />}
                  {type === 'mixed' && <><FileText className="w-3 h-3" /><Code className="w-3 h-3" /></>}
                  <span className="capitalize">{type}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-terminal-500 font-mono w-16">Date:</span>
            <div className="flex gap-1">
              {([
                { value: 'all', label: 'All Time' },
                { value: 'today', label: 'Today' },
                { value: 'week', label: 'This Week' },
                { value: 'month', label: 'This Month' }
              ] as const).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setCollaborateFilters({ dateRange: value })}
                  className={`px-2 py-1 text-xs font-mono border transition-colors flex items-center gap-1 ${
                    filters.dateRange === value
                      ? 'bg-orange/20 border-orange text-orange'
                      : 'border-white/20 text-terminal-400 hover:border-white/30 hover:text-terminal-300'
                  }`}
                >
                  <Calendar className="w-3 h-3" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tags Filter */}
          <div className="flex items-start gap-2">
            <span className="text-xs text-terminal-500 font-mono w-16 pt-1">Tags:</span>
            <div className="flex-1">
              <div className="relative">
                <button
                  onClick={() => setShowTagDropdown(!showTagDropdown)}
                  className="px-2 py-1 text-xs font-mono border border-white/20 text-terminal-400 
                           hover:border-white/30 hover:text-terminal-300 transition-colors 
                           flex items-center gap-1"
                >
                  <Tag className="w-3 h-3" />
                  <span>Select Tags</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${showTagDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showTagDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-terminal-black border-2 border-white/20 
                                z-50 max-h-40 overflow-y-auto terminal-scrollbar">
                    {allTags.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-terminal-500">No tags yet</div>
                    ) : (
                      allTags.map(tag => (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className={`w-full px-3 py-1.5 text-left text-xs font-mono transition-colors flex items-center gap-2 ${
                            filters.tags.includes(tag)
                              ? 'bg-orange/20 text-orange'
                              : 'text-terminal-300 hover:bg-terminal-800'
                          }`}
                        >
                          <div className={`w-3 h-3 border ${
                            filters.tags.includes(tag) 
                              ? 'bg-orange border-orange' 
                              : 'border-white/30'
                          }`}>
                            {filters.tags.includes(tag) && (
                              <span className="text-[8px] text-black font-bold flex items-center justify-center">✓</span>
                            )}
                          </div>
                          {tag}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Selected tags */}
              {filters.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {filters.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-orange/20 border border-orange text-orange text-[10px] 
                               font-mono flex items-center gap-1"
                    >
                      {tag}
                      <button
                        onClick={() => toggleTag(tag)}
                        className="hover:text-white transition-colors"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Clear filters button */}
          {hasActiveFilters && (
            <div className="pt-2 border-t border-white/10">
              <button
                onClick={clearAllFilters}
                className="text-xs text-terminal-500 hover:text-terminal-300 transition-colors 
                         flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
