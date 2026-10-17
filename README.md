# STADVDB MCO1: Query Processing in a Data Warehouse
**NYC Green Taxi 2021 Data Warehouse**

This repository contains the complete database foundation and automated ETL implementation for **STADVDB MCO1**:
- **Target Star Schema DDL** for MySQL 8.0 (`schema.sql`).
- **High-Performance DuckDB ETL Pipeline** (`etl.py`) extracting from 2021 NYC Green Taxi Parquet data and loading 1,052,419 rows into MySQL.

---

## 🏗️ Dimensional Data Warehouse Architecture

The data warehouse follows a **Star Schema** centered on the `fact_green_trips` table:

```
                          +-------------------+
                          |     dim_date      |
                          +-------------------+
                          | PK date_id        |
                          |    full_date      |
                          |    year, quarter  |
                          |    month, day     |
                          |    is_weekend     |
                          +-------------------+
                                    |
                                    | (1:N Role-Playing: Pickup & Dropoff)
+-------------------+               v               +-------------------+
|   dim_location    |      +-----------------+      |     dim_time      |
+-------------------+      |fact_green_trips |      +-------------------+
| PK location_id    |----->| PK trip_id      |<-----| PK time_id (0-23) |
|    borough        |      | FK dates        |      |    full_time      |
|    zone           |      | FK times        |      |    hour_24        |
|    service_zone   |      | FK locations    |      |    day_bracket    |
+-------------------+      | FK vendor       |      | is_peak_surcharge |
                           | FK rate_code    |      +-------------------+
+-------------------+      | FK payment_type |      +-------------------+
|    dim_vendor     |----->| FK trip_type    |<-----|   dim_rate_code   |
+-------------------+      | measures (fare, |      +-------------------+
                           | distance, tip,  |
+-------------------+      | total, duration)|      +-------------------+
| dim_payment_type  |----->+-----------------+<-----|   dim_trip_type   |
+-------------------+                               +-------------------+
```

---

## 🔄 The Data Population & ETL Process (Step-by-Step)

The entire population process is automated inside `etl.py` using **DuckDB** and **MySQL Connector**:

### Step 1: DDL & Schema Initialization
1. Creates the database `green_taxi_dw` if it does not already exist.
2. Drops existing tables in reverse foreign-key dependency order to allow clean re-runs.
3. Executes `schema.sql` to instantiate the 7 dimension tables and `fact_green_trips` using MySQL InnoDB engine with `utf8mb4` encoding, foreign key constraints, and performance indexes.

### Step 2: Populating the Dimension Tables
* **Static Lookup Dimensions:**
  * `dim_vendor`: Populates 2 official vendors (1: Creative Mobile Technologies, 2: VeriFone Inc.).
  * `dim_rate_code`: Populates 6 fare rate codes (1: Standard rate, 2: JFK, 3: Newark, 4: Nassau/Westchester, 5: Negotiated fare, 6: Group ride).
  * `dim_payment_type`: Populates 6 payment categories (1: Credit card, 2: Cash, 3: No charge, 4: Dispute, 5: Unknown, 6: Voided trip).
  * `dim_trip_type`: Populates 2 trip types (1: Street-hail, 2: Dispatch).
* **Location Dimension (`dim_location`):**
  * Reads `taxi_zone_lookup.csv` using pandas.
  * Filters to official NYC zones $1 \le \text{LocationID} \le 263$.
  * Handles missing values by replacing `NULL` boroughs, zones, or service zones with `'Unknown'`.
  * Ingests 263 zone rows via `executemany` with `ON DUPLICATE KEY UPDATE`.
* **Date Dimension (`dim_date`):**
  * Programmatically generates all calendar days for 2021 plus buffer through `2022-01-02` (367 days) to ensure New Year's Eve trips dropping off after midnight maintain referential integrity.
  * Computes surrogate key `date_id` (format `YYYYMMDD`), `full_date`, `year`, `quarter`, `month`, `month_name`, `day`, `day_of_week`, and `is_weekend` (1 for Saturday/Sunday, else 0).
* **Time Dimension (`dim_time`):**
  * Programmatically populates all 24 hours of the day (`0` to `23`).
  * Generates surrogate key `time_id` (`0` to `23`), `full_time` (`HH:00:00`), `hour_24`, and human-facing `day_bracket`:
    * `00:00 - 05:59`: 'Late Night'
    * `06:00 - 08:59`: 'Early Morning'
    * `09:00 - 11:59`: 'Morning Rush'
    * `12:00 - 15:59`: 'Midday'
    * `16:00 - 19:59`: 'Evening Rush'
    * `20:00 - 23:59`: 'Night'
  * Sets `is_peak_surcharge = 1` for Evening Rush hours 16–19, else 0.

### Step 3: Extracting, Transforming & Cleaning Fact Records
DuckDB processes all 12 raw monthly Parquet files (`green_tripdata_2021-01.parquet` through `green_tripdata_2021-12.parquet`) concurrently without memory exhaustion:
* **Filtering Criteria:**
  1. `lpep_pickup_datetime >= '2021-01-01' AND lpep_pickup_datetime < '2022-01-01'` — Eliminates corrupt/out-of-scope timestamps.
  2. `lpep_dropoff_datetime >= lpep_pickup_datetime` — Eliminates inverted timestamp anomalies.
  3. `PULocationID BETWEEN 1 AND 263 AND DOLocationID BETWEEN 1 AND 263` — Guarantees all trips match valid spatial dimensions.
  4. `total_amount > 0 AND trip_distance >= 0` — Filters out dispute voids, negative amounts, and erroneous negative distances.
* **Key Generation & Normalization:**
  * `pickup_date_id` / `dropoff_date_id`: Integer `YYYYMMDD` via `strftime`.
  * `pickup_time_id` / `dropoff_time_id`: Hour integer `0–23` via `strftime`.
  * `trip_duration_seconds`: Calculated as `epoch(dropoff) - epoch(pickup)`.
  * Unrecorded or dispatch `payment_type = 0` cleanly mapped to `5` ('Unknown').
  * Out-of-range vendor/rate/trip IDs mapped safely to standard values.
  * Measures cast and rounded to `DECIMAL(8,2)`.

### Step 4: High-Throughput Bulk Ingestion
1. **Primary Ingestion (`LOAD DATA INFILE`):**
   * DuckDB exports the cleaned, transformed dataset directly to `C:\ProgramData\MySQL\MySQL Server 8.0\Uploads\fact_green_trips.csv` (~94 MB).
   * Executes MySQL native `LOAD DATA INFILE` directly into `fact_green_trips`, inserting all **1,052,419 rows in ~130 seconds**.
2. **Resilient Fallback:**
   * If `LOAD DATA INFILE` permissions are disabled on any host machine, the script automatically catches the event and falls back to chunked streaming cursor inserts in batches of 25,000 rows.

---

## 🚀 How to Reproduce the Exact Database

Anyone on your team can reproduce the exact same database in **under 3 minutes**:

### 1. Prerequisites
- **MySQL 8.0+** running locally (default port `3306`).
- **Python 3.10+**.
- Required Python libraries:
  ```bash
  pip install pandas duckdb mysql-connector-python pyarrow
  ```

### 2. Configure Credentials (Optional)
By default, `etl.py` connects using:
- **User:** `root`
- **Password:** `password`
- **Database:** `green_taxi_dw`

If your local MySQL credentials differ, set environment variables before running:
```bash
# In Windows PowerShell:
$env:MYSQL_PASSWORD = "your_mysql_password"

# In Bash / macOS / Linux:
export MYSQL_PASSWORD="your_mysql_password"
```

### 3. Run the ETL Pipeline
Run the ETL script from the project folder:
```bash
python etl.py
```

---

## 📊 Verification & Row Counts

Verify table counts in MySQL:
```sql
USE green_taxi_dw;

SELECT 'dim_date' AS tbl, COUNT(*) FROM dim_date
UNION ALL SELECT 'dim_time', COUNT(*) FROM dim_time
UNION ALL SELECT 'dim_location', COUNT(*) FROM dim_location
UNION ALL SELECT 'dim_vendor', COUNT(*) FROM dim_vendor
UNION ALL SELECT 'dim_rate_code', COUNT(*) FROM dim_rate_code
UNION ALL SELECT 'dim_payment_type', COUNT(*) FROM dim_payment_type
UNION ALL SELECT 'dim_trip_type', COUNT(*) FROM dim_trip_type
UNION ALL SELECT 'fact_green_trips', COUNT(*) FROM fact_green_trips;
```

**Expected Results:**
- `dim_date`: 367 rows
- `dim_time`: 24 rows
- `dim_location`: 263 rows
- `dim_vendor`: 2 rows
- `dim_rate_code`: 6 rows
- `dim_payment_type`: 6 rows
- `dim_trip_type`: 2 rows
- `fact_green_trips`: 1,052,419 rows
