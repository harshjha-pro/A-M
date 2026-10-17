// Soft rose sprays drawn in SVG (1.0.23 redesign): decoration only, hidden from screen
// readers, never catches taps. corner: tl | tr | bl | br.
const PLACE = {
  tl: { top: 0, left: 0, transform: 'none' },
  tr: { top: 0, right: 0, transform: 'scaleX(-1)' },
  bl: { bottom: 0, left: 0, transform: 'scaleY(-1)' },
  br: { bottom: 0, right: 0, transform: 'scale(-1,-1)' },
};

function Rose({ x, y, r, tone = 'a' }) {
  const rings = [1, 0.78, 0.58, 0.4];
  return (
    <g transform={`translate(${x} ${y})`}>
      {rings.map((k, ring) => {
        const n = 6 - ring;
        return Array.from({ length: n }).map((_, i) => {
          const a = (i * 360) / n + ring * 22;
          return (
            <ellipse key={`${ring}-${i}`} cx={0} cy={-r * k * 0.42} rx={r * k * 0.5} ry={r * k * 0.42}
              transform={`rotate(${a})`} fill={`url(#am-petal-${tone}-${ring})`} stroke="rgb(138 28 43 / .18)" strokeWidth="0.8" />
          );
        });
      })}
      <circle r={r * 0.12} fill="#8A1C2B" opacity=".55" />
    </g>
  );
}

function Leaf({ x, y, a, l }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${a})`}>
      <path d={`M0 0 Q ${l * 0.5} ${-l * 0.32} ${l} 0 Q ${l * 0.5} ${l * 0.32} 0 0 Z`} fill="#9DB09A" opacity=".85" />
      <path d={`M0 0 L ${l} 0`} stroke="#7E927A" strokeWidth="1" opacity=".7" />
    </g>
  );
}

export default function Florals({ corner = 'tl', size = 160, className = '' }) {
  const tones = { a: ['#FBE1E4', '#F2B7BF', '#E08E9B', '#B94A5C'], b: ['#FFF4F2', '#F9D7DA', '#EFB1BA', '#D27B89'] };
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 200 200"
      className={`pointer-events-none absolute select-none ${className}`} style={PLACE[corner]}>
      <defs>
        {Object.entries(tones).map(([k, cols]) => cols.map((c, i) => (
          <radialGradient key={`${k}${i}`} id={`am-petal-${k}-${i}`} cx="50%" cy="70%" r="70%">
            <stop offset="0%" stopColor={c} />
            <stop offset="100%" stopColor={cols[Math.min(i + 1, 3)]} />
          </radialGradient>
        )))}
      </defs>
      <Leaf x={40} y={52} a={-20} l={70} />
      <Leaf x={36} y={60} a={70} l={62} />
      <Leaf x={70} y={30} a={10} l={58} />
      <Leaf x={20} y={80} a={110} l={50} />
      <Rose x={46} y={46} r={40} tone="a" />
      <Rose x={108} y={24} r={26} tone="b" />
      <Rose x={18} y={108} r={24} tone="b" />
      <circle cx={140} cy={52} r={5} fill="#E8A317" opacity=".55" />
      <circle cx={60} cy={130} r={4} fill="#E8A317" opacity=".5" />
      <circle cx={150} cy={18} r={3} fill="#F2B7BF" />
    </svg>
  );
}
