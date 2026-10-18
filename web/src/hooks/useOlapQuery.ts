import { useCallback, useEffect, useRef, useState } from 'react';
import { duckdbClient, DuckDBStatus } from '../engine/duckdbClient';
import { executeMockDynamicReport, executeMockVisualQuery } from '../engine/mockOlapEngine';
import { compileDynamicPresetQuery, compileVisualQuery, VisualBuilderState } from '../engine/olapCompiler';
import { OLAP_REPORT_PRESETS } from '../engine/schemaData';
import {
  DynamicReportParams,
  QueryFilter,
  QueryResult,
  SelectedDimension,
  SelectedMeasure,
  WorkbenchMode,
} from '../types/olap';

export function getInitialReportParams(presetId: string): DynamicReportParams {
  const baseDefaults: DynamicReportParams = {
    startDate: '',
    endDate: '',
    dayBracket: 'Evening Rush',
    pickupDate: '',
    boroughs: [],
    dayBrackets: [],
    paymentTypeIds: [1],
    isWeekend: 0,
    haydenBorough: 'All',
    aboveAverageOnly: true,
    sliceMonth: 12,
    r4Weekend: null,
    r4Borough: 'All',
    r4Vendor: 'All',
    withRollup: true,
    r5PaymentType: 'All',
    dateHierarchy: 'Day',
    r5WithRollup: true,
    rollupGranularity: 'Month',
    rollupBoroughs: [],
    targetBorough: 'Manhattan',
    peakSurchargeOnly: false,
    pivotMetric: 'revenue',
    pivotQuarter: null,
    pivotPaymentTypeIds: [1, 2],
  };

  const preset = OLAP_REPORT_PRESETS.find((p) => p.id === presetId);
  return preset ? { ...baseDefaults, ...preset.defaultParams } : baseDefaults;
}

export function useOlapQuery() {
  const [mode, setMode] = useState<WorkbenchMode>('preset');
  const [activeReportId, setActiveReportId] = useState<string>('report_1');
  const [duckdbStatus, setDuckdbStatus] = useState<DuckDBStatus>(duckdbClient.getStatus());

  // Dynamic Report Parameters matching queries.py baseline
  const [dynamicParams, setDynamicParams] = useState<DynamicReportParams>(() => getInitialReportParams('report_1'));

  // Visual Builder State
  const [builderState, setBuilderState] = useState<VisualBuilderState>({
    measures: [
      {
        id: 'm1',
        fieldId: 'f_total_amount',
        tableName: 'fact_green_trips',
        fieldName: 'total_amount',
        displayName: 'Total Revenue',
        aggregation: 'SUM',
        alias: 'total_revenue',
      },
      {
        id: 'm2',
        fieldId: 'f_trip_id',
        tableName: 'fact_green_trips',
        fieldName: 'trip_id',
        displayName: 'Total Trips',
        aggregation: 'COUNT',
        alias: 'total_trips',
      },
    ],
    dimensions: [
      {
        id: 'd1',
        fieldId: 'l_borough',
        tableName: 'dim_location',
        fieldName: 'borough',
        displayName: 'Borough',
        granularity: 'raw',
        alias: 'pickup_borough',
      },
    ],
    filters: [],
    limit: 'ALL',
    rollupEnabled: false,
  });

  // Raw SQL state
  const [customSql, setCustomSql] = useState<string>('');

  // Results & Loading
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [autoRun, setAutoRun] = useState<boolean>(true);

  // Subscribe to DuckDB status
  useEffect(() => {
    return duckdbClient.subscribe((status) => {
      setDuckdbStatus(status);
    });
  }, []);

  // Compute active compiled SQL
  const getCompiledSql = useCallback(() => {
    if (mode === 'preset') {
      return compileDynamicPresetQuery(activeReportId, dynamicParams, 'duckdb');
    } else if (mode === 'builder') {
      return compileVisualQuery(builderState, 'duckdb');
    } else {
      return customSql || compileDynamicPresetQuery(activeReportId, dynamicParams, 'duckdb');
    }
  }, [mode, activeReportId, dynamicParams, builderState, customSql]);

  // Synchronize custom SQL editor when switching to SQL mode
  useEffect(() => {
    if (mode === 'sql' && !customSql) {
      setCustomSql(getCompiledSql());
    }
  }, [mode, getCompiledSql, customSql]);

  // Run Query implementation
  const runQuery = useCallback(async (sqlToRun?: string) => {
    setLoading(true);
    const sql = sqlToRun || getCompiledSql();

    try {
      if (duckdbStatus.state === 'ready') {
        const queryRes = await duckdbClient.query(sql);
        setResult(queryRes);
      } else {
        // Fallback to In-Memory Engine
        if (mode === 'preset') {
          const mockRes = executeMockDynamicReport(activeReportId, dynamicParams, sql);
          setResult(mockRes);
        } else {
          const mockRes = executeMockVisualQuery(builderState, sql);
          setResult(mockRes);
        }
      }
    } catch (err: any) {
      console.warn('[useOlapQuery] Query execution fallback:', err);
      // Fallback on DuckDB syntax or execution error
      if (mode === 'preset') {
        const mockRes = executeMockDynamicReport(activeReportId, dynamicParams, sql);
        setResult(mockRes);
      } else {
        const mockRes = executeMockVisualQuery(builderState, sql);
        setResult(mockRes);
      }
    } finally {
      setLoading(false);
    }
  }, [duckdbStatus.state, getCompiledSql, mode, activeReportId, dynamicParams, builderState]);

  // Auto-run trigger with debouncing
  const debounceTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!autoRun) return;

    if (debounceTimer.current) {
      window.clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = window.setTimeout(() => {
      runQuery();
    }, 150);

    return () => {
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    };
  }, [activeReportId, dynamicParams, builderState, autoRun, mode]);

  // Keyboard shortcut listener (Cmd/Ctrl + Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        runQuery();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [runQuery]);

  // Action helpers
  const addMeasure = (measure: Omit<SelectedMeasure, 'id'>) => {
    const newMeasure: SelectedMeasure = {
      ...measure,
      id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    setBuilderState((prev) => ({
      ...prev,
      measures: [...prev.measures, newMeasure],
    }));
  };

  const removeMeasure = (id: string) => {
    setBuilderState((prev) => ({
      ...prev,
      measures: prev.measures.filter((m) => m.id !== id),
    }));
  };

  const updateMeasureAggregation = (id: string, aggregation: SelectedMeasure['aggregation']) => {
    setBuilderState((prev) => ({
      ...prev,
      measures: prev.measures.map((m) => (m.id === id ? { ...m, aggregation } : m)),
    }));
  };

  const addDimension = (dimension: Omit<SelectedDimension, 'id'>) => {
    const newDimension: SelectedDimension = {
      ...dimension,
      id: `d_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    setBuilderState((prev) => ({
      ...prev,
      dimensions: [...prev.dimensions, newDimension],
    }));
  };

  const removeDimension = (id: string) => {
    setBuilderState((prev) => ({
      ...prev,
      dimensions: prev.dimensions.filter((d) => d.id !== id),
    }));
  };

  const updateDimensionGranularity = (id: string, granularity: SelectedDimension['granularity']) => {
    setBuilderState((prev) => ({
      ...prev,
      dimensions: prev.dimensions.map((d) => (d.id === id ? { ...d, granularity } : d)),
    }));
  };

  const addFilter = (filter: Omit<QueryFilter, 'id'>) => {
    const newFilter: QueryFilter = {
      ...filter,
      id: `f_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    setBuilderState((prev) => ({
      ...prev,
      filters: [...prev.filters, newFilter],
    }));
  };

  const removeFilter = (id: string) => {
    setBuilderState((prev) => ({
      ...prev,
      filters: prev.filters.filter((f) => f.id !== id),
    }));
  };

  const setLimit = (limit: number | 'ALL') => {
    setBuilderState((prev) => ({ ...prev, limit }));
  };

  const toggleRollup = () => {
    setBuilderState((prev) => ({ ...prev, rollupEnabled: !prev.rollupEnabled }));
  };

  const selectReportPreset = (presetId: string) => {
    setActiveReportId(presetId);
    setMode('preset');
    setDynamicParams(getInitialReportParams(presetId));
  };

  const resetToReportBenchmark = () => {
    setDynamicParams(getInitialReportParams(activeReportId));
  };

  return {
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
    compiledSql: getCompiledSql(),
    runQuery,
    loading,
    result,
    autoRun,
    setAutoRun,
    duckdbStatus,
  };
}
