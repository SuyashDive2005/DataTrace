const METRICS = [
  { key: 'missing_pct',   countKey: 'missing_count',   label: 'Missing Values', icon: '○', color: '#f59e0b', desc: 'Cells with null / NaN' },
  { key: 'duplicate_pct', countKey: 'duplicate_count', label: 'Duplicate Rows', icon: '⊡', color: '#6366f1', desc: 'Exact duplicate records' },
  { key: 'outlier_pct',   countKey: 'outlier_count',   label: 'IQR Outliers',   icon: '◇', color: '#ef4444', desc: 'Values outside Q1−1.5·IQR or Q3+1.5·IQR' },
];

function trend(before, after) {
  if (before == null || after == null) return null;
  const diff = after - before;
  if (diff < -0.5) return { dir: '↓', color: '#10b981', label: `−${Math.abs(diff).toFixed(1)}%` };
  if (diff > 0.5)  return { dir: '↑', color: '#ef4444', label: `+${diff.toFixed(1)}%` };
  return               { dir: '→', color: '#8b9ab8', label: `±0%` };
}

function MetricRow({ label, icon, color, desc, pct, count, beforePct }) {
  const bar = pct > 20 ? '#ef4444' : pct > 5 ? '#f59e0b' : '#10b981';
  const t   = trend(beforePct, pct);

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 9 }}>
        {/* Left: icon + label + desc */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: `${color}18`,
              border: `1px solid ${color}33`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color,
              fontSize: 14,
              fontWeight: 800,
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            {icon}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-faint)', lineHeight: 1.3 }}>{desc}</div>
          </div>
        </div>

        {/* Right: % + count + trend */}
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: bar }}>
            {(pct || 0).toFixed(1)}%
          </div>
          {count !== undefined && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              {count.toLocaleString()} rows
            </div>
          )}
          {t && (
            <div style={{ fontSize: 11, color: t.color, fontWeight: 700, marginTop: 3 }}>
              {t.dir} {t.label}
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 7,
          background: 'rgba(99,131,255,0.07)',
          borderRadius: 9999,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          className="metric-bar-fill"
          style={{
            width: `${Math.min(pct || 0, 100)}%`,
            background: `linear-gradient(to right, ${color}cc, ${color})`,
          }}
        />
      </div>

      {/* Before bar ghost overlay if before is given */}
      {beforePct != null && (
        <div
          style={{
            height: 3,
            borderRadius: 9999,
            overflow: 'hidden',
            marginTop: 3,
            background: 'rgba(99,131,255,0.05)',
          }}
        >
          <div
            style={{
              width: `${Math.min(beforePct, 100)}%`,
              height: '100%',
              background: 'rgba(239,68,68,0.30)',
              borderRadius: 9999,
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function MetricsCard({ m, title, before = null }) {
  return (
    <div className="glass" style={{ padding: '26px 24px', flex: 1, minWidth: 250 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <div>
          <p style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.01em' }}>{title || 'Quality Metrics'}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 5, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Total:{' '}
              <span style={{ color: '#a5b4fc', fontWeight: 700 }}>
                {(m?.total_rows || 0).toLocaleString()}
              </span>
              {' '}rows
            </span>
            {before && (
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--text-faint)',
                  background: 'rgba(99,131,255,0.07)',
                  padding: '2px 8px',
                  borderRadius: 5,
                  border: '1px solid rgba(99,131,255,0.12)',
                }}
              >
                ▲▼ vs before
              </span>
            )}
          </div>
        </div>

        {/* Overall health dot */}
        {(() => {
          const avg = ((m?.missing_pct||0) + (m?.duplicate_pct||0) + (m?.outlier_pct||0)) / 3;
          const c   = avg < 5 ? '#10b981' : avg < 15 ? '#f59e0b' : '#ef4444';
          return (
            <div style={{
              width: 10, height: 10, borderRadius: '50%', background: c,
              boxShadow: `0 0 8px ${c}`,
            }} />
          );
        })()}
      </div>

      {/* Metrics */}
      {METRICS.map(({ key, countKey, label, icon, color, desc }) => (
        <MetricRow
          key={key}
          label={label}
          icon={icon}
          color={color}
          desc={desc}
          pct={m?.[key] ?? 0}
          count={m?.[countKey]}
          beforePct={before ? before[key] : null}
        />
      ))}
    </div>
  );
}
