import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('migration de charte : défaut adopté, palettes personnalisées et groupements préservés', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE platform_appearance(id uuid,primary_color text,savings_color text,tontine_color text,solidarity_color text,updated_at timestamptz DEFAULT now());
      CREATE TABLE group_appearance(group_id uuid,primary_color text,savings_color text,tontine_color text,solidarity_color text);
      INSERT INTO platform_appearance VALUES('00000000-0000-4000-a000-000000000001','#155d50','#197647','#471976','#764019',now());
      INSERT INTO group_appearance VALUES('00000000-0000-4000-a000-000000000002','#155d50','#197647','#471976','#764019');`);
    const sql = await readFile('../../database/migrations/014_charter_default_palette.sql', 'utf8');
    await db.exec(sql);
    const { rows } = await db.query<{ tontine_color: string; solidarity_color: string }>(
      'SELECT * FROM platform_appearance',
    );
    assert.equal(rows[0].tontine_color, '#6d3fc0');
    assert.equal(rows[0].solidarity_color, '#a85d12');
    assert.equal(
      (await db.query<{ tontine_color: string }>('SELECT * FROM group_appearance')).rows[0]
        .tontine_color,
      '#471976',
    );
    await db.exec(
      "UPDATE platform_appearance SET primary_color='#0044cc',tontine_color='#471976',solidarity_color='#764019'",
    );
    await db.exec(sql);
    assert.equal(
      (await db.query<{ tontine_color: string }>('SELECT * FROM platform_appearance')).rows[0]
        .tontine_color,
      '#471976',
    );
  } finally {
    await db.close();
  }
});
