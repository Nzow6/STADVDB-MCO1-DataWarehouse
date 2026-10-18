"""
Functional and Equivalence Tests for the ROLLUP OLAP Query (Report 4 - Ryan).
Title: Multi-Dimensional Performance and Revenue Analysis by Weekend, Borough, Vendor, and Period for December (Rollup + Slice)
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


class TestRollupQuery(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        try:
            cls.conn = mysql.connector.connect(**DB_CONFIG)
            cls.cursor = cls.conn.cursor()
            cls.config = REPORTS["report_4"]
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
        Correctness Test: Proves that the covering index yields the exact same
        aggregations and rollup rows as the baseline query.
        """
        orig_sql = self.config["original_query"]
        opt_sql = self.config["optimized_query"]

        self.cursor.execute(orig_sql)
        orig_results = self.cursor.fetchall()

        self.cursor.execute(opt_sql)
        opt_results = self.cursor.fetchall()

        self.assertGreater(len(orig_results), 0, "Query returned no rows!")
        self.assertEqual(orig_results, opt_results, "Optimized query produced different results than unoptimized query!")

    def test_december_slice_constraint(self):
        """
        Slice Filter Validation:
        Confirms that every non-rollup detailed row strictly contains month = 12 and year = 2021.
        """
        sql = self.config["optimized_query"]
        self.cursor.execute(sql)
        rows = self.cursor.fetchall()

        for is_weekend, borough, vendor, year, month, trips, total_sum, avg_amount in rows:
            # Check detailed rows where month is not null (subtotal rows will have month=None)
            if month is not None:
                self.assertEqual(int(month), 12, f"Found non-December month: {month}")
                self.assertEqual(int(year), 2021, f"Found non-2021 year: {year}")

    def test_rollup_hierarchy_structure(self):
        """
        Rollup Validation:
        Confirms WITH ROLLUP generates hierarchical subtotal rows and a grand total row.
        """
        sql = self.config["optimized_query"]
        self.cursor.execute(sql)
        rows = self.cursor.fetchall()

        # Grand total row has is_weekend IS NULL
        grand_totals = [r for r in rows if r[0] is None]
        self.assertGreater(len(grand_totals), 0, "No grand total row found in ROLLUP results!")

        # Subtotal rows have month IS NULL but is_weekend IS NOT NULL
        subtotals = [r for r in rows if r[4] is None and r[0] is not None]
        self.assertGreater(len(subtotals), 0, "No intermediate subtotal rows found in ROLLUP results!")

    def test_positive_aggregates(self):
        """Data Quality Test: Validates that trip counts and revenues are strictly positive."""
        sql = self.config["optimized_query"]
        self.cursor.execute(sql)
        rows = self.cursor.fetchall()

        for is_weekend, borough, vendor, year, month, trips, total_sum, avg_amount in rows:
            self.assertGreater(trips, 0, f"Found non-positive trips: {trips}")
            self.assertGreater(float(total_sum), 0.0, f"Found non-positive total sum: {total_sum}")
            self.assertGreater(float(avg_amount), 0.0, f"Found non-positive average: {avg_amount}")

    def test_rollup_grand_total_math_consistency(self):
        """
        Mathematical Invariant Test:
        In WITH ROLLUP, the grand total trip count (where is_weekend IS NULL) must exactly
        equal the sum of trips from the highest-level subtotal partitions (is_weekend = 0 and is_weekend = 1).
        """
        sql = self.config["optimized_query"]
        self.cursor.execute(sql)
        rows = self.cursor.fetchall()

        # Grand total row: is_weekend is None
        grand_total_rows = [r for r in rows if r[0] is None]
        self.assertEqual(len(grand_total_rows), 1, "Expected exactly 1 grand total row!")
        grand_total_trips = grand_total_rows[0][5]
        grand_total_amount = float(grand_total_rows[0][6])

        # Top-level partition subtotals: is_weekend in (0, 1) and borough is None
        weekend_subtotals = [r for r in rows if r[0] is not None and r[1] is None]
        sum_subtotal_trips = sum(r[5] for r in weekend_subtotals)
        sum_subtotal_amount = sum(float(r[6]) for r in weekend_subtotals)

        self.assertEqual(grand_total_trips, sum_subtotal_trips,
                         f"Grand total trips ({grand_total_trips}) != sum of weekend subtotals ({sum_subtotal_trips})")
        self.assertAlmostEqual(grand_total_amount, sum_subtotal_amount, places=1,
                               msg=f"Grand total revenue ({grand_total_amount}) != sum of weekend subtotal revenue ({sum_subtotal_amount})")

    def test_valid_weekend_domain(self):
        """Domain Validation Test: Confirms is_weekend is either 0, 1, or None (rollup subtotals)."""
        sql = self.config["optimized_query"]
        self.cursor.execute(sql)
        rows = self.cursor.fetchall()

        valid_domain = {0, 1, None}
        for r in rows:
            is_weekend = r[0]
            self.assertIn(is_weekend, valid_domain, f"Invalid is_weekend value found: {is_weekend}")


if __name__ == '__main__':
    unittest.main()

