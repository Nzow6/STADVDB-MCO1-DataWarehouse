import { DynamicReportParams, QueryFilter, SelectedDimension, SelectedMeasure } from '../types/olap';

export interface VisualBuilderState {
  measures: SelectedMeasure[];
  dimensions: SelectedDimension[];
  filters: QueryFilter[];
  pivotDimension?: string;
  limit: number | 'ALL';
  rollupEnabled?: boolean;
}

/**
 * Maps table name to canonical alias and join expression.
 */
function getJoinSpec(table: string): { alias: string; joinSql: string } | null {
  switch (table) {
    case 'dim_date':
      return { alias: 'd', joinSql: 'JOIN dim_date d ON f.pickup_date_id = d.date_id' };
    case 'dim_time':
      return { alias: 't', joinSql: 'JOIN dim_time t ON f.pickup_time_id = t.time_id' };
    case 'dim_location':
      return { alias: 'l', joinSql: 'JOIN dim_location l ON f.pickup_location_id = l.location_id' };
    case 'dim_vendor':
      return { alias: 'v', joinSql: 'JOIN dim_vendor v ON f.vendor_id = v.vendor_id' };
    case 'dim_payment_type':
      return { alias: 'pt', joinSql: 'JOIN dim_payment_type pt ON f.payment_type_id = pt.payment_type_id' };
    case 'dim_rate_code':
      return { alias: 'rc', joinSql: 'JOIN dim_rate_code rc ON f.rate_code_id = rc.rate_code_id' };
    case 'dim_trip_type':
      return { alias: 'tt', joinSql: 'JOIN dim_trip_type tt ON f.trip_type_id = tt.trip_type_id' };
    default:
      return null;
  }
}

/**
 * Returns table alias for a given table name.
 */
function getTableAlias(table: string): string {
  if (table === 'fact_green_trips') return 'f';
  const spec = getJoinSpec(table);
  return spec ? spec.alias : table;
}

/**
 * Compiles Visual Builder configuration into valid OLAP SQL.
 */
export function compileVisualQuery(state: VisualBuilderState, dialect: 'duckdb' | 'mysql' = 'duckdb'): string {
  const { measures, dimensions, filters, limit, rollupEnabled } = state;

  if (measures.length === 0 && dimensions.length === 0) {
    return `-- Select at least one measure or dimension in the Visual Builder\nSELECT 'No fields selected' AS message;`;
  }

  const tablesNeeded = new Set<string>();

  // Check dimension tables
  dimensions.forEach((d) => {
    if (d.tableName !== 'fact_green_trips') tablesNeeded.add(d.tableName);
  });
  measures.forEach((m) => {
    if (m.tableName !== 'fact_green_trips') tablesNeeded.add(m.tableName);
  });
  filters.forEach((f) => {
    if (f.tableName !== 'fact_green_trips') tablesNeeded.add(f.tableName);
  });

  const selectItems: string[] = [];
  const groupByItems: string[] = [];

  // Dimensions
  dimensions.forEach((d) => {
    const alias = getTableAlias(d.tableName);
    let expr = `${alias}.${d.fieldName}`;

    // Handle date bucketing
    if (d.granularity && d.granularity !== 'raw') {
      if (d.granularity === 'month') {
        expr = `date_trunc('month', ${alias}.${d.fieldName})`;
      } else if (d.granularity === 'quarter') {
        expr = `date_trunc('quarter', ${alias}.${d.fieldName})`;
      } else if (d.granularity === 'year') {
        expr = `date_trunc('year', ${alias}.${d.fieldName})`;
      } else if (d.granularity === 'day') {
        expr = `date_trunc('day', ${alias}.${d.fieldName})`;
      }
    }

    const colAlias = d.alias || d.fieldName;
    selectItems.push(`    ${expr} AS ${colAlias}`);
    groupByItems.push(expr);
  });

  // Measures
  measures.forEach((m) => {
    const alias = getTableAlias(m.tableName);
    let aggFunc = m.aggregation || 'SUM';
    let expr = `${alias}.${m.fieldName}`;

    if (aggFunc === 'COUNT_DISTINCT') {
      expr = `COUNT(DISTINCT ${expr})`;
    } else {
      expr = `${aggFunc}(${expr})`;
    }

    // Rounding financial and decimal fields
    if (['SUM', 'AVG'].includes(aggFunc)) {
      expr = `ROUND(${expr}, 2)`;
    }

    const colAlias = m.alias || `${m.fieldName}_${aggFunc.toLowerCase()}`;
    selectItems.push(`    ${expr} AS ${colAlias}`);
  });

  // FROM and JOIN clauses
  const joinClauses: string[] = [];
  tablesNeeded.forEach((t) => {
    const spec = getJoinSpec(t);
    if (spec) {
      joinClauses.push(`JOIN ${t} ${spec.alias} ON f.${t.replace('dim_', '')}_id = ${spec.alias}.${t.replace('dim_', '')}_id`);
    }
  });

  // WHERE clauses
  const whereClauses: string[] = [];
  filters.forEach((filter) => {
    const alias = getTableAlias(filter.tableName);
    const fieldExpr = `${alias}.${filter.fieldName}`;
    const op = filter.operator;
    const val = filter.value.trim();

    if (op === 'IN' || op === 'NOT IN') {
      const items = val.split(',').map((s) => `'${s.trim().replace(/'/g, "''")}'`).join(', ');
      whereClauses.push(`${fieldExpr} ${op} (${items})`);
    } else if (op === 'BETWEEN') {
      const valTo = (filter.valueTo || '').trim();
      whereClauses.push(`${fieldExpr} BETWEEN '${val.replace(/'/g, "''")}' AND '${valTo.replace(/'/g, "''")}'`);
    } else if (op === 'LIKE') {
      whereClauses.push(`${fieldExpr} LIKE '%${val.replace(/'/g, "''")}%'`);
    } else {
      const isNum = !isNaN(Number(val)) && val !== '';
      const formattedVal = isNum ? val : `'${val.replace(/'/g, "''")}'`;
      whereClauses.push(`${fieldExpr} ${op} ${formattedVal}`);
    }
  });

  let sql = 'SELECT\n' + selectItems.join(',\n') + '\nFROM fact_green_trips f';

  if (joinClauses.length > 0) {
    sql += '\n' + joinClauses.map((j) => '  ' + j).join('\n');
  }

  if (whereClauses.length > 0) {
    sql += '\nWHERE ' + whereClauses.join('\n  AND ');
  }

  if (groupByItems.length > 0) {
    if (rollupEnabled) {
      sql += dialect === 'duckdb'
        ? `\nGROUP BY ROLLUP (${groupByItems.join(', ')})`
        : `\nGROUP BY ${groupByItems.join(', ')} WITH ROLLUP`;
    } else {
      sql += '\nGROUP BY ' + groupByItems.join(', ');
    }
    sql += '\nORDER BY 1 ASC';
  }

  if (limit !== 'ALL' && typeof limit === 'number' && limit > 0) {
    sql += `\nLIMIT ${limit};`;
  } else {
    sql += ';';
  }

  return sql;
}

/**
 * Compiles specific Dynamic Preset Reports matching docs/dynamic_parameters.md.
 */
export function compileDynamicPresetQuery(reportId: string, params: DynamicReportParams, dialect: 'duckdb' | 'mysql' = 'duckdb'): string {
  switch (reportId) {
    case 'report_1': {
      // SLICE: Evening Rush Borough Revenue Ranking (Karl)
      const dayBracket = params.dayBracket || 'Evening Rush';
      const whereParts: string[] = [`t.day_bracket = '${dayBracket.replace(/'/g, "''")}'`];
      let hasDateFilter = false;

      if (params.startDate && params.endDate) {
        whereParts.push(`d.full_date BETWEEN '${params.startDate.replace(/'/g, "''")}' AND '${params.endDate.replace(/'/g, "''")}'`);
        hasDateFilter = true;
      } else if (params.startDate) {
        whereParts.push(`d.full_date >= '${params.startDate.replace(/'/g, "''")}'`);
        hasDateFilter = true;
      } else if (params.endDate) {
        whereParts.push(`d.full_date <= '${params.endDate.replace(/'/g, "''")}'`);
        hasDateFilter = true;
      } else if (params.pickupDate) {
        whereParts.push(`d.full_date = '${params.pickupDate.replace(/'/g, "''")}'`);
        hasDateFilter = true;
      }

      const dateJoin = hasDateFilter ? '\nJOIN dim_date d ON f.pickup_date_id = d.date_id' : '';

      return `SELECT 
    pu_loc.borough AS pickup_borough,
    COUNT(f.trip_id) AS total_rush_trips,
    ROUND(SUM(f.total_amount), 2) AS total_rush_revenue,
    ROUND(AVG(f.fare_amount), 2) AS avg_fare,
    DENSE_RANK() OVER (
        ORDER BY SUM(f.total_amount) DESC
    ) AS revenue_rank
FROM fact_green_trips f
JOIN dim_time t 
    ON f.pickup_time_id = t.time_id
JOIN dim_location pu_loc 
    ON f.pickup_location_id = pu_loc.location_id${dateJoin}
WHERE ${whereParts.join('\n  AND ')}
GROUP BY pu_loc.borough
ORDER BY revenue_rank ASC;`.trim();
    }

    case 'report_2': {
      // DICE: Monthly Weekday Borough Tip Rate Ranking (Enzo)
      const whereParts: string[] = [];
      if (params.isWeekend !== null && params.isWeekend !== undefined) {
        whereParts.push(`d.is_weekend = ${params.isWeekend}`);
      }
      if (params.startDate && params.endDate) {
        whereParts.push(`d.full_date BETWEEN '${params.startDate.replace(/'/g, "''")}' AND '${params.endDate.replace(/'/g, "''")}'`);
      }
      if (params.boroughs && params.boroughs.length > 0) {
        const bList = params.boroughs.map((b) => `'${b.replace(/'/g, "''")}'`).join(', ');
        whereParts.push(`l.borough IN (${bList})`);
      }
      let timeJoin = '';
      if (params.dayBrackets && params.dayBrackets.length > 0) {
        timeJoin = '\nJOIN dim_time t ON f.pickup_time_id = t.time_id';
        const dbList = params.dayBrackets.map((b) => `'${b.replace(/'/g, "''")}'`).join(', ');
        whereParts.push(`t.day_bracket IN (${dbList})`);
      }
      // Payment filter: default to credit card (id=1) if selected or if paymentTypeIds specified
      if (params.paymentTypeIds && params.paymentTypeIds.length > 0 && !params.paymentTypeIds.includes(0)) {
        whereParts.push(`f.payment_type_id IN (${params.paymentTypeIds.join(', ')})`);
      }

      const whereSql = whereParts.length > 0 ? 'WHERE ' + whereParts.join('\n  AND ') : '';

      return `SELECT 
    d.month_name, 
    l.borough, 
    ROUND(SUM(f.tip_amount) / NULLIF(SUM(f.fare_amount), 0), 4) AS avg_tip_rate,
    DENSE_RANK() OVER (
        PARTITION BY d.month 
        ORDER BY (SUM(f.tip_amount) / NULLIF(SUM(f.fare_amount), 0)) DESC
    ) AS borough_tip_rank
FROM fact_green_trips f
JOIN dim_date d ON f.pickup_date_id = d.date_id
JOIN dim_location l ON f.pickup_location_id = l.location_id${timeJoin}
${whereSql}
GROUP BY 
    d.month, 
    d.month_name, 
    l.borough
ORDER BY 
    d.month ASC, 
    borough_tip_rank ASC;`.trim();
    }

    case 'report_3': {
      // DRILL-DOWN & PIVOT: Annual Zone Revenue with Quarterly Pivot (Hayden)
      const whereParts: string[] = [];
      if (params.haydenBorough && params.haydenBorough !== 'All') {
        whereParts.push(`dl.borough = '${params.haydenBorough.replace(/'/g, "''")}'`);
      }
      if (params.startDate && params.endDate) {
        whereParts.push(`dd.full_date BETWEEN '${params.startDate.replace(/'/g, "''")}' AND '${params.endDate.replace(/'/g, "''")}'`);
      }
      const whereSql = whereParts.length > 0 ? '\n    WHERE ' + whereParts.join('\n      AND ') : '';

      const whereFilter = params.aboveAverageOnly !== false
        ? '\nWHERE total_annual_earnings > avg_zone_revenue'
        : '';

      return `WITH zone_summary AS (
    SELECT
        dl.borough, 
        dl.zone,
        ROUND(SUM(CASE WHEN dd.quarter = 1 THEN f.total_amount ELSE 0 END), 2) AS Q1_earnings,
        ROUND(SUM(CASE WHEN dd.quarter = 2 THEN f.total_amount ELSE 0 END), 2) AS Q2_earnings,
        ROUND(SUM(CASE WHEN dd.quarter = 3 THEN f.total_amount ELSE 0 END), 2) AS Q3_earnings,
        ROUND(SUM(CASE WHEN dd.quarter = 4 THEN f.total_amount ELSE 0 END), 2) AS Q4_earnings,
        ROUND(SUM(f.total_amount), 2) AS total_annual_earnings,
        CONCAT(ROUND(100.0 * AVG(f.tip_amount > 0), 2), '%') AS tip_percentage,
        AVG(SUM(f.total_amount)) OVER () AS avg_zone_revenue
    FROM 
        fact_green_trips f
    JOIN 
        dim_location dl ON f.pickup_location_id = dl.location_id
    JOIN 
        dim_date dd ON f.pickup_date_id = dd.date_id${whereSql}
    GROUP BY 
        dl.borough, 
        dl.zone
)
SELECT 
    borough,
    zone,
    Q1_earnings,
    Q2_earnings,
    Q3_earnings,
    Q4_earnings,
    total_annual_earnings,
    tip_percentage
FROM 
    zone_summary${whereFilter}
ORDER BY 
    total_annual_earnings DESC;`.trim();
    }

    case 'report_4': {
      // ROLL-UP & SLICE: December Performance by Weekend, Borough & Vendor (Ryan)
      const sliceMonth = params.sliceMonth || 12;
      const whereParts: string[] = [`d.month = ${sliceMonth}`];

      if (params.r4Weekend !== null && params.r4Weekend !== undefined) {
        whereParts.push(`d.is_weekend = ${params.r4Weekend}`);
      }
      if (params.r4Borough && params.r4Borough !== 'All') {
        whereParts.push(`l.borough = '${params.r4Borough.replace(/'/g, "''")}'`);
      }
      if (params.r4Vendor && params.r4Vendor !== 'All') {
        whereParts.push(`v.vendor_name = '${params.r4Vendor.replace(/'/g, "''")}'`);
      }

      const whereSql = 'WHERE ' + whereParts.join('\n  AND ');

      const withRollup = params.withRollup !== false;
      const rollupClause = withRollup
        ? (dialect === 'duckdb'
            ? 'GROUP BY ROLLUP (d.is_weekend, l.borough, v.vendor_name, d.year, d.month)'
            : 'GROUP BY d.is_weekend, l.borough, v.vendor_name, d.year, d.month WITH ROLLUP')
        : 'GROUP BY d.is_weekend, l.borough, v.vendor_name, d.year, d.month';

      const orderClause = dialect === 'duckdb'
        ? `ORDER BY 
    d.is_weekend NULLS LAST, d.is_weekend,
    l.borough NULLS LAST, l.borough,
    v.vendor_name NULLS LAST, v.vendor_name,
    d.year NULLS LAST, d.year,
    d.month NULLS LAST, d.month`
        : `ORDER BY 
    d.is_weekend IS NULL, d.is_weekend,
    l.borough IS NULL, l.borough,
    v.vendor_name IS NULL, v.vendor_name,
    d.year IS NULL, d.year,
    d.month IS NULL, d.month`;

      return `SELECT 
    d.is_weekend,
    l.borough,
    v.vendor_name AS vendor,
    d.year,
    d.month,
    COUNT(f.trip_id) AS total_trips,
    ROUND(SUM(f.total_amount), 2) AS total_amount_sum,
    ROUND(AVG(f.total_amount), 2) AS avg_trip_amount
FROM fact_green_trips f
JOIN dim_date d 
    ON f.pickup_date_id = d.date_id
JOIN dim_location l 
    ON f.pickup_location_id = l.location_id
JOIN dim_vendor v 
    ON f.vendor_id = v.vendor_id
${whereSql}
${rollupClause}
${orderClause};`.trim();
    }

    case 'report_5': {
      // ROLL-UP: Revenue & Distance by Payment Type and Date (Ryan)
      const whereParts: string[] = [];
      if (params.r5PaymentType && params.r5PaymentType !== 'All') {
        whereParts.push(`p.payment_type_name = '${params.r5PaymentType.replace(/'/g, "''")}'`);
      }
      if (params.startDate && params.endDate) {
        whereParts.push(`d.full_date BETWEEN '${params.startDate.replace(/'/g, "''")}' AND '${params.endDate.replace(/'/g, "''")}'`);
      }
      const whereSql = whereParts.length > 0 ? '\nWHERE ' + whereParts.join('\n  AND ') : '';

      const gran = params.dateHierarchy || 'Day';
      let dateCols = 'd.year, d.month, d.day';
      let orderCols = dialect === 'duckdb'
        ? 'd.year NULLS LAST, d.year, d.month NULLS LAST, d.month, d.day NULLS LAST, d.day, p.payment_type_name'
        : 'd.year IS NULL, d.year, d.month IS NULL, d.month, d.day IS NULL, d.day, p.payment_type_name';

      if (gran === 'Month') {
        dateCols = 'd.year, d.month';
        orderCols = dialect === 'duckdb'
          ? 'd.year NULLS LAST, d.year, d.month NULLS LAST, d.month, p.payment_type_name'
          : 'd.year IS NULL, d.year, d.month IS NULL, d.month, p.payment_type_name';
      } else if (gran === 'Year') {
        dateCols = 'd.year';
        orderCols = dialect === 'duckdb'
          ? 'd.year NULLS LAST, d.year, p.payment_type_name'
          : 'd.year IS NULL, d.year, p.payment_type_name';
      }

      const withRollup = params.r5WithRollup !== false;
      const rollupClause = withRollup
        ? (dialect === 'duckdb'
            ? `GROUP BY ROLLUP (p.payment_type_name, ${dateCols})`
            : `GROUP BY p.payment_type_name, ${dateCols} WITH ROLLUP`)
        : `GROUP BY p.payment_type_name, ${dateCols}`;

      if (dialect === 'mysql') {
        return `SELECT 
    p.payment_type_name AS payment_type,
    ${dateCols},
    SUM(f.total_trips) AS total_trips,
    ROUND(SUM(f.total_revenue), 2) AS total_revenue,
    ROUND(SUM(f.total_tip), 2) AS total_tip,
    ROUND(SUM(f.sum_dist) / NULLIF(SUM(f.count_dist), 0), 2) AS avg_dist
FROM (
    SELECT 
        pickup_date_id,
        payment_type_id,
        COUNT(trip_id) AS total_trips,
        SUM(total_amount) AS total_revenue,
        SUM(tip_amount) AS total_tip,
        SUM(trip_distance) AS sum_dist,
        COUNT(trip_distance) AS count_dist
    FROM fact_green_trips
    GROUP BY pickup_date_id, payment_type_id
) f
JOIN dim_payment_type p 
    ON f.payment_type_id = p.payment_type_id
JOIN dim_date d 
    ON f.pickup_date_id = d.date_id${whereSql}
${rollupClause}
ORDER BY 
    ${orderCols};`.trim();
      }

      return `SELECT 
    p.payment_type_name AS payment_type,
    ${dateCols},
    COUNT(f.trip_id) AS total_trips,
    ROUND(SUM(f.total_amount), 2) AS total_revenue,
    ROUND(SUM(f.tip_amount), 2) AS total_tip,
    ROUND(AVG(f.trip_distance), 2) AS avg_dist
FROM fact_green_trips f
JOIN dim_payment_type p 
    ON f.payment_type_id = p.payment_type_id
JOIN dim_date d 
    ON f.pickup_date_id = d.date_id${whereSql}
${rollupClause}
ORDER BY 
    ${orderCols};`.trim();
    }

    default:
      return 'SELECT 1 AS status;';
  }
}
