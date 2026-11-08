/**
 * Tiny weekly bar chart (one series, one hue). Each bar has a native tooltip
 * with the week and the value; bars are anchored to the baseline.
 */
export function SparkBars({ values, height = 28, unit = "hiba" }: { values: { label: string; value: number }[]; height?: number; unit?: string }) {
  const max = Math.max(1, ...values.map((v) => v.value));
  const w = 10;
  const gap = 2;
  return (
    <svg width={values.length * (w + gap)} height={height} role="img" aria-label={values.map((v) => `${v.label}: ${v.value}`).join(", ")}>
      <line x1={0} x2={values.length * (w + gap)} y1={height - 0.5} y2={height - 0.5} stroke="var(--chart-grid)" />
      {values.map((v, i) => {
        const h = v.value === 0 ? 0 : Math.max(2, (v.value / max) * (height - 2));
        return (
          <g key={v.label}>
            <title>{`${v.label} hete: ${v.value} ${unit}`}</title>
            <rect x={i * (w + gap)} y={0} width={w} height={height} fill="transparent" />
            {h > 0 && <rect x={i * (w + gap)} y={height - h} width={w} height={h} rx={2} fill="var(--series-1)" />}
          </g>
        );
      })}
    </svg>
  );
}
