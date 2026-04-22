import io
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import pandas as pd

from services.processing  import analyze_quality, clean_data
from services.trust_score import predict_trust_score
from services.lineage     import save_run, get_all_runs, get_run_by_id
from services.evaluation  import evaluate_cleaning_accuracy, read_uploaded_dataframe

app = Flask(__name__)
CORS(app)

# ── Configuration ─────────────────────────────────────────────────────────────
TRUST_THRESHOLD = 85.0

# Directory to store cleaned export files
EXPORT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cleaned_exports")
os.makedirs(EXPORT_DIR, exist_ok=True)

# In-memory map: download_key → { path, original_filename, ext }
_cleaned_files: dict = {}


# ── Health ────────────────────────────────────────────────────────────────────
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "threshold": TRUST_THRESHOLD})


# ── Upload & Pipeline ─────────────────────────────────────────────────────────
@app.route("/api/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file     = request.files["file"]
    filename = file.filename or "upload.csv"
    ext      = "xlsx" if filename.lower().endswith(".xlsx") else "csv"

    if not (filename.lower().endswith(".csv") or filename.lower().endswith(".xlsx")):
        return jsonify({"error": "Only .csv and .xlsx files are supported"}), 400

    # ── Parse ─────────────────────────────────────────────────────
    try:
        content = file.read()
        df = pd.read_excel(io.BytesIO(content)) if ext == "xlsx" else pd.read_csv(io.BytesIO(content))
    except Exception as exc:
        return jsonify({"error": f"Failed to parse file: {exc}"}), 400

    if df.empty:
        return jsonify({"error": "The uploaded file is empty"}), 400

    # ── Before analysis ───────────────────────────────────────────
    before_metrics = analyze_quality(df)
    before_score, _before_conf, before_importances, before_std = predict_trust_score(
        before_metrics["missing_pct"],
        before_metrics["duplicate_pct"],
        before_metrics["outlier_pct"],
        before_metrics["type_inconsistency_pct"],
        before_metrics["null_col_ratio"],
        before_metrics["constant_col_ratio"],
        before_metrics["avg_skewness"],
    )

    # ── Decision: clean if score below threshold ──────────────────
    was_cleaned = before_score < TRUST_THRESHOLD
    cleaning_report = {
        "duplicates_removed": 0,
        "missing_before": int(df.isna().sum().sum()),
        "missing_after": int(df.isna().sum().sum()),
        "imputations": [],
        "outlier_clipping": [],
        "validation": {
            "no_missing_values": int(df.isna().sum().sum()) == 0,
            "no_duplicate_rows": int(df.duplicated().sum()) == 0,
        },
    }

    if was_cleaned:
        df_after, cleaning_report = clean_data(df.copy())
    else:
        df_after = df.copy()

    # ── After analysis ────────────────────────────────────────────
    after_metrics = analyze_quality(df_after)
    after_score, confidence, after_importances, after_std = predict_trust_score(
        after_metrics["missing_pct"],
        after_metrics["duplicate_pct"],
        after_metrics["outlier_pct"],
        after_metrics["type_inconsistency_pct"],
        after_metrics["null_col_ratio"],
        after_metrics["constant_col_ratio"],
        after_metrics["avg_skewness"],
    )

    # ── Persist to DB (non-fatal) ─────────────────────────────────
    run_id = None
    try:
        run_id = save_run(
            filename,
            before_metrics, before_score,
            after_metrics,  after_score,
            was_cleaned, confidence,
        )
    except Exception as exc:
        print(f"[DB] Could not save run: {exc}")

    # ── Save cleaned file for download ────────────────────────────
    download_key = None
    download_url = None
    if was_cleaned:
        # Use run_id as key if DB saved it; fall back to a short UUID
        download_key = str(run_id) if run_id else uuid.uuid4().hex[:10]
        save_name    = f"cleaned_{download_key}.{ext}"
        save_path    = os.path.join(EXPORT_DIR, save_name)
        try:
            if ext == "xlsx":
                df_after.to_excel(save_path, index=False)
            else:
                df_after.to_csv(save_path, index=False)
            _cleaned_files[download_key] = {
                "path":              save_path,
                "original_filename": filename,
                "ext":               ext,
            }
            # Build the download URL with the correct filename IN the path,
            # so the browser always saves it with the right name.
            clean_name   = f"{filename.rsplit('.', 1)[0]}_cleaned.{ext}"
            download_url = f"/api/download/{download_key}/{clean_name}"
        except Exception as exc:
            print(f"[Export] Could not save cleaned file: {exc}")
            download_key = None
            download_url = None

    return jsonify({
        "run_id":       run_id,
        "filename":     filename,
        "threshold":    TRUST_THRESHOLD,
        "was_cleaned":  was_cleaned,
        "cleaning_report": cleaning_report,
        "download_key": download_key,
        "download_url": download_url,   # ← pre-built URL with correct filename in path
        "model_info": {
            "algorithm":    "Random Forest Regressor",
            "n_estimators": 200,
            "n_features":   7,
            "max_depth":    12,
        },
        "before": {
            "metrics":      before_metrics,
            "trust_score":  before_score,
            "importances":  before_importances,
            "std_dev":      before_std,
        },
        "after": {
            "metrics":          after_metrics,
            "trust_score":      after_score,
            "confidence_level": confidence,
            "importances":      after_importances,
            "std_dev":          after_std,
        },
    })


@app.route("/api/evaluate-cleaning", methods=["POST"])
def evaluate_cleaning():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]

    try:
        mask_fraction = float(request.form.get("mask_fraction", 0.1))
        duplicate_fraction = float(request.form.get("duplicate_fraction", 0.1))
        random_state = int(request.form.get("random_state", 42))
    except ValueError:
        return jsonify({"error": "mask_fraction, duplicate_fraction, and random_state must be numeric"}), 400

    try:
        df, _ext = read_uploaded_dataframe(file)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Failed to parse file: {exc}"}), 400

    if df.empty:
        return jsonify({"error": "The uploaded file is empty"}), 400

    result = evaluate_cleaning_accuracy(
        df,
        mask_fraction=mask_fraction,
        duplicate_fraction=duplicate_fraction,
        random_state=random_state,
    )

    return jsonify({
        "filename": file.filename,
        "rows": int(len(df)),
        "columns": int(len(df.columns)),
        **result,
    })


# ── Download cleaned dataset ──────────────────────────────────────────────────
# The filename is embedded in the URL path (<fname>) so the browser
# always sees the correct name regardless of Content-Disposition support.
@app.route("/api/download/<key>/<path:fname>", methods=["GET"])
def download_cleaned(key, fname):
    if key not in _cleaned_files:
        return jsonify({
            "error": "Cleaned file not found. "
                     "This happens if the server restarted after the upload. "
                     "Please re-upload to regenerate."
        }), 404

    info      = _cleaned_files[key]
    file_path = info["path"]

    if not os.path.exists(file_path):
        return jsonify({"error": "File no longer on disk. Please re-upload."}), 404

    mimetype = (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        if info["ext"] == "xlsx"
        else "text/csv"
    )

    # fname comes from the URL path — use it as the download filename
    return send_file(
        file_path,
        mimetype=mimetype,
        as_attachment=True,
        download_name=fname,
    )


# Backward-compat route without fname in path (constructs name from stored info)
@app.route("/api/download/<key>", methods=["GET"])
def download_cleaned_compat(key):
    if key not in _cleaned_files:
        return jsonify({"error": "File not found. Please re-upload."}), 404
    info  = _cleaned_files[key]
    base  = info["original_filename"].rsplit(".", 1)[0]
    fname = f"{base}_cleaned.{info['ext']}"
    from flask import redirect
    return redirect(f"/api/download/{key}/{fname}")


# ── History ───────────────────────────────────────────────────────────────────
@app.route("/api/history", methods=["GET"])
def history():
    try:
        runs = get_all_runs()
        return jsonify({"runs": runs})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/history/<int:run_id>", methods=["GET"])
def history_detail(run_id):
    try:
        run = get_run_by_id(run_id)
        if not run:
            return jsonify({"error": "Run not found"}), 404
        return jsonify({"run": run})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True, port=5000)
