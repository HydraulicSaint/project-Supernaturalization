import { db } from "@/lib/db";

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

export function resolveActorId(actor?: string | null) {
  return actor?.trim() || "internal-operator";
}
