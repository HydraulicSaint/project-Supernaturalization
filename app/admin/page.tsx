async function load<T>(path: string): Promise<T> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}${path}`, { cache: "no-store" });
  const data = await res.json();
  return data.data;
}

export default async function AdminPage() {
  const [cases, runs, issues, decisions, enrichment] = await Promise.all([
    load<any[]>("/api/internal/cases"),
    load<any[]>("/api/internal/ingestion/runs"),
    load<any[]>("/api/internal/ingestion/issues"),
    load<any[]>("/api/internal/ingestion/decisions"),
    load<any[]>("/api/internal/enrichment/snapshots")
  ]);

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>Ingestion Inspection Console</h1>
      <h2>Canonical Cases ({cases.length})</h2>
      <pre>{JSON.stringify(cases.slice(0, 5), null, 2)}</pre>
      <h2>Ingestion Runs ({runs.length})</h2>
      <pre>{JSON.stringify(runs.slice(0, 5), null, 2)}</pre>
      <h2>Issues ({issues.length})</h2>
      <pre>{JSON.stringify(issues.slice(0, 10), null, 2)}</pre>
      <h2>Merge Decisions ({decisions.length})</h2>
      <pre>{JSON.stringify(decisions.slice(0, 10), null, 2)}</pre>
      <h2>Spatial Enrichment Snapshots ({enrichment.length})</h2>
      <pre>{JSON.stringify(enrichment.slice(0, 10), null, 2)}</pre>
    </main>
  );
}
