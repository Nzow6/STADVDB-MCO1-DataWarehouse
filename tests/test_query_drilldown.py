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


class TestDrillDownPivotQuery(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            cls.conn = mysql.connector.connect(**DB_CONFIG)
            cls.cursor = cls.conn.cursor()
            cls.config = REPORTS["report_3"]
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
        self.assertEqual(len(orig_results), 74)
        self.assertEqual(orig_results, opt_results)

    def test_schema_and_column_contract(self):
        self.cursor.execute(self.config["optimized_query"])
        self.cursor.fetchall()
        cols = [desc[0] for desc in self.cursor.description]
        expected_cols = [
            "borough", "zone", "Q1_earnings", "Q2_earnings",
            "Q3_earnings", "Q4_earnings", "total_annual_earnings", "tip_percentage"
        ]
        self.assertEqual(cols, expected_cols)

    def test_pivot_earnings_reconciliation(self):
        self.cursor.execute(self.config["optimized_query"])
        rows = self.cursor.fetchall()
        for r in rows:
            q1, q2, q3, q4, total = float(r[2]), float(r[3]), float(r[4]), float(r[5]), float(r[6])
            self.assertAlmostEqual(q1 + q2 + q3 + q4, total, places=2)


if __name__ == '__main__':
    unittest.main()
