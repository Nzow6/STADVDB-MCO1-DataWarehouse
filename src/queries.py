REPORTS = {
    "report_1": {
        "title": "Evening Rush Borough Revenue Ranking (Slice)",
        "operation": "SLICE",
        "author": "Karl",
        "index_name": "idx_fgt_slice_covering",
        "index_create_sql": """
            CREATE INDEX idx_fgt_slice_covering 
            ON fact_green_trips (pickup_time_id, pickup_location_id, total_amount, fare_amount, trip_id);
        """,
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

    "report_2": {
        "title": "Monthly Weekday Borough Tip Rate Ranking (Dice)",
        "operation": "DICE",
        "author": "Enzo",  
        "index_name": "idx_is_weekend",
        "index_create_sql": """
            CREATE INDEX idx_is_weekend ON dim_date (is_weekend);
        """,
        "original_query": """
            SELECT 
                d.month_name, 
                l.borough, 
                (SUM(f.tip_amount) / NULLIF(SUM(f.fare_amount), 0)) AS avg_tip_rate,
                DENSE_RANK() OVER (
                    PARTITION BY d.month_name 
                    ORDER BY (SUM(f.tip_amount) / NULLIF(SUM(f.fare_amount), 0)) DESC
                ) AS borough_tip_rank
            FROM fact_green_trips f
            JOIN dim_date d ON f.pickup_date_id = d.date_id
            JOIN dim_location l ON f.pickup_location_id = l.location_id
            JOIN dim_time t ON f.pickup_time_id = t.time_id
            JOIN dim_payment_type pt ON f.payment_type_id = pt.payment_type_id
            JOIN dim_trip_type tt ON f.trip_type_id = tt.trip_type_id
            WHERE d.is_weekend = 0
            GROUP BY 
                d.month, 
                d.month_name, 
                l.borough
            ORDER BY 
                d.month ASC, 
                borough_tip_rank ASC;
        """,
        "optimized_query": """
            SELECT 
                d.month_name, 
                l.borough, 
                (SUM(f.tip_amount) / NULLIF(SUM(f.fare_amount), 0)) AS avg_tip_rate,
                DENSE_RANK() OVER (
                    PARTITION BY d.month 
                    ORDER BY (SUM(f.tip_amount) / NULLIF(SUM(f.fare_amount), 0)) DESC
                ) AS borough_tip_rank
            FROM fact_green_trips f
            JOIN dim_date d ON f.pickup_date_id = d.date_id
            JOIN dim_location l ON f.pickup_location_id = l.location_id
            WHERE d.is_weekend = 0 
            GROUP BY 
                d.month, 
                d.month_name, 
                l.borough
            ORDER BY 
                d.month ASC, 
                borough_tip_rank ASC;
        """
    },

    "report_3": {
        "title": "Annual Zone Revenue Drill-Down with Quarterly Pivot (Drill-Down and Pivot)",
        "operation": "DRILLDOWN and PIVOT",
        "author": "Hayden",
        "index_name": "idx_fgt_optimized",
        "index_create_sql": """
            CREATE INDEX idx_fgt_optimized 
            ON fact_green_trips (pickup_location_id, pickup_date_id, total_amount, tip_amount);
        """,
        "original_query": """
            SELECT
                dl.borough, 
                dl.zone,
                SUM(CASE WHEN dd.quarter = 1 THEN f.total_amount ELSE 0 END) AS Q1_earnings,
                SUM(CASE WHEN dd.quarter = 2 THEN f.total_amount ELSE 0 END) AS Q2_earnings,
                SUM(CASE WHEN dd.quarter = 3 THEN f.total_amount ELSE 0 END) AS Q3_earnings,
                SUM(CASE WHEN dd.quarter = 4 THEN f.total_amount ELSE 0 END) AS Q4_earnings,
                SUM(f.total_amount) AS total_annual_earnings,
                CONCAT(ROUND(100.0 * COUNT(CASE WHEN tip_amount > 0 THEN 1 END) / COUNT(*), 2), '%') AS tip_percentage
            FROM 
                fact_green_trips f
            JOIN 
                dim_location dl ON f.pickup_location_id = dl.location_id
            JOIN 
                dim_date dd ON f.pickup_date_id = dd.date_id
            GROUP BY 
                dl.borough, 
                dl.zone
            HAVING 
                total_annual_earnings > (
                    SELECT AVG(zone_totals.zone_revenue)
                    FROM (
                        SELECT SUM(f2.total_amount) AS zone_revenue
                        FROM fact_green_trips f2
                        JOIN dim_location dl2 ON f2.pickup_location_id = dl2.location_id
                        GROUP BY dl2.borough, dl2.zone
                    ) zone_totals
                )
            ORDER BY 
                total_annual_earnings DESC;
        """,
        "optimized_query": """
            WITH zone_summary AS (
                SELECT
                    dl.borough, 
                    dl.zone,
                    SUM(CASE WHEN dd.quarter = 1 THEN f.total_amount ELSE 0 END) AS Q1_earnings,
                    SUM(CASE WHEN dd.quarter = 2 THEN f.total_amount ELSE 0 END) AS Q2_earnings,
                    SUM(CASE WHEN dd.quarter = 3 THEN f.total_amount ELSE 0 END) AS Q3_earnings,
                    SUM(CASE WHEN dd.quarter = 4 THEN f.total_amount ELSE 0 END) AS Q4_earnings,
                    SUM(f.total_amount) AS total_annual_earnings,
                    CONCAT(ROUND(100.0 * AVG(f.tip_amount > 0), 2), '%') AS tip_percentage,
                    AVG(SUM(f.total_amount)) OVER () AS avg_zone_revenue
                FROM 
                    fact_green_trips f
                JOIN 
                    dim_location dl ON f.pickup_location_id = dl.location_id
                JOIN 
                    dim_date dd ON f.pickup_date_id = dd.date_id
                GROUP BY 
                    dl.borough, 
                    dl.zone
            )
            SELECT 
                borough,
                zone,
                Q1_earnings,
                Q2_earnings,
                Q3_earnings,
                Q4_earnings,
                total_annual_earnings,
                tip_percentage
            FROM 
                zone_summary
            WHERE 
                total_annual_earnings > avg_zone_revenue
            ORDER BY 
                total_annual_earnings DESC;
        """
    },

    "report_4": {
        "title": "Multi-Dimensional Performance and Revenue Analysis by Weekend, Borough, Vendor, and Period for December(Rollup + Slice)",
        "operation": "ROLLUP and SLICE",
        "author": "Ryan",
        "index_name": "index_fgt_cube_borough_covering",
        "index_create_sql": """
            CREATE INDEX index_fgt_cube_borough_covering 
            ON fact_green_trips (pickup_date_id, pickup_location_id, vendor_id, total_amount);
        """,
        "original_query": """
            SELECT 
                d.is_weekend,
                l.borough,
                v.vendor_name AS vendor,
                d.year,
                d.month,
                COUNT(f.trip_id) AS total_trips,
                ROUND(SUM(f.total_amount), 2) AS total_amount_sum,
                ROUND(AVG(f.total_amount), 2) AS avg_trip_amount
            FROM fact_green_trips f
            JOIN dim_date d 
                ON f.pickup_date_id = d.date_id
            JOIN dim_location l 
                ON f.pickup_location_id = l.location_id
            JOIN dim_vendor v 
                ON f.vendor_id = v.vendor_id
            WHERE d.month = 12 
            GROUP BY 
                d.is_weekend, 
                l.borough, 
                v.vendor_name, 
                d.year, 
                d.month WITH ROLLUP
            ORDER BY 
                d.is_weekend IS NULL, d.is_weekend,
                l.borough IS NULL, l.borough,
                v.vendor IS NULL, v.vendor,
                d.year IS NULL, d.year,
                d.month IS NULL, d.month;
        """,
        "optimized_query": """
            SELECT 
                d.is_weekend,
                l.borough,
                v.vendor_name AS vendor,
                d.year,
                d.month,
                COUNT(f.trip_id) AS total_trips,
                ROUND(SUM(f.total_amount), 2) AS total_amount_sum,
                ROUND(AVG(f.total_amount), 2) AS avg_trip_amount
            FROM fact_green_trips f
            JOIN dim_date d 
                ON f.pickup_date_id = d.date_id
            JOIN dim_location l 
                ON f.pickup_location_id = l.location_id
            JOIN dim_vendor v 
                ON f.vendor_id = v.vendor_id
            WHERE d.month = 12  
            GROUP BY 
                d.is_weekend, 
                l.borough, 
                v.vendor_name, 
                d.year, 
                d.month WITH ROLLUP
            ORDER BY 
                d.is_weekend IS NULL, d.is_weekend,
                l.borough IS NULL, l.borough,
                v.vendor IS NULL, v.vendor,
                d.year IS NULL, d.year,
                d.month IS NULL, d.month;
        """
    },

    "report_5": {
        "title": "Green Taxi Aggregate Revenue and Distance by Payment Type and Date (Rollup)",
        "operation": "ROLLUP",
        "author": "Ryan",
        "index_name": "index_fgt_rollup_covering",
        "index_create_sql": """
            CREATE INDEX index_fgt_rollup_covering
            ON fact_green_trips (pickup_date_id, payment_type_id);
        """,
        "original_query": """
            SELECT 
                p.payment_type_name AS payment_type,
                d.year,
                d.month,
                d.day,
                COUNT(f.trip_id) AS total_trips,
                ROUND(SUM(f.total_amount), 2) AS total_revenue,
                ROUND(SUM(f.tip_amount), 2) AS total_tip,
                ROUND(AVG(f.trip_distance), 2) AS avg_dist
            FROM fact_green_trips f
            JOIN dim_payment_type p 
                ON f.payment_type_id = p.payment_type_id
            JOIN dim_date d 
                ON f.pickup_date_id = d.date_id
            GROUP BY p.payment_type_name, d.year, d.month, d.day WITH ROLLUP
            ORDER BY 
                d.year IS NULL, d.year, 
                d.month IS NULL, d.month, 
                d.day IS NULL, d.day, 
                p.payment_type_name;
        """,
        "optimized_query": """
            SELECT 
                p.payment_type_name AS payment_type,
                d.year,
                d.month,
                d.day,
                COUNT(f.trip_id) AS total_trips,
                ROUND(SUM(f.total_amount), 2) AS total_revenue,
                ROUND(SUM(f.tip_amount), 2) AS total_tip,
                ROUND(AVG(f.trip_distance), 2) AS avg_dist
            FROM fact_green_trips f
            JOIN dim_payment_type p 
                ON f.payment_type_id = p.payment_type_id
            JOIN dim_date d 
                ON f.pickup_date_id = d.date_id
            GROUP BY p.payment_type_name, d.year, d.month, d.day WITH ROLLUP
            ORDER BY 
                d.year IS NULL, d.year, 
                d.month IS NULL, d.month, 
                d.day IS NULL, d.day, 
                p.payment_type_name;
        """
    }
}
