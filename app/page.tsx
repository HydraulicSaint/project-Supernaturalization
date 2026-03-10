"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { CaseDetailDrawer } from "@/components/CaseDetailDrawer";
import { FilterRail } from "@/components/FilterRail";
import { ProvenancePanel } from "@/components/ProvenancePanel";
import { TimelineControls } from "@/components/TimelineControls";
import { cases, locationEvents, sourceRecords } from "@/lib/mockData";

const InvestigationMap = dynamic(() => import("@/components/InvestigationMap").then((m) => m.InvestigationMap), {
  ssr: false
});

export default function Home() {
  const [caseStatus, setCaseStatus] = useState("all");
  const [biome, setBiome] = useState("");
  const [timelineIndex, setTimelineIndex] = useState(locationEvents.length - 1);

  const filteredCases = useMemo(
    () =>
      cases.filter((c) => {
        const statusOk = caseStatus === "all" || c.status.value === caseStatus;
        const biomeOk = !biome || c.primaryBiome.value.toLowerCase().includes(biome.toLowerCase());
        return statusOk && biomeOk;
      }),
    [caseStatus, biome]
  );

  const selectedCase = filteredCases[0] ?? cases[0];

  return (
    <main>
      <FilterRail caseStatus={caseStatus} setCaseStatus={setCaseStatus} biome={biome} setBiome={setBiome} />
      <section className="map-wrap">
        <InvestigationMap events={locationEvents} visibleEvents={timelineIndex + 1} />
        <TimelineControls
          value={timelineIndex}
          onChange={setTimelineIndex}
          max={Math.max(locationEvents.length - 1, 0)}
          label={`Showing events through step ${timelineIndex + 1}`}
        />
      </section>
      <aside className="right-panel">
        <CaseDetailDrawer selectedCase={selectedCase} />
        <ProvenancePanel sources={sourceRecords.filter((s) => selectedCase.sourceRecordIds.includes(s.id))} />
      </aside>
    </main>
  );
}
