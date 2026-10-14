import '../config';
import { Pool } from 'pg';

// Tâche de provisionnement initial, jamais exécutée par le serveur HTTP.
async function provision() {
  const connectionString = process.env.MIGRATION_DATABASE_URL;
  const password = process.env.APP_DATABASE_PASSWORD;
  if (!connectionString || !password || password.length < 32)
    throw new Error('Connexion de migration et mot de passe applicatif de 32 caractères requis.');
  const pool = new Pool({ connectionString });
  try {
    const existing = await pool.query("SELECT 1 FROM pg_roles WHERE rolname='aveclesfemmes_app'");
    if (existing.rows.length) {
      console.log('Rôle applicatif existant ; aucune modification de ses identifiants.');
      return;
    }
    const statement = await pool.query(
      "SELECT format('CREATE ROLE aveclesfemmes_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD %L', $1::text) AS sql",
      [password],
    );
    await pool.query(statement.rows[0].sql);
    console.log('Rôle applicatif créé.');
  } finally {
    await pool.end();
  }
}
provision().catch(() => {
  console.error('Échec du provisionnement du rôle applicatif ; vérifier droits et connexion.');
  process.exitCode = 1;
});
