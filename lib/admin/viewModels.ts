import { getCanonicalCase, listCanonicalCases } from "@/lib/repositories/canonicalCasesRepository";
import {
  listConflicts,
  listIngestionIssues,
  listIngestionRuns,
  listMergeDecisions,
  listReferenceLayerInventory,
  listSourceExtractionReview,
  listSpatialEnrichmentSnapshots
} from "@/lib/repositories/ingestionRunsRepository";
import { listOperatorActions } from "@/lib/operatorAudit";
import { getCurrentReferenceLayerSnapshot } from "@/lib/ingestion/enrichment/referenceLayers";

const labelize = (value: string) => value.replace(/[_-]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

export function getSeverityTone(value?: string | null) {
  if (!value) return "neutral";
  const normalized = value.toLowerCase();
  if (["critical", "error", "high"].includes(normalized)) return "danger";
  if (["warning", "medium"].includes(normalized)) return "warning";
  if (["low", "info", "resolved", "reviewed"].includes(normalized)) return "success";
  return "neutral";
}

export function getConfidenceTone(value?: number | null) {
  if (value === null || value === undefined) return "neutral";
  if (value < 0.5) return "danger";
  if (value < 0.8) return "warning";
  return "success";
}

export async function getAdminBoardViewModel() {
  const [issues, conflicts, stale, lowConfidence, decisions, actions, runs] = await Promise.all([
    listIngestionIssues({ reviewed: "unreviewed", sort: "severity", limit: 50, offset: 0 }),
    listConflicts({ reviewStatus: "unreviewed", sort: "severity", limit: 50, offset: 0 }),
    listSpatialEnrichmentSnapshots({ stale: "true", limit: 50, offset: 0 }),
    listSourceExtractionReview({ confidenceMax: 0.75, limit: 50, offset: 0 }),
    listMergeDecisions(undefined, { limit: 20, offset: 0 }),
    listOperatorActions({ limit: 20, offset: 0 }),
    listIngestionRuns()
  ]);

  const latestRun = runs[0] ?? null;
  const latestDecision = decisions.data[0] ?? null;
  const latestAction = actions.data[0] ?? null;

  return {
    stats: [
      {
        label: "Unreviewed Issues",
        value: issues.data.length,
        href: "/admin/issues",
        hint: issues.data.length ? "Parser misses, ingest gaps, and source QA blockers." : "No current ingestion issues.",
        tone: issues.data.length ? "danger" : "success"
      },
      {
        label: "Unreviewed Conflicts",
        value: conflicts.data.length,
        href: "/admin/conflicts",
        hint: conflicts.data.length ? "Competing source claims still need operator judgment." : "No unresolved contradictions.",
        tone: conflicts.data.length ? "warning" : "success"
      },
      {
        label: "Stale Enrichment",
        value: stale.data.length,
        href: "/admin/stale-enrichment",
        hint: stale.data.length ? "Reference-layer versions have moved ahead of stored snapshots." : "Reference-layer snapshots are current.",
        tone: stale.data.length ? "warning" : "success"
      },
      {
        label: "Low-confidence Extractions",
        value: lowConfidence.data.length,
        href: "/admin/recent-changes#low-confidence-extractions",
        hint: lowConfidence.data.length ? "Recent HTML/PDF extractions likely need evidence inspection." : "Recent document extractions are above the caution threshold.",
        tone: lowConfidence.data.length ? "danger" : "success"
      },
      {
        label: "Recent Operator Actions",
        value: actions.data.length,
        href: "/admin/recent-changes#operator-actions",
        hint: latestAction ? `${labelize(latestAction.action_type)} by ${latestAction.actor_id}.` : "No recent audit activity.",
        tone: "neutral"
      },
      {
        label: "Latest Ingestion Activity",
        value: latestRun ? labelize(latestRun.status ?? "run") : "No runs",
        href: "/admin/recent-changes#ingestion-runs",
        hint: latestRun ? `${labelize(latestRun.job_type ?? "ingestion_run")} finished ${latestRun.finished_at ?? latestRun.started_at}.` : "No ingestion runs recorded yet.",
        tone: latestRun?.status === "failed" ? "danger" : "neutral"
      }
    ],
    panels: [
      {
        title: "Review Issues",
        href: "/admin/issues",
        count: issues.data.length,
        tone: issues.data.length ? "danger" : "success",
        updatedAt: issues.data[0]?.created_at ?? issues.data[0]?.createdAt ?? null,
        description: "Work the parser and ingestion exceptions that block clean evidence intake.",
        preview: issues.data.slice(0, 3).map((issue: any) => ({
          id: issue.id,
          title: labelize(issue.issue_type ?? "ingestion issue"),
          subtitle: issue.source_record_id ? `Source ${issue.source_record_id}` : "Source linkage unavailable",
          meta: `${labelize(issue.severity ?? "info")} · ${issue.review_status ?? "unreviewed"}`,
          href: issue.source_record_id ? `/admin/cases/${issue.source_record_id}` : "/admin/issues",
          why: issue.details ?? issue.message ?? "Operator review keeps ingest provenance explicit before reconciliation."
        }))
      },
      {
        title: "Review Conflicts",
        href: "/admin/conflicts",
        count: conflicts.data.length,
        tone: conflicts.data.length ? "warning" : "success",
        updatedAt: conflicts.data[0]?.created_at ?? null,
        description: "Inspect contradictory normalized and direct values before case conclusions drift.",
        preview: conflicts.data.slice(0, 3).map((conflict: any) => ({
          id: conflict.id,
          title: labelize(conflict.conflict_type ?? "conflict"),
          subtitle: conflict.case_id ? `Case ${conflict.case_id}` : "Case unavailable",
          meta: `${labelize(conflict.severity ?? "medium")} · ${conflict.review_status ?? "unreviewed"}`,
          href: conflict.case_id ? `/admin/cases/${conflict.case_id}` : "/admin/conflicts",
          why: conflict.competing_values ? "Conflicting values preserved for side-by-side inspection." : "Conflicting evidence requires operator judgment."
        }))
      },
      {
        title: "Refresh Stale Enrichment",
        href: "/admin/stale-enrichment",
        count: stale.data.length,
        tone: stale.data.length ? "warning" : "success",
        updatedAt: stale.data[0]?.captured_at ?? null,
        description: "Re-run environment snapshots where layer versions have changed underneath the evidence chain.",
        preview: stale.data.slice(0, 3).map((snapshot: any) => ({
          id: snapshot.id,
          title: snapshot.case_id ? `Case ${snapshot.case_id}` : "Environment snapshot",
          subtitle: snapshot.location_event_id ? `Location event ${snapshot.location_event_id}` : "Case-level enrichment snapshot",
          meta: `Captured ${snapshot.captured_at ?? "unknown"}`,
          href: snapshot.case_id ? `/admin/cases/${snapshot.case_id}#enrichment-snapshots` : "/admin/stale-enrichment",
          why: snapshot.reference_layer_snapshot ? "Stored layer snapshot differs from latest reference inventory." : "Layer-version provenance should be refreshed."
        }))
      },
      {
        title: "Inspect Recent Changes",
        href: "/admin/recent-changes",
        count: decisions.data.length,
        tone: latestDecision ? "neutral" : "success",
        updatedAt: latestDecision?.created_at ?? latestAction?.created_at ?? latestRun?.finished_at ?? null,
        description: "See the newest reconciliation decisions, operator actions, and extracts that changed the evidence picture.",
        preview: [
          ...lowConfidence.data.slice(0, 1).map((item: any) => ({
            id: item.id,
            title: `Low-confidence ${item.source_channel ?? "document"} extraction`,
            subtitle: item.source_record_key ?? item.id,
            meta: `Confidence ${Number(item.parse_confidence ?? 0).toFixed(2)}`,
            href: "/admin/recent-changes#low-confidence-extractions",
            why: "Why this needs review: extraction confidence fell below the operator threshold."
          })),
          ...actions.data.slice(0, 1).map((action: any) => ({
            id: action.id,
            title: labelize(action.action_type ?? "operator action"),
            subtitle: action.actor_id ?? "internal-operator",
            meta: action.created_at ?? "",
            href: "/admin/recent-changes#operator-actions",
            why: action.notes ?? "Recent operator action preserved in audit history."
          })),
          ...runs.slice(0, 1).map((run: any) => ({
            id: run.id,
            title: labelize(run.job_type ?? "ingestion run"),
            subtitle: run.status ?? "unknown",
            meta: run.finished_at ?? run.started_at ?? "",
            href: "/admin/recent-changes#ingestion-runs",
            why: "Latest ingestion/re-enrichment activity for operational situational awareness."
          }))
        ]
      }
    ]
  };
}

export async function getCaseEvidenceViewModel(caseId: string) {
  const data = await getCanonicalCase(caseId);
  if (!data) return null;

  const [conflicts, decisions, issues, actions] = await Promise.all([
    listConflicts({ caseId, limit: 50, offset: 0 }),
    listMergeDecisions(caseId, { limit: 50, offset: 0 }),
    listIngestionIssues({ limit: 50, offset: 0 }),
    listOperatorActions({ limit: 50, offset: 0 })
  ]);

  const scopedIssues = issues.data.filter((issue: any) => issue.case_id === caseId || issue.source_record_id === caseId);
  const scopedActions = actions.data.filter((action: any) => action.target_entity_id === caseId || action.context?.caseId === caseId);

  return {
    ...data,
    summary: {
      issueCount: scopedIssues.length,
      conflictCount: conflicts.data.length,
      decisionCount: decisions.data.length,
      sourceCount: data.links.length,
      locationCount: data.locations.length,
      enrichmentCount: data.environment.length,
      actionCount: scopedActions.length
    },
    issues: scopedIssues,
    conflicts: conflicts.data,
    decisions: decisions.data,
    actions: scopedActions
  };
}

export async function getReferenceLayerInventoryViewModel() {
  const [inventory, snapshot] = await Promise.all([listReferenceLayerInventory(), getCurrentReferenceLayerSnapshot()]);
  const fallbackInventory = Object.entries(snapshot).map(([layerType, effectiveVersion]) => ({
    id: `${layerType}-${effectiveVersion}`,
    layer_type: layerType,
    effective_version: effectiveVersion,
    imported_at: null,
    source_name: "demo reference inventory"
  }));

  return {
    snapshot,
    inventory: inventory.length ? inventory : fallbackInventory
  };
}
