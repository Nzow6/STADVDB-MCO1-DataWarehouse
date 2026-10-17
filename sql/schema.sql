-- ==============================================================================
-- STADVDB MCO1: Target Star Schema DDL for 2021 NYC Green Taxi Data Warehouse
-- DBMS: MySQL 8.0 (InnoDB Engine)
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS `green_taxi_dw`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE `green_taxi_dw`;

-- ------------------------------------------------------------------------------
-- 1. Drop existing tables in reverse dependency order
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS `fact_green_trips`;
DROP TABLE IF EXISTS `dim_trip_type`;
DROP TABLE IF EXISTS `dim_payment_type`;
DROP TABLE IF EXISTS `dim_rate_code`;
DROP TABLE IF EXISTS `dim_vendor`;
DROP TABLE IF EXISTS `dim_location`;
DROP TABLE IF EXISTS `dim_time`;
DROP TABLE IF EXISTS `dim_date`;

-- ------------------------------------------------------------------------------
-- 2. Dimension Tables
-- ------------------------------------------------------------------------------

-- Dimension 1: Date Dimension (Grain: 1 day)
CREATE TABLE `dim_date` (
    `date_id`       INT NOT NULL,              -- Format: YYYYMMDD
    `full_date`     DATE NOT NULL,
    `year`          INT NOT NULL,
    `quarter`       INT NOT NULL,
    `month`         INT NOT NULL,
    `month_name`    VARCHAR(15) NOT NULL,
    `day`           INT NOT NULL,
    `day_of_week`   VARCHAR(15) NOT NULL,
    `is_weekend`    TINYINT(1) NOT NULL,
    PRIMARY KEY (`date_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dimension 2: Time Dimension (Grain: 1 hour, 24 rows)
CREATE TABLE `dim_time` (
    `time_id`           INT NOT NULL,          -- Hour of day: 0 to 23
    `full_time`         TIME NOT NULL,
    `hour_24`           INT NOT NULL,          -- 0 to 23
    `day_bracket`       VARCHAR(20) NOT NULL,  -- 'Late Night', 'Early Morning', 'Morning Rush', 'Midday', 'Evening Rush', 'Night'
    `is_peak_surcharge` TINYINT(1) NOT NULL,   -- 1 for hours 16-19, else 0
    PRIMARY KEY (`time_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dimension 3: Location Dimension (NYC TLC Zones 1 to 263)
CREATE TABLE `dim_location` (
    `location_id`   INT NOT NULL,              -- 1 to 263
    `borough`       VARCHAR(50) NOT NULL,
    `zone`          VARCHAR(100) NOT NULL,
    `service_zone`  VARCHAR(50) DEFAULT NULL,
    PRIMARY KEY (`location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dimension 4: Vendor Dimension
CREATE TABLE `dim_vendor` (
    `vendor_id`     INT NOT NULL,
    `vendor_name`   VARCHAR(50) NOT NULL,
    PRIMARY KEY (`vendor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dimension 5: Rate Code Dimension
CREATE TABLE `dim_rate_code` (
    `rate_code_id`   INT NOT NULL,
    `rate_code_name` VARCHAR(50) NOT NULL,
    PRIMARY KEY (`rate_code_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dimension 6: Payment Type Dimension
CREATE TABLE `dim_payment_type` (
    `payment_type_id`   INT NOT NULL,
    `payment_type_name` VARCHAR(50) NOT NULL,
    PRIMARY KEY (`payment_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dimension 7: Trip Type Dimension
CREATE TABLE `dim_trip_type` (
    `trip_type_id`   INT NOT NULL,
    `trip_type_name` VARCHAR(50) NOT NULL,
    PRIMARY KEY (`trip_type_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- 3. Fact Table
-- ------------------------------------------------------------------------------
CREATE TABLE `fact_green_trips` (
    `trip_id`                BIGINT AUTO_INCREMENT NOT NULL,
    
    -- Role-Playing Foreign Keys
    `pickup_date_id`         INT NOT NULL,
    `dropoff_date_id`        INT NOT NULL,
    `pickup_time_id`         INT NOT NULL,
    `dropoff_time_id`        INT NOT NULL,
    `pickup_location_id`     INT NOT NULL,
    `dropoff_location_id`    INT NOT NULL,
    
    -- Standard Foreign Keys
    `vendor_id`              INT NOT NULL,
    `rate_code_id`           INT NOT NULL,
    `payment_type_id`        INT NOT NULL,
    `trip_type_id`           INT NOT NULL,
    
    -- Degenerate Dimensions & Counts
    `store_and_fwd_flag`     CHAR(1) DEFAULT 'N',
    `passenger_count`        INT DEFAULT 1,
    
    -- Numeric Measures (Strictly DECIMAL(8,2))
    `trip_distance`          DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    `fare_amount`            DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    `extra`                  DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    `mta_tax`                DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    `tip_amount`             DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    `tolls_amount`           DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    `improvement_surcharge`  DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    `congestion_surcharge`   DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    `total_amount`           DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    `trip_duration_seconds`  INT NOT NULL DEFAULT 0,
    
    PRIMARY KEY (`trip_id`),
    
    -- Foreign Key Constraints (Matching Star Schema Diagram)
    CONSTRAINT `fk_fgt_pickup_date`
        FOREIGN KEY (`pickup_date_id`) REFERENCES `dim_date` (`date_id`),
    CONSTRAINT `fk_fgt_dropoff_date`
        FOREIGN KEY (`dropoff_date_id`) REFERENCES `dim_date` (`date_id`),
    CONSTRAINT `fk_fgt_pickup_time`
        FOREIGN KEY (`pickup_time_id`) REFERENCES `dim_time` (`time_id`),
    CONSTRAINT `fk_fgt_dropoff_time`
        FOREIGN KEY (`dropoff_time_id`) REFERENCES `dim_time` (`time_id`),
    CONSTRAINT `fk_fgt_pickup_loc`
        FOREIGN KEY (`pickup_location_id`) REFERENCES `dim_location` (`location_id`),
    CONSTRAINT `fk_fgt_dropoff_loc`
        FOREIGN KEY (`dropoff_location_id`) REFERENCES `dim_location` (`location_id`),
    CONSTRAINT `fk_fgt_vendor`
        FOREIGN KEY (`vendor_id`) REFERENCES `dim_vendor` (`vendor_id`),
    CONSTRAINT `fk_fgt_rate_code`
        FOREIGN KEY (`rate_code_id`) REFERENCES `dim_rate_code` (`rate_code_id`),
    CONSTRAINT `fk_fgt_payment_type`
        FOREIGN KEY (`payment_type_id`) REFERENCES `dim_payment_type` (`payment_type_id`),
    CONSTRAINT `fk_fgt_trip_type`
        FOREIGN KEY (`trip_type_id`) REFERENCES `dim_trip_type` (`trip_type_id`),

    -- Foreign Key Indexes for Fast Join Traversal
    INDEX `idx_fgt_pickup_date` (`pickup_date_id`),
    INDEX `idx_fgt_dropoff_date` (`dropoff_date_id`),
    INDEX `idx_fgt_pickup_time` (`pickup_time_id`),
    INDEX `idx_fgt_dropoff_time` (`dropoff_time_id`),
    INDEX `idx_fgt_pickup_loc` (`pickup_location_id`),
    INDEX `idx_fgt_dropoff_loc` (`dropoff_location_id`),
    INDEX `idx_fgt_vendor` (`vendor_id`),
    INDEX `idx_fgt_rate_code` (`rate_code_id`),
    INDEX `idx_fgt_payment_type` (`payment_type_id`),
    INDEX `idx_fgt_trip_type` (`trip_type_id`),

    -- Composite Performance Indexes for High-Frequency Dimensional Slicing
    INDEX `idx_fgt_pu_date_loc` (`pickup_date_id`, `pickup_location_id`),
    INDEX `idx_fgt_pu_loc_do_loc` (`pickup_location_id`, `dropoff_location_id`),
    INDEX `idx_fgt_pu_time_date` (`pickup_time_id`, `pickup_date_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
