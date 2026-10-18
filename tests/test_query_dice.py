"""
Functional and Equivalence Tests for the DICE OLAP Query (Report 2 - Enzo).
Title: Monthly Weekday Borough Tip Rate Ranking (Dice)
Uses Python's built-in unittest framework.
"""

import os
import sys
import unittest
import mysql.connector

# Ensure src is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src')))
from queries import REPORTS

DB_CONFIG = {
    'host': os.environ.get('MYSQL_HOST', '127.0.0.1'),
    'port': int(os.environ.get('MYSQL_PORT', 3306)),
    'user': os.environ.get('MYSQL_USER', 'root'),
    'password': os.environ.get('MYSQL_PASSWORD', 'password'),
    'database': os.environ.get('MYSQL_DATABASE', 'green_taxi_dw')
}


class TestDiceQuery(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        try:
            cls.conn = mysql.connector.connect(**DB_CONFIG)
            cls.cursor = cls.conn.cursor()
            cls.config = REPORTS["report_2"]
        except Exception as e:
            raise unittest.SkipTest(f"MySQL connection not available: {e}")

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, 'cursor') and cls.cursor:
            cls.cursor.close()
        if hasattr(cls, 'conn') and cls.conn:
            cls.conn.close()

    def test_optimization_equivalence(self):
        """
        Correctness Test: Proves that removing redundant table joins (dim_time,
        dim_payment_type, dim_trip_type) returns the exact same data rows.
        """
        orig_sql = self.config["original_query"]
        opt_sql = self.config["optimized_query"]

        self.cursor.execute(orig_sql)
        orig_results = self.cursor.fetchall()

        self.cursor.execute(opt_sql)
        opt_results = self.cursor.fetchall()

        self.assertGreater(len(orig_results), 0, "Query returned no rows!")
        self.assertEqual(orig_results, opt_results, "Optimized query produced different results than unoptimized query!")

    def test_all_12_months_present(self):
        """Validates that weekday dice filtering covers all 12 calendar months of 2021."""
        sql = self.config["optimized_query"]
        self.cursor.execute(sql)
        rows = self.cursor.fetchall()

        months = set(r[0] for r in rows)
        self.assertEqual(len(months), 12, f"Expected 12 months, found {len(months)}: {months}")

    def test_monthly_rank_ordering(self):
        """
        Window Function Test:
        Validates that within each month, ranks start at 1 and tip rates are strictly descending.
        """
        sql = self.config["optimized_query"]
        self.cursor.execute(sql)
        rows = self.cursor.fetchall()

        # Group rows by month
        by_month = {}
        for month_name, borough, tip_rate, rank in rows:
            by_month.setdefault(month_name, []).append((borough, float(tip_rate) if tip_rate is not None else 0.0, rank))

        for month_name, month_rows in by_month.items():
            with self.subTest(month=month_name):
                ranks = [r[2] for r in month_rows]
                tip_rates = [r[1] for r in month_rows]

                # Ranks start at 1
                self.assertEqual(ranks[0], 1, f"{month_name} does not start at rank 1!")
                # Ranks increment monotonically
                self.assertEqual(ranks, list(range(1, len(ranks) + 1)))
                # Tip rates are strictly non-increasing within the month
                for i in range(len(tip_rates) - 1):
                    self.assertGreaterEqual(tip_rates[i], tip_rates[i + 1])

    def test_tip_rate_valid_range(self):
        """Data Quality Test: Validates that average tip rates are non-negative and realistic."""
        sql = self.config["optimized_query"]
        self.cursor.execute(sql)
        rows = self.cursor.fetchall()

        for month_name, borough, tip_rate, rank in rows:
            if tip_rate is not None:
                rate_val = float(tip_rate)
                self.assertGreaterEqual(rate_val, 0.0, f"Negative tip rate in {month_name} {borough}: {rate_val}")
                # Average tip rate in NYC rarely exceeds 100% of fare
                self.assertLessEqual(rate_val, 1.0, f"Unusually high average tip rate (>100%) in {month_name} {borough}: {rate_val}")

    def test_no_null_boroughs_or_months(self):
        """Schema Integrity Test: Validates that month_name, borough, and rank are never NULL."""
        sql = self.config["optimized_query"]
        self.cursor.execute(sql)
        rows = self.cursor.fetchall()

        for month_name, borough, tip_rate, rank in rows:
            self.assertIsNotNone(month_name, "Found NULL month_name!")
            self.assertIsNotNone(borough, "Found NULL borough!")
            self.assertIsNotNone(rank, "Found NULL rank!")

    def test_borough_partitioning_cardinality(self):
        """
        Partition Uniqueness Test:
        Validates that within any single month, each borough appears at most once.
        """
        sql = self.config["optimized_query"]
        self.cursor.execute(sql)
        rows = self.cursor.fetchall()

        by_month = {}
        for month_name, borough, tip_rate, rank in rows:
            by_month.setdefault(month_name, []).append(borough)

        for month_name, boroughs in by_month.items():
            self.assertEqual(
                len(boroughs), len(set(boroughs)),
                f"Duplicate borough found in month {month_name}: {boroughs}"
            )


if __name__ == '__main__':
    unittest.main()

