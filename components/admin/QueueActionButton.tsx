"use client";
import React from "react";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function QueueActionButton({ endpoint, payload, label, successMessage }: { endpoint: string; payload: Record<string, unknown>; label: string; successMessage: string }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="queue-action-wrap">
      <button
        type="button"
        className="ghost-button"
        disabled={isPending}
        onClick={() => {
          setFeedback(null);
          startTransition(async () => {
            try {
              const response = await fetch(endpoint, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "x-operator-id": "internal-operator" },
                body: JSON.stringify(payload)
              });
              const result = await response.json();
              if (!response.ok || result.ok === false) {
                throw new Error(result.error ?? "Action failed");
              }
              setFeedback(successMessage);
              router.refresh();
            } catch (error) {
              setFeedback(error instanceof Error ? error.message : "Action failed");
            }
          });
        }}
      >
        {isPending ? "Working…" : label}
      </button>
      {feedback ? <p className="inline-feedback">{feedback}</p> : null}
    </div>
  );
}
