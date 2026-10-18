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


class TestUniversalReports(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            cls.conn = mysql.connector.connect(**DB_CONFIG)
            cls.cursor = cls.conn.cursor()
        except Exception as e:
            raise unittest.SkipTest(f"MySQL not available: {e}")

    @classmethod
    def tearDownClass(cls):
        if hasattr(cls, 'cursor') and cls.cursor:
            cls.cursor.close()
        if hasattr(cls, 'conn') and cls.conn:
            cls.conn.close()

    def test_all_registered_reports_execution_and_equivalence(self):
        tested_count = 0

        for report_key, report_data in REPORTS.items():
            orig_sql = report_data.get("original_query")
            opt_sql = report_data.get("optimized_query")
            title = report_data.get("title", report_key)

            with self.subTest(report=title):
                if not orig_sql or not opt_sql:
                    continue

                try:
                    self.cursor.execute(orig_sql)
                    orig_results = self.cursor.fetchall()
                    orig_cols = [desc[0] for desc in self.cursor.description]
                except Exception as e:
                    self.fail(f"Original query for '{title}' failed: {e}")

                self.assertGreater(len(orig_results), 0, f"'{title}' returned 0 rows")

                try:
                    self.cursor.execute(opt_sql)
                    opt_results = self.cursor.fetchall()
                    opt_cols = [desc[0] for desc in self.cursor.description]
                except Exception as e:
                    self.fail(f"Optimized query for '{title}' failed: {e}")

                self.assertGreater(len(opt_results), 0, f"'{title}' returned 0 rows")
                self.assertEqual(len(orig_cols), len(opt_cols), f"Column count mismatch in '{title}'")
                self.assertEqual(orig_results, opt_results, f"Result mismatch in '{title}'")

                print(f"[+] {title}: Equivalence verified ({len(opt_results)} rows).")
                tested_count += 1

        self.assertGreater(tested_count, 0, "No reports tested")


if __name__ == '__main__':
    unittest.main()
