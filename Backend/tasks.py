import os
import uuid
import pandas as pd

from celery_app import celery_app
from services.processing import analyze_quality, clean_data
from services.trust_score import predict_trust_score
from services.lineage import save_run
from config import TRUST_THRESHOLD, EXPORT_DIR, REPORTS_DIR
from rag.assistant import build_run_report_text, save_and_index_report


@celery_app.task(bind=True)
def run_data_pipeline_task(self, temp_file_path, filename, ext):
    """
    Background worker task that processes and cleans data asynchronously.
    """

    # ─────────────────────────────────────────────────────────────
    # Step 1: Parse File
    # ─────────────────────────────────────────────────────────────
    self.update_state(
        state="PROGRESS",
        meta={
            "status": "Parsing file...",
            "progress": 10
        }
    )

    try:
        if ext == "xlsx":
            df = pd.read_excel(temp_file_path)
        else:
            df = pd.read_csv(temp_file_path)

        if df.empty:
            return {"error": "The uploaded file is empty"}

        # ─────────────────────────────────────────────────────────
        # Step 2: Analyze Initial Quality
        # ─────────────────────────────────────────────────────────
        self.update_state(
            state="PROGRESS",
            meta={
                "status": "Analyzing initial quality...",
                "progress": 35
            }
        )

        before_metrics = analyze_quality(df)

        before_score, _, before_importances, before_std = predict_trust_score(
            before_metrics["missing_pct"],
            before_metrics["duplicate_pct"],
            before_metrics["outlier_pct"],
            before_metrics["type_inconsistency_pct"],
            before_metrics["null_col_ratio"],
            before_metrics["constant_col_ratio"],
            before_metrics["avg_skewness"],
        )

        # ─────────────────────────────────────────────────────────
        # Step 3: Cleaning Decision
        # ─────────────────────────────────────────────────────────
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

            self.update_state(
                state="PROGRESS",
                meta={
                    "status": "Cleaning dataset entries...",
                    "progress": 65
                }
            )

            df_after, cleaning_report = clean_data(df.copy())

        else:
            df_after = df.copy()

        # ─────────────────────────────────────────────────────────
        # Step 4: Preparing Results
        # ─────────────────────────────────────────────────────────
        self.update_state(
            state="PROGRESS",
            meta={
                "status": "Preparing results...",
                "progress": 80
            }
        )

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

        # ─────────────────────────────────────────────────────────
        # Step 5: Save Results
        # ─────────────────────────────────────────────────────────
        self.update_state(
            state="PROGRESS",
            meta={
                "status": "Saving results...",
                "progress": 90
            }
        )

        run_id = None

        try:
            run_id = save_run(
                filename,
                before_metrics,
                before_score,
                after_metrics,
                after_score,
                was_cleaned,
                confidence,
            )
        except Exception as exc:
            print(f"[DB Error] {exc}")

        report_path = None
        try:
            report_text = build_run_report_text(
                run_id=run_id,
                filename=filename,
                was_cleaned=was_cleaned,
                threshold=TRUST_THRESHOLD,
                before_metrics=before_metrics,
                before_score=before_score,
                after_metrics=after_metrics,
                after_score=after_score,
                confidence_level=confidence,
                cleaning_report=cleaning_report,
            )
            report_path = save_and_index_report(
                report_text=report_text,
                run_id=run_id,
                filename=filename,
                reports_dir=REPORTS_DIR,
            )
        except Exception as exc:
            print(f"[RAG Error] {exc}")

        # ─────────────────────────────────────────────────────────
        # Step 6: Save Cleaned File
        # ─────────────────────────────────────────────────────────
        download_key = None
        download_url = None

        if was_cleaned:
            download_key = str(run_id) if run_id else uuid.uuid4().hex[:10]

            save_path = os.path.join(
                EXPORT_DIR,
                f"cleaned_{download_key}.{ext}"
            )

            if ext == "xlsx":
                df_after.to_excel(save_path, index=False)
            else:
                df_after.to_csv(save_path, index=False)

            clean_name = f"{filename.rsplit('.',1)[0]}_cleaned.{ext}"
            download_url = f"/api/download/{download_key}/{clean_name}"

        # Remove temporary upload
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

        # ─────────────────────────────────────────────────────────
        # Step 7: Completed
        # ─────────────────────────────────────────────────────────
        self.update_state(
            state="PROGRESS",
            meta={
                "status": "Completed",
                "progress": 100
            }
        )

        return {
            "status": "SUCCESS",
            "run_id": run_id,
            "filename": filename,
            "was_cleaned": was_cleaned,
            "threshold": TRUST_THRESHOLD,
            "cleaning_report": cleaning_report,
            "download_key": download_key,
            "download_url": download_url,
            "before": {
                "metrics": before_metrics,
                "trust_score": before_score,
                "importances": before_importances,
                "std_dev": before_std,
            },
            "after": {
                "metrics": after_metrics,
                "trust_score": after_score,
                "confidence_level": confidence,
                "importances": after_importances,
                "std_dev": after_std,
            },
            "report_path": report_path,
        }

    except Exception as exc:

        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

        return {
            "error": str(exc)
        }