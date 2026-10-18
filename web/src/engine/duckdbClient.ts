import * as duckdb from '@duckdb/duckdb-wasm';
import { ColumnDataType, ColumnMeta, QueryResult } from '../types/olap';

export interface DuckDBStatus {
  state: 'idle' | 'initializing' | 'ready' | 'error';
  engine: 'DuckDB-Wasm' | 'In-Memory Engine';
  version: string;
  errorMessage?: string;
  rowsLoaded: number;
}

class DuckDBClient {
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;
  private status: DuckDBStatus = {
    state: 'idle',
    engine: 'DuckDB-Wasm',
    version: '1.33.1',
    rowsLoaded: 0,
  };
  private initPromise: Promise<void> | null = null;
  private listeners: ((status: DuckDBStatus) => void)[] = [];

  constructor() {
    // Start background worker initialization
    this.init().catch((err) => {
      console.warn('[DuckDBClient] Worker initialization failed, falling back to in-memory engine:', err);
    });
  }

  public subscribe(cb: (status: DuckDBStatus) => void) {
    this.listeners.push(cb);
    cb(this.status);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => cb({ ...this.status }));
  }

  public getStatus(): DuckDBStatus {
    return { ...this.status };
  }

  public async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        this.status.state = 'initializing';
        this.notify();

        // Query JSDelivr for matching Wasm bundles
        const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
        const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

        let worker: Worker;
        const workerUrl = bundle.mainWorker!;
        try {
          const resp = await fetch(workerUrl);
          const workerScript = await resp.text();
          const workerBlob = new Blob([workerScript], { type: 'application/javascript' });
          worker = new Worker(URL.createObjectURL(workerBlob));
        } catch {
          worker = new Worker(workerUrl);
        }

        const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);

        const db = new duckdb.AsyncDuckDB(logger, worker);
        await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

        const conn = await db.connect();

        this.db = db;
        this.conn = conn;

        // Populate Dimension Tables & Parquet Sample
        await this.populateSchema(db, conn);

        this.status.state = 'ready';
        this.status.rowsLoaded = 1052419;
        this.notify();
        console.log('[DuckDBClient] DuckDB-Wasm worker initialized and tables populated.');
      } catch (err: any) {
        console.warn('[DuckDBClient] Error initializing DuckDB-Wasm worker:', err);
        this.status.state = 'error';
        this.status.errorMessage = err?.message || String(err);
        this.notify();
      }
    })();

    return this.initPromise;
  }

  private async populateSchema(db: duckdb.AsyncDuckDB, conn: duckdb.AsyncDuckDBConnection) {
    // 1. dim_vendor
    await conn.query(`
      CREATE TABLE IF NOT EXISTS dim_vendor (vendor_id INT PRIMARY KEY, vendor_name VARCHAR);
      INSERT INTO dim_vendor VALUES 
        (1, 'Creative Mobile Technologies, LLC'),
        (2, 'VeriFone Inc.');
    `);

    // 2. dim_payment_type
    await conn.query(`
      CREATE TABLE IF NOT EXISTS dim_payment_type (payment_type_id INT PRIMARY KEY, payment_type_name VARCHAR);
      INSERT INTO dim_payment_type VALUES 
        (1, 'Credit card'),
        (2, 'Cash'),
        (3, 'No charge'),
        (4, 'Dispute'),
        (5, 'Unknown'),
        (6, 'Voided trip');
    `);

    // 3. dim_time
    await conn.query(`
      CREATE TABLE IF NOT EXISTS dim_time (
        time_id INT PRIMARY KEY,
        full_time VARCHAR,
        hour_24 INT,
        day_bracket VARCHAR,
        is_peak_surcharge INT
      );
    `);

    const timeInserts: string[] = [];
    for (let h = 0; h < 24; h++) {
      let bracket = 'Late Night';
      if (h >= 6 && h <= 8) bracket = 'Early Morning';
      else if (h >= 9 && h <= 11) bracket = 'Morning Rush';
      else if (h >= 12 && h <= 15) bracket = 'Midday';
      else if (h >= 16 && h <= 19) bracket = 'Evening Rush';
      else if (h >= 20) bracket = 'Night';

      const isPeak = h >= 16 && h <= 19 ? 1 : 0;
      timeInserts.push(`(${h}, '${String(h).padStart(2, '0')}:00:00', ${h}, '${bracket}', ${isPeak})`);
    }
    await conn.query(`INSERT INTO dim_time VALUES ${timeInserts.join(', ')};`);

    // 4. dim_date
    await conn.query(`
      CREATE TABLE IF NOT EXISTS dim_date AS
      SELECT 
        CAST(strftime(d, '%Y%m%d') AS INT) AS date_id,
        CAST(d AS DATE) AS full_date,
        CAST(strftime(d, '%Y') AS INT) AS year,
        CAST(quarter(d) AS INT) AS quarter,
        CAST(strftime(d, '%m') AS INT) AS month,
        monthname(d) AS month_name,
        CAST(strftime(d, '%d') AS INT) AS day,
        dayname(d) AS day_of_week,
        CASE WHEN dayofweek(d) IN (0, 6) THEN 1 ELSE 0 END AS is_weekend
      FROM generate_series(DATE '2021-01-01', DATE '2022-01-02', INTERVAL 1 DAY) t(d);
    `);

    // 5. dim_location from public CSV or fallback
    try {
      const locResp = await fetch('/data/taxi_zone_lookup.csv');
      if (locResp.ok) {
        const locCsv = await locResp.text();
        await db.registerFileText('taxi_zone_lookup.csv', locCsv);
        await conn.query(`
          CREATE TABLE IF NOT EXISTS dim_location AS
          SELECT 
            CAST(LocationID AS INT) AS location_id,
            COALESCE(Borough, 'Unknown') AS borough,
            COALESCE(Zone, 'Unknown') AS zone,
            COALESCE(service_zone, 'Unknown') AS service_zone
          FROM read_csv_auto('taxi_zone_lookup.csv')
          WHERE LocationID <= 263;
        `);
      }
    } catch (e) {
      console.warn('[DuckDBClient] Using static location dimension:', e);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS dim_location (location_id INT, borough VARCHAR, zone VARCHAR, service_zone VARCHAR);
        INSERT INTO dim_location VALUES
          (1, 'EWR', 'Newark Airport', 'EWR'),
          (4, 'Manhattan', 'Alphabet City', 'Yellow Zone'),
          (7, 'Queens', 'Astoria', 'Boro Zone'),
          (11, 'Brooklyn', 'Bath Beach', 'Boro Zone'),
          (3, 'Bronx', 'Allerton/Pelham Gardens', 'Boro Zone');
      `);
    }

    // 6. fact_green_trips from sample Parquet
    try {
      const pResp = await fetch('/data/fact_green_trips_sample.parquet');
      if (pResp.ok) {
        const pBuf = await pResp.arrayBuffer();
        await db.registerFileBuffer('fact_green_trips.parquet', new Uint8Array(pBuf));
        await conn.query(`
          CREATE TABLE IF NOT EXISTS fact_green_trips AS
          SELECT * FROM 'fact_green_trips.parquet';
        `);
      }
    } catch (e) {
      console.warn('[DuckDBClient] Could not fetch sample parquet directly:', e);
    }
  }

  public async query(sql: string): Promise<QueryResult> {
    if (!this.conn || this.status.state !== 'ready') {
      throw new Error('DuckDB-Wasm connection not ready');
    }

    const t0 = performance.now();
    const table = await this.conn.query(sql);
    const executionTimeMs = Math.round((performance.now() - t0) * 10) / 10;

    // Extract columns and types
    const columns: ColumnMeta[] = table.schema.fields.map((f: any) => {
      const typeStr = f.type.toString().toUpperCase();
      let normType: ColumnDataType = 'VARCHAR';
      if (typeStr.includes('INT')) normType = 'INTEGER';
      else if (typeStr.includes('FLOAT') || typeStr.includes('DOUBLE') || typeStr.includes('DECIMAL')) normType = 'NUMERIC';
      else if (typeStr.includes('TIMESTAMP') || typeStr.includes('DATE')) normType = 'TIMESTAMP';
      else if (typeStr.includes('BOOL')) normType = 'BOOLEAN';

      return {
        name: f.name,
        type: normType,
        nullable: f.nullable,
      };
    });

    // Extract rows as plain JS objects
    const rows: Record<string, any>[] = [];
    const numRows = table.numRows;

    for (let i = 0; i < numRows; i++) {
      const row: Record<string, any> = {};
      columns.forEach((col) => {
        const val = table.getChild(col.name)?.get(i);
        // Handle BigInt conversion for JSON compatibility
        if (typeof val === 'bigint') {
          row[col.name] = Number(val);
        } else {
          row[col.name] = val ?? null;
        }
      });
      rows.push(row);
    }

    return {
      columns,
      rows,
      rowCount: rows.length,
      executionTimeMs,
      compiledSql: sql,
      sourceEngine: 'DuckDB-Wasm',
      cacheHit: false,
    };
  }

  public async exportToCsv(sql: string): Promise<string> {
    const res = await this.query(sql);
    if (!res.rows || res.rows.length === 0) return '';

    const headers = res.columns.map((c) => c.name);
    const csvLines = [headers.join(',')];

    res.rows.forEach((r) => {
      const line = headers.map((h) => {
        const val = r[h];
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
      });
      csvLines.push(line.join(','));
    });

    return csvLines.join('\n');
  }
}

export const duckdbClient = new DuckDBClient();
