import ConfidenceBadge from "./ConfidenceBadge";

function ScorePill({ score }) {
  if (score == null)
    return <span style={{ color: "var(--text-faint)" }}>—</span>;
  const c = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  const bg =
    score >= 75
      ? "rgba(16,185,129,0.11)"
      : score >= 50
        ? "rgba(245,158,11,0.11)"
        : "rgba(239,68,68,0.11)";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 11px",
        borderRadius: 999,
        background: bg,
        color: c,
        fontWeight: 800,
        fontSize: 13,
        letterSpacing: "-0.01em",
      }}
    >
      {score.toFixed(1)}
    </span>
  );
}

export default function HistoryTable({ data, onBack }) {
  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "30px 20px 70px" }}>
      {/* Header */}
      <div
        className="animate-fade-up"
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 14,
          marginBottom: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontWeight: 800,
              fontSize: 24,
              letterSpacing: "-0.02em",
              marginBottom: 4,
            }}
          >
            History
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 5 }}>
            {data.length} pipeline run{data.length !== 1 ? "s" : ""} stored
          </p>
        </div>
        <button className="btn-ghost" onClick={onBack} id="history-back-btn">
          Back to upload
        </button>
      </div>

      {data.length === 0 ? (
        /* Empty state */
        <div
          className="glass animate-fade-up"
          style={{ padding: "54px 24px", textAlign: "center" }}
        >
          <p style={{ fontWeight: 800, fontSize: 20, marginBottom: 10 }}>
            No history yet
          </p>
          <p
            style={{
              color: "var(--text-muted)",
              maxWidth: 380,
              margin: "0 auto",
              lineHeight: 1.6,
            }}
          >
            Upload and analyze a dataset to create your first run.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {data.map((run, i) => {
            const before = run.before_trust_score ?? 0;
            const after = run.after_trust_score ?? 0;
            const impNum = +(after - before).toFixed(1);
            const impColor =
              impNum > 0 ? "#10b981" : impNum < 0 ? "#ef4444" : "#8b9ab8";

            return (
              <div
                key={run.id}
                className="glass animate-fade-up"
                style={{
                  padding: "14px 16px",
                  animationDelay: `${i * 0.04}s`,
                  opacity: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <p
                      style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}
                    >
                      {run.filename}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {run.upload_time
                        ? new Date(run.upload_time).toLocaleString()
                        : "—"}
                    </p>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        padding: "3px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        background: run.was_cleaned
                          ? "rgba(99,102,241,0.10)"
                          : "rgba(255,255,255,0.04)",
                        border: `1px solid ${run.was_cleaned ? "rgba(99,102,241,0.28)" : "rgba(255,255,255,0.08)"}`,
                        color: run.was_cleaned
                          ? "#a5b4fc"
                          : "var(--text-muted)",
                      }}
                    >
                      {run.was_cleaned ? "Cleaned" : "No cleaning"}
                    </span>
                    <ConfidenceBadge level={run.confidence_level} />
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        marginBottom: 3,
                      }}
                    >
                      Before
                    </p>
                    <ScorePill score={before} />
                  </div>
                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        marginBottom: 3,
                      }}
                    >
                      After
                    </p>
                    <ScorePill score={after} />
                  </div>
                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        marginBottom: 3,
                      }}
                    >
                      Improvement
                    </p>
                    <p
                      style={{ fontSize: 15, fontWeight: 800, color: impColor }}
                    >
                      {impNum > 0 ? `+${impNum.toFixed(1)}` : impNum.toFixed(1)}
                    </p>
                  </div>
                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        marginBottom: 3,
                      }}
                    >
                      Rows
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 700 }}>
                      {(run.before_total_rows ?? 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
