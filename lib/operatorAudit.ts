import { db } from "@/lib/db";

type QueueFilters = { limit?: number; offset?: number };
const safeLimit = (n?: number) => Math.min(200, Math.max(1, n ?? 50));

export type OperatorActionInput = {
  actorId: string;
  actionType: string;
  targetEntityType: string;
  targetEntityId?: string;
  notes?: string;
  context?: Record<string, unknown>;
};

export async function recordOperatorAction(input: OperatorActionInput) {
  if (!db) return { ok: false, mode: "demo" };
  await db.query(
    `INSERT INTO operator_action_audit (actor_id, action_type, target_entity_type, target_entity_id, notes, context)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [input.actorId, input.actionType, input.targetEntityType, input.targetEntityId ?? null, input.notes ?? null, JSON.stringify(input.context ?? {})]
  );
  return { ok: true };
}

export async function listOperatorActions(filters: QueueFilters = {}) {
  const limit = safeLimit(filters.limit);
  const offset = Math.max(0, filters.offset ?? 0);

  if (!db) {
    return {
      data: [
        {
          id: "demo-action-1",
          actor_id: "internal-operator",
          action_type: "review_issue",
          target_entity_type: "ingestion_issue",
          target_entity_id: "issue-1",
          notes: "Validated parser miss and queued follow-up source review.",
          created_at: new Date().toISOString()
        }
      ],
      pagination: { limit, offset, hasMore: false }
    };
  }

  const { rows } = await db.query(
    `SELECT * FROM operator_action_audit ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return { data: rows, pagination: { limit, offset, hasMore: rows.length === limit } };
}

export function resolveActorId(actor?: string | null) {
  return actor?.trim() || "internal-operator";
}
