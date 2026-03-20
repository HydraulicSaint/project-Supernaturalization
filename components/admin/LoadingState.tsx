import React from "react";
export function LoadingState({ label = "Loading internal workspace…" }: { label?: string }) {
  return (
    <div className="loading-state" aria-busy="true">
      <div className="loading-bar" />
      <div className="loading-bar loading-bar-short" />
      <p>{label}</p>
    </div>
  );
}
