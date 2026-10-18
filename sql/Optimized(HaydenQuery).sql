CREATE INDEX idx_fgt_optimized 
ON fact_green_trips (pickup_location_id, pickup_date_id, total_amount, tip_amount);

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