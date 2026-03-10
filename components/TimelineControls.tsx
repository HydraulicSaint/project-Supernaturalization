"use client";

export function TimelineControls({
  value,
  onChange,
  max,
  label
}: {
  value: number;
  onChange: (value: number) => void;
  max: number;
  label: string;
}) {
  return (
    <div className="timeline">
      <div className="label">Timeline Controls</div>
      <div className="value">{label}</div>
      <input type="range" min={0} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
