import React from "react";
import Link from "next/link";
import { AdminShell, Breadcrumbs, SectionHeader } from "@/components/admin/ui";
import { QueueTable } from "@/components/admin/QueueTable";
import { listIngestionIssues } from "@/lib/repositories/ingestionRunsRepository";

export default async function AdminIssuesPage() {
  const issues = await listIngestionIssues({ reviewed: "unreviewed", sort: "severity", limit: 50, offset: 0 });

  return (
    <AdminShell title="Review Issues" description="Work ingestion and extraction problems in priority order while preserving direct source provenance.">
      <Breadcrumbs items={[{ label: "Evidence Board", href: "/admin" }, { label: "Review Issues" }]} />
      <SectionHeader title="Unreviewed ingestion issues" description="Severity, linked evidence, and review state are surfaced directly in each row." />
      <QueueTable
        rows={issues.data.map((issue: any) => ({
          id: issue.id,
          title: issue.issue_type ?? "Ingestion issue",
          description: issue.details ?? issue.message ?? "Issue needs operator verification.",
          caseHref: issue.case_id ? `/admin/cases/${issue.case_id}` : undefined,
          caseLabel: issue.case_id ? `Case ${issue.case_id}` : undefined,
          sourceLabel: issue.source_record_id ? `Source ${issue.source_record_id}` : undefined,
          severity: issue.severity,
          timestamp: issue.created_at ?? issue.createdAt,
          reviewState: issue.review_status ?? "unreviewed",
          meta: [issue.issue_type].filter(Boolean),
          quickAction: {
            endpoint: "/api/internal/ingestion/issues",
            payload: { issueId: issue.id, reviewedBy: "internal-operator" },
            label: "Mark reviewed",
            successMessage: "Issue marked reviewed."
          }
        }))}
        emptyTitle="No issues waiting"
        emptyMessage="Current ingestion and extraction issues are cleared. Check recent changes for historical activity."
      />
      <p className="supporting-copy">Need broader context? <Link href="/admin/recent-changes">Inspect recent changes</Link> to see nearby extraction and reconciliation activity.</p>
    </AdminShell>
  );
}
