import type { ReactNode } from "react";

async function loadCase(id: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/internal/cases/${id}`, { cache: "no-store" });
  return res.json();
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section style={{ border: "1px solid #ddd", padding: 12, marginTop: 12 }}><h2>{title}</h2>{children}</section>;
}

export default async function CaseDetailPage({ params }: { params: { id: string } }) {
  const payload = await loadCase(params.id);
  if (!payload?.data) {
    return <main style={{ padding: 24 }}><h1>Case not found</h1></main>;
  }

  const data = payload.data;

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>Evidence Drilldown: {data.case.canonical_case_ref}</h1>
      <p>{data.case.display_name}</p>
      <p>
        Summary · Sources: {data.relationshipSummary.sourceRecords} · Conflicts: {data.relationshipSummary.conflicts} · Decisions: {data.relationshipSummary.decisions} ·
        Location events: {data.relationshipSummary.locationEvents} · Snapshots: {data.relationshipSummary.environmentSnapshots}
      </p>

      <Section title="Source records">
        <ul>{data.links.map((link: any) => <li key={link.id}>{link.source_system}/{link.source_channel} · {link.source_record_key} · {link.source_uri || "n/a"}</li>)}</ul>
      </Section>

      <Section title="Conflicts">
        <ul>{data.conflicts.map((conflict: any) => <li key={conflict.id}>{conflict.conflict_type} · {conflict.severity} · {conflict.review_status}</li>)}</ul>
      </Section>

      <Section title="Reconciliation decisions">
        <ul>{data.reconciliationDecisions.map((decision: any) => <li key={decision.id}>{decision.decision_type} · {decision.rule_triggered} · {decision.created_at}</li>)}</ul>
      </Section>

      <Section title="Location events">
        <ul>{data.locations.map((location: any) => <li key={location.id}>{location.event_type} · {location.location_confidence} · {location.geometry_wkt || "no-geometry"}</li>)}</ul>
      </Section>

      <Section title="Environment snapshots">
        <ul>{data.environment.map((snap: any) => <li key={snap.id}>{snap.source} · stale={String(snap.stale_reference_data)} · captured={snap.captured_at}</li>)}</ul>
      </Section>

      <Section title="Ingestion issues">
        <ul>{data.ingestionIssues.map((issue: any) => <li key={issue.id}>{issue.issue_type} · {issue.severity} · {issue.review_status}</li>)}</ul>
      </Section>

      <Section title="Operator actions">
        <ul>{data.operatorActions.map((action: any) => <li key={action.id}>{action.action_type} · {action.actor_display_name || action.actor_id} · {action.created_at}</li>)}</ul>
      </Section>
    </main>
  );
}
