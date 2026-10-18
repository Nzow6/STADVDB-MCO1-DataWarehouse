"""
Functional, Equivalence, and Hierarchical Tests for Report 5 (Ryan).
Title: Green Taxi Aggregate Revenue and Distance by Payment Type and Date (Rollup)
Operation: ROLLUP across Payment Type -> Year -> Month -> Day
Framework: Python standard library unittest.
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


class TestReport5Rollup(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        try:
            cls.conn = mysql.connector.connect(**DB_CONFIG)
            cls.cursor = cls.conn.cursor()
            cls.config = REPORTS["report_5"]
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
        Correctness & Equivalence Test:
        Validates that the baseline query and index-backed query yield the exact
        same rows, subtotals, and metrics.
        """
        orig_sql = self.config["original_query"]
        opt_sql = self.config["optimized_query"]

        self.cursor.execute(orig_sql)
        orig_results = self.cursor.fetchall()

        self.cursor.execute(opt_sql)
        opt_results = self.cursor.fetchall()

        self.assertGreater(len(orig_results), 0, "Query returned 0 rows!")
        self.assertEqual(orig_results, opt_results,
                         "Optimized query results do not match baseline query results!")

    def test_rollup_hierarchy_structure(self):
        """
        Rollup Structural Integrity Test:
        Validates that WITH ROLLUP generates hierarchical aggregation rows:
        1. Grand total row (payment_type is None)
        2. Payment-level subtotal rows (year is None, payment_type is not None)
        3. Detailed daily rows (all grouping keys populated)
        """
        sql = self.config["optimized_query"]
        self.cursor.execute(sql)
        rows = self.cursor.fetchall()

        # Grand total row: payment_type IS NULL
        grand_total_rows = [r for r in rows if r[0] is None]
        self.assertEqual(len(grand_total_rows), 1, "Expected exactly 1 grand total row!")

        # Payment-type level subtotals: year IS NULL and payment_type IS NOT NULL
        payment_subtotals = [r for r in rows if r[0] is not None and r[1] is None]
        self.assertGreater(len(payment_subtotals), 0, "No payment-level subtotal rows found!")

        # Detailed daily rows: day IS NOT NULL
        detailed_rows = [r for r in rows if r[3] is not None]
        self.assertGreater(len(detailed_rows), 0, "No daily detailed rows found!")

    def test_rollup_grand_total_math_consistency(self):
        """
        Mathematical Invariant Test:
        In WITH ROLLUP, the grand total trip count and revenue must exactly equal
        the sum of the top-level payment type subtotals.
        """
        sql = self.config["optimized_query"]
        self.cursor.execute(sql)
        rows = self.cursor.fetchall()

        # Grand total
        grand_total_rows = [r for r in rows if r[0] is None]
        self.assertEqual(len(grand_total_rows), 1)
        grand_trips = grand_total_rows[0][4]
        grand_revenue = float(grand_total_rows[0][5])

        # Payment-type subtotals (year is None, payment_type is not None)
        payment_subtotals = [r for r in rows if r[0] is not None and r[1] is None]
        sum_subtotal_trips = sum(r[4] for r in payment_subtotals)
        sum_subtotal_revenue = sum(float(r[5]) for r in payment_subtotals)

        self.assertEqual(grand_trips, sum_subtotal_trips,
                         f"Grand total trips ({grand_trips}) != sum of payment subtotals ({sum_subtotal_trips})")
        self.assertAlmostEqual(grand_revenue, sum_subtotal_revenue, places=1,
                               msg=f"Grand total revenue ({grand_revenue}) != sum of payment subtotal revenue ({sum_subtotal_revenue})")

    def test_payment_types_presence(self):
        """Domain Validation Test: Confirms primary payment types exist in the report."""
        sql = self.config["optimized_query"]
        self.cursor.execute(sql)
        rows = self.cursor.fetchall()

        # Distinct payment types present (excluding Grand Total None)
        payment_types = set(r[0] for r in rows if r[0] is not None)
        self.assertIn("Credit card", payment_types, "Credit card payment type missing!")
        self.assertIn("Cash", payment_types, "Cash payment type missing!")

    def test_metric_bounds(self):
        """Data Quality Test: Validates that trip counts, revenue, and average distance are positive."""
        sql = self.config["optimized_query"]
        self.cursor.execute(sql)
        rows = self.cursor.fetchall()

        for ptype, yr, mo, dy, trips, revenue, tip, avg_dist in rows:
            self.assertGreater(trips, 0, f"Found non-positive trips: {trips}")
            self.assertGreater(float(revenue), 0.0, f"Found non-positive revenue: {revenue}")
            self.assertGreaterEqual(float(tip), 0.0, f"Found negative tip amount: {tip}")
            self.assertGreaterEqual(float(avg_dist), 0.0, f"Found negative avg distance: {avg_dist}")

    def test_credit_card_tip_distribution(self):
        """
        Business Rule Validation:
        In NYC taxi data, tips are electronically recorded primarily on Credit Card transactions.
        Verifies that Credit Card generates positive recorded tips.
        """
        sql = self.config["optimized_query"]
        self.cursor.execute(sql)
        rows = self.cursor.fetchall()

        # Top-level subtotal for Credit card (year is None)
        cc_subtotals = [r for r in rows if r[0] == "Credit card" and r[1] is None]
        self.assertEqual(len(cc_subtotals), 1, "Expected 1 Credit card subtotal row!")
        cc_total_tips = float(cc_subtotals[0][6])
        self.assertGreater(cc_total_tips, 0.0, "Credit card transactions must have recorded tips > 0!")


if __name__ == '__main__':
    unittest.main()
