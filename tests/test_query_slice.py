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


class TestSliceQuery(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            cls.conn = mysql.connector.connect(**DB_CONFIG)
            cls.cursor = cls.conn.cursor()
            cls.config = REPORTS["report_1"]
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

    def test_revenue_rank_dense_order(self):
        sql = self.config["optimized_query"]
        self.cursor.execute(sql)
        rows = self.cursor.fetchall()

        ranks = [row[4] for row in rows]
        revenues = [row[2] for row in rows]

        self.assertEqual(ranks[0], 1)
        self.assertEqual(ranks, list(range(1, len(rows) + 1)))
        for i in range(len(revenues) - 1):
            self.assertGreaterEqual(revenues[i], revenues[i + 1])

    def test_borough_coverage(self):
        sql = self.config["optimized_query"]
        self.cursor.execute(sql)
        rows = self.cursor.fetchall()
        boroughs = [r[0] for r in rows]

        for b in ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"]:
            self.assertIn(b, boroughs)

    def test_borough_metric_bounds(self):
        sql = self.config["optimized_query"]
        self.cursor.execute(sql)
        rows = self.cursor.fetchall()

        for b_name, trips, revenue, avg_fare, rank in rows:
            with self.subTest(borough=b_name):
                self.assertGreater(trips, 0)
                self.assertGreater(float(revenue), 0.0)
                self.assertGreater(float(avg_fare), 0.0)

        top_borough = rows[0][0]
        self.assertEqual(top_borough, "Manhattan")


if __name__ == '__main__':
    unittest.main()
