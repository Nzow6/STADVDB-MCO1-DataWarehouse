import React from 'react';
import { Plus, Hash, Type, Filter } from 'lucide-react';
import { VisualBuilderState } from '../../engine/olapCompiler';
import { MeasureAggregation, DateGranularity, QueryFilter } from '../../types/olap';
import { MetricChip } from './MetricChip';
import { DimensionChip } from './DimensionChip';
import { FilterRow } from './FilterRow';

interface VisualBuilderProps {
  state: VisualBuilderState;
  onRemoveMeasure: (id: string) => void;
  onUpdateMeasureAggregation: (id: string, agg: MeasureAggregation) => void;
  onRemoveDimension: (id: string) => void;
  onUpdateDimensionGranularity: (id: string, gran: DateGranularity) => void;
  onRemoveFilter: (id: string) => void;
  onUpdateFilter: (id: string, updates: Partial<QueryFilter>) => void;
  onAddFilter: (filter: Omit<QueryFilter, 'id'>) => void;
}

export const VisualBuilder: React.FC<VisualBuilderProps> = ({
  state,
  onRemoveMeasure,
  onUpdateMeasureAggregation,
  onRemoveDimension,
  onUpdateDimensionGranularity,
  onRemoveFilter,
  onUpdateFilter,
  onAddFilter,
}) => {
  const handleAddNewFilter = () => {
    onAddFilter({
      fieldId: 'l_borough',
      tableName: 'dim_location',
      fieldName: 'borough',
      operator: '=',
      value: 'Manhattan',
    });
  };

  return (
    <div className="bg-slate-50 border-b border-slate-200 p-2.5 space-y-2 select-none text-xs">
      {/* Metrics / Measures Zone */}
      <div className="flex items-start gap-2">
        <div className="w-24 flex items-center gap-1.5 pt-1 text-[11px] font-semibold text-slate-700 uppercase tracking-wider flex-shrink-0">
          <Hash className="w-3.5 h-3.5 text-emerald-700" />
          <span>Metrics</span>
        </div>

        <div className="flex-1 flex flex-wrap items-center gap-1.5 min-h-[30px] p-1 rounded bg-white border border-slate-300">
          {state.measures.length === 0 ? (
            <span className="text-slate-400 font-mono text-[11px] px-1 italic">
              Click any numerical field on the left schema navigator to add measure
            </span>
          ) : (
            state.measures.map((m) => (
              <MetricChip
                key={m.id}
                measure={m}
                onRemove={onRemoveMeasure}
                onUpdateAggregation={onUpdateMeasureAggregation}
              />
            ))
          )}
        </div>
      </div>

      {/* Dimensions / Breakdowns Zone */}
      <div className="flex items-start gap-2">
        <div className="w-24 flex items-center gap-1.5 pt-1 text-[11px] font-semibold text-slate-700 uppercase tracking-wider flex-shrink-0">
          <Type className="w-3.5 h-3.5 text-slate-600" />
          <span>Dimensions</span>
        </div>

        <div className="flex-1 flex flex-wrap items-center gap-1.5 min-h-[30px] p-1 rounded bg-white border border-slate-300">
          {state.dimensions.length === 0 ? (
            <span className="text-slate-400 font-mono text-[11px] px-1 italic">
              Click any dimension field on the left schema navigator to add breakdown
            </span>
          ) : (
            state.dimensions.map((d) => (
              <DimensionChip
                key={d.id}
                dimension={d}
                onRemove={onRemoveDimension}
                onUpdateGranularity={onUpdateDimensionGranularity}
              />
            ))
          )}
        </div>
      </div>

      {/* Filters Zone */}
      <div className="flex items-start gap-2">
        <div className="w-24 flex items-center justify-between pt-1 text-[11px] font-semibold text-slate-700 uppercase tracking-wider flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-600" />
            <span>Filters</span>
          </div>
          <button
            onClick={handleAddNewFilter}
            className="p-0.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-200"
            title="Add filter predicate"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <div className="flex-1 space-y-1">
          {state.filters.length === 0 ? (
            <div className="flex items-center justify-between px-2 py-1 rounded bg-white border border-dashed border-slate-300 text-slate-400 font-mono text-[11px]">
              <span>No active query predicates</span>
              <button
                onClick={handleAddNewFilter}
                className="text-emerald-700 hover:text-emerald-800 font-medium flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Filter
              </button>
            </div>
          ) : (
            state.filters.map((f) => (
              <FilterRow
                key={f.id}
                filter={f}
                onRemove={onRemoveFilter}
                onUpdate={onUpdateFilter}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
