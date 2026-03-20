import React from "react";
import Link from "next/link";
import type { ReactNode } from "react";

export function AdminShell({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="admin-page-shell">
      <div className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Internal operations</p>
          <h1>{title}</h1>
          {description ? <p className="admin-page-description">{description}</p> : null}
        </div>
        {actions ? <div className="admin-page-actions">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function SectionHeader({ title, description, anchor, action }: { title: string; description?: string; anchor?: string; action?: ReactNode }) {
  return (
    <div className="section-header" id={anchor}>
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function StatCard({ label, value, hint, href, tone = "neutral" }: { label: string; value: ReactNode; hint?: string; href?: string; tone?: string }) {
  const content = (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">{value}</div>
      {hint ? <p className="stat-card-hint">{hint}</p> : null}
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

export function InfoPanel({ title, description, count, updatedAt, href, tone = "neutral", children }: { title: string; description?: string; count?: ReactNode; updatedAt?: string | null; href?: string; tone?: string; children: ReactNode }) {
  return (
    <section className={`info-panel tone-${tone}`}>
      <div className="info-panel-header">
        <div>
          <div className="info-panel-kicker">{title}</div>
          {description ? <p>{description}</p> : null}
        </div>
        <div className="info-panel-meta">
          {count !== undefined ? <div className="info-panel-count">{count}</div> : null}
          {updatedAt ? <TimestampMeta label="Updated" value={updatedAt} /> : null}
          {href ? (
            <Link className="admin-link" href={href}>
              Open queue
            </Link>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) {
  return <span className={`admin-badge tone-${tone}`}>{children}</span>;
}

export function MetaList({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="meta-list">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{message}</p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function PreviewList({ items }: { items: Array<{ id: string; title: string; subtitle?: string; meta?: string; href?: string; why?: string }> }) {
  if (!items.length) {
    return <EmptyState title="Nothing waiting here" message="This panel is clear right now. Use the linked queue for historical context if needed." />;
  }

  return (
    <div className="preview-list">
      {items.map((item) => (
        <div className="preview-row" key={item.id}>
          <div>
            <div className="preview-row-title">{item.href ? <Link href={item.href}>{item.title}</Link> : item.title}</div>
            {item.subtitle ? <div className="preview-row-subtitle">{item.subtitle}</div> : null}
            {item.why ? <p className="preview-row-why">{item.why}</p> : null}
          </div>
          {item.meta ? <div className="preview-row-meta">{item.meta}</div> : null}
        </div>
      ))}
    </div>
  );
}

export function TimestampMeta({ label, value }: { label: string; value?: string | null }) {
  return <div className="timestamp-meta">{label}: {value ? new Date(value).toLocaleString() : "—"}</div>;
}

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {item.href ? <Link href={item.href}>{item.label}</Link> : item.label}
          {index < items.length - 1 ? <span className="breadcrumbs-separator">/</span> : null}
        </span>
      ))}
    </nav>
  );
}

export function DetailPanel({ title, summary, children, defaultOpen = true }: { title: string; summary?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="detail-panel" open={defaultOpen}>
      <summary>
        <span>{title}</span>
        {summary ? <span className="detail-panel-summary">{summary}</span> : null}
      </summary>
      <div className="detail-panel-body">{children}</div>
    </details>
  );
}

export function KeyValueTable({ rows }: { rows: Array<{ key: string; value: ReactNode }> }) {
  return (
    <div className="key-value-table">
      {rows.map((row) => (
        <div key={row.key}>
          <div>{row.key}</div>
          <div>{row.value}</div>
        </div>
      ))}
    </div>
  );
}
