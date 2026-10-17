"""
==============================================================================
STADVDB MCO1: DuckDB to MySQL ETL Pipeline for NYC Green Taxi 2021 Data Warehouse
==============================================================================
"""

import os
import sys
import time
import datetime
import calendar
import pandas as pd
import duckdb
import mysql.connector

# ------------------------------------------------------------------------------
# Configuration (Can be overridden via environment variables)
# ------------------------------------------------------------------------------
DB_CONFIG = {
    'host': os.environ.get('MYSQL_HOST', '127.0.0.1'),
    'port': int(os.environ.get('MYSQL_PORT', 3306)),
    'user': os.environ.get('MYSQL_USER', 'root'),
    'password': os.environ.get('MYSQL_PASSWORD', 'password'),
    'database': os.environ.get('MYSQL_DATABASE', 'green_taxi_dw'),
    'allow_local_infile': True
}

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TAX_ZONE_CSV = os.path.join(SCRIPT_DIR, 'taxi_zone_lookup.csv')
PARQUET_PATTERN = os.path.join(SCRIPT_DIR, 'green_tripdata_2021-*.parquet').replace('\\', '/')
SCHEMA_SQL = os.path.join(SCRIPT_DIR, 'schema.sql')

# MySQL Uploads folder for ultra-fast LOAD DATA INFILE
MYSQL_UPLOADS_DIR = r"C:\ProgramData\MySQL\MySQL Server 8.0\Uploads"
EXPORT_CSV_PATH = os.path.join(MYSQL_UPLOADS_DIR, "fact_green_trips.csv").replace('\\', '/')


def get_db_connection(create_db_if_missing=True):
    """Establishes connection to MySQL server."""
    if create_db_if_missing:
        conn = mysql.connector.connect(
            host=DB_CONFIG['host'],
            port=DB_CONFIG['port'],
            user=DB_CONFIG['user'],
            password=DB_CONFIG['password']
        )
        cur = conn.cursor()
        cur.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_CONFIG['database']}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
        conn.commit()
        conn.close()

    return mysql.connector.connect(**DB_CONFIG)


def run_schema_ddl(conn):
    """Executes the DDL from schema.sql."""
    print(">> Initializing Schema DDL from schema.sql...")
    cursor = conn.cursor()
    with open(SCHEMA_SQL, 'r', encoding='utf-8') as f:
        ddl_script = f.read()

    # Execute statements separated by semicolons
    statements = [stmt.strip() for stmt in ddl_script.split(';') if stmt.strip()]
    for stmt in statements:
        if stmt.upper().startswith("CREATE DATABASE") or stmt.upper().startswith("USE"):
            continue
        cursor.execute(stmt)
    conn.commit()
    cursor.close()
    print("   [+] Schema tables and indexes created successfully.")


def load_static_dimensions(conn):
    """Populates dim_vendor, dim_rate_code, dim_payment_type, dim_trip_type."""
    print(">> Populating static dimensions...")
    cursor = conn.cursor()

    # 1. dim_vendor
    vendors = [
        (1, 'Creative Mobile Technologies, LLC'),
        (2, 'VeriFone Inc.')
    ]
    cursor.executemany(
        "INSERT INTO dim_vendor (vendor_id, vendor_name) VALUES (%s, %s) "
        "ON DUPLICATE KEY UPDATE vendor_name=VALUES(vendor_name);",
        vendors
    )

    # 2. dim_rate_code
    rate_codes = [
        (1, 'Standard rate'),
        (2, 'JFK'),
        (3, 'Newark'),
        (4, 'Nassau or Westchester'),
        (5, 'Negotiated fare'),
        (6, 'Group ride')
    ]
    cursor.executemany(
        "INSERT INTO dim_rate_code (rate_code_id, rate_code_name) VALUES (%s, %s) "
        "ON DUPLICATE KEY UPDATE rate_code_name=VALUES(rate_code_name);",
        rate_codes
    )

    # 3. dim_payment_type
    payment_types = [
        (1, 'Credit card'),
        (2, 'Cash'),
        (3, 'No charge'),
        (4, 'Dispute'),
        (5, 'Unknown'),
        (6, 'Voided trip')
    ]
    cursor.executemany(
        "INSERT INTO dim_payment_type (payment_type_id, payment_type_name) VALUES (%s, %s) "
        "ON DUPLICATE KEY UPDATE payment_type_name=VALUES(payment_type_name);",
        payment_types
    )

    # 4. dim_trip_type
    trip_types = [
        (1, 'Street-hail'),
        (2, 'Dispatch')
    ]
    cursor.executemany(
        "INSERT INTO dim_trip_type (trip_type_id, trip_type_name) VALUES (%s, %s) "
        "ON DUPLICATE KEY UPDATE trip_type_name=VALUES(trip_type_name);",
        trip_types
    )

    conn.commit()
    cursor.close()
    print("   [+] Static dimensions loaded: dim_vendor, dim_rate_code, dim_payment_type, dim_trip_type.")


def load_dim_location(conn):
    """Loads dim_location from taxi_zone_lookup.csv (Locations 1 to 263)."""
    print(f">> Populating dim_location from {TAX_ZONE_CSV}...")
    df = pd.read_csv(TAX_ZONE_CSV)
    df.columns = [c.lower() for c in df.columns]
    df_valid = df[df['locationid'] <= 263].copy()
    df_valid['service_zone'] = df_valid['service_zone'].fillna('Unknown')
    df_valid['borough'] = df_valid['borough'].fillna('Unknown')
    df_valid['zone'] = df_valid['zone'].fillna('Unknown')

    cursor = conn.cursor()
    records = [
        (int(row['locationid']), str(row['borough']), str(row['zone']), str(row['service_zone']))
        for _, row in df_valid.iterrows()
    ]
    cursor.executemany(
        "INSERT INTO dim_location (location_id, borough, zone, service_zone) VALUES (%s, %s, %s, %s) "
        "ON DUPLICATE KEY UPDATE borough=VALUES(borough), zone=VALUES(zone), service_zone=VALUES(service_zone);",
        records
    )
    conn.commit()
    cursor.close()
    print(f"   [+] Loaded {len(records)} zones into dim_location (Locations 1 to 263).")


def load_dim_date(conn):
    """Populates dim_date for all days of 2021 plus buffer for 2022-01-01 dropoffs."""
    print(">> Populating dim_date (2021-01-01 to 2022-01-02)...")
    start_date = datetime.date(2021, 1, 1)
    end_date = datetime.date(2022, 1, 2)
    delta = datetime.timedelta(days=1)

    records = []
    curr = start_date
    while curr <= end_date:
        date_id = int(curr.strftime("%Y%m%d"))
        quarter = (curr.month - 1) // 3 + 1
        month_name = calendar.month_name[curr.month]
        day_of_week = calendar.day_name[curr.weekday()]
        is_weekend = 1 if curr.weekday() in [5, 6] else 0

        records.append((
            date_id,
            curr,
            curr.year,
            quarter,
            curr.month,
            month_name,
            curr.day,
            day_of_week,
            is_weekend
        ))
        curr += delta

    cursor = conn.cursor()
    cursor.executemany(
        "INSERT INTO dim_date (date_id, full_date, year, quarter, month, month_name, day, day_of_week, is_weekend) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) "
        "ON DUPLICATE KEY UPDATE full_date=VALUES(full_date);",
        records
    )
    conn.commit()
    cursor.close()
    print(f"   [+] Loaded {len(records)} calendar days into dim_date.")


def load_dim_time(conn):
    """Populates dim_time (hourly grain: 24 rows, 0 to 23)."""
    print(">> Populating dim_time (24 hours: 0 to 23)...")
    records = []
    for h in range(24):
        time_id = h
        full_time = f"{h:02d}:00:00"

        # Day brackets
        if 0 <= h <= 5:
            day_bracket = 'Late Night'
        elif 6 <= h <= 8:
            day_bracket = 'Early Morning'
        elif 9 <= h <= 11:
            day_bracket = 'Morning Rush'
        elif 12 <= h <= 15:
            day_bracket = 'Midday'
        elif 16 <= h <= 19:
            day_bracket = 'Evening Rush'
        else:
            day_bracket = 'Night'

        # Peak surcharge hour (16-19)
        is_peak_surcharge = 1 if 16 <= h <= 19 else 0

        records.append((time_id, full_time, h, day_bracket, is_peak_surcharge))

    cursor = conn.cursor()
    cursor.executemany(
        "INSERT INTO dim_time (time_id, full_time, hour_24, day_bracket, is_peak_surcharge) "
        "VALUES (%s, %s, %s, %s, %s) "
        "ON DUPLICATE KEY UPDATE full_time=VALUES(full_time);",
        records
    )
    conn.commit()
    cursor.close()
    print(f"   [+] Loaded {len(records)} hours into dim_time.")


def extract_transform_and_load_facts(conn):
    """
    Uses DuckDB to extract and transform records from Parquet files according to strict criteria,
    then loads into MySQL fact_green_trips using high-speed bulk ingestion.
    """
    print(f">> Extracting & Transforming data using DuckDB from {PARQUET_PATTERN}...")
    start_time = time.time()

    duck_con = duckdb.connect()

    # Optimized transformation SQL
    transform_sql = f"""
    SELECT 
        CAST(strftime(lpep_pickup_datetime, '%Y%m%d') AS INT) AS pickup_date_id,
        CAST(strftime(lpep_dropoff_datetime, '%Y%m%d') AS INT) AS dropoff_date_id,
        CAST(strftime(lpep_pickup_datetime, '%H') AS INT) AS pickup_time_id,
        CAST(strftime(lpep_dropoff_datetime, '%H') AS INT) AS dropoff_time_id,
        CAST(PULocationID AS INT) AS pickup_location_id,
        CAST(DOLocationID AS INT) AS dropoff_location_id,
        CASE 
            WHEN CAST(VendorID AS INT) IN (1, 2) THEN CAST(VendorID AS INT)
            ELSE 2 
        END AS vendor_id,
        CASE 
            WHEN CAST(RatecodeID AS INT) BETWEEN 1 AND 6 THEN CAST(RatecodeID AS INT)
            ELSE 1 
        END AS rate_code_id,
        CASE 
            WHEN CAST(payment_type AS INT) BETWEEN 1 AND 6 THEN CAST(payment_type AS INT)
            ELSE 5 
        END AS payment_type_id,
        CASE 
            WHEN CAST(trip_type AS INT) IN (1, 2) THEN CAST(trip_type AS INT)
            ELSE 1 
        END AS trip_type_id,
        COALESCE(store_and_fwd_flag, 'N') AS store_and_fwd_flag,
        COALESCE(CAST(passenger_count AS INT), 1) AS passenger_count,
        ROUND(CAST(trip_distance AS DECIMAL(8,2)), 2) AS trip_distance,
        ROUND(CAST(fare_amount AS DECIMAL(8,2)), 2) AS fare_amount,
        ROUND(CAST(extra AS DECIMAL(8,2)), 2) AS extra,
        ROUND(CAST(mta_tax AS DECIMAL(8,2)), 2) AS mta_tax,
        ROUND(CAST(tip_amount AS DECIMAL(8,2)), 2) AS tip_amount,
        ROUND(CAST(tolls_amount AS DECIMAL(8,2)), 2) AS tolls_amount,
        ROUND(CAST(COALESCE(improvement_surcharge, 0) AS DECIMAL(8,2)), 2) AS improvement_surcharge,
        ROUND(CAST(COALESCE(congestion_surcharge, 0) AS DECIMAL(8,2)), 2) AS congestion_surcharge,
        ROUND(CAST(total_amount AS DECIMAL(8,2)), 2) AS total_amount,
        CAST(epoch(lpep_dropoff_datetime) - epoch(lpep_pickup_datetime) AS INT) AS trip_duration_seconds
    FROM '{PARQUET_PATTERN}'
    WHERE lpep_pickup_datetime >= '2021-01-01' AND lpep_pickup_datetime < '2022-01-01'
      AND lpep_dropoff_datetime >= lpep_pickup_datetime
      AND PULocationID BETWEEN 1 AND 263 AND DOLocationID BETWEEN 1 AND 263
      AND total_amount > 0 AND trip_distance >= 0
    """

    cursor = conn.cursor()

    # Attempt fast export to CSV for LOAD DATA INFILE
    loaded_via_infile = False
    try:
        print(f">> Exporting transformed records to {EXPORT_CSV_PATH} via DuckDB...")
        duck_con.execute(f"COPY ({transform_sql}) TO '{EXPORT_CSV_PATH}' (HEADER FALSE, DELIMITER ',');")
        
        # Check file size
        file_size_mb = os.path.getsize(EXPORT_CSV_PATH) / (1024 * 1024)
        print(f"   [+] Exported CSV successfully ({file_size_mb:.2f} MB).")
        
        print(">> Ingesting into MySQL fact_green_trips via LOAD DATA INFILE...")
        load_sql = f"""
        LOAD DATA INFILE '{EXPORT_CSV_PATH}'
        INTO TABLE fact_green_trips
        FIELDS TERMINATED BY ','
        LINES TERMINATED BY '\\n'
        (
            pickup_date_id,
            dropoff_date_id,
            pickup_time_id,
            dropoff_time_id,
            pickup_location_id,
            dropoff_location_id,
            vendor_id,
            rate_code_id,
            payment_type_id,
            trip_type_id,
            store_and_fwd_flag,
            passenger_count,
            trip_distance,
            fare_amount,
            extra,
            mta_tax,
            tip_amount,
            tolls_amount,
            improvement_surcharge,
            congestion_surcharge,
            total_amount,
            trip_duration_seconds
        );
        """
        cursor.execute(load_sql)
        conn.commit()
        loaded_via_infile = True
        print("   [+] Ingested all records using LOAD DATA INFILE successfully!")
    except Exception as e:
        print(f"   [!] LOAD DATA INFILE encountered note: {e}")
        print("   [*] Falling back to high-throughput chunked stream insertion...")

    if not loaded_via_infile:
        # Fallback: Stream in chunks using DuckDB cursor fetch
        chunk_size = 25000
        duck_cur = duck_con.cursor()
        duck_cur.execute(transform_sql)

        insert_sql = """
        INSERT INTO fact_green_trips (
            pickup_date_id, dropoff_date_id, pickup_time_id, dropoff_time_id,
            pickup_location_id, dropoff_location_id, vendor_id, rate_code_id,
            payment_type_id, trip_type_id, store_and_fwd_flag, passenger_count,
            trip_distance, fare_amount, extra, mta_tax, tip_amount, tolls_amount,
            improvement_surcharge, congestion_surcharge, total_amount, trip_duration_seconds
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        """
        total_rows = 0
        while True:
            batch = duck_cur.fetchmany(chunk_size)
            if not batch:
                break
            cursor.executemany(insert_sql, batch)
            conn.commit()
            total_rows += len(batch)
            print(f"   -> Inserted {total_rows:,} records...")

    # Verification
    cursor.execute("SELECT COUNT(*) FROM fact_green_trips;")
    final_count = cursor.fetchone()[0]
    elapsed = time.time() - start_time
    print(f">> Fact table load complete: {final_count:,} rows inserted in {elapsed:.2f} seconds!")
    cursor.close()


def main():
    print("=" * 70)
    print("STARTING ETL PROCESS: NYC GREEN TAXI 2021 DATA WAREHOUSE")
    print("=" * 70)
    
    total_start = time.time()
    
    # 1. Connect & Init DDL
    conn = get_db_connection(create_db_if_missing=True)
    run_schema_ddl(conn)

    # 2. Populate Dimensions
    load_static_dimensions(conn)
    load_dim_location(conn)
    load_dim_date(conn)
    load_dim_time(conn)

    # 3. Extract, Transform & Ingest Fact Table
    extract_transform_and_load_facts(conn)

    conn.close()
    
    total_elapsed = time.time() - total_start
    print("=" * 70)
    print(f"ETL COMPLETED SUCCESSFULLY IN {total_elapsed:.2f} SECONDS!")
    print("=" * 70)


if __name__ == '__main__':
    main()
