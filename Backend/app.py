import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import pandas as pd

from tasks import run_data_pipeline_task
import werkzeug
from services.lineage     import save_run, get_all_runs, get_run_by_id
from services.evaluation  import evaluate_cleaning_accuracy, read_uploaded_dataframe
from rag.assistant import answer_question, index_existing_reports
from config import TRUST_THRESHOLD, EXPORT_DIR, UPLOAD_DIR, REPORTS_DIR

app = Flask(__name__)
CORS(app)



@app.route("/api/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    filename = file.filename or "upload.csv"
    ext = "xlsx" if filename.lower().endswith(".xlsx") else "csv"

    if not (filename.lower().endswith(".csv") or filename.lower().endswith(".xlsx")):
        return jsonify({"error": "Only .csv and .xlsx files are supported"}), 400

    # Save incoming file payload to disk temporarily for the celery worker
    temp_filename = f"{uuid.uuid4().hex}_{werkzeug.utils.secure_filename(filename)}"
    temp_file_path = os.path.join(UPLOAD_DIR, temp_filename)
    file.save(temp_file_path)

    # Dispatched to execution pool immediately — returns a handle instantly
    task = run_data_pipeline_task.delay(temp_file_path, filename, ext)

    return jsonify({
        "message": "File processing has started asynchronously.",
        "task_id": task.id,
        "status_url": f"/api/tasks/{task.id}"
    }), 202


@app.route("/api/tasks/<task_id>", methods=["GET"])
def get_task_status(task_id):
    """
    Endpoint polled by the React frontend to retrieve the
    current Celery task state and progress.
    """

    task = run_data_pipeline_task.AsyncResult(task_id)

    # Task has not been picked up by a worker yet
    if task.state == "PENDING":
        return jsonify({
            "state": "PENDING",
            "status": "Waiting in queue...",
            "progress": 0
        })

    # Task is currently executing
    elif task.state == "PROGRESS":
        return jsonify({
            "state": "PROGRESS",
            "status": task.info.get("status", ""),
            "progress": task.info.get("progress", 0)
        })

    # Task finished successfully
    elif task.state == "SUCCESS":

        # If your task returned an error dictionary
        if isinstance(task.result, dict) and "error" in task.result:
            return jsonify({
                "state": "FAILED",
                "error": task.result["error"]
            }), 400

        return jsonify({
            "state": "SUCCESS",
            "status": "Completed",
            "progress": 100,
            "result": task.result
        })

    # Task crashed
    elif task.state == "FAILURE":
        return jsonify({
            "state": "FAILURE",
            "status": "Task Failed",
            "progress": 100,
            "error": str(task.info)
        }), 500

    # Any unexpected Celery state
    return jsonify({
        "state": task.state,
        "status": "Unknown",
        "progress": 0
    })


# ── Health ────────────────────────────────────────────────────────────────────
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "threshold": TRUST_THRESHOLD})



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

@app.route("/api/download/<key>/<path:filename>", methods=["GET"])
def download_cleaned(key, filename):

    ext = filename.rsplit(".", 1)[-1].lower()

    if ext not in ("csv", "xlsx"):
        return jsonify({"error": "Unsupported file type"}), 400

    file_path = os.path.join(EXPORT_DIR, f"cleaned_{key}.{ext}")

    if not os.path.exists(file_path):
        return jsonify({
            "error": "Cleaned file not found."
        }), 404

    mimetype = (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        if ext == "xlsx"
        else "text/csv"
    )

    return send_file(
        file_path,
        as_attachment=True,
        download_name=filename,
        mimetype=mimetype,
    )


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


@app.route("/api/chat", methods=["POST"])
def chat():
    payload = request.get_json(silent=True) or {}
    question = (payload.get("question") or "").strip()
    run_id = payload.get("run_id")
    filename = (payload.get("filename") or "").strip() or None

    if not question:
        return jsonify({"error": "question is required"}), 400

    try:
        run_id = int(run_id) if run_id not in (None, "", "null") else None
    except (TypeError, ValueError):
        return jsonify({"error": "run_id must be an integer"}), 400

    try:
        result = answer_question(question, run_id=run_id, filename=filename)
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/rag/reindex", methods=["POST"])
def reindex_reports():
    try:
        result = index_existing_reports(REPORTS_DIR)
        return jsonify({"status": "ok", **result})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True, port=5000)
