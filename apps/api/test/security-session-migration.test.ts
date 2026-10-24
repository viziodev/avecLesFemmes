import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

test('migration de sécurité : anciennes sessions PWA révoquées, sessions Super Admin et mots de passe conservés', async () => {
  const pg = new PGlite();
  try {
    await pg.exec('CREATE ROLE aveclesfemmes_app');
    await pg.exec(await readFile(resolve('../../database/migrations/001_initial.sql'), 'utf8'));
    await pg.exec(`INSERT INTO app_users(id,login,name,password_hash,is_super) VALUES
      ('11111111-1111-4111-a111-111111111111','membre','Membre','unchanged-member',false),
      ('22222222-2222-4222-a222-222222222222','super','Super','unchanged-super',true);
      INSERT INTO sessions(token_hash,user_id,expires_at) VALUES
      ('legacy-member','11111111-1111-4111-a111-111111111111',now()+interval '1 hour'),
      ('legacy-super','22222222-2222-4222-a222-222222222222',now()+interval '1 hour');`);
    const migration = await readFile(
      resolve('../../database/migrations/016_revoke_legacy_pwa_sessions.sql'),
      'utf8',
    );
    await pg.exec(migration);
    assert.deepEqual((await pg.query('SELECT token_hash FROM sessions')).rows, [
      { token_hash: 'legacy-super' },
    ]);
    assert.deepEqual((await pg.query('SELECT password_hash FROM app_users ORDER BY login')).rows, [
      { password_hash: 'unchanged-member' },
      { password_hash: 'unchanged-super' },
    ]);
    await pg.exec(migration);
    assert.equal((await pg.query('SELECT token_hash FROM sessions')).rows.length, 1);
  } finally {
    await pg.close();
  }
});
