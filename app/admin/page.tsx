async function load<T>(path: string): Promise<T> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}${path}`, { cache: "no-store" });
  const data = await res.json();
  return data.data;
}

export default async function AdminPage() {
  const [cases, runs, issues, decisions, enrichment, layers, conflicts, extractions] = await Promise.all([
    load<any[]>("/api/internal/cases"),
    load<any[]>("/api/internal/ingestion/runs"),
    load<any[]>("/api/internal/ingestion/issues?reviewed=unreviewed"),
    load<any[]>("/api/internal/ingestion/decisions"),
    load<any[]>("/api/internal/enrichment/snapshots"),
    load<any[]>("/api/internal/reference/layers"),
    load<any[]>("/api/internal/conflicts?reviewStatus=unreviewed"),
    load<any[]>("/api/internal/source-extractions")
  ]);

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>Ingestion Inspection Console</h1>
      <h2>Canonical Cases ({cases.length})</h2>
      <pre>{JSON.stringify(cases.slice(0, 5), null, 2)}</pre>
      <h2>Reference Layer Inventory ({layers.length})</h2>
      <pre>{JSON.stringify(layers.slice(0, 10), null, 2)}</pre>
      <h2>Stale/Current Enrichment Snapshots ({enrichment.length})</h2>
      <pre>{JSON.stringify(enrichment.slice(0, 10), null, 2)}</pre>
      <h2>Merge Decisions ({decisions.length})</h2>
      <pre>{JSON.stringify(decisions.slice(0, 10), null, 2)}</pre>
      <h2>Conflicts ({conflicts.length})</h2>
      <pre>{JSON.stringify(conflicts.slice(0, 10), null, 2)}</pre>
      <h2>Source Extraction Review ({extractions.length})</h2>
      <pre>{JSON.stringify(extractions.slice(0, 10), null, 2)}</pre>
      <h2>Ingestion Issues ({issues.length})</h2>
      <pre>{JSON.stringify(issues.slice(0, 10), null, 2)}</pre>
      <h2>Ingestion Runs ({runs.length})</h2>
      <pre>{JSON.stringify(runs.slice(0, 5), null, 2)}</pre>
    </main>
  );
}
