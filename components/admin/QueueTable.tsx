import React from "react";
import Link from "next/link";
import { Badge, EmptyState } from "@/components/admin/ui";
import { getConfidenceTone, getSeverityTone } from "@/lib/admin/viewModels";
import { QueueActionButton } from "@/components/admin/QueueActionButton";

export type QueueRow = {
  id: string;
  title: string;
  description: string;
  caseHref?: string;
  caseLabel?: string;
  sourceLabel?: string;
  severity?: string | null;
  confidence?: number | null;
  timestamp?: string | null;
  reviewState?: string | null;
  meta?: string[];
  quickAction?: { endpoint: string; payload: Record<string, unknown>; label: string; successMessage: string };
};

export function QueueTable({ rows, emptyTitle, emptyMessage }: { rows: QueueRow[]; emptyTitle: string; emptyMessage: string }) {
  if (!rows.length) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <div className="queue-table">
      {rows.map((row) => (
        <div className="queue-row" key={row.id}>
          <div className="queue-row-main">
            <div className="queue-row-title">{row.title}</div>
            <p className="queue-row-description">{row.description}</p>
            <div className="queue-row-meta-line">
              {row.severity ? <Badge tone={getSeverityTone(row.severity)}>{row.severity}</Badge> : null}
              {row.confidence !== null && row.confidence !== undefined ? <Badge tone={getConfidenceTone(row.confidence)}>{row.confidence.toFixed(2)} confidence</Badge> : null}
              {row.reviewState ? <Badge tone={row.reviewState === "reviewed" ? "success" : "warning"}>{row.reviewState}</Badge> : null}
              {row.timestamp ? <span>{new Date(row.timestamp).toLocaleString()}</span> : null}
            </div>
            <div className="queue-row-links">
              {row.caseHref && row.caseLabel ? <Link href={row.caseHref}>{row.caseLabel}</Link> : null}
              {row.sourceLabel ? <span>{row.sourceLabel}</span> : null}
              {row.meta?.map((item) => <span key={item}>{item}</span>)}
            </div>
          </div>
          <div className="queue-row-actions">
            {row.caseHref ? <Link className="admin-link" href={row.caseHref}>Open evidence</Link> : null}
            {row.quickAction ? <QueueActionButton {...row.quickAction} /> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
