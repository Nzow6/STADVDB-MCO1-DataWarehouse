# STADVDB MCO1: Master Project Management Checklist

**Project:** Query Processing in a Data Warehouse (AY 2026–2027)  
**Target Delivery Window:** October 19, 2026 (8:00 AM) – October 24, 2026 (11:59 PM)  
**Defense Timebox:** 20-minute live presentation + Q&A per team  

---

## 1. Project Quick Reference & Critical Constraints

| Item | Specification / Constraint |
| --- | --- |
| **Team Size** | 3 to 4 members under the same instructor |
| **DBMS Engine** | Local **MySQL** or **PostgreSQL** |
| **Report Length** | **4 to 10 pages** (excluding References & Appendix) in **ACM format** |
| **Late Penalty** | **-10 points / day late**; zero acceptance after October 24, 2026, 11:59 PM |
| **Missing File Penalty** | **-10 points deduction per missing supplementary deliverable** |
| **Archive Format** | `.zip` only (`STADVDB-MCO1-GroupN.zip`). **RAR files are strictly rejected** |
| **Academic Integrity** | Plagiarism or unauthorized GenAI use = **Grade of 0.0 for the entire course** |

---

## 2. Phase-by-Phase Execution Checklist

### Phase 1: Dimensional Modeling (Data Warehouse Design)

> ⚠️ **STRICT POLICY**: **GenAI USE IS BANNED** for designing the dimensional model and schema.

- [x] **Define business processes & metrics**: Determine numerical measures (additive, semi-additive) for the fact table (`trip_distance`, `fare_amount`, `extra`, `mta_tax`, `tip_amount`, `tolls_amount`, `surcharges`, `total_amount`, `trip_duration_seconds`).
- [x] **Select schema architecture**: Choose between **Star Schema** (denormalized, optimized for read speed) or **Snowflake Schema** (normalized dimensions). *(Implemented: Star Schema centered on `fact_green_trips`)*.
- [x] **Core table requirements**:
    - [x] At least **one (1) Fact table** (`fact_green_trips`).
    - [x] At least **three (3) Dimension tables** (7 implemented: `dim_date`, `dim_time`, `dim_location`, `dim_vendor`, `dim_rate_code`, `dim_payment_type`, `dim_trip_type`).
- [x] **Map dimensional hierarchies**: Explicitly construct levels for roll-up/drill-down:
    - `dim_date`: `full_date` -> `month` / `month_name` -> `quarter` -> `year`
    - `dim_time`: `full_time` -> `hour_24` -> `day_bracket`
    - `dim_location`: `location_id` -> `zone` -> `borough` -> `service_zone`
- [x] **Enforce integrity constraints**: Explicit Primary Keys (`PK`), Foreign Keys (`FK`), surrogate keys (`date_id`, `time_id`), and multiplicity rules in `sql/schema.sql`.
- [ ] **Generate schema artifacts**: Save SQL DDL script and visual ERD diagram (`STADVDB-MCO1-GroupN-Schema.xxx`). *(DDL complete in `sql/schema.sql`; visual ERD export pending)*.

---

### Phase 2: ETL Pipeline Development

> ℹ️ *GenAI use permitted for assisting with scripts and synthetic data within guidelines*.

- [x] **Select tech stack**: Python (`pandas`, `duckdb`, `mysql-connector-python`).
- [x] **Extraction stage**: Automated DuckDB extraction from 12 monthly Parquet files (`data/green_tripdata_2021-*.parquet`) and zones CSV (`data/taxi_zone_lookup.csv`).
- [x] **Transformation stage (Data Wrangling)**:
    - [x] Handle missing/null values (`COALESCE` flags, imputation of `'Unknown'` for boroughs/zones/service zones, default passenger count).
    - [x] Data type standardization and datetime casting (`CAST`, `strftime`, `DECIMAL(8,2)` rounding).
    - [x] String trimming, casing normalization, and categorical mapping for vendor, rate codes, and trip types.
    - [x] Business logic transformations and surrogate key generation (`pickup_date_id`, `dropoff_date_id`, `pickup_time_id`, `dropoff_time_id`, `trip_duration_seconds`).
- [x] **Loading stage**: Bulk load transformed data into target warehouse tables via MySQL native `LOAD DATA INFILE` with chunked stream insert fallback in `src/etl.py`.
- [x] **ETL validation (Data Quality)**: Verify row counts (1,052,419 rows loaded into `fact_green_trips`), checksums, and attribute consistency between source and loaded warehouse.

---

### Phase 3: OLAP Formulation & Interactive Dashboard

> ⚠️ *GenAI is permitted for dashboard UI/frontend development, but **BANNED for authoring the underlying SQL queries***.

- [ ] **Formulate advanced OLAP SQL queries**:
    - [] **Roll-up**: Increasing aggregation level along a hierarchy (e.g., daily -> monthly -> quarterly taxi revenue).
    - [ ] **Drill-down**: Decreasing aggregation level to reveal finer grain (e.g., borough -> individual pick-up zones).
    - [] **Slice**: Filtering by one specific dimension member (e.g., single borough or single vendor).
    - [ ] **Dice**: Subsetting via multi-dimensional criteria/ranges (e.g., peak-hours + credit card + specific distance bracket).
    - [ ] **Pivot**: Rotating data axes to analyze multi-dimensional summaries (e.g., hour of day vs. day of week matrix).
    - [ ] Use advanced SQL syntax (`GROUP BY ROLLUP/CUBE`, window functions, CTEs).
- [ ] **Parameterization**: Ensure queries accept dynamic parameters/filters rather than static hardcoded values.
- [ ] **Dashboard interface development**:
    - [ ] Build interactive web dashboard application.
    - [ ] Implement intuitive UI controls (dropdowns, date pickers, sliders) for drill/slice operations.
    - [ ] Render analytical visualizations (bar, line, heatmaps, stacked area charts)—**no raw, static tables only**.

---

### Phase 4: Functional & Performance Testing

> ⚠️ **STRICT POLICY**: **GenAI USE IS BANNED** for query optimization strategies and bottleneck diagnosis.

- [ ] **Functional Testing (Correctness)**:
    - [ ] Build test script (`STADVDB-MCO1-GroupN-Test.xxx`) with systematic test cases.
    - [ ] Run parameterized queries multiple times with edge-case inputs.
    - [ ] Record test verdicts (**PASS/FAIL**) and document validation mechanisms.
- [ ] **Performance Testing (Execution Profiling)**:
    - [ ] Document fixed hardware/software environment (CPU, RAM, OS, DBMS version, buffer settings).
    - [ ] Record baseline execution times (run each query multiple times; calculate average latency).
    - [ ] Run `EXPLAIN` / `EXPLAIN ANALYZE` on unoptimized queries to detect bottlenecks (e.g., sequential scans, temporary tables, heavy nested loops).
- [ ] **Apply Optimization Strategies (At least 2 strategies required)**:
    - [ ] **Index Strategy**: Implement secondary B-Tree/composite indexes on high-cardinality join/filter columns. *(Preliminary indexes created in `sql/schema.sql`)*.
    - [ ] **Query Restructuring**: Eliminate redundant subqueries, simplify joins, utilize CTEs, push down predicates.
    - [ ] **Schema Restructuring / Denormalization**: Introduce pre-aggregated summary tables or denormalized reporting structures if needed.
    - [ ] **Hardware / DBMS Tuning**: Adjust buffer pool size, work memory, or sort buffer configurations.
- [ ] **Post-Optimization Benchmarking**:
    - [ ] Re-run identical queries under same test conditions.
    - [ ] Tabulate Before vs. After execution times, percentage speedup, rows/columns returned.
    - [ ] Provide technical justification for improvements or explain non-improvements.

---

### Phase 5: Technical Report Authoring (ACM Format)

- [ ] **Template compliance**: Use ACM Word or LaTeX template (2-column layout, Times New Roman, numbered citations).
- [ ] **Page constraints**: **4 to 10 pages** (excluding References & Appendix).
- [ ] **Section Checklist**:
    - [ ] **Section 1: Introduction** — Dataset background, data warehouse purpose, analytical users, definition of terms with literature citations.
    - [ ] **Section 2: Data Warehouse** — ERD figure, fact/dimension details, hierarchy table, design justification, literature citations.
    - [ ] **Section 3: ETL Script** — Ingestion architecture, data wrangling transformation rules/functions, constraints, challenges resolved, citations.
    - [ ] **Section 4: OLAP Application** — Decision-making use cases, exact SQL code listings, advanced constructs, UI screenshots showing slice/dice/drill.
    - [ ] **Section 5: Query Processing and Optimization** — Optimization theory, ≥2 applied strategies, `EXPLAIN` execution plans before/after, illustrations, citations.
    - [ ] **Section 6: Results and Analysis** — Functional test methodology/results; Performance test data, hardware spec, timing comparison tables/graphs, root-cause analysis.
    - [ ] **Section 7: Conclusion** — Core takeaways on DW, OLAP vs. OLTP, ETL lifecycles, indexing conditions, societal/industry contributions (no complaints about project difficulty).
    - [ ] **Section 8: References** — ACM numbered citation format (`[1]`, `[2]`), peer-reviewed papers, books, technical docs.
    - [ ] **Section 9: Declarations**:
        - [ ] **9.1 Declaration of Generative AI Usage** (specific bulleted list with tasks, tools, prompts, verification method).
        - [ ] **9.2 Statement of Accountability** (verbatim copy of the required 4-point statement).
        - [ ] **9.3 Record of Contribution Table** (explicit breakdown per member).
- [ ] **Appendix (Optional)**: Supplementary scripts, full schema DDL, extended test logs.

---

### Phase 6: Presentation & Final Submission

- [ ] **Prepare Slide Deck (`STADVDB-MCO1-GroupN-Slides.PDF`)**:
    - [ ] Slide 1: Title, Group Number, Member Roles.
    - [ ] Slide 2: Source Dataset & Dimensional Model (Star/Snowflake, Hierarchies).
    - [ ] Slide 3: ETL Architecture & Data Wrangling Highlights.
    - [ ] Slide 4: OLAP Queries & Live Dashboard Demonstration.
    - [ ] Slide 5: Performance Optimization (`EXPLAIN`, Strategies, Before/After Timing).
    - [ ] Slide 6: Testing Methodology & Validation Results.
    - [ ] Slide 7: Technical Insights & Conclusion.
- [ ] **Dry Run Defense**: Rehearse 20-minute presentation; verify every member speaks and understands all queries/plans.

---

## 3. Generative AI Compliance Matrix

| Task Component | GenAI Policy | Permitted Scope | Banned Actions |
| --- | --- | --- | --- |
| **Synthetic Data Generation** | **ALLOWED** | Generating SQL inserts for scaling load | Blindly trusting data without validating schema |
| **Dimensional Model Design** | 🛑 **BANNED** | High-level discussion of theoretical trade-offs | Generating the actual schema, tables, or hierarchies |
| **ETL Scripting** | **ALLOWED** | Assisting with regex, python syntax, data cleaning logic | Complete unverified code generation |
| **OLAP SQL Formulation** | 🛑 **BANNED** | Brainstorming analytical business questions | Generating the underlying SQL queries |
| **Dashboard UI** | **ALLOWED** | UI layout, CSS styling, chart configuration code | Writing backend OLAP data access logic |
| **Functional Test Scripts** | **ALLOWED** | Drafting test harnesses, test case structuring | Running tests without student verification |
| **Execution Plan Diagnosis** | **ASSIST ONLY** | Asking AI to clarify terms in `EXPLAIN` output | Having AI choose or write optimization strategies |
| **Query Optimization** | 🛑 **BANNED** | None | Prompting AI to rewrite queries or add indexes |
| **Report Writing** | **ASSIST ONLY** | Grammar checking, proofreading, clarity editing | AI-generated section drafts or analysis |

---

## 4. Deliverables & File Naming Audit Checklist

Ensure all files strictly use your group number (replace `N` with your actual group number, e.g., `Group4`):

### Main Assignment Portal (Turnitin Submission)

- [ ] `STADVDB-MCO1-GroupN-Paper.PDF` (Technical Report, ACM format, 4–10 pages)
- [ ] `STADVDB-MCO1-GroupN-Slides.PDF` (Presentation Slide Deck)

### Supplementary Materials Portal (or single `STADVDB-MCO1-GroupN.zip`)

- [ ] `STADVDB-MCO1-GroupN-Schema.xxx` (Schema DDL script and/or diagram file) *(DDL script ready at `sql/schema.sql`)*
- [ ] `STADVDB-MCO1-GroupN-ETL.xxx` (ETL script source file or PDF/JPG/PNG export) *(ETL script ready at `src/etl.py`)*
- [ ] `STADVDB-MCO1-GroupN-OLAP.xxx` (Complete source code for web dashboard & SQL queries)
- [ ] `STADVDB-MCO1-GroupN-Test.xxx` (Functional & performance test scripts with execution logs)
- [ ] `STADVDB-MCO1-GroupN-AI.xxx` (Full prompt log, tools declared, and verification notes)

---

## 5. Rubric Scoring Verification (Targeting 100/100 Points)

| Rubric Area | Max Pts | Exemplary Criteria Verification | Status in Codebase |
| --- | --- | --- | --- |
| **Dimensional Model** | **15 pts** | • Deep rationale for Star/Snowflake schema<br>• Complete Fact table and $\ge$3 Dimension tables with explicit hierarchies<br>• Strict PK, FK, surrogate keys, and multiplicity constraints | ✅ Schema implemented (`sql/schema.sql`) with 1 fact table & 7 dimensions |
| **ETL Pipeline** | **10 pts** | • Robust, reusable data wrangling pipeline<br>• Explicit data cleaning, type conversion, and null-handling rules<br>• Documented validation of loaded data warehouse vs. source | ✅ Automated pipeline implemented (`src/etl.py`), 1.05M rows validated |
| **OLAP Queries & App** | **17 pts** | • Complex SQL using advanced clauses (`GROUP BY`, aggregations, window functions)<br>• Parameterized queries supporting Roll-up, Drill-down, Slice, Dice, Pivot<br>• Clean, interactive web dashboard with meaningful analytical charts | ⏳ Pending implementation |
| **Query Optimization** | **18 pts** | • Clear performance bottleneck evaluation via `EXPLAIN`<br>• Correct application of $\ge$2 optimization strategies (indexing, restructuring, etc.)<br>• In-depth comparative analysis of Before vs. After execution times | ⏳ Pending execution & benchmarking |
| **Technical Report** | **30 pts** | • Strict ACM template adherence, 4–10 pages, professional figures/tables<br>• Thoughtful, evidence-based discussion backed by literature citations<br>• Honest, detailed GenAI declaration, Accountability statement, and Contribution table | ⏳ Pending authoring |
| **Oral Presentation** | **10 pts** | • 20-minute concise defense covering all 5 core modules<br>• Equal participation, live query/dashboard demo readiness, confident Q&A | ⏳ Pending presentation prep |
| **Total** | **100 pts** | **All deliverables submitted on time with exact naming conventions** | 🚀 In Progress |
