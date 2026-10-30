type Series = { label: string; color: string; values: number[] };

export default function AnalysisChart({ title, description, labels, series, maximum, unit }: {
  title: string; description: string; labels: string[]; series: Series[]; maximum: number; unit: string;
}) {
  const left = 64, top = 24, width = 620, height = 190;
  const x = (index: number) => left + (labels.length === 1 ? width / 2 : index * width / (labels.length - 1));
  const y = (value: number) => top + height * (1 - value / maximum);
  return <figure className="analysis-chart">
    <figcaption><h3>{title}</h3><p>{description}</p></figcaption>
    <div className="analysis-legend">{series.map((s, i) => <span key={s.label}><i style={{ borderColor: s.color, borderTopStyle: i ? "dashed" : "solid" }} />{s.label}</span>)}</div>
    <svg viewBox="0 0 720 265" role="img" aria-label={`${title}. Sumbu horizontal: urutan frame valid. Sumbu vertikal: ${unit}. Nilai lengkap tersedia pada tabel hasil.`}>
      {[0, 0.25, 0.5, 0.75, 1].map(f => <g key={f}>
        <line x1={left} x2={left + width} y1={y(f * maximum)} y2={y(f * maximum)} stroke="var(--line)" />
        <text x={left - 10} y={y(f * maximum) + 4} textAnchor="end">{(f * maximum).toLocaleString("id-ID", { maximumFractionDigits: 1 })}</text>
      </g>)}
      {labels.map((label, index) => (index === 0 || index === labels.length - 1 || index % Math.max(1, Math.ceil(labels.length / 6)) === 0) && <text key={label} x={x(index)} y={238} textAnchor="middle">{index + 1}</text>)}
      <text x={left + width / 2} y={260} textAnchor="middle">Urutan frame valid</text>
      {series.map((s, seriesIndex) => <g key={s.label}>
        <polyline points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke={s.color} strokeWidth="2" strokeDasharray={seriesIndex ? "6 4" : undefined} />
        {s.values.map((v, i) => <circle key={labels[i]} cx={x(i)} cy={y(v)} r="3" fill={s.color}><title>{labels[i]} · {s.label}: {v.toFixed(3)} {unit}</title></circle>)}
      </g>)}
    </svg>
  </figure>;
}
