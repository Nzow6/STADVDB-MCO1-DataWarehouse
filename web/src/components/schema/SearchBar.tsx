import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  matchCount?: number;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search fields, measures...',
  matchCount,
}) => {
  return (
    <div className="relative flex items-center px-2 py-1.5 border-b border-slate-200 bg-white">
      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-6 pr-6 py-1 bg-slate-50 text-slate-900 placeholder-slate-400 text-[11px] rounded border border-slate-300 focus:outline-none focus:border-emerald-600 transition"
      />
      {value ? (
        <button
          onClick={() => onChange('')}
          className="absolute right-3.5 p-0.5 text-slate-400 hover:text-slate-600"
          title="Clear search"
        >
          <X className="w-3 h-3" />
        </button>
      ) : matchCount !== undefined ? (
        <span className="absolute right-3.5 text-[10px] font-mono text-slate-400">
          {matchCount}
        </span>
      ) : null}
    </div>
  );
};
