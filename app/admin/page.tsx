import React from "react";
import { AdminShell, InfoPanel, PreviewList, SectionHeader, StatCard } from "@/components/admin/ui";
import { getAdminBoardViewModel } from "@/lib/admin/viewModels";

export default async function AdminPage() {
  const model = await getAdminBoardViewModel();

  return (
    <AdminShell
      title="Evidence board"
      description="Start here to see what needs review next, what changed recently, and which cases need deeper inspection."
    >
      <SectionHeader title="Priority summary" description="Compact operational counts tuned for scanning before you open a queue." />
      <div className="stat-grid">
        {model.stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <SectionHeader title="Next actions" description="High-signal panels turn the board into an action surface instead of a list dump." />
      <div className="panel-grid">
        {model.panels.map((panel) => (
          <InfoPanel
            key={panel.title}
            title={panel.title}
            description={panel.description}
            count={panel.count}
            updatedAt={panel.updatedAt}
            href={panel.href}
            tone={panel.tone}
          >
            <PreviewList items={panel.preview} />
          </InfoPanel>
        ))}
      </div>
    </AdminShell>
  );
}
