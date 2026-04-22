-- Run this in MySQL Workbench before starting the Flask server
CREATE DATABASE IF NOT EXISTS trust_system;
USE trust_system;

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  filename           VARCHAR(255),
  upload_time        DATETIME DEFAULT CURRENT_TIMESTAMP,
  before_total_rows  INT,
  before_missing_pct FLOAT,
  before_duplicate_pct FLOAT,
  before_outlier_pct FLOAT,
  before_trust_score FLOAT,
  was_cleaned        BOOLEAN DEFAULT FALSE,
  after_total_rows   INT,
  after_missing_pct  FLOAT,
  after_duplicate_pct FLOAT,
  after_outlier_pct  FLOAT,
  after_trust_score  FLOAT,
  confidence_level   VARCHAR(20)
);
