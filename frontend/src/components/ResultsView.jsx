import TrustGauge from "./TrustGauge";
import ConfidenceBadge from "./ConfidenceBadge";

const CLEAN_ITEMS = [
  { key: "missing_pct", label: "Missing values" },
  { key: "duplicate_pct", label: "Duplicate rows" },
  { key: "outlier_pct", label: "Outliers (IQR)" },
  { key: "type_inconsistency_pct", label: "Type inconsistency" },
  { key: "null_col_ratio", label: "Null columns" },
  { key: "constant_col_ratio", label: "Constant columns" },
];

function fmtPct(value) {
  return `${(value || 0).toFixed(1)}%`;
}

function fmtDelta(beforeValue, afterValue) {
  const delta = +((afterValue || 0) - (beforeValue || 0)).toFixed(1);
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`;
}

function buildCleaningSummary(beforeMetrics, afterMetrics) {
  return CLEAN_ITEMS.map((item) => {
    const before = Number(beforeMetrics?.[item.key] || 0);
    const after = Number(afterMetrics?.[item.key] || 0);
    const fixed = +(before - after).toFixed(1);
    return { ...item, before, after, fixed };
  })
    .filter((item) => item.fixed > 0.1)
    .sort((a, b) => b.fixed - a.fixed);
}

function buildCleaningActions(beforeMetrics, afterMetrics, cleaningReport) {
  if (cleaningReport) {
    const actions = [];
    if (cleaningReport.missing_before > cleaningReport.missing_after) {
      actions.push(
        `Missing values fixed: ${(cleaningReport.missing_before - cleaningReport.missing_after).toLocaleString()}`,
      );
    }
    if ((cleaningReport.duplicates_removed || 0) > 0) {
      actions.push(
        `Duplicate rows removed: ${(cleaningReport.duplicates_removed || 0).toLocaleString()}`,
      );
    }

    const clipped = (cleaningReport.outlier_clipping || []).reduce(
      (sum, item) => sum + (item.clipped_low || 0) + (item.clipped_high || 0),
      0,
    );
    if (clipped > 0) {
      actions.push(
        `Outlier values clipped to IQR bounds: ${clipped.toLocaleString()}`,
      );
    }

    if (actions.length > 0) return actions;
  }

  const actions = [];
  const missingFixed = Math.max(
    (beforeMetrics?.missing_count || 0) - (afterMetrics?.missing_count || 0),
    0,
  );
  const duplicatesRemoved = Math.max(
    (beforeMetrics?.duplicate_count || 0) -
      (afterMetrics?.duplicate_count || 0),
    0,
  );
  const outliersHandled = Math.max(
    (beforeMetrics?.outlier_count || 0) - (afterMetrics?.outlier_count || 0),
    0,
  );

  if (missingFixed > 0)
    actions.push(`Missing values fixed: ${missingFixed.toLocaleString()}`);
  if (duplicatesRemoved > 0)
    actions.push(
      `Duplicate rows removed: ${duplicatesRemoved.toLocaleString()}`,
    );
  if (outliersHandled > 0)
    actions.push(`Outliers handled: ${outliersHandled.toLocaleString()}`);

  if (actions.length === 0) {
    actions.push("Standard cleaning pipeline executed.");
  }
  return actions;
}

export default function ResultsView({ data, onBack }) {
  const {
    filename,
    was_cleaned,
    threshold,
    before,
    after,
    download_url,
    cleaning_report,
  } = data;
  const improvement = +(after.trust_score - before.trust_score).toFixed(1);
  const rowsRemoved =
    cleaning_report?.duplicates_removed ??
    Math.max(
      (before.metrics?.total_rows || 0) - (after.metrics?.total_rows || 0),
      0,
    );
  const cleaningSummary = buildCleaningSummary(before.metrics, after.metrics);
  const cleaningActions = buildCleaningActions(
    before.metrics,
    after.metrics,
    cleaning_report,
  );
  const imputationPreview = (cleaning_report?.imputations || []).slice(0, 8);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `datatrace-${filename}.json`,
    });
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCleaned = () => {
    if (!download_url) return;
    window.open(download_url, "_blank");
  };

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "30px 20px 70px" }}>
      <div
        className="glass animate-fade-up"
        style={{ padding: 24, marginBottom: 16 }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <p
              style={{
                fontSize: 11,
                color: "var(--text-faint)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              Processing Complete
            </p>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 800,
                marginBottom: 8,
                wordBreak: "break-word",
              }}
            >
              {filename}
            </h1>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <ConfidenceBadge level={after.confidence_level} />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Threshold: {Number(threshold ?? 95).toFixed(0)}/100
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {was_cleaned && download_url && (
              <button
                className="btn-secondary"
                onClick={handleDownloadCleaned}
                id="download-cleaned-btn"
              >
                Download cleaned file
              </button>
            )}
            <button
              className="btn-export"
              onClick={handleExport}
              id="export-btn"
            >
              Export JSON
            </button>
            <button className="btn-ghost" onClick={onBack} id="back-btn">
              New analysis
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div
          className="glass animate-fade-up delay-100"
          style={{ padding: 22, textAlign: "center" }}
        >
          <TrustGauge
            score={after.trust_score}
            size={190}
            uid="final"
            label="FINAL TRUST SCORE"
          />
        </div>

        <div
          className="glass animate-fade-up delay-100"
          style={{ padding: 22 }}
        >
          <p
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              marginBottom: 8,
            }}
          >
            Outcome
          </p>
          <p
            style={{
              fontSize: 26,
              fontWeight: 900,
              marginBottom: 4,
              color: improvement >= 0 ? "#10b981" : "#ef4444",
            }}
          >
            {improvement >= 0 ? "+" : ""}
            {improvement}
          </p>
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: 13,
              marginBottom: 14,
            }}
          >
            Trust score change
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(110px, 1fr))",
              gap: 8,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                padding: 10,
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  marginBottom: 4,
                }}
              >
                Before score
              </p>
              <p className="mono" style={{ fontSize: 18, fontWeight: 800 }}>
                {before.trust_score.toFixed(1)}
              </p>
            </div>
            <div
              style={{
                padding: 10,
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "rgba(16,185,129,0.08)",
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  marginBottom: 4,
                }}
              >
                After score
              </p>
              <p
                className="mono"
                style={{ fontSize: 18, fontWeight: 800, color: "#6ee7b7" }}
              >
                {after.trust_score.toFixed(1)}
              </p>
            </div>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {after.trust_score >= threshold
              ? "Dataset is above trust threshold."
              : "Dataset is still below trust threshold."}
          </p>
        </div>
      </div>

      {was_cleaned ? (
        <div
          className="glass animate-fade-up delay-200"
          style={{ padding: 22, marginBottom: 16 }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
            What was cleaned to increase trust score
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              marginBottom: 14,
            }}
          >
            Only quality dimensions with measurable improvement are listed.
          </p>

          <div style={{ marginBottom: 14 }}>
            <p
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                marginBottom: 6,
              }}
            >
              Cleaning actions performed
            </p>
            <div style={{ display: "grid", gap: 6 }}>
              {cleaningActions.map((action) => (
                <div
                  key={action}
                  style={{
                    fontSize: 13,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "rgba(16,185,129,0.08)",
                    border: "1px solid rgba(16,185,129,0.22)",
                    color: "#a7f3d0",
                  }}
                >
                  {action}
                </div>
              ))}
            </div>
          </div>

          {cleaningSummary.length > 0 ? (
            <div style={{ display: "grid", gap: 10 }}>
              {cleaningSummary.map((item) => (
                <div
                  key={item.key}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 13 }}>
                      {item.label}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {fmtPct(item.before)} to {fmtPct(item.after)}
                    </p>
                  </div>
                  <div
                    style={{ fontSize: 12, fontWeight: 700, color: "#10b981" }}
                  >
                    fixed {fmtPct(item.fixed)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
              No large metric shifts detected, but cleanup pipeline still
              executed.
            </p>
          )}

          {imputationPreview.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginBottom: 6,
                }}
              >
                Imputation audit (sample)
              </p>
              <div style={{ display: "grid", gap: 6 }}>
                {imputationPreview.map((item) => (
                  <div
                    key={`${item.column}-${item.strategy}`}
                    style={{
                      fontSize: 12.5,
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "rgba(59,130,246,0.08)",
                      border: "1px solid rgba(59,130,246,0.22)",
                    }}
                  >
                    <strong>{item.column}</strong>: {item.strategy} (filled{" "}
                    {item.filled_count})
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: 12,
              fontSize: 12.5,
              color: "var(--text-muted)",
            }}
          >
            Rows removed during cleaning (duplicates):{" "}
            <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>
              {rowsRemoved.toLocaleString()}
            </span>
          </div>
        </div>
      ) : (
        <div
          className="glass animate-fade-up delay-200"
          style={{ padding: 22, marginBottom: 16 }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
            No cleaning needed
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
            The dataset already met quality requirements, so no records were
            modified.
          </p>
        </div>
      )}

      <div className="glass animate-fade-up delay-300" style={{ padding: 22 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>
          Key quality metrics (before vs after)
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 10,
          }}
        >
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <p
              style={{
                color: "var(--text-muted)",
                fontSize: 12,
                marginBottom: 4,
              }}
            >
              Missing values
            </p>
            <p style={{ fontSize: 12.5, marginBottom: 3 }}>
              Before:{" "}
              <span className="mono">
                {fmtPct(before.metrics?.missing_pct)}
              </span>
            </p>
            <p style={{ fontSize: 12.5, marginBottom: 6 }}>
              After:{" "}
              <span className="mono">{fmtPct(after.metrics?.missing_pct)}</span>
            </p>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#8b9ab8" }}>
              Δ{" "}
              {fmtDelta(
                before.metrics?.missing_pct,
                after.metrics?.missing_pct,
              )}
            </p>
          </div>
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <p
              style={{
                color: "var(--text-muted)",
                fontSize: 12,
                marginBottom: 4,
              }}
            >
              Duplicate rows
            </p>
            <p style={{ fontSize: 12.5, marginBottom: 3 }}>
              Before:{" "}
              <span className="mono">
                {fmtPct(before.metrics?.duplicate_pct)}
              </span>
            </p>
            <p style={{ fontSize: 12.5, marginBottom: 6 }}>
              After:{" "}
              <span className="mono">
                {fmtPct(after.metrics?.duplicate_pct)}
              </span>
            </p>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#8b9ab8" }}>
              Δ{" "}
              {fmtDelta(
                before.metrics?.duplicate_pct,
                after.metrics?.duplicate_pct,
              )}
            </p>
          </div>
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <p
              style={{
                color: "var(--text-muted)",
                fontSize: 12,
                marginBottom: 4,
              }}
            >
              Outliers
            </p>
            <p style={{ fontSize: 12.5, marginBottom: 3 }}>
              Before:{" "}
              <span className="mono">
                {fmtPct(before.metrics?.outlier_pct)}
              </span>
            </p>
            <p style={{ fontSize: 12.5, marginBottom: 6 }}>
              After:{" "}
              <span className="mono">{fmtPct(after.metrics?.outlier_pct)}</span>
            </p>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#8b9ab8" }}>
              Δ{" "}
              {fmtDelta(
                before.metrics?.outlier_pct,
                after.metrics?.outlier_pct,
              )}
            </p>
          </div>
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <p
              style={{
                color: "var(--text-muted)",
                fontSize: 12,
                marginBottom: 4,
              }}
            >
              Type inconsistency
            </p>
            <p style={{ fontSize: 12.5, marginBottom: 3 }}>
              Before:{" "}
              <span className="mono">
                {fmtPct(before.metrics?.type_inconsistency_pct)}
              </span>
            </p>
            <p style={{ fontSize: 12.5, marginBottom: 6 }}>
              After:{" "}
              <span className="mono">
                {fmtPct(after.metrics?.type_inconsistency_pct)}
              </span>
            </p>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#8b9ab8" }}>
              Δ{" "}
              {fmtDelta(
                before.metrics?.type_inconsistency_pct,
                after.metrics?.type_inconsistency_pct,
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
