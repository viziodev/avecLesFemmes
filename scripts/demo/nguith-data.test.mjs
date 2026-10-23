import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import { resetNguith } from './nguith-data.mjs';
import { verifyPassword } from '../../apps/api/dist/auth/password.js';

test('remplacement Nguith : ancien jeu supprimé, Super Admin conservé et trois campagnes exactes', async () => {
  const db = new PGlite();
  const c = {
    query: async (sql, args) => {
      const result = await db.query(sql, args);
      return { ...result, rowCount: result.affectedRows || result.rows.length };
    },
  };
  try {
    await db.exec('CREATE ROLE aveclesfemmes_app');
    for (const file of readdirSync('database/migrations')
      .filter((x) => x.endsWith('.sql'))
      .sort())
      await db.exec(readFileSync('database/migrations/' + file, 'utf8'));
    const superId = randomUUID();
    await c.query(
      "INSERT INTO app_users(id,login,name,is_super) VALUES($1,'superadmin','Super',true),($2,'ancien','Ancien',false)",
      [superId, randomUUID()],
    );
    await c.query("INSERT INTO campaign_types(id,name,code) VALUES($1,'Avec Épargne','AVEC')", [
      randomUUID(),
    ]);
    await c.query(
      "INSERT INTO groupements(id,name,address,responsible,phone) VALUES($1,'Ancien groupement','Dakar','Ancien','')",
      [randomUUID()],
    );
    await assert.rejects(
      resetNguith(c, { NGUITH_PASSWORD: '1234', NGUITH_PIN: '1234' }),
      /Secrets/,
    );
    assert.equal((await c.query('SELECT * FROM groupements')).rowCount, 1);
    await c.query('BEGIN');
    const result = await resetNguith(c, {
      NGUITH_PASSWORD: 'Test-only-Nguith-password',
      NGUITH_PIN: '1234',
    });
    await c.query('COMMIT');
    assert.deepEqual(
      [result.groupements, result.campagnes, result.membres, result.versements],
      [1, 3, 1, 0],
    );
    assert.equal((await c.query('SELECT id FROM app_users WHERE is_super')).rows[0].id, superId);
    assert.equal((await c.query("SELECT * FROM app_users WHERE login='ancien'")).rowCount, 0);
    const awa = (await c.query("SELECT * FROM app_users WHERE login='awa'")).rows[0];
    assert(verifyPassword('Test-only-Nguith-password', awa.password_hash));
    assert(verifyPassword('1234', awa.secret_code_hash));
    const group = (await c.query('SELECT * FROM groupements')).rows[0];
    assert.equal(group.name, 'Cabalabasse des Femmes de Nguith');
    const member = (
      await c.query(
        'SELECT m.*,f.code FROM memberships m JOIN group_functions f ON f.id=m.function_id',
      )
    ).rows[0];
    assert.equal(member.role, 'ADMIN');
    assert.equal(member.code, 'PRESIDENTE');
    const campaigns = (
      await c.query(
        'SELECT c.name,c.standard_amount::int amount,c.weekday,c.rotation_interval,c.monthly_week,e.code event,p.forfait::int forfait FROM campaigns c LEFT JOIN campaign_events e ON e.id=c.event_id JOIN participations p ON p.campaign_id=c.id ORDER BY c.name',
      )
    ).rows;
    assert.deepEqual(campaigns, [
      {
        name: 'Avec',
        amount: 5000,
        weekday: 0,
        rotation_interval: null,
        monthly_week: null,
        event: 'TABASKI',
        forfait: 5000,
      },
      {
        name: 'Natte-10000',
        amount: 1000,
        weekday: 0,
        rotation_interval: 'MONTHLY',
        monthly_week: 1,
        event: null,
        forfait: 1000,
      },
      {
        name: 'Sokorou Kor',
        amount: 3000,
        weekday: 0,
        rotation_interval: 'MONTHLY',
        monthly_week: 1,
        event: 'RAMADAN',
        forfait: 3000,
      },
    ]);
    assert.equal((await c.query('SELECT * FROM savings_sessions')).rowCount, 0);
    assert.equal((await c.query('SELECT * FROM tontine_rounds')).rowCount, 0);
  } finally {
    await db.close();
  }
});
