import { WFD_BOUNDARIES, type WfdClass } from "@/lib/science/wfd";
import type { TrendPoint } from "@/lib/science/trend";
import { colourForClass, PLAIN_CLASS_LABEL } from "@/lib/ui/wfd-colours";

const W = 640;
const H = 220;
const PAD = { left: 8, right: 8, top: 10, bottom: 34 };
const ORDER: WfdClass[] = ["high", "good", "moderate", "poor", "bad"];

/** Month-by-month reading drawn over the five status bands, with the uncertainty range as a bar. */
export function TrendChart({ points }: { points: TrendPoint[] }) {
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + (1 - v) * plotH;
  const step = plotW / points.length;
  const x = (i: number) => PAD.left + step * (i + 0.5);
  const monthLabel = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });

  const withData = points.map((p, i) => ({ p, i })).filter(({ p }) => p.mean !== null);
  const path = withData.map(({ p, i }, k) => `${k === 0 ? "M" : "L"}${x(i)},${y(p.mean!)}`).join("");

  const summary = points
    .map((p) =>
      p.mean === null
        ? `${monthLabel(p.month)}: no reports`
        : `${monthLabel(p.month)}: ${p.klass ? PLAIN_CLASS_LABEL[p.klass] : "too few reports to rate"} (${p.count} report${p.count === 1 ? "" : "s"})`,
    )
    .join("; ");

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Water health by month. ${summary}.`}>
        {ORDER.map((k) => {
          const b = WFD_BOUNDARIES[k];
          return (
            <rect
              key={k}
              x={PAD.left}
              width={plotW}
              y={y(b.max)}
              height={y(b.min) - y(b.max)}
              fill={colourForClass(k)}
              opacity={0.28}
            />
          );
        })}
        {path && <path d={path} fill="none" stroke="#151b1c" strokeWidth={1.5} strokeDasharray="4 3" />}
        {points.map((p, i) =>
          p.mean === null ? (
            <text key={p.month} x={x(i)} y={PAD.top + plotH / 2} textAnchor="middle" fontSize="12" fill="#3b4546">
              no reports
            </text>
          ) : (
            <g key={p.month}>
              <line x1={x(i)} x2={x(i)} y1={y(p.upper!)} y2={y(p.lower!)} stroke="#151b1c" strokeWidth={6} strokeLinecap="round" opacity={0.25} />
              <circle cx={x(i)} cy={y(p.mean)} r={7} fill={colourForClass(p.klass)} stroke="#151b1c" strokeWidth={1.5} />
            </g>
          ),
        )}
        {points.map((p, i) => (
          <text key={`l-${p.month}`} x={x(i)} y={H - 12} textAnchor="middle" fontSize="13" fill="#151b1c">
            {monthLabel(p.month)}
          </text>
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span>Higher is healthier.</span>
        <span>Dot = what that month&apos;s reports suggest; grey bar = how sure we are.</span>
      </figcaption>
    </figure>
  );
}
