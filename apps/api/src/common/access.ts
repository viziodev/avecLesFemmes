import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Actor, SqlClient } from '../database/database.module';
export function requireSuper(actor: Actor) {
  if (!actor.isSuper) throw new ForbiddenException('Action réservée au super administrateur.');
}
export async function requireGroup(c: SqlClient, groupId: string, admin = false) {
  const r = await c.query('SELECT id,app_is_admin(id) AS admin FROM groupements WHERE id=$1', [
    groupId,
  ]);
  if (!r.rows[0]) throw new NotFoundException('Groupement introuvable.');
  if (admin && !r.rows[0].admin)
    throw new ForbiddenException('Administration du groupement requise.');
}
export async function audit(
  c: SqlClient,
  actor: Actor,
  groupId: string | null,
  action: string,
  entityId: string,
  payload: unknown = {},
) {
  await c.query(
    'INSERT INTO audit_events(id,group_id,actor_id,action,entity_id,payload) VALUES($1,$2,$3,$4,$5,$6)',
    [randomUUID(), groupId, actor.id, action, entityId, JSON.stringify(payload)],
  );
}
