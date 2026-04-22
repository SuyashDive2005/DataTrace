import { useState, useRef } from "react";

const HOW_TO_USE = [
  "Upload a CSV or XLSX dataset from your system.",
  "Click Run analysis to start quality checks and trust scoring.",
  "Review before/after score and see what cleaning was done.",
  "Download cleaned data and export the JSON report.",
];

const PROJECT_FEATURES = [
  {
    title: "Data Quality Checks",
    desc: "Detects missing values, duplicates, outliers, and type inconsistencies.",
  },
  {
    title: "Trust Score Prediction",
    desc: "Computes a trust score with confidence level for your uploaded dataset.",
  },
  {
    title: "Automatic Cleaning",
    desc: "Applies cleanup pipeline when trust score is below the quality threshold.",
  },
  {
    title: "Before vs After Insights",
    desc: "Shows score improvement and the exact cleaning impact on key metrics.",
  },
  {
    title: "Cleaned File Export",
    desc: "Lets you download the cleaned dataset in the original file format.",
  },
  {
    title: "Analysis Report",
    desc: "Exports complete run details in JSON for sharing or audit purposes.",
  },
];

export default function UploadZone({ onUpload, error }) {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  return (
    <div style={{ position: "relative", minHeight: "calc(100vh - 62px)" }}>
      <section
        style={{ maxWidth: 720, margin: "0 auto", padding: "52px 20px 70px" }}
      >
        <div
          className="animate-fade-up"
          style={{ marginBottom: 20, textAlign: "center" }}
        >
          <h1
            style={{
              fontSize: 34,
              fontWeight: 800,
              marginBottom: 10,
              letterSpacing: "-0.02em",
            }}
          >
            DataTrust Analyzer
          </h1>
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            Upload a dataset to run quality checks, trust scoring, and automatic
            cleaning when needed.
          </p>
        </div>

        <div
          id="upload-dropzone"
          className={`upload-zone animate-fade-up delay-200 ${dragging ? "drag-active" : ""}`}
          style={{ padding: "40px 26px", textAlign: "center" }}
          onClick={() => inputRef.current.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            id="file-input"
            type="file"
            accept=".csv,.xlsx"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files[0];
              if (f) setFile(f);
            }}
          />

          <div style={{ fontSize: 48, marginBottom: 14, lineHeight: 1 }}>
            {file ? "FILE" : "UPLOAD"}
          </div>

          {file ? (
            <div>
              <p
                style={{
                  fontWeight: 700,
                  fontSize: 18,
                  marginBottom: 8,
                  color: "#f0f4ff",
                }}
              >
                {file.name}
              </p>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <span
                  className="tag"
                  style={{
                    background: "rgba(99,102,241,0.12)",
                    color: "#a5b4fc",
                    border: "1px solid rgba(99,102,241,0.25)",
                  }}
                >
                  {file.name.split(".").pop().toUpperCase()}
                </span>
                <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </div>
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: 12,
                  marginTop: 10,
                }}
              >
                Click to change file
              </p>
            </div>
          ) : (
            <div>
              <p
                style={{
                  fontWeight: 700,
                  fontSize: 18,
                  marginBottom: 10,
                  color: "#f0f4ff",
                }}
              >
                Drop your dataset here
              </p>
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                Click to browse files. Supported:
                <span
                  className="tag"
                  style={{
                    background: "rgba(99,102,241,0.10)",
                    color: "#a5b4fc",
                    border: "1px solid rgba(99,102,241,0.20)",
                  }}
                >
                  .csv
                </span>{" "}
                and
                <span
                  className="tag"
                  style={{
                    background: "rgba(99,102,241,0.10)",
                    color: "#a5b4fc",
                    border: "1px solid rgba(99,102,241,0.20)",
                  }}
                >
                  .xlsx
                </span>
              </p>
            </div>
          )}
        </div>

        {/* ── Error banner ─────────────────────────────────────────── */}
        {error && (
          <div
            className="animate-fade-in"
            style={{
              marginTop: 14,
              padding: "13px 18px",
              borderRadius: 12,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.28)",
              color: "#fca5a5",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 16 }}>⚠</span>
            {error}
          </div>
        )}

        {/* ── CTA button ───────────────────────────────────────────── */}
        <div
          className="animate-fade-up delay-300"
          style={{ marginTop: 18, display: "flex", justifyContent: "center" }}
        >
          <button
            id="analyze-btn"
            className="btn-primary"
            onClick={() => file && onUpload(file)}
            disabled={!file}
            style={{ fontSize: 15, padding: "13px 36px", borderRadius: 12 }}
          >
            Run analysis
          </button>
        </div>

        <div
          className="glass-sm animate-fade-up delay-400"
          style={{ marginTop: 22, padding: "14px 16px" }}
        >
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: 12,
              marginBottom: 8,
            }}
          >
            What you get after processing:
          </p>
          <ul
            style={{
              marginLeft: 16,
              color: "var(--text-primary)",
              fontSize: 13,
              lineHeight: 1.75,
            }}
          >
            <li>Final trust score and confidence level</li>
            <li>What was cleaned to improve score</li>
            <li>Cleaned file download and JSON report</li>
          </ul>
        </div>

        <div
          className="glass-sm animate-fade-up delay-500"
          style={{ marginTop: 14, padding: "16px" }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
            How to use
          </h3>
          <div style={{ display: "grid", gap: 8 }}>
            {HOW_TO_USE.map((step, index) => (
              <div
                key={step}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <span
                  style={{
                    minWidth: 20,
                    height: 20,
                    borderRadius: "50%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#a5b4fc",
                    background: "rgba(99,102,241,0.14)",
                    border: "1px solid rgba(99,102,241,0.25)",
                  }}
                >
                  {index + 1}
                </span>
                <span
                  style={{
                    color: "var(--text-primary)",
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          className="glass-sm animate-fade-up delay-600"
          style={{ marginTop: 14, padding: "16px" }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
            Project features
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 10,
            }}
          >
            {PROJECT_FEATURES.map((feature) => (
              <div
                key={feature.title}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                  {feature.title}
                </p>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    lineHeight: 1.5,
                  }}
                >
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
