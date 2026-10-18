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
        orig_sql = self.config["original_query"]
        opt_sql = self.config["optimized_query"]

        self.cursor.execute(orig_sql)
        orig_results = self.cursor.fetchall()

        self.cursor.execute(opt_sql)
        opt_results = self.cursor.fetchall()

        self.assertGreater(len(orig_results), 0)
        self.assertEqual(orig_results, opt_results)

    def test_december_slice_constraint(self):
        sql = self.config["optimized_query"]
        self.cursor.execute(sql)
        rows = self.cursor.fetchall()

        for is_weekend, borough, vendor, year, month, trips, total_sum, avg_amount in rows:
            if month is not None:
                self.assertEqual(int(month), 12)
                self.assertEqual(int(year), 2021)

    def test_rollup_hierarchy_structure(self):
        sql = self.config["optimized_query"]
        self.cursor.execute(sql)
        rows = self.cursor.fetchall()

        grand_totals = [r for r in rows if r[0] is None]
        self.assertGreater(len(grand_totals), 0)

        subtotals = [r for r in rows if r[4] is None and r[0] is not None]
        self.assertGreater(len(subtotals), 0)

    def test_positive_aggregates(self):
        sql = self.config["optimized_query"]
        self.cursor.execute(sql)
        rows = self.cursor.fetchall()

        for is_weekend, borough, vendor, year, month, trips, total_sum, avg_amount in rows:
            self.assertGreater(trips, 0)
            self.assertGreater(float(total_sum), 0.0)
            self.assertGreater(float(avg_amount), 0.0)

    def test_rollup_grand_total_math_consistency(self):
        sql = self.config["optimized_query"]
        self.cursor.execute(sql)
        rows = self.cursor.fetchall()

        grand_total_rows = [r for r in rows if r[0] is None]
        self.assertEqual(len(grand_total_rows), 1)
        grand_total_trips = grand_total_rows[0][5]
        grand_total_amount = float(grand_total_rows[0][6])

        weekend_subtotals = [r for r in rows if r[0] is not None and r[1] is None]
        sum_subtotal_trips = sum(r[5] for r in weekend_subtotals)
        sum_subtotal_amount = sum(float(r[6]) for r in weekend_subtotals)

        self.assertEqual(grand_total_trips, sum_subtotal_trips)
        self.assertAlmostEqual(grand_total_amount, sum_subtotal_amount, places=1)

    def test_valid_weekend_domain(self):
        sql = self.config["optimized_query"]
        self.cursor.execute(sql)
        rows = self.cursor.fetchall()

        valid_domain = {0, 1, None}
        for r in rows:
            is_weekend = r[0]
            self.assertIn(is_weekend, valid_domain)


if __name__ == '__main__':
    unittest.main()
