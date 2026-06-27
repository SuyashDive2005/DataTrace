const PIPELINE_STAGES = [
  "Waiting in queue...",
  "Parsing file...",
  "Analyzing initial quality...",
  "Cleaning dataset entries...",
  "Preparing results...",
];

export default function LoadingSpinner({ status, progress = 0 }) {
  let active = PIPELINE_STAGES.indexOf(status);

  // Unknown status -> first stage
  if (active === -1) {
    active = 0;
  }

  // When backend is finished
  if (status === "SUCCESS") {
    active = PIPELINE_STAGES.length;
  }

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
        style={{
          width: "100%",
          maxWidth: 620,
          padding: 24,
        }}
      >
        {/* Spinner */}
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

        <p
          style={{
            fontSize: 20,
            fontWeight: 800,
            marginBottom: 8,
          }}
        >
          Processing Dataset
        </p>

        <p
          style={{
            color: "var(--text-muted)",
            fontSize: 13,
            marginBottom: 20,
          }}
        >
          {status || "Waiting in queue..."}
        </p>

        {/* Progress Bar */}
        <div
          style={{
            width: "100%",
            height: 10,
            background: "#e5e7eb",
            borderRadius: 10,
            overflow: "hidden",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: "#6366f1",
              transition: "width 0.4s ease",
            }}
          />
        </div>

        <p
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#6366f1",
            marginBottom: 20,
          }}
        >
          {progress}% Complete
        </p>

        {/* Pipeline Stages */}
        <div
          style={{
            display: "grid",
            gap: 10,
            textAlign: "left",
          }}
        >
          {PIPELINE_STAGES.map((stage, index) => {
            const completed = index < active;
            const current = index === active;

            return (
              <div
                key={stage}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 14,
                }}
              >
                <span
                  style={{
                    width: 18,
                    textAlign: "center",
                    color: completed
                      ? "#10b981"
                      : current
                      ? "#6366f1"
                      : "var(--text-faint)",
                    fontWeight: 700,
                  }}
                >
                  {completed ? "✓" : current ? "●" : "○"}
                </span>

                <span
                  style={{
                    color:
                      completed || current
                        ? "var(--text-primary)"
                        : "var(--text-muted)",
                    fontWeight: current ? 600 : 400,
                  }}
                >
                  {stage}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}