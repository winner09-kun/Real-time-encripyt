import "./MetricRow.css";

type Tone = "neutral" | "ok" | "warn" | "err";

export default function MetricRow({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: Tone;
}) {
  return (
    <div className="metric-row">
      <span className="metric-row-label">{label}</span>
      <span className={"metric-row-value mono metric-row-value--" + tone}>{value}</span>
    </div>
  );
}
