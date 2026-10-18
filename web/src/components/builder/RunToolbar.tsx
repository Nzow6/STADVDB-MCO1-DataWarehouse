import React from 'react';
import { Play, Table, Database } from 'lucide-react';
import { QueryResult } from '../../types/olap';

interface RunToolbarProps {
  onRunQuery: () => void;
  loading: boolean;
  result: QueryResult | null;
  limit: number | 'ALL';
  onLimitChange: (limit: number | 'ALL') => void;
  autoRun: boolean;
  onToggleAutoRun: () => void;
  rollupEnabled?: boolean;
  onToggleRollup?: () => void;
}

export const RunToolbar: React.FC<RunToolbarProps> = ({
  onRunQuery,
  loading,
  result,
  limit,
  onLimitChange,
  autoRun,
  onToggleAutoRun,
  rollupEnabled,
  onToggleRollup,
}) => {
  const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  return (
    <div className="h-10 bg-white border-b border-slate-200 px-3 flex items-center justify-between text-xs select-none">
      {/* Left: Run button & Limit */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRunQuery}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-900/50 text-white font-medium text-xs shadow-xs transition active:scale-95 cursor-pointer"
          title={`Execute query (${isMac ? '⌘' : 'Ctrl'} + Enter)`}
        >
          {loading ? (
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          <span>Run Query</span>
          <span className="text-[10px] font-mono text-emerald-100 bg-emerald-800/80 px-1 rounded ml-1">
            {isMac ? '⌘↵' : 'Ctrl↵'}
          </span>
        </button>

        <div className="h-4 w-px bg-slate-200 mx-1" />

        {/* Limit Selector */}
        <div className="flex items-center gap-1 text-slate-600 font-mono text-[11px]">
          <span>Limit:</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
            className="bg-white text-slate-800 border border-slate-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-emerald-600 font-medium"
          >
            <option value="ALL">All (Default)</option>
            <option value={100}>100</option>
            <option value={1000}>1,000</option>
            <option value={5000}>5,000</option>
          </select>
        </div>

        {/* Rollup Toggle (if visual mode) */}
        {onToggleRollup && (
          <button
            onClick={onToggleRollup}
            className={`px-2 py-0.5 rounded text-[11px] font-medium border transition ${
              rollupEnabled
                ? 'bg-emerald-50 text-emerald-900 border-emerald-600 font-semibold'
                : 'bg-white text-slate-600 border-slate-300 hover:text-slate-900'
            }`}
            title="Toggle hierarchical subtotal rows"
          >
            Hierarchical Rollup {rollupEnabled && '✓'}
          </button>
        )}

        {/* Auto Run Checkbox */}
        <label className="flex items-center gap-1.5 cursor-pointer ml-1 text-slate-600 hover:text-slate-900">
          <input
            type="checkbox"
            checked={autoRun}
            onChange={onToggleAutoRun}
            className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-0"
          />
          <span className="text-[11px]">Auto-run</span>
        </label>
      </div>

      {/* Right: Execution Statistics Badges (Row count and Engine only - ms removed) */}
      <div className="flex items-center gap-2">
        {result ? (
          <>
            {/* Row Count */}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[11px] text-slate-700">
              <Table className="w-3 h-3 text-slate-500" />
              <span>{result.rowCount.toLocaleString()} rows</span>
            </div>

            {/* Source Engine */}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 font-mono text-[11px] text-emerald-800 font-medium">
              <Database className="w-3 h-3 text-emerald-700" />
              <span>{result.sourceEngine}</span>
            </div>
          </>
        ) : (
          <span className="text-slate-400 font-mono text-[11px]">
            No query executed yet
          </span>
        )}
      </div>
    </div>
  );
};
