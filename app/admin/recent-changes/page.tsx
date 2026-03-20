import React from "react";
import { AdminShell, Breadcrumbs, DetailPanel, PreviewList, SectionHeader } from "@/components/admin/ui";
import { listIngestionRuns, listMergeDecisions, listSourceExtractionReview } from "@/lib/repositories/ingestionRunsRepository";
import { listOperatorActions } from "@/lib/operatorAudit";

export default async function AdminRecentChangesPage() {
  const [decisions, extractions, actions, runs] = await Promise.all([
    listMergeDecisions(undefined, { limit: 20, offset: 0 }),
    listSourceExtractionReview({ confidenceMax: 0.75, limit: 20, offset: 0 }),
    listOperatorActions({ limit: 20, offset: 0 }),
    listIngestionRuns()
  ]);

  return (
    <AdminShell title="Inspect Recent Changes" description="Review the newest decisions, low-confidence extracts, operator actions, and ingestion runs together.">
      <Breadcrumbs items={[{ label: "Evidence Board", href: "/admin" }, { label: "Inspect Recent Changes" }]} />
      <SectionHeader title="Recent activity widgets" description="Use these compact feeds to understand what changed before reopening a queue or a case." />
      <div className="panel-stack">
        <DetailPanel title="Recent reconciliation decisions" summary={`${decisions.data.length} items`}>
          <PreviewList items={decisions.data.slice(0, 5).map((decision: any) => ({
            id: decision.id,
            title: decision.decision_type ?? "Decision",
            subtitle: decision.case_id ? `Case ${decision.case_id}` : undefined,
            meta: decision.created_at,
            href: decision.case_id ? `/admin/cases/${decision.case_id}#reconciliation-decisions` : undefined,
            why: decision.rule_triggered ? `Triggered by ${decision.rule_triggered}.` : "Decision trail preserved for audit inspection."
          }))} />
        </DetailPanel>
        <DetailPanel title="Low-confidence extractions" summary={`${extractions.data.length} items`}>
          <div id="low-confidence-extractions">
            <PreviewList items={extractions.data.slice(0, 5).map((item: any) => ({
              id: item.id,
              title: item.source_record_key ?? item.id,
              subtitle: item.source_uri,
              meta: `Confidence ${Number(item.parse_confidence ?? 0).toFixed(2)}`,
              why: "Why this needs review: extraction confidence is below the caution threshold."
            }))} />
          </div>
        </DetailPanel>
        <DetailPanel title="Operator actions" summary={`${actions.data.length} items`}>
          <div id="operator-actions">
            <PreviewList items={actions.data.slice(0, 5).map((action: any) => ({
              id: action.id,
              title: action.action_type ?? "Operator action",
              subtitle: action.actor_id,
              meta: action.created_at,
              why: action.notes ?? "Actor identity and target entity remain visible in audit history."
            }))} />
          </div>
        </DetailPanel>
        <DetailPanel title="Ingestion and re-enrichment runs" summary={`${runs.length} items`}>
          <div id="ingestion-runs">
            <PreviewList items={runs.slice(0, 5).map((run: any) => ({
              id: run.id,
              title: run.job_type ?? "Run",
              subtitle: run.status,
              meta: run.finished_at ?? run.started_at,
              why: run.summary ? JSON.stringify(run.summary) : "Run summary available in ingestion history."
            }))} />
          </div>
        </DetailPanel>
      </div>
    </AdminShell>
  );
}
