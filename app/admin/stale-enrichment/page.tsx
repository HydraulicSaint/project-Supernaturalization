import React from "react";
import { AdminShell, Badge, Breadcrumbs, SectionHeader } from "@/components/admin/ui";
import { QueueTable } from "@/components/admin/QueueTable";
import { listSpatialEnrichmentSnapshots } from "@/lib/repositories/ingestionRunsRepository";

export default async function AdminStaleEnrichmentPage() {
  const stale = await listSpatialEnrichmentSnapshots({ stale: "true", limit: 50, offset: 0 });

  return (
    <AdminShell title="Refresh Stale Enrichment" description="Track snapshots whose layer-version provenance no longer matches the latest reference inventory.">
      <Breadcrumbs items={[{ label: "Evidence Board", href: "/admin" }, { label: "Refresh Stale Enrichment" }]} />
      <SectionHeader
        title="Stale environment snapshots"
        description="Rows show exactly which case evidence needs re-enrichment attention; the case drilldown keeps historical layer versions visible."
        action={<Badge tone={stale.data.length ? "warning" : "success"}>{stale.data.length} stale</Badge>}
      />
      <QueueTable
        rows={stale.data.map((snapshot: any) => ({
          id: snapshot.id,
          title: snapshot.case_id ? `Case ${snapshot.case_id}` : "Environment snapshot",
          description: snapshot.reference_layer_snapshot ? `Layer snapshot ${JSON.stringify(snapshot.reference_layer_snapshot)}` : "Layer-version provenance available in case detail.",
          caseHref: snapshot.case_id ? `/admin/cases/${snapshot.case_id}#enrichment-snapshots` : undefined,
          caseLabel: snapshot.case_id ? `Case ${snapshot.case_id}` : undefined,
          confidence: snapshot.confidence_score,
          timestamp: snapshot.captured_at,
          reviewState: snapshot.stale_reference_data ? "stale" : "current",
          meta: [snapshot.location_event_id ? `Location event ${snapshot.location_event_id}` : "Case-level enrichment"].filter(Boolean)
        }))}
        emptyTitle="No stale enrichment snapshots"
        emptyMessage="Current environment snapshots match the latest layer inventory."
      />
    </AdminShell>
  );
}
