import React, { useState, useMemo } from 'react';
import { BarChart3, Layers, SlidersHorizontal, ArrowDownWideNarrow } from 'lucide-react';
import { QueryResult } from '../../types/olap';

interface ChartViewProps {
  result: QueryResult | null;
}

type ChartType = 'bar' | 'horizontal_bar';

export const ChartView: React.FC<ChartViewProps> = ({ result }) => {
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [selectedMeasureCol, setSelectedMeasureCol] = useState<string>('');
  const [useDynamicScale, setUseDynamicScale] = useState<boolean>(true);
  const [sortByValue, setSortByValue] = useState<boolean>(false);

  if (!result || !result.rows || result.rows.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 font-mono text-xs select-none bg-white">
        <BarChart3 className="w-8 h-8 text-slate-300 mb-2" />
        <span>No analytical data available to visualize</span>
      </div>
    );
  }

  const columns = result.columns;
  const numCols = columns.filter((c) => ['INTEGER', 'NUMERIC', 'DOUBLE'].includes(c.type));
  const dimCol = columns.find((c) => ['VARCHAR', 'TIMESTAMP', 'TIME'].includes(c.type)) || columns[0];

  // Default primary measure
  const defaultMeasure =
    numCols.find((c) => !c.name.toLowerCase().includes('rank') && !c.name.toLowerCase().includes('id')) ||
    numCols[0];

  const activeMeasureName = selectedMeasureCol && numCols.some((c) => c.name === selectedMeasureCol)
    ? selectedMeasureCol
    : defaultMeasure?.name || '';

  const activeMeasure = numCols.find((c) => c.name === activeMeasureName) || defaultMeasure;

  if (!activeMeasure || !dimCol) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 font-mono text-xs bg-white">
        <span>Need at least one dimension and one numeric metric to plot visualization</span>
      </div>
    );
  }

  // Format value according to measure semantics
  const formatVal = (val: number, colName: string) => {
    const isRate = /rate|ratio|pct|percent/i.test(colName);
    if (isRate) {
      return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    }
    const isCurrency = /revenue|cost|fare|amount|tip|earning|surcharge|tolls|fee|tax|price/i.test(colName);
    if (isCurrency) {
      return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (Number.isInteger(val)) {
      return val.toLocaleString();
    }
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Process rows
  const rawRows = result.rows.slice(0, 30);
  const processedRows = useMemo(() => {
    const mapped = rawRows.map((r, idx) => ({
      key: idx,
      label: String(r[dimCol.name] ?? 'NULL'),
      val: Number(r[activeMeasure.name]) || 0,
      rawRow: r,
    }));

    if (sortByValue) {
      return [...mapped].sort((a, b) => b.val - a.val);
    }
    return mapped;
  }, [rawRows, dimCol.name, activeMeasure.name, sortByValue]);

  // Compute scale boundaries
  const values = processedRows.map((r) => r.val);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values);

  // If values are clustered, dynamic baseline highlights differences dramatically
  const isClustered = minVal > 0 && minVal / maxVal > 0.35 && maxVal - minVal > 0;
  const baselineFloor = useDynamicScale && isClustered
    ? Math.max(0, minVal - (maxVal - minVal) * 0.25)
    : 0;

  const effectiveRange = maxVal - baselineFloor || 1;

  // Max value reaches 92% of available bar container height/width
  const computePct = (val: number) => {
    const ratio = Math.max(0, val - baselineFloor) / effectiveRange;
    return Math.min(94, Math.max(6, ratio * 92));
  };

  return (
    <div className="flex-1 flex flex-col bg-white p-3 select-none overflow-hidden h-full">
      {/* Chart Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-200 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider font-mono">
            Metric:
          </span>
          <select
            value={activeMeasure.name}
            onChange={(e) => setSelectedMeasureCol(e.target.value)}
            className="text-[11px] font-mono bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-800 font-semibold focus:outline-none focus:border-emerald-600"
          >
            {numCols.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="text-slate-400 font-mono text-[11px]">by</span>
          <span className="text-slate-700 font-mono text-[11px] font-semibold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
            {dimCol.name}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Contrast / Scale Toggle */}
          <button
            onClick={() => setUseDynamicScale(!useDynamicScale)}
            title={useDynamicScale ? 'Using dynamic baseline to highlight differences' : 'Using zero-baseline scale'}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border transition ${
              useDynamicScale
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-medium'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-2.5 h-2.5" />
            <span>{useDynamicScale ? 'High Contrast' : 'Zero Baseline'}</span>
          </button>

          {/* Sort Toggle */}
          <button
            onClick={() => setSortByValue(!sortByValue)}
            title="Sort bars descending by metric value"
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border transition ${
              sortByValue
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-medium'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <ArrowDownWideNarrow className="w-2.5 h-2.5" />
            <span>Sort Max</span>
          </button>

          {/* Orientation Toggle */}
          <div className="flex items-center bg-slate-100 border border-slate-200 rounded p-0.5">
            <button
              onClick={() => setChartType('bar')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition ${
                chartType === 'bar'
                  ? 'bg-emerald-700 text-white font-medium shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-2.5 h-2.5" />
              <span>Vertical</span>
            </button>
            <button
              onClick={() => setChartType('horizontal_bar')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition ${
                chartType === 'horizontal_bar'
                  ? 'bg-emerald-700 text-white font-medium shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-2.5 h-2.5" />
              <span>Horizontal</span>
            </button>
          </div>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {chartType === 'horizontal_bar' ? (
          /* Horizontal Bar Chart */
          <div className="flex-1 overflow-y-auto pr-2 space-y-1.5 py-1">
            {processedRows.map((row) => {
              const pct = computePct(row.val);
              const isMax = row.val === maxVal;

              return (
                <div key={row.key} className="group flex items-center gap-2 text-xs">
                  <div className="w-44 font-mono text-slate-700 truncate text-right text-[11px] flex-shrink-0" title={row.label}>
                    {row.label}
                  </div>
                  <div className="flex-1 bg-slate-100 rounded h-7 relative overflow-hidden flex items-center border border-slate-200">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full rounded transition-all duration-300 ${
                        isMax
                          ? 'bg-emerald-700 group-hover:bg-emerald-600'
                          : 'bg-emerald-600 group-hover:bg-emerald-500'
                      }`}
                    />
                    <div className="absolute left-2.5 flex items-center gap-1.5 font-mono text-[11px] tabular-nums">
                      <span className={`font-semibold ${pct > 40 ? 'text-white' : 'text-slate-900'}`}>
                        {formatVal(row.val, activeMeasure.name)}
                      </span>
                      {isMax && (
                        <span className="text-[9px] uppercase tracking-wider bg-emerald-800 text-white px-1 rounded font-bold">
                          MAX
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Vertical Column Bar Chart */
          <div className="flex-1 flex flex-col h-full min-h-0 justify-between">
            {/* Plot Frame */}
            <div className="flex-1 relative flex items-end gap-2 px-4 pt-6 pb-1 border-b border-slate-300 min-h-0">
              {/* Background Grid Lines & Scale Reference */}
              <div className="absolute inset-0 pointer-events-none flex flex-col justify-between pt-6 pb-1 px-2 select-none">
                <div className="border-b border-dashed border-slate-200 w-full flex items-center justify-between text-[9px] font-mono text-slate-400">
                  <span>MAX: {formatVal(maxVal, activeMeasure.name)}</span>
                  <span>100%</span>
                </div>
                <div className="border-b border-dashed border-slate-100 w-full flex items-center justify-between text-[9px] font-mono text-slate-300">
                  <span>75%</span>
                </div>
                <div className="border-b border-dashed border-slate-100 w-full flex items-center justify-between text-[9px] font-mono text-slate-300">
                  <span>50%</span>
                </div>
                <div className="border-b border-dashed border-slate-100 w-full flex items-center justify-between text-[9px] font-mono text-slate-300">
                  <span>{baselineFloor > 0 ? `BASE: ${formatVal(baselineFloor, activeMeasure.name)}` : '25%'}</span>
                </div>
              </div>

              {/* Individual Vertical Columns */}
              {processedRows.map((row) => {
                const pct = computePct(row.val);
                const isMax = row.val === maxVal;

                return (
                  <div
                    key={row.key}
                    className="group flex-1 flex flex-col items-center justify-end h-full min-w-[28px] max-w-[80px] z-10"
                  >
                    {/* Value Badge placed directly above the bar */}
                    <span
                      className={`text-[10px] font-mono mb-1 tabular-nums whitespace-nowrap transition-opacity ${
                        isMax
                          ? 'font-bold text-emerald-800 opacity-100'
                          : 'font-semibold text-slate-700 opacity-80 group-hover:opacity-100'
                      }`}
                    >
                      {formatVal(row.val, activeMeasure.name)}
                    </span>

                    {/* Column Bar with max near the top */}
                    <div
                      style={{ height: `${pct}%` }}
                      className={`w-full rounded-t transition-all duration-300 shadow-2xs ${
                        isMax
                          ? 'bg-emerald-700 group-hover:bg-emerald-600 ring-1 ring-emerald-800'
                          : 'bg-emerald-600 group-hover:bg-emerald-500'
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Dedicated X-Axis Labels Row (Independent of bar heights) */}
            <div className="h-9 flex items-center gap-2 px-4 pt-1.5 select-none overflow-hidden flex-shrink-0">
              {processedRows.map((row) => (
                <div key={row.key} className="flex-1 min-w-[28px] max-w-[80px] text-center truncate">
                  <span
                    className="text-[10px] font-mono font-medium text-slate-700 truncate block hover:text-slate-900"
                    title={row.label}
                  >
                    {row.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

