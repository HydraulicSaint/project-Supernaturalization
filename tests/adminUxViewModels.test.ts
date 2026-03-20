import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { getAdminBoardViewModel, getCaseEvidenceViewModel } from "@/lib/admin/viewModels";
import { QueueTable } from "@/components/admin/QueueTable";
import AdminLayout from "@/app/admin/layout";

test("admin board view model exposes summary cards and actionable panels", async () => {
  const model = await getAdminBoardViewModel();

  assert.equal(model.stats.length, 6);
  assert.ok(model.stats.some((stat) => stat.label === "Unreviewed Issues"));
  assert.ok(model.panels.some((panel) => panel.title === "Review Conflicts"));
  assert.ok(model.panels.every((panel) => panel.preview.length <= 3));
});

test("queue table renders priority, confidence, review state, and action affordances", () => {
  const markup = renderToStaticMarkup(
    QueueTable({
      rows: [
        {
          id: "row-1",
          title: "Conflicting status",
          description: "Direct and normalized values disagree.",
          caseHref: "/admin/cases/case-1",
          caseLabel: "Case case-1",
          severity: "high",
          confidence: 0.42,
          timestamp: "2026-03-20T00:00:00.000Z",
          reviewState: "unreviewed",
          meta: ["source namus"]
        }
      ],
      emptyTitle: "none",
      emptyMessage: "none"
    })
  );

  assert.match(markup, /high/);
  assert.match(markup, /0.42 confidence/);
  assert.match(markup, /unreviewed/);
  assert.match(markup, /Open evidence/);
});

test("case evidence view model returns major evidence sections in demo mode", async () => {
  const model = await getCaseEvidenceViewModel("case-1");
  assert.ok(model);
  assert.ok(model?.summary.sourceCount >= 1);
  assert.ok(model?.summary.locationCount >= 1);
  assert.ok(Array.isArray(model?.environment));
  assert.ok(Array.isArray(model?.decisions));
});

test("admin layout navigation stays within protected internal routes", () => {
  const markup = renderToStaticMarkup(AdminLayout({ children: "content" }));
  assert.match(markup, /\/admin\/issues/);
  assert.match(markup, /\/admin\/conflicts/);
  assert.match(markup, /\/admin\/cases/);
  assert.doesNotMatch(markup, /href="\/cases"/);
});
