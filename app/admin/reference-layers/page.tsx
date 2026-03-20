import React from "react";
import { AdminShell, Badge, Breadcrumbs, SectionHeader } from "@/components/admin/ui";
import { getReferenceLayerInventoryViewModel } from "@/lib/admin/viewModels";

export default async function AdminReferenceLayersPage() {
  const model = await getReferenceLayerInventoryViewModel();

  return (
    <AdminShell title="Reference Layers" description="Keep the latest layer inventory and snapshot provenance visible while operators review stale enrichments.">
      <Breadcrumbs items={[{ label: "Evidence Board", href: "/admin" }, { label: "Reference Layers" }]} />
      <SectionHeader title="Current layer snapshot" description="These are the versions used to determine whether stored enrichment is stale." />
      <div className="badge-cluster">
        {Object.entries(model.snapshot).map(([layer, version]) => (
          <Badge key={layer} tone="neutral">{layer}: {version}</Badge>
        ))}
      </div>
      <SectionHeader title="Inventory" description="Imported versions remain inspectable without leaving the internal workspace." />
      <div className="queue-table">
        {model.inventory.map((item: any) => (
          <div className="queue-row" key={item.id}>
            <div className="queue-row-main">
              <div className="queue-row-title">{item.layer_type}</div>
              <p className="queue-row-description">{item.source_name ?? "Reference layer version"}</p>
              <div className="queue-row-meta-line">
                <Badge tone="neutral">{item.effective_version}</Badge>
                <span>{item.imported_at ? new Date(item.imported_at).toLocaleString() : "Demo inventory"}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
