import React, { useState } from 'react';
import { Database, ChevronDown } from 'lucide-react';
import { DuckDBStatus } from '../../engine/duckdbClient';
import { OLAP_REPORT_PRESETS } from '../../engine/schemaData';
import { WorkbenchMode } from '../../types/olap';

interface AppHeaderProps {
  mode: WorkbenchMode;
  setMode: (mode: WorkbenchMode) => void;
  activeReportId: string;
  onSelectReport: (id: string) => void;
  duckdbStatus: DuckDBStatus;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  mode,
  setMode,
  activeReportId,
  onSelectReport,
  duckdbStatus,
}) => {
  const [reportDropdownOpen, setReportDropdownOpen] = useState(false);
  const activePreset = OLAP_REPORT_PRESETS.find((p) => p.id === activeReportId);

  return (
    <header className="h-11 bg-white border-b border-slate-200 px-3 flex items-center justify-between text-xs select-none z-30 shadow-xs">
      {/* Left: Branding & Report Selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-emerald-700 flex items-center justify-center text-white font-bold text-xs shadow-xs">
            <Database className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-slate-900 tracking-tight text-sm">
            OLAP Workbench
          </span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
            NYC 2021 DW
          </span>
        </div>

        <div className="h-4 w-px bg-slate-200 mx-1" />

        {/* Report Presets Dropdown */}
        <div className="relative">
          <button
            onClick={() => setReportDropdownOpen(!reportDropdownOpen)}
            className="flex items-center gap-2 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition"
          >
            <span className="font-medium text-slate-500">Preset:</span>
            <span className="font-semibold text-emerald-700">
              {activePreset ? `Report ${activePreset.reportNumber}: ${activePreset.operation}` : 'Custom Report'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-0.5" />
          </button>

          {reportDropdownOpen && (
            <div
              className="absolute left-0 mt-1 w-80 rounded-md bg-white border border-slate-200 shadow-lg py-1 z-50 text-xs"
              onMouseLeave={() => setReportDropdownOpen(false)}
            >
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                STADVDB MCO1 OLAP Reports
              </div>
              {OLAP_REPORT_PRESETS.map((preset) => {
                const isSelected = preset.id === activeReportId && mode === 'preset';
                return (
                  <button
                    key={preset.id}
                    onClick={() => {
                      onSelectReport(preset.id);
                      setReportDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex flex-col gap-0.5 transition ${isSelected
                        ? 'bg-emerald-50 text-emerald-900 border-l-3 border-emerald-600'
                        : 'hover:bg-slate-50 text-slate-700'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-900">
                        Report {preset.reportNumber}: {preset.title}
                      </span>
                      <span className="text-[10px] font-mono px-1 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {preset.operation}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 line-clamp-1">
                      {preset.analyticalFocus}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center bg-slate-100 rounded p-0.5 border border-slate-200">
          <button
            onClick={() => setMode('preset')}
            className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition ${mode === 'preset'
                ? 'bg-white text-emerald-800 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            OLAP Presets
          </button>
          <button
            onClick={() => setMode('builder')}
            className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition ${mode === 'builder'
                ? 'bg-white text-emerald-800 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            Visual Builder
          </button>
          <button
            onClick={() => setMode('sql')}
            className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition ${mode === 'sql'
                ? 'bg-white text-emerald-800 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            Raw SQL
          </button>
        </div>
      </div>

      {/* Right: Worker Connection Status Pill */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-[11px]">
          <span
            className={`w-2 h-2 rounded-full ${duckdbStatus.state === 'ready'
                ? 'bg-emerald-600 animate-subtle-pulse'
                : duckdbStatus.state === 'initializing'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-emerald-500'
              }`}
          />
          <span className="text-slate-800 font-mono text-[11px] font-medium">
            {duckdbStatus.state === 'ready'
              ? 'DuckDB-Wasm (Worker Ready)'
              : duckdbStatus.state === 'initializing'
                ? 'Initializing Wasm...'
                : 'In-Memory Engine (Active)'}
          </span>
          <span className="text-slate-500 text-[10px] font-mono border-l border-slate-300 pl-1.5 ml-0.5">
            1.05M rows
          </span>
        </div>
      </div>
    </header>
  );
};
