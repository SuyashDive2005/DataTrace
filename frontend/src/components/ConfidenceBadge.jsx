const CONFIG = {
  High:   { color: '#10b981', bg: 'rgba(16,185,129,0.10)',  border: 'rgba(16,185,129,0.28)',  icon: '●' },
  Medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.28)',  icon: '●' },
  Low:    { color: '#ef4444', bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.28)',   icon: '●' },
};

export default function ConfidenceBadge({ level }) {
  const c = CONFIG[level] || CONFIG.Low;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 14px',
        borderRadius: 999,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.color,
        fontWeight: 700,
        fontSize: 12.5,
        whiteSpace: 'nowrap',
        letterSpacing: '0.01em',
      }}
    >
      <span style={{ fontSize: 8 }}>{c.icon}</span>
      {level} Confidence
    </span>
  );
}
