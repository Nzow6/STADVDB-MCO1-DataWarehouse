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