import React from 'react';
import { SlidersHorizontal, MapPin, Clock, Layers, Calendar, Filter } from 'lucide-react';
import { DAY_BRACKETS, NYC_BOROUGHS } from '../../engine/schemaData';
import { DynamicReportParams } from '../../types/olap';

interface DynamicReportControlsProps {
  reportId: string;
  params: DynamicReportParams;
  onChange: (updates: Partial<DynamicReportParams>) => void;
}

export const DynamicReportControls: React.FC<DynamicReportControlsProps> = ({
  reportId,
  params,
  onChange,
}) => {
  const toggleArrayItem = <T,>(arr: T[], item: T): T[] => {
    if (arr.includes(item)) {
      return arr.filter((x) => x !== item);
    } else {
      return [...arr, item];
    }
  };

  return (
    <div className="bg-slate-50 border-b border-slate-200 p-2.5 text-xs select-none">
      <div className="flex items-center gap-2 mb-2 pb-1 border-b border-slate-200">
        <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-700" />
        <span className="font-semibold text-slate-800 tracking-wider text-[11px] uppercase">
          Query Parameters
        </span>
        <span className="text-[10px] text-slate-500">
          (Interactive Report Controls)
        </span>
      </div>

      {/* Report 1: Karl's SLICE Controls */}
      {reportId === 'report_1' && (
        <div>
          <label className="block text-[11px] font-mono text-slate-600 mb-1 flex items-center gap-1">
            <Clock className="w-3 h-3 text-emerald-600" />
            <span>Day Bracket Filter (Slice)</span>
          </label>
          <select
            value={params.dayBracket}
            onChange={(e) => onChange({ dayBracket: e.target.value })}
            className="w-full bg-white text-slate-900 font-mono text-xs rounded border border-slate-300 px-2.5 py-1 focus:outline-none focus:border-emerald-600"
          >
            {DAY_BRACKETS.map((bracket) => (
              <option key={bracket} value={bracket}>
                {bracket} {bracket === 'Evening Rush' && '(Baseline Default)'}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Report 2: Enzo's DICE Controls */}
      {reportId === 'report_2' && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-600 mb-1">
                Day Type
              </label>
              <select
                value={params.isWeekend ?? 'all'}
                onChange={(e) =>
                  onChange({ isWeekend: e.target.value === 'all' ? null : Number(e.target.value) })
                }
                className="w-full bg-white text-slate-900 font-mono text-xs rounded border border-slate-300 px-2.5 py-1 focus:outline-none focus:border-emerald-600"
              >
                <option value={0}>Weekday (Monday – Friday) [Baseline Default]</option>
                <option value={1}>Weekend (Saturday – Sunday)</option>
                <option value="all">All Days (Full Week)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-600 mb-1">
                Payment Method
              </label>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-white border border-slate-300 text-xs text-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-600 flex-shrink-0" />
                <span className="font-semibold text-slate-900">Credit Card Only</span>
                <span className="text-[10px] text-slate-500">(tips are 0 on cash)</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-600 mb-1">
              Borough Filter (Default: All Boroughs)
            </label>
            <div className="flex flex-wrap gap-1">
              {NYC_BOROUGHS.map((b) => {
                const selected = params.boroughs.includes(b);
                return (
                  <button
                    key={b}
                    onClick={() => onChange({ boroughs: toggleArrayItem(params.boroughs, b) })}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono border transition ${
                      selected
                        ? 'bg-emerald-700 text-white border-emerald-800 font-medium'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {b} {selected && '✓'}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Report 3: Hayden's DRILL-DOWN & PIVOT Controls */}
      {reportId === 'report_3' && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-600 mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-emerald-600" />
                <span>Borough Filter</span>
              </label>
              <select
                value={params.haydenBorough || 'All'}
                onChange={(e) => onChange({ haydenBorough: e.target.value })}
                className="w-full bg-white text-slate-900 font-mono text-xs rounded border border-slate-300 px-2.5 py-1 focus:outline-none focus:border-emerald-600"
              >
                <option value="All">All Boroughs (Baseline Default)</option>
                {NYC_BOROUGHS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer bg-white border border-slate-300 hover:border-slate-400 rounded px-2.5 py-1.5 transition">
                <input
                  type="checkbox"
                  checked={params.aboveAverageOnly !== false}
                  onChange={(e) => onChange({ aboveAverageOnly: e.target.checked })}
                  className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-800 font-medium">
                  Zones Above Average Revenue Only [Default]
                </span>
              </label>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 bg-white p-1.5 rounded border border-slate-200">
            Pivots earnings into Q1, Q2, Q3, Q4 and tip percentage per taxi zone, filtering by citywide average zone revenue.
          </div>
        </div>
      )}

      {/* Report 4: Ryan's ROLL-UP & SLICE Controls */}
      {reportId === 'report_4' && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-600 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-emerald-600" />
                <span>Slice Month (Baseline: December)</span>
              </label>
              <select
                value={params.sliceMonth || 12}
                onChange={(e) => onChange({ sliceMonth: Number(e.target.value) })}
                className="w-full bg-white text-slate-900 font-mono text-xs rounded border border-slate-300 px-2.5 py-1 focus:outline-none focus:border-emerald-600"
              >
                {[
                  { m: 1, name: 'January' },
                  { m: 2, name: 'February' },
                  { m: 3, name: 'March' },
                  { m: 4, name: 'April' },
                  { m: 5, name: 'May' },
                  { m: 6, name: 'June' },
                  { m: 7, name: 'July' },
                  { m: 8, name: 'August' },
                  { m: 9, name: 'September' },
                  { m: 10, name: 'October' },
                  { m: 11, name: 'November' },
                  { m: 12, name: 'December (Baseline Default)' },
                ].map((item) => (
                  <option key={item.m} value={item.m}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-600 mb-1 flex items-center gap-1">
                <Filter className="w-3 h-3 text-emerald-600" />
                <span>Day Type Filter</span>
              </label>
              <select
                value={params.r4Weekend ?? 'all'}
                onChange={(e) =>
                  onChange({ r4Weekend: e.target.value === 'all' ? null : Number(e.target.value) })
                }
                className="w-full bg-white text-slate-900 font-mono text-xs rounded border border-slate-300 px-2.5 py-1 focus:outline-none focus:border-emerald-600"
              >
                <option value="all">All Days (With Subtotals) [Default]</option>
                <option value={0}>Weekdays Only (is_weekend = 0)</option>
                <option value={1}>Weekends Only (is_weekend = 1)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-600 mb-1">
                Borough Filter
              </label>
              <select
                value={params.r4Borough || 'All'}
                onChange={(e) => onChange({ r4Borough: e.target.value })}
                className="w-full bg-white text-slate-900 font-mono text-xs rounded border border-slate-300 px-2.5 py-1 focus:outline-none focus:border-emerald-600"
              >
                <option value="All">All Boroughs [Default]</option>
                {NYC_BOROUGHS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer bg-white border border-slate-300 hover:border-slate-400 rounded px-2.5 py-1.5 transition">
                <input
                  type="checkbox"
                  checked={params.withRollup !== false}
                  onChange={(e) => onChange({ withRollup: e.target.checked })}
                  className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-800 font-medium">
                  Hierarchical Subtotals (WITH ROLLUP) [Default]
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Report 5: Ryan's ROLL-UP Controls */}
      {reportId === 'report_5' && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-600 mb-1">
                Payment Method Filter
              </label>
              <select
                value={params.r5PaymentType || 'All'}
                onChange={(e) => onChange({ r5PaymentType: e.target.value })}
                className="w-full bg-white text-slate-900 font-mono text-xs rounded border border-slate-300 px-2.5 py-1 focus:outline-none focus:border-emerald-600"
              >
                <option value="All">All Payment Types (Credit card, Cash, etc.) [Default]</option>
                <option value="Credit card">Credit card</option>
                <option value="Cash">Cash</option>
                <option value="No charge">No charge</option>
                <option value="Dispute">Dispute</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-600 mb-1 flex items-center gap-1">
                <Layers className="w-3 h-3 text-emerald-600" />
                <span>Date Hierarchy Granularity</span>
              </label>
              <div className="flex items-center gap-1">
                {(['Day', 'Month', 'Year'] as const).map((gran) => {
                  const selected = (params.dateHierarchy || 'Day') === gran;
                  return (
                    <button
                      key={gran}
                      onClick={() => onChange({ dateHierarchy: gran })}
                      className={`flex-1 py-1 rounded text-xs font-mono font-medium border text-center transition ${
                        selected
                          ? 'bg-emerald-700 text-white border-emerald-800'
                          : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      {gran}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 cursor-pointer bg-white border border-slate-300 hover:border-slate-400 rounded px-2.5 py-1.5 transition">
              <input
                type="checkbox"
                checked={params.r5WithRollup !== false}
                onChange={(e) => onChange({ r5WithRollup: e.target.checked })}
                className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-xs text-slate-800 font-medium">
                Hierarchical Subtotals (WITH ROLLUP) [Default]
              </span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

