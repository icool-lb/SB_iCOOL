// components/CandleChart.jsx
"use client";
// رسم شموع SVG بسيط لتوضيح مفاهيم Silver Bullet
// candles: [{o,h,l,c}], annotations: خطوط/مناطق توضيحية

export default function CandleChart({ candles, width = 560, height = 280, zones = [], lines = [], labels = [], padding = 30 }) {
  const allPrices = candles.flatMap((c) => [c.h, c.l]);
  zones.forEach((z) => { allPrices.push(z.top, z.bottom); });
  lines.forEach((l) => allPrices.push(l.y));
  const min = Math.min(...allPrices);
  const max = Math.max(...allPrices);
  const range = max - min || 1;
  const pad = range * 0.1;
  const yMin = min - pad, yMax = max + pad;

  const plotW = width - padding * 2;
  const plotH = height - padding * 2;
  const cw = plotW / candles.length;
  const bodyW = cw * 0.6;

  const x = (i) => padding + i * cw + cw / 2;
  const y = (price) => padding + ((yMax - price) / (yMax - yMin)) * plotH;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {/* خلفية */}
      <rect x="0" y="0" width={width} height={height} fill="#0d1420" rx="12" />

      {/* مناطق (FVG مثلاً) */}
      {zones.map((z, i) => (
        <g key={"z" + i}>
          <rect
            x={padding} y={y(z.top)}
            width={plotW} height={Math.abs(y(z.bottom) - y(z.top))}
            fill={z.color || "rgba(212,175,55,0.18)"}
            stroke={z.border || "rgba(212,175,55,0.5)"} strokeWidth="1" strokeDasharray="4 3" rx="3"
          />
          {z.label && (
            <text x={padding + 8} y={y(z.top) + 16} fill={z.border || "#d4af37"} fontSize="12" fontFamily="monospace" fontWeight="bold">{z.label}</text>
          )}
        </g>
      ))}

      {/* خطوط أفقية (وقف/هدف/سيولة) */}
      {lines.map((l, i) => (
        <g key={"l" + i}>
          <line x1={padding} y1={y(l.y)} x2={width - padding} y2={y(l.y)} stroke={l.color} strokeWidth="1.5" strokeDasharray={l.dash || "6 4"} />
          {l.label && (
            <text x={width - padding} y={y(l.y) - 5} fill={l.color} fontSize="11" fontFamily="monospace" textAnchor="end" fontWeight="bold">{l.label}</text>
          )}
        </g>
      ))}

      {/* الشموع */}
      {candles.map((c, i) => {
        const up = c.c >= c.o;
        const col = c.color || (up ? "#2dd4a7" : "#f4515b");
        const bodyTop = y(Math.max(c.o, c.c));
        const bodyBot = y(Math.min(c.o, c.c));
        return (
          <g key={i}>
            <line x1={x(i)} y1={y(c.h)} x2={x(i)} y2={y(c.l)} stroke={col} strokeWidth="1.5" />
            <rect x={x(i) - bodyW / 2} y={bodyTop} width={bodyW} height={Math.max(bodyBot - bodyTop, 2)} fill={col} rx="1" />
          </g>
        );
      })}

      {/* تسميات نصية حرة */}
      {labels.map((lb, i) => (
        <g key={"t" + i}>
          {lb.arrow && (
            <line x1={x(lb.atIndex)} y1={y(lb.atPrice) + (lb.below ? 24 : -24)} x2={x(lb.atIndex)} y2={y(lb.atPrice) + (lb.below ? 6 : -6)} stroke={lb.color || "#e8edf4"} strokeWidth="1.5" markerEnd="url(#arrow)" />
          )}
          <text
            x={x(lb.atIndex)} y={y(lb.atPrice) + (lb.below ? 40 : -30)}
            fill={lb.color || "#e8edf4"} fontSize="11.5" fontFamily="Tajawal, sans-serif"
            textAnchor="middle" fontWeight="bold"
          >{lb.text}</text>
        </g>
      ))}

      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#e8edf4" />
        </marker>
      </defs>
    </svg>
  );
}
