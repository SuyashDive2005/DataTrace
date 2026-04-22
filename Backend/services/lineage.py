"""
Data Lineage Service — MySQL read/write for pipeline run history
"""

import os
import sys

# Ensure Backend root is on the path so 'db' can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_connection
from datetime import datetime


def save_run(
    filename: str,
    before_metrics: dict,
    before_score: float,
    after_metrics: dict,
    after_score: float,
    was_cleaned: bool,
    confidence_level: str,
) -> int:
    """Insert a pipeline run record and return the new row id."""
    conn = get_connection()
    cursor = conn.cursor()

    sql = """
        INSERT INTO pipeline_runs (
            filename, upload_time,
            before_total_rows, before_missing_pct, before_duplicate_pct, before_outlier_pct,
            before_trust_score,
            was_cleaned,
            after_total_rows, after_missing_pct, after_duplicate_pct, after_outlier_pct,
            after_trust_score,
            confidence_level
        ) VALUES (
            %s, %s,
            %s, %s, %s, %s,
            %s,
            %s,
            %s, %s, %s, %s,
            %s,
            %s
        )
    """

    values = (
        filename,
        datetime.now(),
        before_metrics["total_rows"],
        before_metrics["missing_pct"],
        before_metrics["duplicate_pct"],
        before_metrics["outlier_pct"],
        before_score,
        was_cleaned,
        after_metrics["total_rows"],
        after_metrics["missing_pct"],
        after_metrics["duplicate_pct"],
        after_metrics["outlier_pct"],
        after_score,
        confidence_level,
    )

    cursor.execute(sql, values)
    conn.commit()
    run_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return run_id


def get_all_runs() -> list:
    """Return up to 50 most recent pipeline runs, newest first."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT * FROM pipeline_runs ORDER BY upload_time DESC LIMIT 50"
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    for row in rows:
        if row.get("upload_time"):
            row["upload_time"] = str(row["upload_time"])
        if "was_cleaned" in row and row["was_cleaned"] is not None:
            row["was_cleaned"] = bool(row["was_cleaned"])

    return rows


def get_run_by_id(run_id: int) -> dict | None:
    """Return a single pipeline run by primary key."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM pipeline_runs WHERE id = %s", (run_id,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()

    if row:
        if row.get("upload_time"):
            row["upload_time"] = str(row["upload_time"])
        if "was_cleaned" in row and row["was_cleaned"] is not None:
            row["was_cleaned"] = bool(row["was_cleaned"])

    return row
