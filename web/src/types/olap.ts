export type FieldCategory = 'dimension' | 'measure';

export type ColumnDataType = 'VARCHAR' | 'INTEGER' | 'NUMERIC' | 'TIMESTAMP' | 'TIME' | 'BOOLEAN' | 'DOUBLE';

export type MeasureAggregation = 'SUM' | 'AVG' | 'COUNT' | 'COUNT_DISTINCT' | 'MIN' | 'MAX';

export type DateGranularity = 'raw' | 'day' | 'week' | 'month' | 'quarter' | 'year';

export type FilterOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'IN' | 'NOT IN' | 'BETWEEN' | 'LIKE';

export interface SchemaField {
  id: string;
  name: string;
  displayName: string;
  table: string;
  category: FieldCategory;
  dataType: ColumnDataType;
  description?: string;
  defaultAggregation?: MeasureAggregation;
}

export interface SchemaTable {
  id: string;
  name: string;
  displayName: string;
  type: 'fact' | 'dimension';
  description?: string;
  fields: SchemaField[];
}

export interface SelectedMeasure {
  id: string;
  fieldId: string;
  tableName: string;
  fieldName: string;
  displayName: string;
  aggregation: MeasureAggregation;
  alias?: string;
}

export interface SelectedDimension {
  id: string;
  fieldId: string;
  tableName: string;
  fieldName: string;
  displayName: string;
  granularity: DateGranularity;
  alias?: string;
}

export interface QueryFilter {
  id: string;
  fieldId: string;
  tableName: string;
  fieldName: string;
  operator: FilterOperator;
  value: string;
  valueTo?: string; // For BETWEEN
}

export interface PivotConfig {
  columnDimension?: string;
  pivotValues?: string[];
  metricField?: string;
}

export interface ColumnMeta {
  name: string;
  type: ColumnDataType;
  nullable?: boolean;
}

export interface QueryResult {
  columns: ColumnMeta[];
  rows: Record<string, any>[];
  rowCount: number;
  executionTimeMs: number;
  compiledSql: string;
  sourceEngine: 'DuckDB-Wasm' | 'In-Memory Engine' | (string & {});
  cacheHit?: boolean;
  error?: string | null;
}

export type WorkbenchMode = 'builder' | 'sql' | 'preset';

export interface DynamicReportParams {
  // Date range filters
  startDate?: string;
  endDate?: string;

  // Report 1: Slice (Karl)
  dayBracket: string;
  pickupDate?: string;

  // Report 2: Dice (Enzo)
  boroughs: string[];
  dayBrackets: string[];
  paymentTypeIds: number[];
  isWeekend: number | null;

  // Report 3: Drill-Down & Pivot (Hayden)
  haydenBorough?: string;
  aboveAverageOnly?: boolean;
  rollupGranularity?: 'Quarter' | 'Month' | 'Day';
  rollupBoroughs?: string[];

  // Report 4: Rollup & Slice (Ryan)
  sliceMonth?: number;
  r4Weekend?: number | null;
  r4Borough?: string;
  r4Vendor?: string;
  withRollup?: boolean;
  targetBorough?: string;
  peakSurchargeOnly?: boolean;

  // Report 5: Rollup (Ryan)
  r5PaymentType?: string;
  dateHierarchy?: 'Day' | 'Month' | 'Year';
  r5WithRollup?: boolean;
  pivotMetric?: 'revenue' | 'volume';
  pivotQuarter?: number | null;
  pivotPaymentTypeIds?: number[];
}

export interface ReportPresetDefinition {
  id: string;
  reportNumber: number;
  title: string;
  operation: 'SLICE' | 'DICE' | 'ROLL-UP' | 'DRILL-DOWN' | 'PIVOT' | 'DRILL-DOWN & PIVOT' | 'ROLL-UP & SLICE';
  analyticalFocus: string;
  author?: string;
  defaultParams: Partial<DynamicReportParams>;
  description: string;
}
