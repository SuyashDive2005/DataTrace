import { useEffect, useState } from 'react';

/* ── Helpers ────────────────────────────────────────────────────── */
const scoreColor = (s) => {
  if (s >= 75) return '#10b981';
  if (s >= 50) return '#f59e0b';
  return '#ef4444';
};

function healthGrade(score) {
  if (score >= 92) return { grade: 'A+', color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.30)' };
  if (score >= 80) return { grade: 'A',  color: '#34d399', bg: 'rgba(52,211,153,0.11)',  border: 'rgba(52,211,153,0.28)' };
  if (score >= 68) return { grade: 'B',  color: '#06b6d4', bg: 'rgba(6,182,212,0.11)',   border: 'rgba(6,182,212,0.30)'  };
  if (score >= 55) return { grade: 'C',  color: '#f59e0b', bg: 'rgba(245,158,11,0.11)',  border: 'rgba(245,158,11,0.28)' };
  if (score >= 40) return { grade: 'D',  color: '#f97316', bg: 'rgba(249,115,22,0.10)',  border: 'rgba(249,115,22,0.28)' };
  return                 { grade: 'F',  color: '#ef4444', bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.28)'  };
}

/* ── SVG arc gauge (270° sweep, speedometer) ────────────────────── */
export default function TrustGauge({ score, size = 200, label = 'TRUST SCORE', uid = 'g' }) {
  const [animScore, setAnimScore] = useState(0);

  useEffect(() => {
    setAnimScore(0);
    let raf;
    const start    = performance.now();
    const duration = 1900;
    const step     = (now) => {
      const t     = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimScore(eased * score);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const r             = 74;
  const cx            = 100;
  const cy            = 100;
  const circ          = 2 * Math.PI * r;        // ≈ 464.9
  const totalArc      = (270 / 360) * circ;      // ≈ 348.7
  const filledLen     = Math.max(0.01, (animScore / 100) * totalArc);
  const color         = scoreColor(score);
  const { grade, ...gradeStyle } = healthGrade(score);
  const filterId      = `gf-${uid}`;
  const gradId        = `gg-${uid}`;

  return (
    <div style={{ display: 'inline-block', textAlign: 'center' }}>
      <svg
        viewBox="0 0 200 220"
        width={size}
        height={size * 1.1}
        aria-label={`Trust score ${score.toFixed(1)}`}
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Glow filter */}
          <filter id={filterId} x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Gradient stroke */}
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor={color} stopOpacity="0.7" />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>

        {/* Outer decorative ring (dashed) */}
        <circle
          cx={cx} cy={cy} r={r + 16}
          fill="none"
          stroke="rgba(99,131,255,0.08)"
          strokeWidth="1"
          strokeDasharray="4 6"
          transform={`rotate(90, ${cx}, ${cy})`}
        />

        {/* Background track */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="rgba(99,131,255,0.10)"
          strokeWidth="14"
          strokeLinecap="butt"
          strokeDasharray={`${totalArc} ${circ - totalArc}`}
          transform={`rotate(135, ${cx}, ${cy})`}
        />

        {/* Filled arc with glow */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${filledLen} ${circ - filledLen}`}
          transform={`rotate(135, ${cx}, ${cy})`}
          filter={`url(#${filterId})`}
          className="gauge-fill"
        />

        {/* Score number */}
        <text
          x={cx} y={cy - 8}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#f0f4ff"
          fontSize="32"
          fontWeight="900"
          fontFamily="Inter, sans-serif"
          letterSpacing="-0.02em"
        >
          {animScore.toFixed(1)}
        </text>

        {/* /100 */}
        <text
          x={cx} y={cy + 14}
          textAnchor="middle"
          fill="#3d4d6e"
          fontSize="11"
          fontWeight="600"
          fontFamily="Inter, sans-serif"
        >
          / 100
        </text>

        {/* Label below */}
        <text
          x={cx} y={cy + 30}
          textAnchor="middle"
          fill="#3d4d6e"
          fontSize="8.5"
          fontWeight="700"
          fontFamily="Inter, sans-serif"
          letterSpacing="0.08em"
        >
          {label}
        </text>

        {/* Min / Max tick labels */}
        <text x="42"  y="172" textAnchor="middle" fill="#3d4d6e" fontSize="8.5" fontFamily="Inter, sans-serif">0</text>
        <text x="158" y="172" textAnchor="middle" fill="#3d4d6e" fontSize="8.5" fontFamily="Inter, sans-serif">100</text>

        {/* Health grade badge */}
        <rect
          x={cx - 22} y={185}
          width={44} height={26}
          rx="8"
          fill={gradeStyle.bg}
          stroke={gradeStyle.border}
          strokeWidth="1"
        />
        <text
          x={cx} y={200}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={gradeStyle.color}
          fontSize="13"
          fontWeight="900"
          fontFamily="Inter, sans-serif"
        >
          Grade {grade}
        </text>
      </svg>
    </div>
  );
}
