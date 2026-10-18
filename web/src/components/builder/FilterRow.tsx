import React from 'react';
import { X, Filter } from 'lucide-react';
import { FilterOperator, QueryFilter } from '../../types/olap';

interface FilterRowProps {
  filter: QueryFilter;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<QueryFilter>) => void;
}

const OPERATORS: FilterOperator[] = ['=', '!=', '>', '<', '>=', '<=', 'IN', 'BETWEEN', 'LIKE'];

export const FilterRow: React.FC<FilterRowProps> = ({
  filter,
  onRemove,
  onUpdate,
}) => {
  return (
    <div className="flex items-center gap-2 p-1.5 rounded bg-slate-50 border border-slate-200 text-xs">
      <Filter className="w-3 h-3 text-emerald-700 flex-shrink-0" />

      {/* Field Name */}
      <span className="text-[11px] text-slate-900 font-medium px-1.5 py-0.5 rounded bg-white border border-slate-300">
        {filter.fieldName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
      </span>

      {/* Operator Dropdown */}
      <select
        value={filter.operator}
        onChange={(e) => onUpdate(filter.id, { operator: e.target.value as FilterOperator })}
        className="bg-white text-emerald-800 font-mono text-[11px] rounded px-1.5 py-0.5 border border-slate-300 focus:outline-none focus:border-emerald-600 font-semibold"
      >
        {OPERATORS.map((op) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
      </select>

      {/* Value Input */}
      <input
        type="text"
        value={filter.value}
        onChange={(e) => onUpdate(filter.id, { value: e.target.value })}
        placeholder={filter.operator === 'IN' ? 'val1, val2, ...' : 'Filter value'}
        className="flex-1 bg-white text-slate-900 font-mono text-[11px] px-2 py-0.5 rounded border border-slate-300 focus:outline-none focus:border-emerald-600"
      />

      {/* Value To (for BETWEEN) */}
      {filter.operator === 'BETWEEN' && (
        <>
          <span className="text-[10px] text-slate-500 uppercase font-mono">and</span>
          <input
            type="text"
            value={filter.valueTo || ''}
            onChange={(e) => onUpdate(filter.id, { valueTo: e.target.value })}
            placeholder="Upper bound"
            className="flex-1 bg-white text-slate-900 font-mono text-[11px] px-2 py-0.5 rounded border border-slate-300 focus:outline-none focus:border-emerald-600"
          />
        </>
      )}

      {/* Remove Button */}
      <button
        onClick={() => onRemove(filter.id)}
        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
        title="Remove filter"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};
