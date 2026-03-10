import { SourceRecord } from "@/lib/types";

export function ProvenancePanel({ sources }: { sources: SourceRecord[] }) {
  return (
    <div className="drawer">
      <h3>Provenance / Sources</h3>
      {sources.map((source) => (
        <div key={source.id} className="section">
          <div className="label">{source.id}</div>
          <div className="value">{source.citation}</div>
          <div className="label">
            {source.system} • trust {Math.round(source.trustScore * 100)}%
          </div>
        </div>
      ))}
    </div>
  );
}
