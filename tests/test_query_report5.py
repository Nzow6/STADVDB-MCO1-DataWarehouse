import os
import sys
import unittest
import mysql.connector

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
        orig_sql = self.config["original_query"]
        opt_sql = self.config["optimized_query"]

        self.cursor.execute(orig_sql)
        orig_results = self.cursor.fetchall()

        self.cursor.execute(opt_sql)
        opt_results = self.cursor.fetchall()

        self.assertGreater(len(orig_results), 0)
        self.assertEqual(orig_results, opt_results)

    def test_rollup_hierarchy_structure(self):
        sql = self.config["optimized_query"]
        self.cursor.execute(sql)
        rows = self.cursor.fetchall()

        grand_total_rows = [r for r in rows if r[0] is None]
        self.assertEqual(len(grand_total_rows), 1)

        payment_subtotals = [r for r in rows if r[0] is not None and r[1] is None]
        self.assertGreater(len(payment_subtotals), 0)

        detailed_rows = [r for r in rows if r[3] is not None]
        self.assertGreater(len(detailed_rows), 0)

    def test_rollup_grand_total_math_consistency(self):
        sql = self.config["optimized_query"]
        self.cursor.execute(sql)
        rows = self.cursor.fetchall()

        grand_total_rows = [r for r in rows if r[0] is None]
        self.assertEqual(len(grand_total_rows), 1)
        grand_trips = grand_total_rows[0][4]
        grand_revenue = float(grand_total_rows[0][5])

        payment_subtotals = [r for r in rows if r[0] is not None and r[1] is None]
        sum_subtotal_trips = sum(r[4] for r in payment_subtotals)
        sum_subtotal_revenue = sum(float(r[5]) for r in payment_subtotals)

        self.assertEqual(grand_trips, sum_subtotal_trips)
        self.assertAlmostEqual(grand_revenue, sum_subtotal_revenue, places=1)

    def test_payment_types_presence(self):
        sql = self.config["optimized_query"]
        self.cursor.execute(sql)
        rows = self.cursor.fetchall()

        payment_types = set(r[0] for r in rows if r[0] is not None)
        self.assertIn("Credit card", payment_types)
        self.assertIn("Cash", payment_types)

    def test_metric_bounds(self):
        sql = self.config["optimized_query"]
        self.cursor.execute(sql)
        rows = self.cursor.fetchall()

        for ptype, yr, mo, dy, trips, revenue, tip, avg_dist in rows:
            self.assertGreater(trips, 0)
            self.assertGreater(float(revenue), 0.0)
            self.assertGreaterEqual(float(tip), 0.0)
            self.assertGreaterEqual(float(avg_dist), 0.0)

    def test_credit_card_tip_distribution(self):
        sql = self.config["optimized_query"]
        self.cursor.execute(sql)
        rows = self.cursor.fetchall()

        cc_subtotals = [r for r in rows if r[0] == "Credit card" and r[1] is None]
        self.assertEqual(len(cc_subtotals), 1)
        cc_total_tips = float(cc_subtotals[0][6])
        self.assertGreater(cc_total_tips, 0.0)


if __name__ == '__main__':
    unittest.main()
