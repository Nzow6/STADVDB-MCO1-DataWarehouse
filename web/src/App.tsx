import React, { useState } from 'react';
import { Table, BarChart3 } from 'lucide-react';
import { AppHeader } from './components/layout/AppHeader';
import { ResizablePane } from './components/layout/ResizablePane';
import { InspectorPane } from './components/layout/InspectorPane';
import { SchemaNavigator } from './components/schema/SchemaNavigator';
import { VisualBuilder } from './components/builder/VisualBuilder';
import { RunToolbar } from './components/builder/RunToolbar';
import { SqlViewer } from './components/editor/SqlViewer';
import { DataTable } from './components/grid/DataTable';
import { ChartView } from './components/grid/ChartView';
import { useOlapQuery } from './hooks/useOlapQuery';
import { SchemaField } from './types/olap';

export function App() {
  const {
    mode,
    setMode,
    activeReportId,
    selectReportPreset,
    resetToReportBenchmark,
    dynamicParams,
    setDynamicParams,
    builderState,
    addMeasure,
    removeMeasure,
    updateMeasureAggregation,
    addDimension,
    removeDimension,
    updateDimensionGranularity,
    addFilter,
    removeFilter,
    setLimit,
    toggleRollup,
    customSql,
    setCustomSql,
    compiledSql,
    runQuery,
    loading,
    result,
    autoRun,
    setAutoRun,
    duckdbStatus,
  } = useOlapQuery();

  const [activeTab, setActiveTab] = useState<'grid' | 'chart'>('grid');
  const [pivotDimension, setPivotDimension] = useState<string>('day_bracket');

  // Schema navigator click handlers
  const handleAddMeasureFromSchema = (field: SchemaField) => {
    addMeasure({
      fieldId: field.id,
      tableName: field.table,
      fieldName: field.name,
      displayName: field.displayName,
      aggregation: field.defaultAggregation || 'SUM',
      alias: `${field.name}_${(field.defaultAggregation || 'SUM').toLowerCase()}`,
    });
  };

  const handleAddDimensionFromSchema = (field: SchemaField) => {
    addDimension({
      fieldId: field.id,
      tableName: field.table,
      fieldName: field.name,
      displayName: field.displayName,
      granularity: field.name.includes('date') ? 'month' : 'raw',
      alias: field.name,
    });
  };

  // Export handler
  const handleExportCsv = () => {
    if (!result || !result.rows || result.rows.length === 0) {
      alert('No query data available to export');
      return;
    }
    const headers = result.columns.map((c) => c.name);
    const csvRows = [headers.join(',')];

    result.rows.forEach((r) => {
      const line = headers.map((h) => {
        const val = r[h];
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
      });
      csvRows.push(line.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `olap_report_${activeReportId}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-white text-slate-900 overflow-hidden font-sans">
      {/* Top Application Bar */}
      <AppHeader
        mode={mode}
        setMode={setMode}
        activeReportId={activeReportId}
        onSelectReport={selectReportPreset}
        duckdbStatus={duckdbStatus}
      />

      {/* 3-Pane Workbench (Left pane only shown when Visual Builder is active) */}
      <ResizablePane
        showLeftPane={mode === 'builder'}
        leftContent={
          <SchemaNavigator
            onAddMeasure={handleAddMeasureFromSchema}
            onAddDimension={handleAddDimensionFromSchema}
          />
        }
        centerContent={
          <div className="h-full flex flex-col bg-white overflow-hidden">
            {/* Workbench Top: Visual Builder / SQL Mode */}

            {mode === 'builder' && (
              <VisualBuilder
                state={builderState}
                onRemoveMeasure={removeMeasure}
                onUpdateMeasureAggregation={updateMeasureAggregation}
                onRemoveDimension={removeDimension}
                onUpdateDimensionGranularity={updateDimensionGranularity}
                onRemoveFilter={removeFilter}
                onUpdateFilter={() => null}
                onAddFilter={addFilter}
              />
            )}

            {mode === 'sql' && (
              <div className="h-64 border-b border-slate-200 flex flex-col">
                <SqlViewer
                  sql={customSql}
                  compiledSql={compiledSql}
                  onChange={setCustomSql}
                  isEditable={true}
                />
              </div>
            )}

            {/* Run Toolbar */}
            <RunToolbar
              onRunQuery={() => runQuery(mode === 'sql' ? customSql : undefined)}
              loading={loading}
              result={result}
              limit={builderState.limit}
              onLimitChange={setLimit}
              autoRun={autoRun}
              onToggleAutoRun={() => setAutoRun(!autoRun)}
              rollupEnabled={mode === 'builder' ? builderState.rollupEnabled : undefined}
              onToggleRollup={mode === 'builder' ? toggleRollup : undefined}
            />

            {/* Center Bottom: Grid vs Chart Tabs Header */}
            <div className="h-8 bg-slate-50 border-b border-slate-200 px-3 flex items-center justify-between text-xs select-none">
              <div className="flex items-center gap-1 bg-white p-0.5 rounded border border-slate-200 shadow-2xs">
                <button
                  onClick={() => setActiveTab('grid')}
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono transition ${
                    activeTab === 'grid'
                      ? 'bg-emerald-700 text-white font-medium shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Table className="w-3 h-3" />
                  <span>Enterprise Grid</span>
                </button>
                <button
                  onClick={() => setActiveTab('chart')}
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-mono transition ${
                    activeTab === 'chart'
                      ? 'bg-emerald-700 text-white font-medium shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BarChart3 className="w-3 h-3" />
                  <span>Analytical Visualization</span>
                </button>
              </div>

              {/* Status info */}
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                <span>Tabular Figures: Tabular-Nums</span>
                <span>•</span>
                <span>Sticky Virtualized Header</span>
              </div>
            </div>

            {/* Grid / Chart Render Area */}
            <div className="flex-1 flex overflow-hidden relative">
              {activeTab === 'grid' ? (
                <DataTable result={result} loading={loading} />
              ) : (
                <ChartView result={result} />
              )}
            </div>
          </div>
        }
        rightContent={
          <InspectorPane
            activeReportId={activeReportId}
            dynamicParams={dynamicParams}
            onParamsChange={(updates) => setDynamicParams((prev) => ({ ...prev, ...updates }))}
            onResetBenchmark={resetToReportBenchmark}
            result={result}
            onExportCsv={handleExportCsv}
            pivotDimension={pivotDimension}
            onPivotChange={(dim) => setPivotDimension(dim || 'day_bracket')}
          />
        }
      />
    </div>
  );
}

export default App;
