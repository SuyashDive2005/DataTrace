import io
import os
import sys
import json
import argparse
import numpy as np
import pandas as pd

try:
    from services.processing import clean_data, analyze_quality
except ModuleNotFoundError:
    # Support direct script execution from Backend/services.
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from services.processing import clean_data, analyze_quality


def _safe_pct(numerator: int | float, denominator: int | float) -> float:
    if denominator == 0:
        return 0.0
    return round(float(numerator) / float(denominator) * 100.0, 2)


def _as_float(value: object, default: float = 0.0) -> float:
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


def _imputation_accuracy(df: pd.DataFrame, mask_fraction: float, random_state: int) -> dict:
    rng = np.random.default_rng(random_state)
    original = df.copy()
    masked = df.copy()

    numeric_positions = []
    categorical_positions = []

    for col in original.columns:
        non_null_idx = original.index[original[col].notna()].tolist()
        if not non_null_idx:
            continue

        sample_size = max(1, int(len(non_null_idx) * mask_fraction))
        chosen = rng.choice(non_null_idx, size=min(sample_size, len(non_null_idx)), replace=False)

        if pd.api.types.is_numeric_dtype(original[col]):
            numeric_positions.extend([(col, int(i)) for i in chosen])
        else:
            categorical_positions.extend([(col, int(i)) for i in chosen])

    for col, idx in numeric_positions + categorical_positions:
        masked.at[idx, col] = np.nan

    cleaned, _report = clean_data(masked)

    numeric_total = len(numeric_positions)
    categorical_total = len(categorical_positions)

    numeric_hits = 0
    numeric_mae_sum = 0.0

    for col, idx in numeric_positions:
        true_val = original.at[idx, col]
        pred_val = cleaned.at[idx, col]
        if pd.isna(true_val) or pd.isna(pred_val):
            continue

        true_f = _as_float(true_val, default=0.0)
        pred_f = _as_float(pred_val, default=0.0)
        abs_err = abs(pred_f - true_f)
        numeric_mae_sum += abs_err

        tolerance = max(abs(true_f) * 0.05, 1e-9)
        if abs_err <= tolerance:
            numeric_hits += 1

    categorical_hits = 0
    for col, idx in categorical_positions:
        true_val = original.at[idx, col]
        pred_val = cleaned.at[idx, col]
        if pd.isna(true_val) or pd.isna(pred_val):
            continue
        if str(true_val) == str(pred_val):
            categorical_hits += 1

    numeric_accuracy = _safe_pct(numeric_hits, numeric_total)
    categorical_accuracy = _safe_pct(categorical_hits, categorical_total)

    total = numeric_total + categorical_total
    overall_hits = numeric_hits + categorical_hits

    return {
        "masked_cells": total,
        "numeric_masked": numeric_total,
        "categorical_masked": categorical_total,
        "numeric_within_5pct_accuracy": numeric_accuracy,
        "categorical_exact_match_accuracy": categorical_accuracy,
        "numeric_mae": round(numeric_mae_sum / numeric_total, 6) if numeric_total else 0.0,
        "overall_imputation_accuracy": _safe_pct(overall_hits, total),
    }


def _duplicate_fix_accuracy(df: pd.DataFrame, duplicate_fraction: float, random_state: int) -> dict:
    if df.empty:
        return {
            "injected_duplicates": 0,
            "duplicates_removed": 0,
            "duplicate_fix_accuracy": 100.0,
        }

    rng = np.random.default_rng(random_state)
    deduped = df.drop_duplicates().reset_index(drop=True)

    if deduped.empty:
        return {
            "injected_duplicates": 0,
            "duplicates_removed": 0,
            "duplicate_fix_accuracy": 100.0,
        }

    n_inject = max(1, int(len(deduped) * duplicate_fraction))
    n_inject = min(n_inject, len(deduped))

    inject_idx = rng.choice(deduped.index.to_numpy(), size=n_inject, replace=False)
    injected_rows = deduped.loc[inject_idx]

    test_df = pd.concat([deduped, injected_rows], ignore_index=True)
    cleaned, _report = clean_data(test_df)

    expected_rows = len(deduped)
    extra_rows_after = max(len(cleaned) - expected_rows, 0)
    removed = n_inject - extra_rows_after

    return {
        "injected_duplicates": int(n_inject),
        "duplicates_removed": int(max(removed, 0)),
        "duplicate_fix_accuracy": _safe_pct(max(removed, 0), n_inject),
    }


def _outlier_fix_effectiveness(df: pd.DataFrame) -> dict:
    if df.empty:
        return {
            "outlier_count_before": 0,
            "outlier_count_after": 0,
            "outlier_reduction_pct": 0.0,
        }

    before = analyze_quality(df)
    cleaned, _report = clean_data(df)
    after = analyze_quality(cleaned)

    out_before = int(before.get("outlier_count", 0))
    out_after = int(after.get("outlier_count", 0))

    reduced = max(out_before - out_after, 0)

    return {
        "outlier_count_before": out_before,
        "outlier_count_after": out_after,
        "outlier_reduction_pct": _safe_pct(reduced, out_before) if out_before else 0.0,
    }


def evaluate_cleaning_accuracy(
    df: pd.DataFrame,
    mask_fraction: float = 0.1,
    duplicate_fraction: float = 0.1,
    random_state: int = 42,
) -> dict:
    """Evaluate cleaning quality with controlled corruption tests."""
    mask_fraction = min(max(mask_fraction, 0.01), 0.5)
    duplicate_fraction = min(max(duplicate_fraction, 0.01), 0.5)

    imputation = _imputation_accuracy(df, mask_fraction=mask_fraction, random_state=random_state)
    duplicates = _duplicate_fix_accuracy(df, duplicate_fraction=duplicate_fraction, random_state=random_state)
    outliers = _outlier_fix_effectiveness(df)

    final_score = round(
        0.6 * imputation["overall_imputation_accuracy"]
        + 0.25 * duplicates["duplicate_fix_accuracy"]
        + 0.15 * outliers["outlier_reduction_pct"],
        2,
    )

    return {
        "evaluation": {
            "mask_fraction": mask_fraction,
            "duplicate_fraction": duplicate_fraction,
            "random_state": random_state,
            "overall_cleaning_accuracy_score": final_score,
        },
        "imputation_accuracy": imputation,
        "duplicate_fix": duplicates,
        "outlier_fix": outliers,
    }


def read_uploaded_dataframe(file_storage) -> tuple[pd.DataFrame, str]:
    """Read uploaded CSV/XLSX file and return DataFrame + extension."""
    filename = file_storage.filename or "upload.csv"
    ext = "xlsx" if filename.lower().endswith(".xlsx") else "csv"

    if not (filename.lower().endswith(".csv") or filename.lower().endswith(".xlsx")):
        raise ValueError("Only .csv and .xlsx files are supported")

    content = file_storage.read()
    df = pd.read_excel(io.BytesIO(content)) if ext == "xlsx" else pd.read_csv(io.BytesIO(content))
    return df, ext


def _read_local_dataframe(file_path: str) -> pd.DataFrame:
    lower = file_path.lower()
    if lower.endswith(".xlsx"):
        return pd.read_excel(file_path)
    if lower.endswith(".csv"):
        return pd.read_csv(file_path)
    raise ValueError("Only .csv and .xlsx files are supported")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Evaluate DataTrace cleaning accuracy on a local dataset file.",
    )
    parser.add_argument(
        "--file",
        nargs="+",
        help="Path to input CSV/XLSX dataset (quotes optional for spaces)",
    )
    parser.add_argument("--mask-fraction", type=float, default=0.1)
    parser.add_argument("--duplicate-fraction", type=float, default=0.1)
    parser.add_argument("--random-state", type=int, default=42)

    args = parser.parse_args()

    if not args.file:
        print("Provide --file to run evaluation.")
        print("Example:")
        print("python evaluation.py --file ..\\testing csv\\testing.csv")
        return 0

    file_path = " ".join(args.file)

    try:
        df = _read_local_dataframe(file_path)
        if df.empty:
            print(json.dumps({"error": "Input dataset is empty"}, indent=2))
            return 1

        result = evaluate_cleaning_accuracy(
            df,
            mask_fraction=args.mask_fraction,
            duplicate_fraction=args.duplicate_fraction,
            random_state=args.random_state,
        )
        payload = {
            "file": file_path,
            "rows": int(len(df)),
            "columns": int(len(df.columns)),
            **result,
        }
        print(json.dumps(payload, indent=2))
        return 0
    except Exception as exc:
        print(json.dumps({"error": str(exc)}, indent=2))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())