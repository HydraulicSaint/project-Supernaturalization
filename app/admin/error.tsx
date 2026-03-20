"use client";
import React from "react";

export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="empty-state">
      <h3>Unable to load internal workspace</h3>
      <p>{error.message || "An unexpected admin UI error occurred."}</p>
      <button type="button" onClick={reset}>Retry</button>
    </div>
  );
}
