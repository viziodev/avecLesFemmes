import '../config';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../auth/password';
async function bootstrap() {
  const login = process.env.SUPERADMIN_LOGIN,
    name = process.env.SUPERADMIN_NAME,
    password = process.env.SUPERADMIN_PASSWORD,
    phone = process.env.SUPERADMIN_PHONE;
  if (!process.env.MIGRATION_DATABASE_URL || !login || !name || !password || password.length < 12)
    throw new Error(
      'Configurer MIGRATION_DATABASE_URL, SUPERADMIN_LOGIN, SUPERADMIN_NAME et SUPERADMIN_PASSWORD (12 caractères minimum).',
    );
  const pool = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL });
  try {
    const r = await pool.query(
      'INSERT INTO app_users(id,login,name,phone,password_hash,is_super) VALUES($1,$2,$3,$4,$5,true) ON CONFLICT(login) DO NOTHING RETURNING id',
      [randomUUID(), login, name, phone || null, hashPassword(password)],
    );
    console.log(
      r.rows.length
        ? 'Super administrateur initial créé.'
        : 'Cet identifiant existe déjà ; aucune modification.',
    );
  } finally {
    await pool.end();
  }
}
bootstrap().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
