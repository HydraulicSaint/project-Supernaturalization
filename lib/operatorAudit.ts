import { db } from "@/lib/db";

export type OperatorActionInput = {
  actorId: string;
  actorDisplayName?: string;
  authSource?: string;
  actionType: string;
  targetEntityType: string;
  targetEntityId?: string;
  notes?: string;
  context?: Record<string, unknown>;
};

export async function recordOperatorAction(input: OperatorActionInput) {
  if (!db) return { ok: false, mode: "demo" };
  await db.query(
    `INSERT INTO operator_action_audit (actor_id, actor_display_name, auth_source, action_type, target_entity_type, target_entity_id, notes, context)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      input.actorId,
      input.actorDisplayName ?? null,
      input.authSource ?? null,
      input.actionType,
      input.targetEntityType,
      input.targetEntityId ?? null,
      input.notes ?? null,
      JSON.stringify(input.context ?? {})
    ]
  );
  return { ok: true };
}
