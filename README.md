# STADVDB MCO1: Query Processing in a Data Warehouse
**NYC Green Taxi 2021 Data Warehouse**

This repository contains the database foundation and ETL implementation for **STADVDB MCO1**:
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

This single command will:
1. Create the `green_taxi_dw` database.
2. Execute `schema.sql` to generate all dimension tables, the fact table, foreign keys, and indexes.
3. Programmatically populate `dim_vendor`, `dim_rate_code`, `dim_payment_type`, and `dim_trip_type`.
4. Load `dim_location` (Zones 1 to 263) from `taxi_zone_lookup.csv`.
5. Populate `dim_date` (all 365 calendar days of 2021 + dropoff buffer).
6. Populate `dim_time` (24 hourly brackets with day brackets and surcharge flags).
7. Extract, clean, transform, and ingest **1,052,419 fact records** into `fact_green_trips` in ~2 minutes!

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
