"""
STADVDB MCO1: Universal Query Test Suite
Automatically tests EVERY query registered in src/queries.py for:
  1. Execution Safety (Runs with zero SQL errors)
  2. Non-Empty Results (Returns data from the 1.05M-row database)
  3. Optimization Equivalence (Original and Optimized return identical data)
  4. Column & Schema Consistency (Column counts and structures match)

When a groupmate pastes their query into src/queries.py, it is automatically
tested by this suite immediately with zero extra code needed!
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


class TestUniversalReports(unittest.TestCase):
    """Universal correctness & equivalence tests for all registered reports."""

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

    def test_all_registered_reports_execution_and_equivalence(self):
        """
        Universal Test: Iterates through all reports in src/queries.py.
        For each implemented report, proves:
          - Both original and optimized execute safely
          - Both return > 0 rows
          - Both return identical rows, columns, and values
        """
        tested_count = 0

        for report_key, report_data in REPORTS.items():
            orig_sql = report_data.get("original_query")
            opt_sql = report_data.get("optimized_query")
            title = report_data.get("title", report_key)

            with self.subTest(report=title):
                # If groupmate hasn't implemented their query yet, skip gracefully
                if not orig_sql or not opt_sql:
                    print(f"[-] {title}: Queries not yet added by team member (Skipped).")
                    continue

                # 1. Execute unoptimized (original) query
                try:
                    self.cursor.execute(orig_sql)
                    orig_results = self.cursor.fetchall()
                    orig_cols = [desc[0] for desc in self.cursor.description]
                except Exception as e:
                    self.fail(f"Original query for '{title}' failed with error: {e}")

                self.assertGreater(
                    len(orig_results), 0,
                    f"Original query for '{title}' returned 0 rows!"
                )

                # 2. Execute optimized query
                try:
                    self.cursor.execute(opt_sql)
                    opt_results = self.cursor.fetchall()
                    opt_cols = [desc[0] for desc in self.cursor.description]
                except Exception as e:
                    self.fail(f"Optimized query for '{title}' failed with error: {e}")

                self.assertGreater(
                    len(opt_results), 0,
                    f"Optimized query for '{title}' returned 0 rows!"
                )

                # 3. Assert Column Count Match
                self.assertEqual(
                    len(orig_cols), len(opt_cols),
                    f"Column count mismatch in '{title}': Original has {len(orig_cols)}, Optimized has {len(opt_cols)}"
                )

                # 4. Assert Optimization Equivalence (Identical Data Rows)
                self.assertEqual(
                    orig_results, opt_results,
                    f"CRITICAL: Optimized query for '{title}' returned different data than original query!"
                )

                print(f"[+] {title} ({report_data.get('operation')}): Equivalence verified ({len(opt_results)} matching rows).")
                tested_count += 1

        self.assertGreater(
            tested_count, 0,
            "No reports were tested! At least one report must be implemented."
        )


if __name__ == '__main__':
    unittest.main()
