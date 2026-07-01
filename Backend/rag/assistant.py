import json
import os
from datetime import datetime
from pathlib import Path
from urllib import error, request

import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

from config import OLLAMA_MODEL, OLLAMA_URL, VECTOR_DB_DIR

COLLECTION_NAME = "datatrace_reports"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

_client = None
_collection = None


def _get_collection():
    global _client, _collection

    if _collection is not None:
        return _collection

    if _client is None:
        _client = chromadb.PersistentClient(path=VECTOR_DB_DIR)

    embedding_fn = SentenceTransformerEmbeddingFunction(model_name=EMBEDDING_MODEL)
    _collection = _client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=embedding_fn,
        metadata={"hnsw:space": "cosine"},
    )
    return _collection


def _format_cleaning_actions(cleaning_report: dict | None) -> list[str]:
    if not cleaning_report:
        return ["No structured cleaning report was available."]

    actions = []
    missing_before = int(cleaning_report.get("missing_before", 0))
    missing_after = int(cleaning_report.get("missing_after", 0))
    duplicates_removed = int(cleaning_report.get("duplicates_removed", 0))
    clipped = sum(
        int(item.get("clipped_low", 0)) + int(item.get("clipped_high", 0))
        for item in cleaning_report.get("outlier_clipping", [])
    )

    if missing_before > missing_after:
        actions.append(
            f"Missing values reduced from {missing_before} to {missing_after}."
        )
    if duplicates_removed > 0:
        actions.append(f"Removed {duplicates_removed} duplicate rows.")
    if clipped > 0:
        actions.append(f"Clipped {clipped} outlier values to IQR bounds.")

    imputations = cleaning_report.get("imputations", [])
    for item in imputations[:6]:
        actions.append(
            f"Column {item.get('column')} used {item.get('strategy')} ({item.get('filled_count', 0)} values)."
        )

    if not actions:
        actions.append("Cleaning pipeline completed without major corrections.")

    return actions


def build_run_report_text(
    run_id: int | None,
    filename: str,
    was_cleaned: bool,
    threshold: float,
    before_metrics: dict,
    before_score: float,
    after_metrics: dict,
    after_score: float,
    confidence_level: str,
    cleaning_report: dict | None,
) -> str:
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    actions = _format_cleaning_actions(cleaning_report)

    report_lines = [
        "DataTrace Cleaning Report",
        f"Created At: {created_at}",
        f"Run ID: {run_id if run_id is not None else 'pending'}",
        f"Dataset Name: {filename}",
        f"Trust Threshold: {threshold}",
        f"Was Cleaned: {was_cleaned}",
        "",
        "Trust Score Summary",
        f"Before: {before_score:.2f}",
        f"After: {after_score:.2f}",
        f"Change: {after_score - before_score:+.2f}",
        f"Confidence Level: {confidence_level}",
        "",
        "Key Metrics Before",
        f"Rows: {before_metrics.get('total_rows', 0)}",
        f"Missing %: {before_metrics.get('missing_pct', 0)}",
        f"Duplicate %: {before_metrics.get('duplicate_pct', 0)}",
        f"Outlier %: {before_metrics.get('outlier_pct', 0)}",
        f"Type inconsistency %: {before_metrics.get('type_inconsistency_pct', 0)}",
        f"Null column ratio %: {before_metrics.get('null_col_ratio', 0)}",
        f"Constant column ratio %: {before_metrics.get('constant_col_ratio', 0)}",
        f"Average skewness: {before_metrics.get('avg_skewness', 0)}",
        "",
        "Key Metrics After",
        f"Rows: {after_metrics.get('total_rows', 0)}",
        f"Missing %: {after_metrics.get('missing_pct', 0)}",
        f"Duplicate %: {after_metrics.get('duplicate_pct', 0)}",
        f"Outlier %: {after_metrics.get('outlier_pct', 0)}",
        f"Type inconsistency %: {after_metrics.get('type_inconsistency_pct', 0)}",
        f"Null column ratio %: {after_metrics.get('null_col_ratio', 0)}",
        f"Constant column ratio %: {after_metrics.get('constant_col_ratio', 0)}",
        f"Average skewness: {after_metrics.get('avg_skewness', 0)}",
        "",
        "Cleaning Actions",
    ]

    report_lines.extend(f"- {action}" for action in actions)

    if cleaning_report:
        report_lines.extend([
            "",
            "Structured Cleaning Details",
            f"Duplicates Removed: {cleaning_report.get('duplicates_removed', 0)}",
            f"Missing Before: {cleaning_report.get('missing_before', 0)}",
            f"Missing After: {cleaning_report.get('missing_after', 0)}",
            f"Validation No Missing Values: {cleaning_report.get('validation', {}).get('no_missing_values', False)}",
            f"Validation No Duplicate Rows: {cleaning_report.get('validation', {}).get('no_duplicate_rows', False)}",
        ])

    report_lines.extend([
        "",
        "Answering Hint",
        "Use this report to explain why trust score changed, which cleaning actions were applied, and what issues remained after processing.",
    ])

    return "\n".join(report_lines)


def save_and_index_report(
    report_text: str,
    run_id: int | None,
    filename: str,
    reports_dir: str | os.PathLike[str],
) -> str:
    Path(reports_dir).mkdir(parents=True, exist_ok=True)
    safe_name = Path(filename).stem.replace(" ", "_")
    report_name = f"run_{run_id if run_id is not None else 'pending'}_{safe_name}.txt"
    report_path = Path(reports_dir) / report_name
    report_path.write_text(report_text, encoding="utf-8")

    try:
        _get_collection().upsert(
            ids=[report_name],
            documents=[report_text],
            metadatas=[{
                "run_id": run_id if run_id is not None else -1,
                "filename": filename,
                "report_path": str(report_path),
            }],
        )
    except Exception:
        pass

    return str(report_path)


def _extract_report_metadata(report_text: str, fallback_path: str | None = None) -> dict:
    metadata = {
        "run_id": -1,
        "filename": None,
        "report_path": fallback_path,
    }

    for line in report_text.splitlines():
        if line.startswith("Run ID:"):
            value = line.split(":", 1)[1].strip()
            try:
                metadata["run_id"] = int(value)
            except ValueError:
                metadata["run_id"] = -1
        elif line.startswith("Dataset Name:"):
            metadata["filename"] = line.split(":", 1)[1].strip()

    if metadata["filename"] is None and fallback_path:
        metadata["filename"] = Path(fallback_path).stem

    return metadata


def index_existing_reports(reports_dir: str | os.PathLike[str]) -> dict:
    reports_path = Path(reports_dir)
    if not reports_path.exists():
        return {"indexed": 0, "files": []}

    collection = _get_collection()
    files = sorted(reports_path.glob("*.txt"))
    indexed = 0
    indexed_files = []

    for file_path in files:
        report_text = file_path.read_text(encoding="utf-8")
        metadata = _extract_report_metadata(report_text, fallback_path=str(file_path))
        collection.upsert(
            ids=[file_path.stem],
            documents=[report_text],
            metadatas=[metadata],
        )
        indexed += 1
        indexed_files.append(file_path.name)

    return {"indexed": indexed, "files": indexed_files}


def _build_prompt(question: str, contexts: list[str]) -> str:
    context_text = "\n\n".join(contexts) if contexts else "No matching reports were found."
    return (
        "You are the DataTrace AI assistant. Answer only from the provided project reports. "
        "If the context is insufficient, say what is missing.\n\n"
        f"Context:\n{context_text}\n\n"
        f"Question:\n{question}\n\n"
        "Answer in clear, short language."
    )


def answer_question(question: str, run_id: int | None = None, filename: str | None = None) -> dict:
    collection = _get_collection()

    where = None
    if run_id is not None:
        where = {"run_id": run_id}

    query_result = collection.query(
        query_texts=[question],
        n_results=5,
        where=where,
    )

    documents = query_result.get("documents", [[]])[0] or []
    metadatas = query_result.get("metadatas", [[]])[0] or []

    if not documents and filename:
        query_result = collection.query(
            query_texts=[question],
            n_results=5,
            where={"filename": filename},
        )
        documents = query_result.get("documents", [[]])[0] or []
        metadatas = query_result.get("metadatas", [[]])[0] or []

    prompt = _build_prompt(question, documents)

    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": "You explain DataTrace cleaning reports with precision."},
            {"role": "user", "content": prompt},
        ],
        "stream": False,
    }

    body = json.dumps(payload).encode("utf-8")
    req = request.Request(
        f"{OLLAMA_URL.rstrip('/')}/api/chat",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=60) as response:
            raw = response.read().decode("utf-8")
        data = json.loads(raw)
        answer = data.get("message", {}).get("content") or data.get("response") or "No response returned by Ollama."
    except error.URLError as exc:
        return {
            "answer": "Ollama is not reachable right now. Start it with ollama serve and make sure the model is pulled.",
            "sources": [],
            "context": [],
            "error": str(exc),
        }

    sources = []
    for meta in metadatas:
        if not meta:
            continue
        sources.append({
            "run_id": meta.get("run_id"),
            "filename": meta.get("filename"),
            "report_path": meta.get("report_path"),
        })

    return {
        "answer": answer,
        "sources": sources,
        "context": documents,
    }