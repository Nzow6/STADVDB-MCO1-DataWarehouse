import React, { useState } from 'react';
import { X, ChevronDown, Type, Calendar } from 'lucide-react';
import { DateGranularity, SelectedDimension } from '../../types/olap';

interface DimensionChipProps {
  dimension: SelectedDimension;
  onRemove: (id: string) => void;
  onUpdateGranularity: (id: string, gran: DateGranularity) => void;
}

const GRANULARITY_OPTIONS: { val: DateGranularity; label: string }[] = [
  { val: 'raw', label: 'Raw Value' },
  { val: 'day', label: 'Day' },
  { val: 'week', label: 'Week' },
  { val: 'month', label: 'Month' },
  { val: 'quarter', label: 'Quarter' },
  { val: 'year', label: 'Year' },
];

export const DimensionChip: React.FC<DimensionChipProps> = ({
  dimension,
  onRemove,
  onUpdateGranularity,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const isTemporal = dimension.fieldName.includes('date') || dimension.fieldName.includes('time');

  return (
    <div className="relative inline-flex items-center gap-1 bg-slate-100 border border-slate-300 rounded px-2 py-1 text-xs select-none">
      {isTemporal ? (
        <Calendar className="w-3 h-3 text-slate-600 flex-shrink-0" />
      ) : (
        <Type className="w-3 h-3 text-slate-600 flex-shrink-0" />
      )}

      {/* Date Granularity Selector (if temporal) */}
      {isTemporal && (
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-0.5 font-mono text-[10px] font-bold px-1 py-0.5 rounded bg-slate-700 text-white hover:bg-slate-800 transition uppercase"
          >
            <span>{dimension.granularity || 'raw'}</span>
            <ChevronDown className="w-2.5 h-2.5" />
          </button>

          {dropdownOpen && (
            <div
              className="absolute left-0 mt-1 w-28 rounded bg-white border border-slate-200 shadow-lg py-1 z-50 text-[11px]"
              onMouseLeave={() => setDropdownOpen(false)}
            >
              {GRANULARITY_OPTIONS.map((g) => (
                <button
                  key={g.val}
                  onClick={() => {
                    onUpdateGranularity(dimension.id, g.val);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left px-2 py-1 font-mono hover:bg-slate-100 ${
                    dimension.granularity === g.val ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-800'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <span className="text-[11px] text-slate-900 font-medium">
        {dimension.fieldName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
      </span>

      <button
        onClick={() => onRemove(dimension.id)}
        className="p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition ml-1"
        title="Remove Dimension"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};
