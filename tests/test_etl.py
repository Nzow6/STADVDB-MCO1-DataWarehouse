"""
STADVDB MCO1: Comprehensive ETL & Data Warehouse Validation Suite
Covers:
  1. Data Wrangling & Cleaning Unit Tests (Edge Cases on sample data)
  2. Live Data Warehouse Referential Integrity & Sanity Tests (on the 1,052,419 rows)
Uses Python's built-in unittest framework (no external pip packages required).
"""

import os
import unittest
import duckdb
import pandas as pd
import mysql.connector

DB_CONFIG = {
    'host': os.environ.get('MYSQL_HOST', '127.0.0.1'),
    'port': int(os.environ.get('MYSQL_PORT', 3306)),
    'user': os.environ.get('MYSQL_USER', 'root'),
    'password': os.environ.get('MYSQL_PASSWORD', 'password'),
    'database': os.environ.get('MYSQL_DATABASE', 'green_taxi_dw')
}


# ==============================================================================
# Suite 1: Data Wrangling & Cleaning Logic (Fast In-Memory Tests)
# ==============================================================================
class TestETLDataWrangling(unittest.TestCase):
    """Tests ETL filtering, cleaning, key derivation, and edge-case handling."""

    @classmethod
    def setUpClass(cls):
        # Hand-crafted edge case trips
        cls.raw_trips = [
            # 1. Standard valid trip
            {
                "trip_id": 1,
                "VendorID": 1,
                "lpep_pickup_datetime": "2021-01-15 08:30:00",
                "lpep_dropoff_datetime": "2021-01-15 08:45:00",
                "PULocationID": 74,
                "DOLocationID": 75,
                "RatecodeID": 1,
                "payment_type": 1,
                "trip_type": 1,
                "store_and_fwd_flag": "N",
                "passenger_count": 1,
                "trip_distance": 2.50,
                "fare_amount": 11.50,
                "extra": 0.50,
                "mta_tax": 0.50,
                "tip_amount": 2.00,
                "tolls_amount": 0.00,
                "improvement_surcharge": 0.30,
                "congestion_surcharge": 0.00,
                "total_amount": 14.80,
            },
            # 2. Midnight New Year's Eve transition (Dec 31 2021 -> Jan 01 2022)
            {
                "trip_id": 2,
                "VendorID": 2,
                "lpep_pickup_datetime": "2021-12-31 23:50:00",
                "lpep_dropoff_datetime": "2022-01-01 00:15:00",
                "PULocationID": 41,
                "DOLocationID": 42,
                "RatecodeID": 1,
                "payment_type": 2,
                "trip_type": 1,
                "store_and_fwd_flag": "N",
                "passenger_count": 2,
                "trip_distance": 3.80,
                "fare_amount": 16.00,
                "extra": 0.50,
                "mta_tax": 0.50,
                "tip_amount": 0.00,
                "tolls_amount": 0.00,
                "improvement_surcharge": 0.30,
                "congestion_surcharge": 0.00,
                "total_amount": 17.30,
            },
            # 3. Invalid: Dropoff before pickup (inverted timestamps)
            {
                "trip_id": 3,
                "VendorID": 2,
                "lpep_pickup_datetime": "2021-06-10 18:00:00",
                "lpep_dropoff_datetime": "2021-06-10 17:50:00",
                "PULocationID": 74,
                "DOLocationID": 75,
                "RatecodeID": 1,
                "payment_type": 1,
                "trip_type": 1,
                "store_and_fwd_flag": "N",
                "passenger_count": 1,
                "trip_distance": 1.00,
                "fare_amount": 5.00,
                "extra": 0.00,
                "mta_tax": 0.50,
                "tip_amount": 0.00,
                "tolls_amount": 0.00,
                "improvement_surcharge": 0.30,
                "congestion_surcharge": 0.00,
                "total_amount": 5.80,
            },
            # 4. Invalid: Negative total amount
            {
                "trip_id": 4,
                "VendorID": 1,
                "lpep_pickup_datetime": "2021-07-04 12:00:00",
                "lpep_dropoff_datetime": "2021-07-04 12:20:00",
                "PULocationID": 74,
                "DOLocationID": 75,
                "RatecodeID": 1,
                "payment_type": 4,
                "trip_type": 1,
                "store_and_fwd_flag": "N",
                "passenger_count": 1,
                "trip_distance": 2.00,
                "fare_amount": -10.00,
                "extra": 0.00,
                "mta_tax": 0.00,
                "tip_amount": 0.00,
                "tolls_amount": 0.00,
                "improvement_surcharge": 0.00,
                "congestion_surcharge": 0.00,
                "total_amount": -10.00,
            },
            # 5. Invalid: Out-of-bounds LocationID 265 (> 263)
            {
                "trip_id": 5,
                "VendorID": 2,
                "lpep_pickup_datetime": "2021-08-20 15:00:00",
                "lpep_dropoff_datetime": "2021-08-20 15:30:00",
                "PULocationID": 265,
                "DOLocationID": 75,
                "RatecodeID": 1,
                "payment_type": 1,
                "trip_type": 1,
                "store_and_fwd_flag": "N",
                "passenger_count": 1,
                "trip_distance": 3.00,
                "fare_amount": 12.00,
                "extra": 0.00,
                "mta_tax": 0.50,
                "tip_amount": 2.00,
                "tolls_amount": 0.00,
                "improvement_surcharge": 0.30,
                "congestion_surcharge": 0.00,
                "total_amount": 14.80,
            },
            # 6. Null defaults and payment_type 0 mapping
            {
                "trip_id": 6,
                "VendorID": 2,
                "lpep_pickup_datetime": "2021-09-12 17:15:00",
                "lpep_dropoff_datetime": "2021-09-12 17:45:00",
                "PULocationID": 130,
                "DOLocationID": 131,
                "RatecodeID": 1,
                "payment_type": 0,  # 0 must be mapped to 5 ('Unknown')
                "trip_type": 2,
                "store_and_fwd_flag": None,
                "passenger_count": None,
                "trip_distance": 4.50,
                "fare_amount": 18.00,
                "extra": 1.00,
                "mta_tax": 0.50,
                "tip_amount": 0.00,
                "tolls_amount": 0.00,
                "improvement_surcharge": 0.30,
                "congestion_surcharge": 0.00,
                "total_amount": 19.80,
            }
        ]

        df_raw = pd.DataFrame(cls.raw_trips)
        df_raw['lpep_pickup_datetime'] = pd.to_datetime(df_raw['lpep_pickup_datetime'])
        df_raw['lpep_dropoff_datetime'] = pd.to_datetime(df_raw['lpep_dropoff_datetime'])

        con = duckdb.connect()
        con.register('sample_trips', df_raw)

        transform_sql = """
        SELECT 
            trip_id,
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
        FROM sample_trips
        WHERE lpep_pickup_datetime >= '2021-01-01' AND lpep_pickup_datetime < '2022-01-01'
          AND lpep_dropoff_datetime >= lpep_pickup_datetime
          AND PULocationID BETWEEN 1 AND 263 AND DOLocationID BETWEEN 1 AND 263
          AND total_amount > 0 AND trip_distance >= 0
        """
        cls.df_clean = con.execute(transform_sql).fetchdf()

    def test_key_generation(self):
        """Verifies date_id (YYYYMMDD), time_id (HH), and trip_duration_seconds derivation."""
        row = self.df_clean[self.df_clean['trip_id'] == 1].iloc[0]
        self.assertEqual(row['pickup_date_id'], 20210115)
        self.assertEqual(row['dropoff_date_id'], 20210115)
        self.assertEqual(row['pickup_time_id'], 8)
        self.assertEqual(row['trip_duration_seconds'], 900)  # 15 mins = 900s

    def test_midnight_year_boundary(self):
        """Verifies trips crossing New Year's Eve map correctly to 20220101 dropoff date."""
        row = self.df_clean[self.df_clean['trip_id'] == 2].iloc[0]
        self.assertEqual(row['pickup_date_id'], 20211231)
        self.assertEqual(row['dropoff_date_id'], 20220101)
        self.assertEqual(row['pickup_time_id'], 23)
        self.assertEqual(row['dropoff_time_id'], 0)
        self.assertEqual(row['trip_duration_seconds'], 1500)

    def test_inverted_timestamps_rejected(self):
        """Data Wrangling Rule: Drops trips with dropoff earlier than pickup."""
        rejected = self.df_clean[self.df_clean['trip_id'] == 3]
        self.assertEqual(len(rejected), 0)

    def test_negative_total_amount_rejected(self):
        """Data Wrangling Rule: Drops trips with total_amount <= 0."""
        rejected = self.df_clean[self.df_clean['trip_id'] == 4]
        self.assertEqual(len(rejected), 0)

    def test_out_of_range_location_rejected(self):
        """Data Wrangling Rule: Drops trips with LocationID not in 1..263."""
        rejected = self.df_clean[self.df_clean['trip_id'] == 5]
        self.assertEqual(len(rejected), 0)

    def test_null_defaults_and_payment_mapping(self):
        """Data Wrangling Rule: Maps payment_type 0 to 5 ('Unknown') and assigns defaults."""
        row = self.df_clean[self.df_clean['trip_id'] == 6].iloc[0]
        self.assertEqual(row['payment_type_id'], 5)
        self.assertEqual(row['store_and_fwd_flag'], 'N')
        self.assertEqual(row['passenger_count'], 1)


# ==============================================================================
# Suite 2: Live Warehouse Sanity & Referential Integrity Tests
# ==============================================================================
class TestLiveWarehouseIntegrity(unittest.TestCase):
    """Verifies live MySQL green_taxi_dw table structure, counts, and FK constraints."""

    @classmethod
    def setUpClass(cls):
        try:
            cls.conn = mysql.connector.connect(**DB_CONFIG)
            cls.cursor = cls.conn.cursor()
        except Exception as e:
            raise unittest.SkipTest(f"Live MySQL database not available: {e}")

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, 'cursor') and cls.cursor:
            cls.cursor.close()
        if hasattr(cls, 'conn') and cls.conn:
            cls.conn.close()

    def test_all_schema_tables_exist(self):
        """Confirms all 8 tables are present in green_taxi_dw."""
        self.cursor.execute("SHOW TABLES;")
        tables = [r[0].lower() for r in self.cursor.fetchall()]
        expected = [
            'dim_date', 'dim_time', 'dim_location', 'dim_vendor',
            'dim_rate_code', 'dim_payment_type', 'dim_trip_type', 'fact_green_trips'
        ]
        for tbl in expected:
            self.assertIn(tbl, tables, f"Table {tbl} missing from database!")

    def test_dimension_row_counts(self):
        """Confirms required row counts for all dimension tables."""
        counts = {
            'dim_time': 24,
            'dim_location': 263,
            'dim_vendor': 2,
            'dim_rate_code': 6,
            'dim_payment_type': 6,
            'dim_trip_type': 2
        }
        for tbl, expected in counts.items():
            self.cursor.execute(f"SELECT COUNT(*) FROM {tbl};")
            actual = self.cursor.fetchone()[0]
            self.assertEqual(actual, expected, f"{tbl} count mismatch!")

        self.cursor.execute("SELECT COUNT(*) FROM dim_date;")
        date_count = self.cursor.fetchone()[0]
        self.assertGreaterEqual(date_count, 365, "dim_date should have >= 365 days")

    def test_fact_table_row_count(self):
        """Confirms fact_green_trips loaded full 1.05M dataset."""
        self.cursor.execute("SELECT COUNT(*) FROM fact_green_trips;")
        count = self.cursor.fetchone()[0]
        self.assertGreaterEqual(count, 1000000, f"Expected >= 1M rows, got {count:,}")

    def test_zero_orphaned_foreign_keys(self):
        """
        Referential Integrity Test:
        Validates that 0 orphaned foreign keys exist in fact_green_trips.
        """
        fk_checks = [
            ("pickup_date_id", "dim_date", "date_id"),
            ("dropoff_date_id", "dim_date", "date_id"),
            ("pickup_time_id", "dim_time", "time_id"),
            ("dropoff_time_id", "dim_time", "time_id"),
            ("pickup_location_id", "dim_location", "location_id"),
            ("dropoff_location_id", "dim_location", "location_id"),
            ("vendor_id", "dim_vendor", "vendor_id"),
            ("rate_code_id", "dim_rate_code", "rate_code_id"),
            ("payment_type_id", "dim_payment_type", "payment_type_id"),
            ("trip_type_id", "dim_trip_type", "trip_type_id")
        ]
        for fk_col, dim_tbl, pk_col in fk_checks:
            query = f"""
            SELECT COUNT(*) 
            FROM fact_green_trips f 
            LEFT JOIN {dim_tbl} d ON f.{fk_col} = d.{pk_col} 
            WHERE d.{pk_col} IS NULL;
            """
            self.cursor.execute(query)
            orphans = self.cursor.fetchone()[0]
            self.assertEqual(orphans, 0, f"Found {orphans} orphaned records in fact_green_trips.{fk_col}!")

    def test_measure_domain_bounds(self):
        """Data Quality Test: Validates metric boundaries and domain constraints."""
        self.cursor.execute("""
        SELECT 
            MIN(trip_distance),
            MIN(total_amount),
            MIN(trip_duration_seconds),
            MIN(pickup_date_id),
            MAX(pickup_date_id)
        FROM fact_green_trips;
        """)
        min_dist, min_total, min_dur, min_pu_date, max_pu_date = self.cursor.fetchone()
        self.assertGreaterEqual(float(min_dist), 0.0)
        self.assertGreater(float(min_total), 0.0)
        self.assertGreaterEqual(int(min_dur), 0)
        self.assertGreaterEqual(int(min_pu_date), 20210101)
        self.assertLessEqual(int(max_pu_date), 20211231)


if __name__ == '__main__':
    unittest.main()
