import React from "react";
import Link from "next/link";
import { AdminShell, Badge, Breadcrumbs, SectionHeader } from "@/components/admin/ui";
import { listCanonicalCases } from "@/lib/repositories/canonicalCasesRepository";
import { getConfidenceTone } from "@/lib/admin/viewModels";

export default async function AdminCasesPage() {
  const cases = await listCanonicalCases({});

  return (
    <AdminShell title="Browse Cases" description="Open case drilldowns in an investigative order instead of starting from raw entities or database tables.">
      <Breadcrumbs items={[{ label: "Evidence Board", href: "/admin" }, { label: "Browse Cases" }]} />
      <SectionHeader title="Canonical cases" description="Use these summaries to jump into the strongest evidence trail for each case." />
      <div className="queue-table">
        {cases.map((item: any) => (
          <div className="queue-row" key={item.id}>
            <div className="queue-row-main">
              <div className="queue-row-title">{item.displayName ?? item.canonical_case_ref ?? item.id}</div>
              <p className="queue-row-description">{item.narrativeSummary ?? item.narrative_summary ?? "Narrative summary unavailable."}</p>
              <div className="queue-row-meta-line">
                <Badge tone={getConfidenceTone(item.sourceConfidence ?? item.source_confidence)}>{Number(item.sourceConfidence ?? item.source_confidence ?? 0).toFixed(2)} confidence</Badge>
                <Badge tone="neutral">{item.caseStatus ?? item.case_status ?? "unknown"}</Badge>
                <span>{item.missingFrom ?? item.missing_from ?? ""}</span>
              </div>
            </div>
            <div className="queue-row-actions">
              <Link className="admin-link" href={`/admin/cases/${item.id}`}>Open case</Link>
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
