"""
Data Quality Analysis & Cleaning Service
=========================================
analyze_quality : computes 7 quality metrics fed into the Random Forest model
  1. missing_pct            – % of all cells that are NaN / empty
  2. duplicate_pct          – % of rows that are exact duplicates
  3. outlier_pct            – % of numeric values outside IQR fence
  4. type_inconsistency_pct – % of object columns containing mixed numeric/text
  5. null_col_ratio         – % of columns that have ≥1 null
  6. constant_col_ratio     – % of columns with only one unique value
  7. avg_skewness           – mean absolute skewness across numeric columns

clean_data : removes duplicates, fills missing values, clips IQR outliers
"""

import pandas as pd
import numpy as np

MISSING_TOKENS = {
    "",
    "na",
    "n/a",
    "nan",
    "null",
    "none",
    "missing",
    "unknown",
    "-",
    "--",
}


def _as_float(value: object, default: float = 0.0) -> float:
    """Safely convert pandas/numpy scalar-like values to float."""
    if value is None:
        return default

    if isinstance(value, np.generic):
        value = value.item()

    if isinstance(value, complex):
        return float(value.real)

    if isinstance(value, (int, np.integer, bool, np.bool_)):
        return float(value)

    if isinstance(value, (float, np.floating)):
        if np.isnan(value):
            return default
        return float(value)

    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return default
        try:
            return float(stripped)
        except ValueError:
            return default

    return default


def _normalize_missing_markers(df: pd.DataFrame) -> pd.DataFrame:
    """Convert common textual missing-value markers to proper NaN values."""
    normalized = df.copy()
    obj_cols = normalized.select_dtypes(include=["object", "string"]).columns
    for col in obj_cols:
        series = normalized[col]
        normalized[col] = series.apply(
            lambda v: np.nan
            if isinstance(v, str) and v.strip().lower() in MISSING_TOKENS
            else v
        )
    return normalized


# ─────────────────────────────────────────────────────────────────────────────
def analyze_quality(df: pd.DataFrame) -> dict:
    """Return all 7 quality metrics for the given DataFrame."""
    df = _normalize_missing_markers(df)

    total_rows  = len(df)
    total_cells = df.size
    n_cols      = len(df.columns)

    # ── 1. Missing values ─────────────────────────────────────────────────────
    missing_count = int(df.isnull().sum().sum())
    missing_pct   = round(missing_count / total_cells * 100, 2) if total_cells > 0 else 0.0

    # ── 2. Duplicate rows ─────────────────────────────────────────────────────
    duplicate_count = int(df.duplicated().sum())
    duplicate_pct   = round(duplicate_count / total_rows * 100, 2) if total_rows > 0 else 0.0

    # ── 3. IQR outliers on numeric columns ────────────────────────────────────
    numeric_cols       = df.select_dtypes(include=[np.number]).columns
    outlier_count      = 0
    numeric_cell_count = 0
    skewness_values    = []

    for col in numeric_cols:
        series = df[col].dropna()
        if len(series) < 4:
            continue
        q1, q3 = series.quantile(0.25), series.quantile(0.75)
        iqr = q3 - q1
        if iqr == 0:
            continue
        lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        outlier_count      += int(((series < lower) | (series > upper)).sum())
        numeric_cell_count += len(series)
        skewness_values.append(abs(_as_float(series.skew(), default=0.0)))

    outlier_pct  = round(outlier_count / numeric_cell_count * 100, 2) if numeric_cell_count > 0 else 0.0
    avg_skewness = round(float(np.mean(skewness_values)), 3) if skewness_values else 0.0

    # ── 4. Type inconsistency ─────────────────────────────────────────────────
    # A text column where 10–90 % of values are numeric-parseable → mixed types
    type_inconsistent = 0
    for col in df.select_dtypes(include="object").columns:
        sample = df[col].dropna()
        if len(sample) < 5:
            continue
        numeric_ratio = pd.to_numeric(sample, errors="coerce").notna().mean()
        if 0.10 < numeric_ratio < 0.90:
            type_inconsistent += 1

    type_inconsistency_pct = round(type_inconsistent / n_cols * 100, 2) if n_cols > 0 else 0.0

    # ── 5. Null-column ratio ──────────────────────────────────────────────────
    null_col_count = int((df.isnull().sum() > 0).sum())
    null_col_ratio = round(null_col_count / n_cols * 100, 2) if n_cols > 0 else 0.0

    # ── 6. Constant-column ratio (zero-variance) ──────────────────────────────
    constant_cols      = int((df.nunique(dropna=False) <= 1).sum())
    constant_col_ratio = round(constant_cols / n_cols * 100, 2) if n_cols > 0 else 0.0

    return {
        # Row-level stats
        "total_rows":             total_rows,
        # Feature 1
        "missing_count":          missing_count,
        "missing_pct":            float(missing_pct),
        # Feature 2
        "duplicate_count":        duplicate_count,
        "duplicate_pct":          float(duplicate_pct),
        # Feature 3
        "outlier_count":          outlier_count,
        "outlier_pct":            float(outlier_pct),
        # Feature 4
        "type_inconsistency_pct": float(type_inconsistency_pct),
        # Feature 5
        "null_col_ratio":         float(null_col_ratio),
        # Feature 6
        "constant_col_ratio":     float(constant_col_ratio),
        # Feature 7
        "avg_skewness":           float(avg_skewness),
    }


# ─────────────────────────────────────────────────────────────────────────────
def clean_data(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """
    Four-step cleaning pipeline:
    1. Remove exact duplicate rows
    2. Fill missing values (median → numeric, mode → categorical)
    3. Remove IQR outliers on numeric columns
    4. Drop remaining constant columns (zero informational value)
    """
    # Normalize textual null-like tokens before quality fixes
    df = _normalize_missing_markers(df)

    report = {
        "duplicates_removed": 0,
        "missing_before": 0,
        "missing_after": 0,
        "imputations": [],
        "outlier_clipping": [],
        "validation": {},
    }

    report["missing_before"] = int(df.isna().sum().sum())

    # Step 1 — Duplicates
    rows_before = len(df)
    df = df.drop_duplicates().reset_index(drop=True)
    report["duplicates_removed"] = max(rows_before - len(df), 0)

    # Step 2 — Missing values
    for col in df.columns:
        missing_in_col = int(df[col].isna().sum())
        if missing_in_col == 0:
            continue

        if pd.api.types.is_numeric_dtype(df[col]):
            non_null = df[col].dropna()
            if non_null.empty:
                fill_value = 0.0
                strategy = "constant_0_all_missing"
            else:
                skewness = abs(_as_float(non_null.skew(), default=0.0)) if len(non_null) >= 3 else 0.0
                if skewness > 1.0:
                    fill_value = _as_float(non_null.median(), default=0.0)
                    strategy = "median_skewed_numeric"
                else:
                    fill_value = _as_float(non_null.mean(), default=0.0)
                    strategy = "mean_near_symmetric_numeric"

            df[col] = df[col].fillna(fill_value)
            report["imputations"].append(
                {
                    "column": col,
                    "strategy": strategy,
                    "filled_count": missing_in_col,
                    "fill_value": round(fill_value, 6),
                }
            )
        else:
            non_null = df[col].dropna()

            if non_null.empty:
                fill_value = "Unknown"
                strategy = "placeholder_all_missing"
            else:
                unique_ratio = non_null.nunique() / max(len(non_null), 1)
                if unique_ratio > 0.9 and len(non_null) >= 20:
                    fill_value = "Unknown"
                    strategy = "placeholder_high_cardinality"
                else:
                    mode_vals = non_null.mode()
                    fill_value = mode_vals.iloc[0] if not mode_vals.empty else "Unknown"
                    strategy = "mode_categorical"

            df[col] = df[col].fillna(fill_value)
            report["imputations"].append(
                {
                    "column": col,
                    "strategy": strategy,
                    "filled_count": missing_in_col,
                    "fill_value": str(fill_value),
                }
            )

    # Step 3 — IQR outlier clipping (winsorization-style)
    for col in df.select_dtypes(include=[np.number]).columns:
        series = df[col].dropna()
        if len(series) < 4:
            continue

        q1, q3 = series.quantile(0.25), series.quantile(0.75)
        iqr = q3 - q1
        if iqr == 0:
            continue
        lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        clipped_low = int((df[col] < lower).sum())
        clipped_high = int((df[col] > upper).sum())

        if clipped_low or clipped_high:
            df[col] = df[col].clip(lower=lower, upper=upper)
            report["outlier_clipping"].append(
                {
                    "column": col,
                    "lower_bound": round(_as_float(lower, default=0.0), 6),
                    "upper_bound": round(_as_float(upper, default=0.0), 6),
                    "clipped_low": clipped_low,
                    "clipped_high": clipped_high,
                }
            )

    df = df.reset_index(drop=True)
    report["missing_after"] = int(df.isna().sum().sum())
    report["validation"] = {
        "no_missing_values": report["missing_after"] == 0,
        "no_duplicate_rows": int(df.duplicated().sum()) == 0,
    }

    return df, report
