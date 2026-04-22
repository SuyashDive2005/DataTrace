export default function Navbar({ view, onNavigate }) {
  const isActive = (keys) => keys.includes(view);

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "rgba(5,8,16,0.94)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "0 20px",
          height: 62,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button
          onClick={() => onNavigate("upload")}
          id="logo-btn"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "6px 0",
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: "1px solid rgba(99,102,241,0.35)",
              background: "rgba(99,102,241,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            DT
          </div>

          <div style={{ textAlign: "left" }}>
            <div
              style={{
                fontWeight: 800,
                fontSize: 16,
                lineHeight: 1.1,
                letterSpacing: "-0.01em",
              }}
            >
              DataTrace
            </div>
            <div
              style={{
                color: "var(--text-faint)",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Data Trust
            </div>
          </div>
        </button>

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {[
            {
              id: "nav-upload",
              dest: ["upload", "results", "loading"],
              key: "upload",
              label: "Upload",
            },
            {
              id: "nav-history",
              dest: ["history"],
              key: "history",
              label: "History",
            },
          ].map(({ id, dest, key, label }) => (
            <button
              key={key}
              id={id}
              className="btn-ghost"
              onClick={() => onNavigate(key)}
              style={{
                color: isActive(dest) ? "#a5b4fc" : undefined,
                borderColor: isActive(dest)
                  ? "rgba(99,102,241,0.40)"
                  : undefined,
                background: isActive(dest)
                  ? "rgba(99,102,241,0.08)"
                  : undefined,
                fontWeight: isActive(dest) ? 700 : 500,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
