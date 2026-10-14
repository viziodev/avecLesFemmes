import '../config';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../auth/password';
export async function seed() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Jeu de démonstration interdit en production.');
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12)
    throw new Error('DEMO_PASSWORD doit contenir au moins 12 caractères.');
  const pool = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL });
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const u = await c.query("SELECT id FROM app_users WHERE login='superadmin'");
    if (u.rows.length) {
      console.log('Démonstration déjà initialisée.');
      await c.query('ROLLBACK');
      return;
    }
    const users = [
      {
        id: randomUUID(),
        login: 'superadmin',
        name: 'Administration AvecLesFemmes',
        phone: '+221770000001',
        super: true,
      },
      {
        id: randomUUID(),
        login: 'admin.ndeye',
        name: 'Ndèye Diop',
        phone: '+221770000002',
        super: false,
      },
      {
        id: randomUUID(),
        login: 'membre.awa',
        name: 'Awa Fall',
        phone: '+221770000003',
        super: false,
      },
    ];
    for (const u of users)
      await c.query(
        'INSERT INTO app_users(id,login,name,phone,password_hash,is_super) VALUES($1,$2,$3,$4,$5,$6)',
        [u.id, u.login, u.name, u.phone, hashPassword(password), u.super],
      );
    const g = randomUUID();
    const type = randomUUID();
    const campaign = randomUUID();
    await c.query(
      "INSERT INTO groupements(id,name,address,responsible,phone) VALUES($1,'Les Femmes de Grand Yoff','Grand Yoff, Dakar','Ndèye Diop','+221770000002')",
      [g],
    );
    await c.query("INSERT INTO campaign_types(id,name,code) VALUES($1,'Avec Épargne','AVEC')", [
      type,
    ]);
    await c.query(
      "INSERT INTO campaigns(id,group_id,type_id,name,start_date,end_date,weekday,interval_weeks,rule_version) VALUES($1,$2,$3,'Épargne solidaire 2026','2026-01-01','2026-12-31',2,1,1)",
      [campaign, g, type],
    );
    for (const [i, u] of users.slice(1).entries()) {
      const member = randomUUID(),
        part = randomUUID();
      await c.query(
        'INSERT INTO memberships(id,group_id,user_id,name,phone,role) VALUES($1,$2,$3,$4,$5,$6)',
        [member, g, u.id, u.name, u.phone, i === 0 ? 'ADMIN' : 'MEMBER'],
      );
      await c.query(
        'INSERT INTO participations(id,group_id,campaign_id,membership_id,forfait) VALUES($1,$2,$3,$4,$5)',
        [part, g, campaign, member, i === 0 ? 2000 : null],
      );
    }
    await c.query('COMMIT');
    console.log(
      'Données fictives créées. Identifiants : superadmin, admin.ndeye, membre.awa. Mot de passe : DEMO_PASSWORD dans .env.',
    );
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
    await pool.end();
  }
}
if (require.main === module)
  seed().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
