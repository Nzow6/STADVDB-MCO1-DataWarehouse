| Report # | OLAP Operation | Analytical Focus | Dynamic Dashboard UI Parameters | Fixed Benchmark Parameters |
| :---: | :---: | :--- | :--- | :--- |
| **Report 1** | **SLICE** | Evening Rush Borough Revenue Ranking | `t.day_bracket` dropdown, Date picker | `day_bracket = 'Evening Rush'` |
| **Report 2** | **DICE** | Monthly Weekday Borough Tip Rate Ranking | `l.borough` multi-select, `t.day_bracket` multi-select, `f.payment_type_id` multi-select | `is_weekend = 0` (with or without specific borough filter) |
| **Report 3** | **ROLL-UP** | Quarterly & Monthly Demand Trends | Granularity level (`Day`/`Month`/`Quarter`), Borough multi-select | `GROUP BY ROLLUP (d.quarter, d.month)` |
| **Report 4** | **DRILL-DOWN** | Borough to Zone Congestion Breakdown | Target Borough dropdown (e.g., Queens), Peak surcharge toggle | `l.borough = 'Manhattan'`, group by `l.zone` |
| **Report 5** | **PIVOT** | Payment Type vs. Day Bracket Matrix | Metric toggle (Revenue vs. Volume), Quarter selector | Pivot across 6 day brackets for `payment_type_id IN (1, 2)` |