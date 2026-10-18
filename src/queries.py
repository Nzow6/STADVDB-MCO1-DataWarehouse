"""
STADVDB MCO1: Central OLAP Query Registry
Each report has an unoptimized (original) version and an optimized version.
Write normal SQL queries and paste them directly into your designated slot below.
"""

REPORTS = {
    # --------------------------------------------------------------------------
    # Report 1: SLICE Query (Karl)
    # Business Scenario: Slice fact table on Evening Rush day bracket and rank
    # boroughs by gross revenue and average fare using DENSE_RANK window function.
    # Optimization Strategy: Multi-column Covering Index on fact_green_trips.
    # --------------------------------------------------------------------------
    "report_1": {
        "title": "Evening Rush Borough Revenue Ranking (Slice)",
        "operation": "SLICE",
        "author": "Karl",
        
        # Index DDL (Leave as None if your optimization is a query rewrite / CTE)
        # Note: Dropping the index before baseline tests is handled automatically!
        "index_name": "idx_fgt_slice_covering",
        "index_create_sql": """
            CREATE INDEX idx_fgt_slice_covering 
            ON fact_green_trips (pickup_time_id, pickup_location_id, total_amount, fare_amount, trip_id);
        """,

        # 1. Unoptimized (Baseline) Query
        "original_query": """
            SELECT 
                pu_loc.borough AS pickup_borough,
                COUNT(f.trip_id) AS total_rush_trips,
                ROUND(SUM(f.total_amount), 2) AS total_rush_revenue,
                ROUND(AVG(f.fare_amount), 2) AS avg_fare,
                DENSE_RANK() OVER (
                    ORDER BY SUM(f.total_amount) DESC
                ) AS revenue_rank
            FROM fact_green_trips f
            JOIN dim_time t 
                ON f.pickup_time_id = t.time_id
            JOIN dim_location pu_loc 
                ON f.pickup_location_id = pu_loc.location_id
            WHERE t.day_bracket = 'Evening Rush'
            GROUP BY pu_loc.borough
            ORDER BY revenue_rank ASC;
        """,

        # 2. Optimized Query (Covering index eliminates row lookups from table pages)
        "optimized_query": """
            SELECT 
                pu_loc.borough AS pickup_borough,
                COUNT(f.trip_id) AS total_rush_trips,
                ROUND(SUM(f.total_amount), 2) AS total_rush_revenue,
                ROUND(AVG(f.fare_amount), 2) AS avg_fare,
                DENSE_RANK() OVER (
                    ORDER BY SUM(f.total_amount) DESC
                ) AS revenue_rank
            FROM fact_green_trips f
            JOIN dim_time t 
                ON f.pickup_time_id = t.time_id
            JOIN dim_location pu_loc 
                ON f.pickup_location_id = pu_loc.location_id
            WHERE t.day_bracket = 'Evening Rush'
            GROUP BY pu_loc.borough
            ORDER BY revenue_rank ASC;
        """
    },

    # --------------------------------------------------------------------------
    # Slots for Groupmates (Open Placeholders)
    # Pick an empty slot below and fill in your details and SQL queries!
    # --------------------------------------------------------------------------
    "report_2": {
        "title": "[Enter Your Query Title Here]",
        "operation": "[ROLLUP / DRILLDOWN / DICE / PIVOT]",
        "author": "[Your Name]",
        "index_name": None,        # Optional: set to index name if using an index, else None
        "index_create_sql": None,  # Optional: "CREATE INDEX ...", else None
        "original_query": None,    # Paste your unoptimized SQL string here
        "optimized_query": None    # Paste your optimized SQL string here
    },
    "report_3": {
        "title": "[Enter Your Query Title Here]",
        "operation": "[ROLLUP / DRILLDOWN / DICE / PIVOT]",
        "author": "[Your Name]",
        "index_name": None,
        "index_create_sql": None,
        "original_query": None,
        "optimized_query": None
    },
    "report_4": {
        "title": "[Enter Your Query Title Here]",
        "operation": "[ROLLUP / DRILLDOWN / DICE / PIVOT]",
        "author": "[Your Name]",
        "index_name": None,
        "index_create_sql": None,
        "original_query": None,
        "optimized_query": None
    },
    "report_5": {
        "title": "[Enter Your Query Title Here]",
        "operation": "[ROLLUP / DRILLDOWN / DICE / PIVOT]",
        "author": "[Your Name]",
        "index_name": None,
        "index_create_sql": None,
        "original_query": None,
        "optimized_query": None
    }
}
