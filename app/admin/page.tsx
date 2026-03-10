async function load<T>(path: string): Promise<T> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}${path}`, { cache: "no-store" });
  return res.json();
}

export default async function AdminPage() {
  const [issues, conflicts, stale, lowConfidence, decisions] = await Promise.all([
    load<any>("/api/internal/ingestion/issues?reviewed=unreviewed&sort=severity&limit=20"),
    load<any>("/api/internal/conflicts?reviewStatus=unreviewed&sort=severity&limit=20"),
    load<any>("/api/internal/enrichment/snapshots?stale=true&limit=20"),
    load<any>("/api/internal/source-extractions?confidenceMax=0.75&limit=20"),
    load<any>("/api/internal/ingestion/decisions?limit=20")
  ]);

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>Operator Review Queues</h1>

      <h2>Unreviewed Issues</h2>
      <ul>{issues.data.map((i: any) => <li key={i.id}><a href={`/api/internal/cases/${i.source_record_id || ""}`}>{i.issue_type}</a> · {i.severity} · {i.created_at}</li>)}</ul>

      <h2>Unreviewed Conflicts</h2>
      <ul>{conflicts.data.map((c: any) => <li key={c.id}><a href={`/api/internal/cases/${c.case_id}`}>{c.conflict_type}</a> · {c.severity} · {c.created_at}</li>)}</ul>

      <h2>Stale Enrichment</h2>
      <ul>{stale.data.map((s: any) => <li key={s.id}><a href={`/api/internal/cases/${s.case_id}`}>{s.case_id}</a> · {s.captured_at}</li>)}</ul>

      <h2>Recent Low-confidence Extractions</h2>
      <ul>{lowConfidence.data.map((e: any) => <li key={e.id}>{e.source_channel} · {e.parse_confidence} · <a href={e.source_uri}>{e.source_record_key}</a></li>)}</ul>

      <h2>Recent Reconciliation Decisions</h2>
      <ul>{decisions.data.map((d: any) => <li key={d.id}><a href={`/api/internal/cases/${d.case_id}`}>{d.decision_type}</a> · {d.rule_triggered}</li>)}</ul>
    </main>
  );
}
