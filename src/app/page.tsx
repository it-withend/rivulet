/**
 * Placeholder home. Task 14 builds the real landing page; the contour field
 * below is the landing hero's texture and is used nowhere else.
 */

function contourPaths(): string[] {
  const paths: string[] = [];
  const cx = 820;
  const cy = 250;
  for (let ring = 1; ring <= 14; ring++) {
    const r = ring * 46;
    const points: string[] = [];
    for (let step = 0; step <= 72; step++) {
      const t = (step / 72) * Math.PI * 2;
      const wobble =
        1 +
        0.09 * Math.sin(3 * t + ring * 0.35) +
        0.05 * Math.cos(5 * t - ring * 0.2) +
        0.03 * Math.sin(8 * t + ring);
      const x = cx + Math.cos(t) * r * 1.35 * wobble;
      const y = cy + Math.sin(t) * r * 0.8 * wobble;
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    paths.push(`M${points.join("L")}Z`);
  }
  return paths;
}

export default function Home() {
  return (
    <section className="relative isolate overflow-hidden border-b border-rule">
      <svg
        aria-hidden="true"
        className="absolute inset-0 -z-10 h-full w-full"
        viewBox="0 0 1000 500"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        {contourPaths().map((d, i) => (
          <path
            key={d}
            d={d}
            stroke="var(--color-rule-strong)"
            strokeOpacity={i % 5 === 4 ? 0.55 : 0.3}
            strokeWidth={i % 5 === 4 ? 1.2 : 0.8}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="mx-auto max-w-5xl px-4 pb-24 pt-20 sm:px-6 sm:pb-36 sm:pt-32">
        <h1 className="m-0 font-display text-[4.5rem] font-medium italic leading-[0.9] sm:text-[8rem]">
          Rivulet
        </h1>
        <p className="mt-6 max-w-md text-xl text-ink">
          Urban streams, read honestly.
        </p>
      </div>
    </section>
  );
}
