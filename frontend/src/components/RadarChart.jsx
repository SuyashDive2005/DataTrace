/**
 * Quality Radar Chart — 3-axis SVG polygon
 * Axes: Completeness (no missing), Uniqueness (no dup), Validity (no outliers)
 */

const cx = 140, cy = 140, MAX_R = 96;
const ANGLES_RAD = [-90, 30, 150].map((d) => (d * Math.PI) / 180);
const AXES = ['Completeness', 'Uniqueness', 'Validity'];

function toXY(angleRad, pct) {
  const len = (Math.max(0, Math.min(100, pct)) / 100) * MAX_R;
  return [cx + len * Math.cos(angleRad), cy + len * Math.sin(angleRad)];
}

function makePoints(scores) {
  return ANGLES_RAD.map((r, i) => toXY(r, scores[i]))
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
}

// Label offsets (slightly outside the full ring)
const LABEL_OFFSET = MAX_R + 24;
const LABEL_POS = ANGLES_RAD.map((r) => ({
  x: cx + LABEL_OFFSET * Math.cos(r),
  y: cy + LABEL_OFFSET * Math.sin(r),
  anchor:
    Math.cos(r) > 0.3 ? 'start' : Math.cos(r) < -0.3 ? 'end' : 'middle',
}));

export default function RadarChart({ before, after, showBefore = true }) {
  const beforeQ = [
    Math.max(0, 100 - (before?.missing_pct   || 0)),
    Math.max(0, 100 - (before?.duplicate_pct || 0)),
    Math.max(0, 100 - (before?.outlier_pct   || 0)),
  ];
  const afterQ = [
    Math.max(0, 100 - (after?.missing_pct   || 0)),
    Math.max(0, 100 - (after?.duplicate_pct || 0)),
    Math.max(0, 100 - (after?.outlier_pct   || 0)),
  ];

  const rings = [25, 50, 75, 100];

  return (
    <div className="glass" style={{ padding: '28px 24px', flex: 1, minWidth: 290 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>Quality Radar</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            3-dimensional quality assessment
          </p>
        </div>
        <div
          style={{
            padding: '4px 10px',
            borderRadius: 8,
            background: 'rgba(99,102,241,0.10)',
            border: '1px solid rgba(99,102,241,0.20)',
            color: '#a5b4fc',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          SVG · Live
        </div>
      </div>

      {/* SVG Radar */}
      <svg
        viewBox="0 0 280 290"
        style={{ width: '100%', maxWidth: 280, display: 'block', margin: '0 auto' }}
        aria-label="Quality radar chart"
      >
        <defs>
          <linearGradient id="afterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#6366f1" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
          <filter id="radarGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Concentric background rings */}
        {rings.map((pct, ri) => (
          <polygon
            key={ri}
            points={makePoints([pct, pct, pct])}
            fill="none"
            stroke={pct === 100 ? 'rgba(99,131,255,0.14)' : 'rgba(99,131,255,0.07)'}
            strokeWidth={pct === 100 ? 1.5 : 1}
            strokeDasharray={pct < 100 ? '3 4' : undefined}
          />
        ))}

        {/* Ring % labels along axis 0 (top) */}
        {[25, 50, 75].map((pct) => {
          const [x, y] = toXY(ANGLES_RAD[0], pct);
          return (
            <text
              key={pct}
              x={x + 6}
              y={y}
              textAnchor="start"
              dominantBaseline="middle"
              fill="rgba(99,131,255,0.35)"
              fontSize="7.5"
              fontFamily="Inter, sans-serif"
            >
              {pct}
            </text>
          );
        })}

        {/* Axis lines */}
        {ANGLES_RAD.map((r, i) => {
          const [x, y] = toXY(r, 100);
          return (
            <line
              key={i}
              x1={cx} y1={cy}
              x2={x}  y2={y}
              stroke="rgba(99,131,255,0.12)"
              strokeWidth="1"
            />
          );
        })}

        {/* Axis endpoint dots */}
        {ANGLES_RAD.map((r, i) => {
          const [x, y] = toXY(r, 100);
          return <circle key={i} cx={x} cy={y} r="3" fill="rgba(99,131,255,0.25)" />;
        })}

        {/* BEFORE polygon */}
        {showBefore && (
          <polygon
            points={makePoints(beforeQ)}
            fill="rgba(239,68,68,0.10)"
            stroke="#ef4444"
            strokeWidth="1.5"
            strokeOpacity="0.55"
            strokeDasharray="4 3"
            className="radar-polygon"
          />
        )}

        {/* AFTER polygon */}
        <polygon
          points={makePoints(afterQ)}
          fill="rgba(99,102,241,0.14)"
          stroke="url(#afterGrad)"
          strokeWidth="2"
          filter="url(#radarGlow)"
        />

        {/* Data point dots — After */}
        {ANGLES_RAD.map((r, i) => {
          const [x, y] = toXY(r, afterQ[i]);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="6" fill="rgba(99,102,241,0.2)" />
              <circle cx={x} cy={y} r="3.5" fill="#6366f1" stroke="#050810" strokeWidth="1.5" />
            </g>
          );
        })}

        {/* Data point dots — Before */}
        {showBefore && ANGLES_RAD.map((r, i) => {
          const [x, y] = toXY(r, beforeQ[i]);
          return (
            <circle key={i} cx={x} cy={y} r="3" fill="#ef4444" stroke="#050810" strokeWidth="1.5" opacity="0.75" />
          );
        })}

        {/* Axis labels */}
        {AXES.map((label, i) => (
          <text
            key={i}
            x={LABEL_POS[i].x}
            y={LABEL_POS[i].y}
            textAnchor={LABEL_POS[i].anchor}
            dominantBaseline="middle"
            fill="#8b9ab8"
            fontSize="10"
            fontWeight="600"
            fontFamily="Inter, sans-serif"
          >
            {label}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 14 }}>
        {showBefore && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 16, height: 2, background: '#ef4444', borderRadius: 2, opacity: 0.6 }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Before</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 16, height: 2, background: 'linear-gradient(90deg, #6366f1, #06b6d4)', borderRadius: 2 }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>After</span>
        </div>
      </div>

      {/* Per-axis scores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 16 }}>
        {AXES.map((label, i) => (
          <div
            key={i}
            style={{
              textAlign: 'center',
              padding: '10px 8px',
              borderRadius: 10,
              background: 'rgba(99,131,255,0.05)',
              border: '1px solid rgba(99,131,255,0.08)',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 16, color: '#a5b4fc' }}>
              {afterQ[i].toFixed(0)}%
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
