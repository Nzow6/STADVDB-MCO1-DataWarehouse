import React, { useState } from 'react';
import {
  SlidersHorizontal,
  Calendar,
  Grid,
  Copy,
  Check,
  FileSpreadsheet,
  Info,
  RotateCcw,
} from 'lucide-react';
import { DynamicReportControls } from '../builder/DynamicReportControls';
import { DynamicReportParams, QueryResult } from '../../types/olap';
import { OLAP_REPORT_PRESETS } from '../../engine/schemaData';

interface InspectorPaneProps {
  activeReportId: string;
  dynamicParams: DynamicReportParams;
  onParamsChange: (updates: Partial<DynamicReportParams>) => void;
  onResetBenchmark?: () => void;
  result: QueryResult | null;
  onExportCsv: () => void;
  onExportJson?: () => void;
  pivotDimension?: string;
  onPivotChange?: (dim?: string) => void;
}

export const InspectorPane: React.FC<InspectorPaneProps> = ({
  activeReportId,
  dynamicParams,
  onParamsChange,
  onResetBenchmark,
  result,
  onExportCsv,
  pivotDimension,
  onPivotChange,
}) => {
  const [copiedTable, setCopiedTable] = useState(false);
  const activePreset = OLAP_REPORT_PRESETS.find((p) => p.id === activeReportId);

  const copyMarkdownTable = () => {
    if (!result || !result.rows || result.rows.length === 0) return;
    const headers = result.columns.map((c) => c.name);
    const mdHeader = `| ${headers.join(' | ')} |`;
    const mdSeparator = `| ${headers.map(() => '---').join(' | ')} |`;
    const mdRows = result.rows.slice(0, 50).map((r) => {
      return `| ${headers.map((h) => (r[h] === null ? 'NULL' : String(r[h]))).join(' | ')} |`;
    });

    const markdown = [mdHeader, mdSeparator, ...mdRows].join('\n');
    navigator.clipboard.writeText(markdown);
    setCopiedTable(true);
    setTimeout(() => setCopiedTable(false), 2000);
  };

  const isPivotNeeded = activeReportId === 'report_3' || activeReportId === 'report_5';

  const handleSelectQuarter = (q: number | null) => {
    if (q === 1) {
      onParamsChange({ startDate: '2021-01-01', endDate: '2021-03-31', pivotQuarter: 1 });
    } else if (q === 2) {
      onParamsChange({ startDate: '2021-04-01', endDate: '2021-06-30', pivotQuarter: 2 });
    } else if (q === 3) {
      onParamsChange({ startDate: '2021-07-01', endDate: '2021-09-30', pivotQuarter: 3 });
    } else if (q === 4) {
      onParamsChange({ startDate: '2021-10-01', endDate: '2021-12-31', pivotQuarter: 4 });
    } else {
      onParamsChange({ startDate: '2021-01-01', endDate: '2021-12-31', pivotQuarter: null });
    }
  };

  const getActiveQuarter = () => {
    const s = dynamicParams.startDate;
    const e = dynamicParams.endDate;
    if (s === '2021-01-01' && e === '2021-03-31') return 1;
    if (s === '2021-04-01' && e === '2021-06-30') return 2;
    if (s === '2021-07-01' && e === '2021-09-30') return 3;
    if (s === '2021-10-01' && e === '2021-12-31') return 4;
    if ((!s || s === '2021-01-01') && (!e || e === '2021-12-31')) return 'all';
    return null;
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 text-xs select-none overflow-y-auto">
      {/* Pane Header */}
      <div className="h-9 px-3 flex items-center justify-between border-b border-slate-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-1.5 font-semibold text-slate-800 tracking-wider text-[11px] uppercase">
          <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-700" />
          <span>Report Inspector</span>
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-300 font-semibold">
          {activePreset?.operation || 'CUSTOM'}
        </span>
      </div>

      <div className="p-3 space-y-4 flex-1">
        {/* Active Report Metadata Card */}
        {activePreset && (
          <div className="p-2.5 rounded bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-slate-900 text-xs">
                Report {activePreset.reportNumber}: {activePreset.operation}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                Author: {activePreset.author}
              </span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed mb-2">
              {activePreset.description}
            </p>
            <div className="text-[10px] font-mono text-emerald-700 flex items-center gap-1 font-medium">
              <Info className="w-3 h-3 flex-shrink-0" />
              <span>{activePreset.analyticalFocus}</span>
            </div>
          </div>
        )}

        {/* Original Benchmark Query Card & Reset Action */}
        <div className="p-2.5 rounded bg-white border border-slate-200 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600 flex-shrink-0" />
            <div>
              <div className="font-semibold text-slate-900 text-[11px]">
                Original Benchmark View
              </div>
              <div className="text-[10px] text-slate-500">
                Default view replicates queries.py
              </div>
            </div>
          </div>
          {onResetBenchmark && (
            <button
              onClick={onResetBenchmark}
              title="Reset all parameters to original queries.py benchmark"
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 text-slate-700 border border-slate-300 font-mono text-[10px] transition font-medium"
            >
              <RotateCcw className="w-3 h-3 text-emerald-700" />
              <span>Reset to Original</span>
            </button>
          )}
        </div>

        {/* Dynamic Parameter Adjustment Controls */}
        <DynamicReportControls
          reportId={activeReportId}
          params={dynamicParams}
          onChange={onParamsChange}
        />

        {/* Unified Date Range Filter with automatic Quarter sync */}
        <div className="p-2.5 rounded bg-white border border-slate-200 space-y-2">
          <div className="flex items-center justify-between text-slate-700 text-[11px] font-semibold uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-700" />
              <span>Date Range Filter</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono normal-case">
              {getActiveQuarter() === 'all'
                ? 'Full Year'
                : getActiveQuarter()
                ? `Quarter ${getActiveQuarter()}`
                : 'Custom Range'}
            </span>
          </div>

          {/* Quick Quarter Selection: Automatically sets start and end dates */}
          <div className="flex items-center gap-1">
            {[
              { id: 'all', label: 'All Year', q: null },
              { id: 'q1', label: 'Q1', q: 1 },
              { id: 'q2', label: 'Q2', q: 2 },
              { id: 'q3', label: 'Q3', q: 3 },
              { id: 'q4', label: 'Q4', q: 4 },
            ].map((item) => {
              const activeQ = getActiveQuarter();
              const isSelected = item.q === null ? activeQ === 'all' : activeQ === item.q;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectQuarter(item.q)}
                  className={`flex-1 py-1 rounded text-xs font-mono font-medium border text-center transition ${
                    isSelected
                      ? 'bg-emerald-700 text-white border-emerald-800'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-xs">
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">Start Date</label>
              <input
                type="date"
                value={dynamicParams.startDate || '2021-01-01'}
                min="2021-01-01"
                max="2021-12-31"
                onChange={(e) => onParamsChange({ startDate: e.target.value })}
                className="w-full bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-0.5">End Date</label>
              <input
                type="date"
                value={dynamicParams.endDate || '2021-12-31'}
                min="2021-01-01"
                max="2021-12-31"
                onChange={(e) => onParamsChange({ endDate: e.target.value })}
                className="w-full bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>
        </div>

        {/* Pivot Matrix Configuration (Only visible when needed / Report 5) */}
        {isPivotNeeded && (
          <div className="p-2.5 rounded bg-white border border-slate-200 space-y-2">
            <div className="flex items-center gap-1.5 text-slate-700 text-[11px] font-semibold uppercase tracking-wider">
              <Grid className="w-3.5 h-3.5 text-emerald-700" />
              <span>Crosstab & Pivot Matrix</span>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-slate-500">Column Dimension:</span>
              <select
                value={pivotDimension || 'day_bracket'}
                onChange={(e) => onPivotChange && onPivotChange(e.target.value)}
                className="w-full bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-600"
              >
                <option value="day_bracket">Day Bracket (6 Diurnal Periods)</option>
                <option value="payment_type">Payment Method</option>
              </select>
            </div>
          </div>
        )}

        {/* Clean Export Actions */}
        <div className="space-y-2 pt-1">
          <button
            onClick={onExportCsv}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-medium text-xs shadow-xs transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Download Report CSV</span>
          </button>

          <button
            onClick={copyMarkdownTable}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-mono text-xs transition"
          >
            {copiedTable ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-semibold">Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy Table to Clipboard</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
