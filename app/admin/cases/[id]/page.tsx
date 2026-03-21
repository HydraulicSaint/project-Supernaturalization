import React from "react";
import { notFound } from "next/navigation";
import { AdminShell, Badge, Breadcrumbs, DetailPanel, KeyValueTable, MetaList, SectionHeader } from "@/components/admin/ui";
import { getCaseEvidenceViewModel, getConfidenceTone, getSeverityTone } from "@/lib/admin/viewModels";

function JsonBlock({ value }: { value: unknown }) {
  return <pre className="json-block">{JSON.stringify(value, null, 2)}</pre>;
}

export default async function AdminCaseDetailPage({ params }: { params: { id: string } }) {
  const model = await getCaseEvidenceViewModel(params.id);
  if (!model) notFound();

  const canonicalCase: any = model.case;
  const confidence = canonicalCase.sourceConfidence ?? canonicalCase.source_confidence ?? null;
  const displayName = canonicalCase.displayName ?? canonicalCase.display_name ?? canonicalCase.canonical_case_ref ?? canonicalCase.id;

  return (
    <AdminShell title={displayName} description="Evidence-chain drilldown organized for review, provenance inspection, and queue follow-through.">
      <Breadcrumbs items={[{ label: "Evidence Board", href: "/admin" }, { label: "Browse Cases", href: "/admin/cases" }, { label: displayName }]} />
      <div className="case-header-card">
        <div>
          <p className="admin-eyebrow">Case summary</p>
          <h2>{displayName}</h2>
          <p className="admin-page-description">{canonicalCase.narrativeSummary ?? canonicalCase.narrative_summary ?? "Narrative summary unavailable."}</p>
        </div>
        <div className="badge-cluster">
          <Badge tone={getConfidenceTone(confidence)}>{confidence !== null ? Number(confidence).toFixed(2) : "—"} confidence</Badge>
          <Badge tone="neutral">{canonicalCase.caseStatus ?? canonicalCase.case_status ?? "unknown"}</Badge>
          <Badge tone={model.summary.conflictCount ? "warning" : "success"}>{model.summary.conflictCount} conflicts</Badge>
          <Badge tone={model.summary.issueCount ? "danger" : "success"}>{model.summary.issueCount} issues</Badge>
        </div>
      </div>

      <div className="case-anchor-nav">
        <a href="#active-review">Active review</a>
        <a href="#source-records">Evidence sources</a>
        <a href="#reconciliation-decisions">Reconciliation</a>
        <a href="#location-events">Location events</a>
        <a href="#enrichment-snapshots">Enrichment snapshots</a>
        <a href="#operator-history">Operator history</a>
      </div>

      <SectionHeader title="Case overview" description="Compact counts orient the operator before drilling into individual evidence objects." />
      <MetaList
        items={[
          { label: "Canonical reference", value: canonicalCase.canonicalCaseRef ?? canonicalCase.canonical_case_ref ?? canonicalCase.id },
          { label: "Missing from", value: canonicalCase.missingFrom ?? canonicalCase.missing_from ?? "—" },
          { label: "Jurisdiction", value: JSON.stringify(canonicalCase.jurisdiction ?? {}) },
          { label: "Primary agency", value: canonicalCase.agency?.primary ?? canonicalCase.agency?.primary_agency ?? "—" },
          {
            label: "Counts",
            value: `${model.summary.sourceCount} sources · ${model.summary.locationCount} locations · ${model.summary.enrichmentCount} enrichment snapshots · ${model.summary.decisionCount} decisions`
          }
        ]}
      />

      <SectionHeader anchor="active-review" title="Active issues and conflicts" description="Start here when the case already appears in a review queue." />
      <div className="panel-grid single-column">
        <DetailPanel title="Issues" summary={`${model.summary.issueCount} open`}>
          {model.issues.length ? model.issues.map((issue: any) => (
            <div className="evidence-card" key={issue.id}>
              <div className="evidence-card-header">
                <strong>{issue.issue_type ?? "Issue"}</strong>
                <Badge tone={getSeverityTone(issue.severity)}>{issue.severity ?? "info"}</Badge>
              </div>
              <p>{issue.details ?? issue.message ?? "Issue details unavailable."}</p>
              <MetaList
                items={[
                  { label: "Review state", value: issue.review_status ?? "unreviewed" },
                  { label: "Created", value: issue.created_at ?? issue.createdAt ?? "—" },
                  { label: "Source record", value: issue.source_record_id ?? "—" }
                ]}
              />
            </div>
          )) : <p className="supporting-copy">No case-scoped issues are currently open.</p>}
        </DetailPanel>
        <DetailPanel title="Conflicts" summary={`${model.summary.conflictCount} open`}>
          {model.conflicts.length ? model.conflicts.map((conflict: any) => (
            <div className="evidence-card" key={conflict.id}>
              <div className="evidence-card-header">
                <strong>{conflict.conflict_type ?? "Conflict"}</strong>
                <Badge tone={getSeverityTone(conflict.severity)}>{conflict.severity ?? "medium"}</Badge>
              </div>
              <KeyValueTable
                rows={[
                  { key: "Review state", value: conflict.review_status ?? "unreviewed" },
                  { key: "Direct values", value: <JsonBlock value={conflict.competing_values ?? { previous: conflict.previous_value, next: conflict.next_value }} /> },
                  {
                    key: "Normalized values",
                    value: <JsonBlock value={conflict.normalized_competing_values ?? { previous: conflict.normalized_previous_value, next: conflict.normalized_next_value }} />
                  }
                ]}
              />
            </div>
          )) : <p className="supporting-copy">No conflicts are currently linked to this case.</p>}
        </DetailPanel>
      </div>

      <SectionHeader anchor="source-records" title="Source records and evidence sources" description="Direct source payloads stay accessible for provenance inspection, but are wrapped in structured context first." />
      <DetailPanel title="Evidence sources" summary={`${model.summary.sourceCount} linked`}>
        {model.links.map((link: any) => (
          <div className="evidence-card" key={link.id}>
            <div className="evidence-card-header">
              <strong>{link.source_system ?? "source"}</strong>
              <Badge tone="neutral">{link.source_channel ?? "channel"}</Badge>
            </div>
            <MetaList
              items={[
                { label: "Source record", value: link.source_record_id ?? "—" },
                { label: "Case link", value: link.case_id ?? canonicalCase.id },
                { label: "Payload preview", value: `${JSON.stringify(link.parsed_payload ?? {}).slice(0, 180)}…` }
              ]}
            />
            <DetailPanel title="Raw payload" defaultOpen={false}>
              <JsonBlock value={link.parsed_payload ?? {}} />
            </DetailPanel>
          </div>
        ))}
      </DetailPanel>

      <SectionHeader anchor="reconciliation-decisions" title="Reconciliation decisions" description="System decisions remain visible as an audit trail instead of being folded into the canonical view." />
      <DetailPanel title="Decision log" summary={`${model.summary.decisionCount} decisions`}>
        {model.decisions.length ? model.decisions.map((decision: any) => (
          <div className="evidence-card" key={decision.id}>
            <div className="evidence-card-header">
              <strong>{decision.decision_type ?? "Decision"}</strong>
              <Badge tone={getConfidenceTone(decision.confidence)}>
                {decision.confidence !== undefined && decision.confidence !== null ? Number(decision.confidence).toFixed(2) : "—"}
              </Badge>
            </div>
            <KeyValueTable
              rows={[
                { key: "Rule triggered", value: decision.rule_triggered ?? "—" },
                { key: "Actor", value: decision.actor_display_name ?? decision.actor_id ?? "system" },
                { key: "Inputs considered", value: <JsonBlock value={decision.inputs_considered ?? {}} /> },
                { key: "Value change", value: <JsonBlock value={{ previous: decision.previous_value, next: decision.new_value }} /> }
              ]}
            />
          </div>
        )) : <p className="supporting-copy">No reconciliation decisions are recorded for this case yet.</p>}
      </DetailPanel>

      <SectionHeader anchor="location-events" title="Location events" description="Location evidence is ordered as a chain with confidence, method, and provenance preserved." />
      <DetailPanel title="Location event chain" summary={`${model.summary.locationCount} events`}>
        {model.locations.map((location: any) => (
          <div className="evidence-card" key={location.id}>
            <div className="evidence-card-header">
              <strong>{location.event_type ?? location.eventType ?? "location event"}</strong>
              <Badge tone={getConfidenceTone(location.confidence_score)}>{location.confidence_score !== undefined && location.confidence_score !== null ? Number(location.confidence_score).toFixed(2) : "—"}</Badge>
            </div>
            <KeyValueTable
              rows={[
                { key: "Reported text", value: location.reported_location_text ?? location.reportedLocationText ?? "—" },
                { key: "Geometry", value: location.geometry_wkt ?? location.geometryWkt ?? "—" },
                { key: "Method", value: location.geom_method ?? location.geomMethod ?? "—" },
                { key: "Precision", value: location.precision_meters ?? location.precisionMeters ?? "—" },
                { key: "Provenance", value: <JsonBlock value={location.provenance ?? {}} /> }
              ]}
            />
          </div>
        ))}
      </DetailPanel>

      <SectionHeader anchor="enrichment-snapshots" title="Environment and enrichment snapshots" description="Layer-version provenance remains visible directly beside each enrichment output." />
      <DetailPanel title="Enrichment snapshots" summary={`${model.summary.enrichmentCount} snapshots`}>
        {model.environment.map((snapshot: any) => (
          <div className="evidence-card" key={snapshot.id}>
            <div className="evidence-card-header">
              <strong>{snapshot.source ?? "enrichment snapshot"}</strong>
              <Badge tone={snapshot.stale_reference_data ? "warning" : "success"}>{snapshot.stale_reference_data ? "stale" : "current"}</Badge>
            </div>
            <KeyValueTable
              rows={[
                { key: "Captured", value: snapshot.captured_at ?? "—" },
                { key: "Layer versions", value: <JsonBlock value={snapshot.reference_layer_snapshot ?? {}} /> },
                { key: "Administrative membership", value: <JsonBlock value={snapshot.admin_membership ?? {}} /> },
                { key: "Park membership", value: <JsonBlock value={snapshot.park_membership ?? {}} /> },
                { key: "Provenance", value: <JsonBlock value={snapshot.provenance ?? {}} /> }
              ]}
            />
          </div>
        ))}
      </DetailPanel>

      <SectionHeader anchor="operator-history" title="Operator actions and history" description="Actor identity stays visible for internal review actions and follow-up audit inspection." />
      <DetailPanel title="Operator audit trail" summary={`${model.summary.actionCount} actions`}>
        {model.actions.length ? model.actions.map((action: any) => (
          <div className="evidence-card" key={action.id}>
            <div className="evidence-card-header">
              <strong>{action.action_type ?? "Operator action"}</strong>
              <Badge tone="neutral">{action.actor_display_name ?? action.actor_id ?? "internal-operator"}</Badge>
            </div>
            <KeyValueTable
              rows={[
                { key: "Target", value: `${action.target_entity_type ?? "entity"} · ${action.target_entity_id ?? "—"}` },
                { key: "When", value: action.created_at ?? "—" },
                { key: "Notes", value: action.notes ?? "—" }
              ]}
            />
          </div>
        )) : <p className="supporting-copy">No operator actions are directly attached to this case yet.</p>}
      </DetailPanel>
    </AdminShell>
  );
}
