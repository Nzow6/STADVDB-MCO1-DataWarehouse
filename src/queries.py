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
                SUM(f.total_trips) AS total_trips,
                ROUND(SUM(f.total_revenue), 2) AS total_revenue,
                ROUND(SUM(f.total_tip), 2) AS total_tip,
                ROUND(SUM(f.sum_dist) / SUM(f.count_dist), 2) AS avg_dist
            FROM (
                SELECT 
                    payment_type_id,
                    pickup_date_id,
                    COUNT(trip_id) AS total_trips,
                    SUM(total_amount) AS total_revenue,
                    SUM(tip_amount) AS total_tip,
                    SUM(trip_distance) AS sum_dist,
                    COUNT(trip_distance) AS count_dist
                FROM fact_green_trips
                GROUP BY payment_type_id, pickup_date_id
                ) f
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


# ==============================================================================
# DYNAMIC QUERY BUILDERS & SPECIFICATIONS (From docs/dynamic_parameters.md)
# ==============================================================================

DYNAMIC_PARAMETERS_SPEC = {
    "report_1": {
        "title": "Evening Rush Borough Revenue Ranking",
        "operation": "SLICE",
        "analytical_focus": "Evening Rush Borough Revenue Ranking",
        "parameters": {
            "day_bracket": {
                "label": "Day Bracket",
                "type": "select",
                "options": ["Evening Rush", "Morning Rush", "Midday", "Early Morning", "Night", "Late Night"],
                "default": "Evening Rush",
                "fixed_benchmark": "Evening Rush"
            },
            "pickup_date": {
                "label": "Pickup Date",
                "type": "date",
                "default": None,
                "fixed_benchmark": None
            }
        }
    },
    "report_2": {
        "title": "Monthly Weekday Borough Tip Rate Ranking",
        "operation": "DICE",
        "analytical_focus": "Monthly Weekday Borough Tip Rate Ranking",
        "parameters": {
            "boroughs": {
                "label": "Boroughs",
                "type": "multi-select",
                "options": ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island", "EWR"],
                "default": [],
                "fixed_benchmark": []
            },
            "day_brackets": {
                "label": "Day Brackets",
                "type": "multi-select",
                "options": ["Evening Rush", "Morning Rush", "Midday", "Early Morning", "Night", "Late Night"],
                "default": [],
                "fixed_benchmark": []
            },
            "payment_type_ids": {
                "label": "Payment Types",
                "type": "multi-select",
                "options": [
                    {"id": 1, "name": "Credit card"},
                    {"id": 2, "name": "Cash"},
                    {"id": 3, "name": "No charge"},
                    {"id": 4, "name": "Dispute"}
                ],
                "default": [],
                "fixed_benchmark": []
            },
            "is_weekend": {
                "label": "Day Type",
                "type": "select",
                "options": [
                    {"value": 0, "label": "Weekday (is_weekend = 0)"},
                    {"value": 1, "label": "Weekend (is_weekend = 1)"},
                    {"value": None, "label": "All Days"}
                ],
                "default": 0,
                "fixed_benchmark": 0
            }
        }
    },
    "report_3": {
        "title": "Annual Zone Revenue Drill-Down with Quarterly Pivot",
        "operation": "DRILLDOWN and PIVOT",
        "author": "Hayden",
        "analytical_focus": "Annual Zone Revenue Drill-Down with Quarterly Pivot",
        "parameters": {
            "borough": {
                "label": "Borough",
                "type": "select",
                "options": ["All", "Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island", "EWR"],
                "default": "All",
                "fixed_benchmark": "All"
            },
            "above_average_only": {
                "label": "Above Average Zones Only",
                "type": "toggle",
                "default": True,
                "fixed_benchmark": True
            }
        }
    },
    "report_4": {
        "title": "Multi-Dimensional Performance and Revenue Analysis by Weekend, Borough, Vendor, and Period for December",
        "operation": "ROLLUP and SLICE",
        "author": "Ryan",
        "analytical_focus": "Performance and Revenue Analysis for December",
        "parameters": {
            "month": {
                "label": "Month",
                "type": "select",
                "options": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
                "default": 12,
                "fixed_benchmark": 12
            },
            "is_weekend": {
                "label": "Day Type",
                "type": "select",
                "options": [None, 0, 1],
                "default": None,
                "fixed_benchmark": None
            },
            "borough": {
                "label": "Borough",
                "type": "select",
                "options": ["All", "Manhattan", "Brooklyn", "Queens", "Bronx"],
                "default": "All",
                "fixed_benchmark": "All"
            },
            "with_rollup": {
                "label": "With Rollup",
                "type": "toggle",
                "default": True,
                "fixed_benchmark": True
            }
        }
    },
    "report_5": {
        "title": "Green Taxi Aggregate Revenue and Distance by Payment Type and Date",
        "operation": "ROLLUP",
        "author": "Ryan",
        "analytical_focus": "Aggregate Revenue and Distance by Payment Type and Date",
        "parameters": {
            "payment_type": {
                "label": "Payment Type",
                "type": "select",
                "options": ["All", "Credit card", "Cash", "No charge", "Dispute"],
                "default": "All",
                "fixed_benchmark": "All"
            },
            "granularity": {
                "label": "Granularity",
                "type": "select",
                "options": ["Day", "Month", "Year"],
                "default": "Day",
                "fixed_benchmark": "Day"
            },
            "with_rollup": {
                "label": "With Rollup",
                "type": "toggle",
                "default": True,
                "fixed_benchmark": True
            }
        }
    }
}


def _sql_quote(val):
    clean = str(val).replace("'", "''")
    return f"'{clean}'"


def _sql_in_list(items):
    return ", ".join(_sql_quote(item) for item in items)


def build_report_1_query(day_bracket="Evening Rush", pickup_date=None, start_date=None, end_date=None, dialect="mysql"):
    """
    Report 1 (SLICE): Evening Rush Borough Revenue Ranking (Karl).
    Dynamic parameters: t.day_bracket, pickup_date or start_date & end_date.
    Defaults reproduce Karl's exact original query.
    """
    where_clauses = []
    if day_bracket:
        where_clauses.append(f"t.day_bracket = {_sql_quote(day_bracket)}")
    if start_date and end_date:
        where_clauses.append(f"d.full_date BETWEEN {_sql_quote(start_date)} AND {_sql_quote(end_date)}")
    elif pickup_date:
        where_clauses.append(f"d.full_date = {_sql_quote(pickup_date)}")
    
    where_sql = ("\n            WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
    date_join = "\n            JOIN dim_date d ON f.pickup_date_id = d.date_id" if (pickup_date or (start_date and end_date)) else ""

    return f"""SELECT 
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
                ON f.pickup_location_id = pu_loc.location_id{date_join}{where_sql}
            GROUP BY pu_loc.borough
            ORDER BY revenue_rank ASC;"""


def build_report_2_query(boroughs=None, day_brackets=None, payment_type_ids=(1,), is_weekend=0, start_date=None, end_date=None, dialect="mysql"):
    """
    Report 2 (DICE): Monthly Weekday Borough Tip Rate Ranking (Enzo).
    Dynamic parameters: l.borough multi-select, t.day_bracket multi-select, start_date/end_date.
    Defaults reproduce Enzo's weekday tip rate ranking query.
    """
    where_clauses = []
    if is_weekend is not None:
        where_clauses.append(f"d.is_weekend = {int(is_weekend)}")
    if start_date and end_date:
        where_clauses.append(f"d.full_date BETWEEN {_sql_quote(start_date)} AND {_sql_quote(end_date)}")
    if boroughs:
        where_clauses.append(f"l.borough IN ({_sql_in_list(boroughs)})")
    
    time_join = ""
    if day_brackets:
        time_join = "\n            JOIN dim_time t ON f.pickup_time_id = t.time_id"
        where_clauses.append(f"t.day_bracket IN ({_sql_in_list(day_brackets)})")
    
    if payment_type_ids:
        pt_list = ", ".join(str(int(pt)) for pt in payment_type_ids)
        where_clauses.append(f"f.payment_type_id IN ({pt_list})")
    else:
        where_clauses.append("f.payment_type_id = 1")

    where_sql = ("\n            WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    return f"""SELECT 
                d.month_name, 
                l.borough, 
                (SUM(f.tip_amount) / NULLIF(SUM(f.fare_amount), 0)) AS avg_tip_rate,
                DENSE_RANK() OVER (
                    PARTITION BY d.month 
                    ORDER BY (SUM(f.tip_amount) / NULLIF(SUM(f.fare_amount), 0)) DESC
                ) AS borough_tip_rank
            FROM fact_green_trips f
            JOIN dim_date d ON f.pickup_date_id = d.date_id
            JOIN dim_location l ON f.pickup_location_id = l.location_id{time_join}{where_sql}
            GROUP BY 
                d.month, 
                d.month_name, 
                l.borough
            ORDER BY 
                d.month ASC, 
                borough_tip_rank ASC;"""


def build_report_3_query(borough="All", above_average_only=True, start_date=None, end_date=None, dialect="mysql"):
    """
    Report 3 (DRILLDOWN and PIVOT): Annual Zone Revenue Drill-Down with Quarterly Pivot (Hayden).
    Defaults reproduce Hayden's exact original query.
    """
    where_clauses = []
    if borough and borough != "All":
        where_clauses.append(f"dl.borough = {_sql_quote(borough)}")
    if start_date and end_date:
        where_clauses.append(f"dd.full_date BETWEEN {_sql_quote(start_date)} AND {_sql_quote(end_date)}")

    where_sql = ("\n            WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    having_clause = """
            HAVING 
                total_annual_earnings > (
                    SELECT AVG(zone_totals.zone_revenue)
                    FROM (
                        SELECT SUM(f2.total_amount) AS zone_revenue
                        FROM fact_green_trips f2
                        JOIN dim_location dl2 ON f2.pickup_location_id = dl2.location_id
                        GROUP BY dl2.borough, dl2.zone
                    ) zone_totals
                )""" if above_average_only else ""

    return f"""SELECT
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
                dim_date dd ON f.pickup_date_id = dd.date_id{where_sql}
            GROUP BY 
                dl.borough, 
                dl.zone{having_clause}
            ORDER BY 
                total_annual_earnings DESC;"""


def build_report_4_query(month=12, is_weekend=None, borough="All", vendor="All", with_rollup=True, dialect="mysql"):
    """
    Report 4 (ROLLUP and SLICE): Multi-Dimensional Performance and Revenue Analysis for December (Ryan).
    Defaults reproduce Ryan's exact original query.
    """
    where_clauses = []
    if month is not None:
        where_clauses.append(f"d.month = {int(month)}")
    if is_weekend is not None:
        where_clauses.append(f"d.is_weekend = {int(is_weekend)}")
    if borough and borough != "All":
        where_clauses.append(f"l.borough = {_sql_quote(borough)}")
    if vendor and vendor != "All":
        where_clauses.append(f"v.vendor_name = {_sql_quote(vendor)}")

    where_sql = ("\n            WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    if dialect == "duckdb":
        rollup_sql = "GROUP BY ROLLUP (d.is_weekend, l.borough, v.vendor_name, d.year, d.month)" if with_rollup else "GROUP BY d.is_weekend, l.borough, v.vendor_name, d.year, d.month"
        order_sql = """ORDER BY 
                d.is_weekend NULLS LAST, d.is_weekend,
                l.borough NULLS LAST, l.borough,
                v.vendor_name NULLS LAST, v.vendor_name,
                d.year NULLS LAST, d.year,
                d.month NULLS LAST, d.month;"""
    else:
        rollup_sql = "GROUP BY \n                d.is_weekend, \n                l.borough, \n                v.vendor_name, \n                d.year, \n                d.month WITH ROLLUP" if with_rollup else "GROUP BY \n                d.is_weekend, \n                l.borough, \n                v.vendor_name, \n                d.year, \n                d.month"
        order_sql = """ORDER BY 
                d.is_weekend IS NULL, d.is_weekend,
                l.borough IS NULL, l.borough,
                v.vendor IS NULL, v.vendor,
                d.year IS NULL, d.year,
                d.month IS NULL, d.month;"""

    return f"""SELECT 
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
                ON f.vendor_id = v.vendor_id{where_sql}
            {rollup_sql}
            {order_sql}"""


def build_report_5_query(payment_type="All", granularity="Day", with_rollup=True, dialect="mysql"):
    """
    Report 5 (ROLLUP): Green Taxi Aggregate Revenue and Distance by Payment Type and Date (Ryan).
    Defaults reproduce Ryan's exact original query.
    """
    where_clauses = []
    if payment_type and payment_type != "All":
        where_clauses.append(f"p.payment_type_name = {_sql_quote(payment_type)}")

    where_sql = ("\n            WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    gran = str(granularity).capitalize()
    if gran == "Year":
        cols = "d.year"
        mysql_orders = "d.year IS NULL, d.year, \n                p.payment_type_name;"
        duck_orders = "d.year NULLS LAST, d.year, \n                p.payment_type_name;"
    elif gran == "Month":
        cols = "d.year, d.month"
        mysql_orders = "d.year IS NULL, d.year, \n                d.month IS NULL, d.month, \n                p.payment_type_name;"
        duck_orders = "d.year NULLS LAST, d.year, \n                d.month NULLS LAST, d.month, \n                p.payment_type_name;"
    else:  # Day
        cols = "d.year, d.month, d.day"
        mysql_orders = "d.year IS NULL, d.year, \n                d.month IS NULL, d.month, \n                d.day IS NULL, d.day, \n                p.payment_type_name;"
        duck_orders = "d.year NULLS LAST, d.year, \n                d.month NULLS LAST, d.month, \n                d.day NULLS LAST, d.day, \n                p.payment_type_name;"

    if dialect == "duckdb":
        rollup_sql = f"GROUP BY ROLLUP (p.payment_type_name, {cols})" if with_rollup else f"GROUP BY p.payment_type_name, {cols}"
        order_sql = f"ORDER BY \n                {duck_orders}"
    else:
        rollup_sql = f"GROUP BY p.payment_type_name, {cols} WITH ROLLUP" if with_rollup else f"GROUP BY p.payment_type_name, {cols}"
        order_sql = f"ORDER BY \n                {mysql_orders}"

    return f"""SELECT 
                p.payment_type_name AS payment_type,
                {cols},
                COUNT(f.trip_id) AS total_trips,
                ROUND(SUM(f.total_amount), 2) AS total_revenue,
                ROUND(SUM(f.tip_amount), 2) AS total_tip,
                ROUND(AVG(f.trip_distance), 2) AS avg_dist
            FROM fact_green_trips f
            JOIN dim_payment_type p 
                ON f.payment_type_id = p.payment_type_id
            JOIN dim_date d 
                ON f.pickup_date_id = d.date_id{where_sql}
            {rollup_sql}
            {order_sql}"""


def get_dynamic_query(report_id, params=None, dialect="mysql"):
    """
    Unified dispatcher to build queries with dynamic parameter values.
    """
    params = params or {}
    key = str(report_id).lower()
    if key in ("1", "report_1", "slice"):
        return build_report_1_query(
            day_bracket=params.get("day_bracket", "Evening Rush"),
            pickup_date=params.get("pickup_date"),
            start_date=params.get("start_date"),
            end_date=params.get("end_date"),
            dialect=dialect
        )
    elif key in ("2", "report_2", "dice"):
        return build_report_2_query(
            boroughs=params.get("boroughs"),
            day_brackets=params.get("day_brackets"),
            payment_type_ids=params.get("payment_type_ids", (1,)),
            is_weekend=params.get("is_weekend", 0),
            start_date=params.get("start_date"),
            end_date=params.get("end_date"),
            dialect=dialect
        )
    elif key in ("3", "report_3", "drilldown", "drill-down", "drilldown and pivot", "pivot"):
        return build_report_3_query(
            borough=params.get("borough", params.get("haydenBorough", "All")),
            above_average_only=params.get("above_average_only", params.get("aboveAverageOnly", True)),
            start_date=params.get("start_date"),
            end_date=params.get("end_date"),
            dialect=dialect
        )
    elif key in ("4", "report_4", "rollup and slice", "slice and rollup"):
        return build_report_4_query(
            month=params.get("month", params.get("sliceMonth", 12)),
            is_weekend=params.get("is_weekend", params.get("r4Weekend")),
            borough=params.get("borough", params.get("r4Borough", "All")),
            vendor=params.get("vendor", params.get("r4Vendor", "All")),
            with_rollup=params.get("with_rollup", params.get("withRollup", True)),
            dialect=dialect
        )
    elif key in ("5", "report_5", "rollup"):
        return build_report_5_query(
            payment_type=params.get("payment_type", params.get("r5PaymentType", "All")),
            granularity=params.get("granularity", params.get("dateHierarchy", "Day")),
            with_rollup=params.get("with_rollup", params.get("r5WithRollup", True)),
            dialect=dialect
        )
    elif key in REPORTS:
        return REPORTS[key]["original_query"]
    raise ValueError(f"Unknown report identifier: {report_id}")


# Attach dynamic builder references
REPORTS["report_1"]["build_dynamic_query"] = build_report_1_query
REPORTS["report_2"]["build_dynamic_query"] = build_report_2_query
REPORTS["report_3"]["build_dynamic_query"] = build_report_3_query
REPORTS["report_4"]["build_dynamic_query"] = build_report_4_query
REPORTS["report_5"]["build_dynamic_query"] = build_report_5_query


