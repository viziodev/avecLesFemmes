import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const owner = randomBytes(20).toString('hex'),
  runtime = randomBytes(20).toString('hex');
const text = `POSTGRES_PASSWORD=${owner}\nAPP_DATABASE_PASSWORD=${runtime}\nDATABASE_URL=postgresql://aveclesfemmes_app:${runtime}@localhost:5433/aveclesfemmes\nMIGRATION_DATABASE_URL=postgresql://postgres:${owner}@localhost:5433/aveclesfemmes\nDEMO_PASSWORD=${randomBytes(12).toString('hex')}\nOTP_SECRET=${randomBytes(32).toString('hex')}\nSMS_MODE=development\nALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:8085,http://localhost:8086\n`;
try {
  await writeFile(new URL('../.env', import.meta.url), text, { flag: 'wx', mode: 0o600 });
  console.log('.env créé avec des secrets aléatoires.');
} catch (e) {
  if (e.code === 'EEXIST') console.log('.env existe déjà ; aucun remplacement.');
  else throw e;
}
