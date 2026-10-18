import React, { useState } from 'react';
import { X, ChevronDown, Hash } from 'lucide-react';
import { MeasureAggregation, SelectedMeasure } from '../../types/olap';

interface MetricChipProps {
  measure: SelectedMeasure;
  onRemove: (id: string) => void;
  onUpdateAggregation: (id: string, agg: MeasureAggregation) => void;
}

const AGG_OPTIONS: MeasureAggregation[] = ['SUM', 'AVG', 'COUNT', 'COUNT_DISTINCT', 'MIN', 'MAX'];

export const MetricChip: React.FC<MetricChipProps> = ({
  measure,
  onRemove,
  onUpdateAggregation,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div className="relative inline-flex items-center gap-1 bg-emerald-50 border border-emerald-300 rounded px-2 py-1 text-xs select-none">
      <Hash className="w-3 h-3 text-emerald-700 flex-shrink-0" />

      {/* Aggregation Selector Dropdown */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-0.5 font-mono text-[10px] font-bold px-1 py-0.5 rounded bg-emerald-700 text-white hover:bg-emerald-800 transition"
        >
          <span>{measure.aggregation}</span>
          <ChevronDown className="w-2.5 h-2.5" />
        </button>

        {dropdownOpen && (
          <div
            className="absolute left-0 mt-1 w-32 rounded bg-white border border-slate-200 shadow-lg py-1 z-50 text-[11px]"
            onMouseLeave={() => setDropdownOpen(false)}
          >
            {AGG_OPTIONS.map((agg) => (
              <button
                key={agg}
                onClick={() => {
                  onUpdateAggregation(measure.id, agg);
                  setDropdownOpen(false);
                }}
                className={`w-full text-left px-2 py-1 font-mono hover:bg-emerald-50 ${
                  measure.aggregation === agg ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-800'
                }`}
              >
                {agg}
              </button>
            ))}
          </div>
        )}
      </div>

      <span className="text-[11px] text-slate-900 font-medium">
        {measure.fieldName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
      </span>

      <button
        onClick={() => onRemove(measure.id)}
        className="p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition ml-1"
        title="Remove Metric"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};
