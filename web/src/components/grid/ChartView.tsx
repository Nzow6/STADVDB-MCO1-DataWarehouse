import React, { useState } from 'react';
import { BarChart3, Layers } from 'lucide-react';
import { QueryResult } from '../../types/olap';

interface ChartViewProps {
  result: QueryResult | null;
}

type ChartType = 'bar' | 'horizontal_bar';

export const ChartView: React.FC<ChartViewProps> = ({ result }) => {
  const [chartType, setChartType] = useState<ChartType>('bar');

  if (!result || !result.rows || result.rows.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 font-mono text-xs select-none bg-white">
        <BarChart3 className="w-8 h-8 text-slate-300 mb-2" />
        <span>No analytical data available to visualize</span>
      </div>
    );
  }

  const columns = result.columns;
  const rows = result.rows.slice(0, 30); // Top 30 items for clean chart density

  // Detect dimension column (categorical string/date) and measure column (numeric)
  const dimCol = columns.find((c) => ['VARCHAR', 'TIMESTAMP', 'TIME'].includes(c.type)) || columns[0];
  const numCols = columns.filter((c) => ['INTEGER', 'NUMERIC', 'DOUBLE'].includes(c.type));
  const primaryMeasureCol =
    numCols.find((c) => !c.name.toLowerCase().includes('rank') && !c.name.toLowerCase().includes('id')) ||
    numCols[0];

  if (!primaryMeasureCol || !dimCol) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 font-mono text-xs bg-white">
        <span>Need at least one dimension and one numeric metric to plot visualization</span>
      </div>
    );
  }

  const maxVal = Math.max(...rows.map((r) => Number(r[primaryMeasureCol.name]) || 0), 1);

  return (
    <div className="flex-1 flex flex-col bg-white p-3 select-none overflow-hidden">
      {/* Chart Control Toolbar */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider font-mono">
            Analytical Visualization:
          </span>
          <span className="text-emerald-700 font-mono text-[11px] font-semibold">
            {dimCol.name} vs. {primaryMeasureCol.name}
          </span>
        </div>

        <div className="flex items-center bg-slate-100 border border-slate-200 rounded p-0.5">
          <button
            onClick={() => setChartType('bar')}
            className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono transition ${
              chartType === 'bar'
                ? 'bg-emerald-700 text-white font-medium shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3 h-3" />
            <span>Vertical</span>
          </button>
          <button
            onClick={() => setChartType('horizontal_bar')}
            className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono transition ${
              chartType === 'horizontal_bar'
                ? 'bg-emerald-700 text-white font-medium shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Horizontal</span>
          </button>
        </div>
      </div>

      {/* Chart Content Area */}
      <div className="flex-1 overflow-y-auto pr-2">
        {chartType === 'horizontal_bar' ? (
          /* Horizontal Bar Chart */
          <div className="space-y-2 py-1">
            {rows.map((row, idx) => {
              const label = String(row[dimCol.name] ?? 'NULL');
              const val = Number(row[primaryMeasureCol.name]) || 0;
              const pct = Math.min(100, Math.max(2, (val / maxVal) * 100));

              return (
                <div key={idx} className="group flex items-center gap-3 text-xs">
                  <div className="w-40 font-mono text-slate-700 truncate text-right text-[11px]">
                    {label}
                  </div>
                  <div className="flex-1 bg-slate-100 rounded h-6 relative overflow-hidden flex items-center border border-slate-200">
                    <div
                      style={{ width: `${pct}%` }}
                      className="bg-emerald-600 h-full rounded transition-all duration-300 group-hover:bg-emerald-500"
                    />
                    <span className="absolute left-2 text-[10px] font-mono font-semibold text-slate-800 tabular-nums">
                      {val.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Vertical Column Bar Chart */
          <div className="h-full flex flex-col justify-end pb-6 pt-2">
            <div className="flex-1 flex items-end gap-2 px-4 pb-2 border-b border-slate-200">
              {rows.map((row, idx) => {
                const label = String(row[dimCol.name] ?? 'NULL');
                const val = Number(row[primaryMeasureCol.name]) || 0;
                const pct = Math.min(100, Math.max(4, (val / maxVal) * 100));

                return (
                  <div
                    key={idx}
                    className="group flex-1 flex flex-col items-center justify-end h-full min-w-[28px]"
                  >
                    <span className="text-[9px] font-mono text-slate-600 mb-1 opacity-0 group-hover:opacity-100 transition-opacity tabular-nums whitespace-nowrap">
                      {val.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </span>
                    <div
                      style={{ height: `${pct}%` }}
                      className="w-full bg-emerald-600 group-hover:bg-emerald-500 rounded-t transition-all duration-300"
                    />
                    <span className="text-[9px] font-mono text-slate-600 mt-2 rotate-45 origin-left truncate w-14 block">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
