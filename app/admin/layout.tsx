import React from "react";
import Link from "next/link";

const navItems = [
  { href: "/admin", label: "Evidence Board" },
  { href: "/admin/issues", label: "Review Issues" },
  { href: "/admin/conflicts", label: "Review Conflicts" },
  { href: "/admin/stale-enrichment", label: "Refresh Stale Enrichment" },
  { href: "/admin/recent-changes", label: "Inspect Recent Changes" },
  { href: "/admin/cases", label: "Browse Cases" },
  { href: "/admin/reference-layers", label: "Reference Layers" }
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="admin-layout">
      <aside className="admin-sidebar">
        <div>
          <p className="admin-eyebrow">Supernaturalization</p>
          <h2>Operator workspace</h2>
          <p className="admin-sidebar-copy">Task-oriented internal views for evidence review, queue work, and provenance inspection.</p>
        </div>
        <nav className="admin-nav">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="admin-nav-link">
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <section className="admin-content">{children}</section>
    </main>
  );
}
