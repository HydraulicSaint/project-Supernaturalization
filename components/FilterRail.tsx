"use client";

type Props = {
  caseStatus: string;
  setCaseStatus: (value: string) => void;
  biome: string;
  setBiome: (value: string) => void;
};

export function FilterRail({ caseStatus, setCaseStatus, biome, setBiome }: Props) {
  return (
    <aside className="panel">
      <h2>Investigation Filters</h2>
      <div className="section">
        <label className="label">Case status</label>
        <select value={caseStatus} onChange={(e) => setCaseStatus(e.target.value)}>
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>
      <div className="section">
        <label className="label">Biome keyword</label>
        <input value={biome} onChange={(e) => setBiome(e.target.value)} placeholder="rainforest, alpine..." />
      </div>
      <div className="section">
        <label className="label">Authoritative overlays</label>
        <p className="value">Boundaries, hydrography, elevation contours, and trail network are expected via GIS feed connectors.</p>
      </div>
    </aside>
  );
}
