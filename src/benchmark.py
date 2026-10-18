"""
STADVDB MCO1: Automated Performance Benchmark Runner
Measures and compares query execution times before and after optimization.
Runs raw SQL queries directly with zero parameters or boilerplate.
"""

import os
import sys
import time
import mysql.connector
from queries import REPORTS

def load_env(env_path):
    """Loads environment variables from .env file into os.environ if present."""
    if not os.path.exists(env_path):
        return
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            stripped = line.strip()
            if not stripped or stripped.startswith('#') or '=' not in stripped:
                continue
            key, val = stripped.split('=', 1)
            key = key.strip()
            val = val.strip().strip("'\"")
            if key and key not in os.environ:
                os.environ[key] = val


# Load .env file from project root if it exists
ENV_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env')
load_env(ENV_FILE)

DB_CONFIG = {
    'host': os.environ.get('MYSQL_HOST', '127.0.0.1'),
    'port': int(os.environ.get('MYSQL_PORT', 3306)),
    'user': os.environ.get('MYSQL_USER', 'root'),
    'password': os.environ.get('MYSQL_PASSWORD', 'password'),
    'database': os.environ.get('MYSQL_DATABASE', 'green_taxi_dw')
}

RUNS_PER_QUERY = 1


def benchmark_report(conn, report_key, report_data):
    """Benchmarks a single report before and after optimization."""
    print("=" * 75)
    print(f"BENCHMARKING: {report_data['title']} ({report_data['operation']})")
    print(f"Author: {report_data['author']}")
    print("=" * 75)

    if not report_data.get("original_query") or not report_data.get("optimized_query"):
        print("[-] Skipping: Report queries not yet implemented by team member.\n")
        return None

    cur = conn.cursor()

    # 1. Automatically drop index if specified so baseline is clean
    idx_name = report_data.get("index_name")
    idx_sql = report_data.get("index_create_sql") or ""
    if idx_name:
        # Detect target table from create sql or check common tables
        target_table = "fact_green_trips"
        for tbl in ["dim_date", "dim_time", "dim_location", "dim_vendor", "dim_payment_type", "dim_trip_type"]:
            if f"ON {tbl}" in idx_sql or f"on {tbl}" in idx_sql.lower():
                target_table = tbl
                break
        try:
            cur.execute(f"DROP INDEX `{idx_name}` ON {target_table};")
            conn.commit()
        except Exception:
            pass

    # 2. Benchmark Baseline (Unoptimized) - 1 Run Only
    print(">> Measuring Baseline (Unoptimized) [1 run]...")
    times_unopt = []
    for _ in range(RUNS_PER_QUERY):
        t0 = time.time()
        cur.execute(report_data["original_query"])
        cur.fetchall()
        times_unopt.append(time.time() - t0)

    avg_unopt = sum(times_unopt) / len(times_unopt)
    print(f"   [+] Baseline Time: {avg_unopt:.4f}s")

    # 3. Apply Index Optimization if applicable (otherwise query reformulation/CTE is tested directly)
    if report_data.get("index_create_sql"):
        print(f">> Applying Index Optimization ({report_data.get('index_name', 'Custom Index')})...")
        t0_idx = time.time()
        cur.execute(report_data["index_create_sql"])
        conn.commit()
        print(f"   [+] Index built in {time.time() - t0_idx:.2f}s.")
    else:
        print(">> Testing Query Reformulation / CTE / Join Restructuring (No index required)...")

    # 4. Benchmark Optimized - 1 Run Only
    print(">> Measuring Optimized [1 run]...")
    times_opt = []
    for _ in range(RUNS_PER_QUERY):
        t0 = time.time()
        cur.execute(report_data["optimized_query"])
        cur.fetchall()
        times_opt.append(time.time() - t0)

    avg_opt = sum(times_opt) / len(times_opt)
    speedup_pct = ((avg_unopt - avg_opt) / avg_unopt) * 100
    ratio = avg_unopt / avg_opt if avg_opt > 0 else 0

    print(f"   [+] Optimized Time: {avg_opt:.4f}s")
    print(f"   [+] Performance Improvement: {speedup_pct:.2f}% faster ({ratio:.2f}x speedup)!\n")

    cur.close()
    return {
        "report": report_data["title"],
        "operation": report_data["operation"],
        "baseline_avg": avg_unopt,
        "optimized_avg": avg_opt,
        "speedup_pct": speedup_pct,
        "ratio": ratio
    }


def main():
    conn = mysql.connector.connect(**DB_CONFIG)
    results = []

    for key, data in REPORTS.items():
        res = benchmark_report(conn, key, data)
        if res:
            results.append(res)

    conn.close()

    if results:
        print("\n" + "=" * 75)
        print("SUMMARY BENCHMARK REPORT (FOR ACM TECHNICAL PAPER SECTION 6)")
        print("=" * 75)
        print(f"{'Report Name':<45} | {'Baseline':<10} | {'Optimized':<10} | {'Speedup':<10}")
        print("-" * 75)
        for r in results:
            print(f"{r['report']:<45} | {r['baseline_avg']:<8.4f}s | {r['optimized_avg']:<8.4f}s | {r['speedup_pct']:>6.2f}%")
        print("=" * 75 + "\n")


if __name__ == '__main__':
    main()
