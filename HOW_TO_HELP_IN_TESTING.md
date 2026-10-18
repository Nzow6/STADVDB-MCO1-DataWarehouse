# 🧪 How to Add, Test & Benchmark Your OLAP Queries
**A Step-by-Step Guide for the STADVDB MCO1 Team**

Welcome! If you have formulated your **unoptimized** and **optimized** OLAP query (whether it's Roll-up, Drill-down, Slice, Dice, or Pivot), follow this guide to plug your query in, test its correctness, and automatically measure its execution speedup for our **Technical Report (Section 6)**.

---

## 📌 Quick Overview of What to Do

1. **Open [`src/queries.py`](src/queries.py)** and pick any empty slot (`report_2`, `report_3`, `report_4`, or `report_5`).
2. **Fill in your query details** and paste your normal SQL.
3. **Run the benchmark script** (`python src/benchmark.py`) to measure before vs. after execution times.
4. **Run the universal test suite** (`python -m unittest tests/test_all_reports.py -v`) to verify correctness.

---

## 🛠️ Step 1: Add Your Query to `src/queries.py`

Open [`src/queries.py`](src/queries.py), find an unused placeholder slot (`report_2`, `report_3`, etc.), and fill in your details:

```python
    "report_2": {
        "title": "Your Query Title (e.g. Weekend Payment Method Distribution)",
        "operation": "DICE",           # ROLLUP, DRILLDOWN, SLICE, DICE, or PIVOT
        "author": "Your Name",

        # OPTIONAL: If your optimization uses an index, put the name and CREATE INDEX here.
        # (Dropping the index for baseline testing is handled automatically by the script!)
        # If your optimization is query rewriting, CTEs, or join restructuring, leave these as None!
        "index_name": "idx_fgt_my_index",    # or None
        "index_create_sql": """
            CREATE INDEX idx_fgt_my_index ON fact_green_trips (...);
        """,                                 # or None

        # 1. Unoptimized (Baseline) SQL Query - Paste your normal SQL here!
        "original_query": """
            SELECT ...
            FROM fact_green_trips f
            JOIN ...
        """,

        # 2. Optimized SQL Query - Paste your optimized SQL here!
        "optimized_query": """
            SELECT ...
            FROM fact_green_trips f
            JOIN ...
        """
    },
```

> **💡 Optimization Note:**  
> You do **NOT** have to create an index! If your optimization strategy is **query reformulation, CTEs, subquery restructuring, or predicate push-down**, simply leave `index_name = None`, `index_create_sql = None`, and `index_drop_sql = None`. The benchmark runner will directly compare your unoptimized SQL against your reformulated SQL!

---

## ⚡ Step 2: Run the Benchmark Script

Once you save [`src/queries.py`](src/queries.py), open your terminal and run:

```bash
python src/benchmark.py
```

### What this automatically does for you:
1. Runs your **baseline (unoptimized)** query 5 times and calculates the average execution time.
2. Applies your optimization (builds your index if specified, or executes your reformulated SQL).
3. Runs your **optimized** query 5 times and calculates the average execution time.
4. Outputs the **percentage speedup** (e.g., $63\%$ faster) and a formatted summary table:

```text
===========================================================================
SUMMARY BENCHMARK REPORT (FOR ACM TECHNICAL PAPER SECTION 6)
===========================================================================
Report Name                                   | Baseline   | Optimized  | Speedup   
---------------------------------------------------------------------------
Evening Rush Borough Revenue Ranking (Slice)  | 0.6648  s  | 0.2450  s  |  63.15%
Weekend Payment Method Distribution (Dice)    | 1.1500  s  | 0.3200  s  |  72.17%
===========================================================================
```

📸 **Take a screenshot of your output!** This table and timing numbers are required for **Section 6 (Results and Analysis)** of our ACM report.

---

## 🧪 Step 3: Run the Automated Tests

To mathematically prove that your optimization did not accidentally change or drop any data rows, run the universal test:

```bash
python -m unittest tests/test_all_reports.py -v
```

This test automatically checks:
* ✅ **Execution Safety:** Proves your queries run on MySQL without errors.
* ✅ **Non-Empty Results:** Proves your query retrieves real data from the 1.05M-row database.
* ✅ **Optimization Equivalence:** Compares `original_results == optimized_results` row-for-row to guarantee 100% data consistency.

*(Optional: To run the full test suite including ETL data wrangling checks, run `python -m unittest discover tests -v`).*

---

## 💡 Troubleshooting / FAQ

* **Error: `Access denied for user 'root'@'localhost'`**  
  If your local MySQL root password is not `password`, set your password in your terminal before running:
  ```bash
  # In Windows PowerShell:
  $env:MYSQL_PASSWORD = "your_actual_password"

  # In Mac / Linux Terminal:
  export MYSQL_PASSWORD="your_actual_password"
  ```

* **Error: `Table 'green_taxi_dw.fact_green_trips' doesn't exist`**  
  Run the ETL loader once to create and populate the database:
  ```bash
  python src/etl.py
  ```

* **Do I need to install any new packages?**  
  No. All tests and benchmark tools use Python's built-in libraries and our existing requirements.
