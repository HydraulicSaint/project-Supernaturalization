import React from "react";
import { AdminShell, Breadcrumbs, SectionHeader } from "@/components/admin/ui";
import { QueueTable } from "@/components/admin/QueueTable";
import { listConflicts } from "@/lib/repositories/ingestionRunsRepository";

export default async function AdminConflictsPage() {
  const conflicts = await listConflicts({ reviewStatus: "unreviewed", sort: "severity", limit: 50, offset: 0 });

  return (
    <AdminShell title="Review Conflicts" description="Inspect contradictory claims without collapsing direct values, normalized values, or review history.">
      <Breadcrumbs items={[{ label: "Evidence Board", href: "/admin" }, { label: "Review Conflicts" }]} />
      <SectionHeader title="Unreviewed conflicts" description="Conflict rows foreground case linkage, severity, and obvious entry points into the evidence chain." />
      <QueueTable
        rows={conflicts.data.map((conflict: any) => ({
          id: conflict.id,
          title: conflict.conflict_type ?? "Conflict",
          description: conflict.summary ?? "Competing values require operator judgment before the case narrative is trusted.",
          caseHref: conflict.case_id ? `/admin/cases/${conflict.case_id}` : undefined,
          caseLabel: conflict.case_id ? `Case ${conflict.case_id}` : undefined,
          severity: conflict.severity,
          timestamp: conflict.created_at,
          reviewState: conflict.review_status ?? "unreviewed",
          meta: [conflict.previous_value ? "Direct and normalized values available" : "Conflicting values available"],
          quickAction: {
            endpoint: "/api/internal/conflicts",
            payload: { conflictId: conflict.id, reviewedBy: "internal-operator" },
            label: "Mark reviewed",
            successMessage: "Conflict marked reviewed."
          }
        }))}
        emptyTitle="No conflicts to resolve"
        emptyMessage="The contradiction queue is currently clear. Evidence history remains accessible from case pages and recent changes."
      />
    </AdminShell>
  );
}
