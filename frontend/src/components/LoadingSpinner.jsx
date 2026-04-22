import { useEffect, useState } from "react";

const PIPELINE_STAGES = [
  { label: "Uploading file" },
  { label: "Analyzing data quality" },
  { label: "Calculating trust score" },
  { label: "Applying cleanup if required" },
  { label: "Preparing results" },
];

export default function LoadingSpinner() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((p) => (p < PIPELINE_STAGES.length - 1 ? p + 1 : p));
    }, 1100);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        minHeight: "calc(100vh - 62px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "30px 20px",
        textAlign: "center",
      }}
    >
      <div
        className="glass animate-fade-up"
        style={{ width: "100%", maxWidth: 620, padding: 24 }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            margin: "0 auto 16px",
            borderRadius: "50%",
            border: "4px solid rgba(99,102,241,0.18)",
            borderTopColor: "#6366f1",
            animation: "spin 0.9s linear infinite",
          }}
        />

        <p style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
          Processing dataset
        </p>
        <p
          style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 18 }}
        >
          {PIPELINE_STAGES[active].label}
        </p>

        <div style={{ display: "grid", gap: 8, textAlign: "left" }}>
          {PIPELINE_STAGES.map((stage, index) => (
            <div
              key={stage.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
              }}
            >
              <span
                style={{
                  width: 18,
                  textAlign: "center",
                  color:
                    index < active
                      ? "#10b981"
                      : index === active
                        ? "#a5b4fc"
                        : "var(--text-faint)",
                }}
              >
                {index < active ? "✓" : index === active ? "•" : "○"}
              </span>
              <span
                style={{
                  color:
                    index <= active
                      ? "var(--text-primary)"
                      : "var(--text-muted)",
                }}
              >
                {stage.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
