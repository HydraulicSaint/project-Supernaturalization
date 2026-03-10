import { CaseRecord } from "@/lib/types";

export function CaseDetailDrawer({ selectedCase }: { selectedCase: CaseRecord }) {
  const fields = [
    ["Subject", selectedCase.subjectName],
    ["Status", selectedCase.status],
    ["Risk profile", selectedCase.riskProfile],
    ["Biome", selectedCase.primaryBiome],
    ["Park unit", selectedCase.parkUnit],
    ["Narrative", selectedCase.narrative]
  ] as const;

  return (
    <div className="drawer">
      <h3>Case Detail</h3>
      {fields.map(([label, field]) => (
        <div className="section" key={label}>
          <div className="label">{label}</div>
          <div className="value">
            {field.value} <span className="badge">{field.confidence}</span>
          </div>
          <div className="label">Source: {field.sourceRecordId}</div>
        </div>
      ))}
    </div>
  );
}
