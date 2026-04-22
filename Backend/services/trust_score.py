"""
ML Trust Score Service — Random Forest Regressor
==================================================
Model   : RandomForestRegressor (200 estimators, max_depth=12)
Features: 7 quality dimensions
  1. missing_pct           – % of missing cells          (weight: −0.30)
  2. duplicate_pct         – % of duplicate rows          (weight: −0.25)
  3. outlier_pct           – % of IQR outliers            (weight: −0.15)
  4. type_inconsistency_pct– % of cols with mixed types   (weight: −0.12)
  5. null_col_ratio        – % of cols with any nulls     (weight: −0.08)
  6. constant_col_ratio    – % of constant/zero-var cols  (weight: −0.05)
  7. avg_skewness          – mean absolute skew (numeric) (weight: capped)
Target  : trust_score (0–100)
"""

import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import MinMaxScaler

# ── Singleton model & scaler ──────────────────────────────────────────────────
_model  = None
_scaler = None

FEATURE_NAMES = [
    "missing_pct",
    "duplicate_pct",
    "outlier_pct",
    "type_inconsistency_pct",
    "null_col_ratio",
    "constant_col_ratio",
    "avg_skewness",
]

FEATURE_LABELS = {
    "missing_pct":             "Missing Values",
    "duplicate_pct":           "Duplicate Rows",
    "outlier_pct":             "IQR Outliers",
    "type_inconsistency_pct":  "Type Inconsistency",
    "null_col_ratio":          "Null Column Ratio",
    "constant_col_ratio":      "Constant Columns",
    "avg_skewness":            "Data Skewness",
}


# ── Training data generator ───────────────────────────────────────────────────
def _build_training_data(n: int = 1500):
    """
    Generate realistic synthetic samples covering the full quality spectrum.
    Ground-truth trust is a weighted penalty model + Gaussian noise.
    """
    rng = np.random.default_rng(42)

    missing    = rng.uniform(0,  70, n)
    duplicates = rng.uniform(0,  60, n)
    outliers   = rng.uniform(0,  40, n)
    type_incon = rng.uniform(0,  50, n)
    null_cols  = rng.uniform(0,  80, n)
    const_cols = rng.uniform(0,  30, n)
    skewness   = rng.uniform(0,  12, n)

    trust = (
        100
        - missing    * 0.30
        - duplicates * 0.25
        - outliers   * 0.15
        - type_incon * 0.12
        - null_cols  * 0.08
        - const_cols * 0.05
        - np.minimum(skewness * 0.5, 10)   # cap skewness penalty at 10 pts
        + rng.normal(0, 1.5, n)
    )
    trust = np.clip(trust, 0, 100)

    X = np.column_stack(
        [missing, duplicates, outliers, type_incon, null_cols, const_cols, skewness]
    )
    return X, trust


# ── Model initialiser (lazy singleton) ───────────────────────────────────────
def _get_model():
    global _model, _scaler
    if _model is None:
        X, y = _build_training_data()
        _scaler = MinMaxScaler()
        X_sc = _scaler.fit_transform(X)
        _model = RandomForestRegressor(
            n_estimators   = 200,
            max_depth      = 12,
            min_samples_leaf = 5,
            max_features   = "sqrt",
            random_state   = 42,
            n_jobs         = -1,
        )
        _model.fit(X_sc, y)
        print("[ML] RandomForestRegressor trained — 200 trees, 7 features, 1 500 samples")
    return _model, _scaler


# ── Public API ────────────────────────────────────────────────────────────────
def predict_trust_score(
    missing_pct:             float,
    duplicate_pct:           float,
    outlier_pct:             float,
    type_inconsistency_pct:  float = 0.0,
    null_col_ratio:          float = 0.0,
    constant_col_ratio:      float = 0.0,
    avg_skewness:            float = 0.0,
):
    """
    Returns
    -------
    score        : float  — trust score 0-100
    confidence   : str    — 'High' | 'Medium' | 'Low'
    importances  : dict   — feature name → importance % (sums to 100)
    std_dev      : float  — inter-tree prediction std (model uncertainty)
    """
    model, scaler = _get_model()

    x_raw = np.array([[
        missing_pct,
        duplicate_pct,
        outlier_pct,
        type_inconsistency_pct,
        null_col_ratio,
        constant_col_ratio,
        avg_skewness,
    ]])
    x_sc = scaler.transform(x_raw)

    # Collect per-tree predictions for uncertainty estimate
    tree_preds = np.array([t.predict(x_sc)[0] for t in model.estimators_])
    raw     = float(np.mean(tree_preds))
    std_dev = float(np.std(tree_preds))

    score = round(max(0.0, min(100.0, raw)), 2)

    # Confidence based on inter-tree deviation
    if std_dev < 3.5:
        confidence = "High"
    elif std_dev < 7.0:
        confidence = "Medium"
    else:
        confidence = "Low"

    # Feature importances (% contribution, sum = 100)
    raw_imp = model.feature_importances_            # array, sums to 1
    imp_pct = (raw_imp / raw_imp.sum() * 100).round(2)
    importances = {
        FEATURE_LABELS[name]: float(pct)
        for name, pct in zip(FEATURE_NAMES, imp_pct)
    }

    return score, confidence, importances, round(std_dev, 2)
