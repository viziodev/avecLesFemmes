/* Runs only in the disposable qualification Compose project. No production URL accepted. */
const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const { writeFile } = require('node:fs/promises');
const { Pool } = require('pg');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('/app/apps/api/dist/app.module.js');
const { configure } = require('/app/apps/api/dist/bootstrap.js');
const { Database } = require('/app/apps/api/dist/database/database.module.js');
const { migrate } = require('/app/apps/api/dist/database/migrate.js');
const { hashPassword } = require('/app/apps/api/dist/auth/password.js');

for (const key of ['DATABASE_URL', 'MIGRATION_DATABASE_URL']) {
  const url = new URL(process.env[key]);
  assert.equal(url.hostname, 'qualification-db', 'Hôte de qualification obligatoire');
  assert.equal(url.pathname, '/qualification', 'Base de qualification obligatoire');
}
const reportFile = process.env.QUALIFICATION_REPORT || 'latest.json';
assert.match(reportFile, /^[a-z0-9-]+\.json$/, 'Nom de rapport invalide');
function boundedInteger(name, fallback, min, max) {
  const value = Number(process.env[name] ?? fallback);
  assert(Number.isInteger(value) && value >= min && value <= max, `${name}: ${min}..${max} requis`);
  return value;
}
const historyDepth = boundedInteger('QUALIFICATION_HISTORY', 1, 1, 10);
const loadRounds = boundedInteger('QUALIFICATION_ROUNDS', 0, 0, 30);
const groups = 1001,
  members = 201;
const id = (value) => {
  const raw = createHash('md5').update(value).digest('hex');
  const h = raw.slice(0, 12) + '4' + raw.slice(13, 16) + '8' + raw.slice(17);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
const owner = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL, max: 2 });
const password = randomUUID();
const report = {
  date: new Date().toISOString(),
  image: process.env.QUALIFICATION_IMAGE,
  status: 'running',
  checks: [],
  timings: {},
  parameters: { historyDepth, loadRounds },
};
let app;
async function measured(name, fn) {
  const start = performance.now();
  const result = await fn();
  report.timings[name] = Math.round(performance.now() - start);
  console.log(`${name}: ${report.timings[name]} ms`);
  return result;
}
function verified(name) {
  report.checks.push(name);
  console.log(`OK: ${name}`);
}
async function main() {
  const existing = await owner.query("SELECT to_regclass('public.app_users') AS table_name");
  assert.equal(
    existing.rows[0].table_name,
    null,
    'Base non vide : aucun effacement automatique autorisé',
  );
  await migrate();
  await owner.query(`CREATE FUNCTION qualification_id(value text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
    SELECT overlay(overlay(md5(value) placing '4' from 13) placing '8' from 17)::uuid $$`);
  await measured('fixture_ms', async () => {
    const hash = hashPassword(password);
    for (const login of ['admin', 'other', 'member']) {
      await owner.query('INSERT INTO app_users(id,login,name,password_hash) VALUES($1,$2,$2,$3)', [
        id(login),
        login,
        hash,
      ]);
    }
    await owner.query(
      `INSERT INTO groupements(id,name,address,responsible,phone)
      SELECT qualification_id('g-'||g),'Qualification '||g,'Fictif','Fictif','Fictif' FROM generate_series(1,$1::int) g`,
      [groups],
    );
    await owner.query(
      `INSERT INTO memberships(id,group_id,user_id,name,role)
      SELECT qualification_id('m-'||g||'-'||m),qualification_id('g-'||g),
        CASE WHEN g=1 AND m=1 THEN $3::uuid WHEN g=2 AND m=1 THEN $4::uuid WHEN g=1 AND m=2 THEN $5::uuid ELSE NULL END,
        'Membre '||lpad(m::text,3,'0'), CASE WHEN g IN (1,2) AND m=1 THEN 'ADMIN' ELSE 'MEMBER' END
      FROM generate_series(1,$1::int) g CROSS JOIN generate_series(1,$2::int) m`,
      [groups, members, id('admin'), id('other'), id('member')],
    );
    await owner.query(
      "INSERT INTO campaign_types(id,name,code) VALUES($1,'Épargne qualification','QUALIF')",
      [id('type')],
    );
    await owner.query(
      `INSERT INTO campaigns(id,group_id,type_id,name,start_date,end_date,weekday,rule_version)
      SELECT qualification_id('c-'||g),qualification_id('g-'||g),$2,'Campagne qualification',current_date-365,current_date+365,extract(dow from current_date)::int,1
      FROM generate_series(1,$1::int) g`,
      [groups, id('type')],
    );
    await owner.query(
      `INSERT INTO participations(id,group_id,campaign_id,membership_id)
      SELECT qualification_id('p-'||g||'-'||m),qualification_id('g-'||g),qualification_id('c-'||g),qualification_id('m-'||g||'-'||m)
      FROM generate_series(1,$1::int) g CROSS JOIN generate_series(1,$2::int) m`,
      [groups, members],
    );
    for (let day = 0; day < historyDepth; day++) {
      await owner.query(
        `INSERT INTO contributions(id,group_id,campaign_id,participation_id,amount,paid_on,created_by,reference,idempotency_key,request_hash)
        SELECT qualification_id('x-'||g||'-'||m||'-'||$4),qualification_id('g-'||g),qualification_id('c-'||g),qualification_id('p-'||g||'-'||m),
          100,current_date-$4::int,$3,'QUALIF-'||g||'-'||m||'-'||$4,qualification_id('key-'||g||'-'||m||'-'||$4),'fixture'
        FROM generate_series(1,$1::int) g CROSS JOIN generate_series(1,$2::int) m`,
        [groups, members, id('admin'), day],
      );
      const size = await owner.query(
        'SELECT pg_database_size(current_database())::float8 AS bytes',
      );
      report.databaseBytes = size.rows[0].bytes;
      assert(report.databaseBytes < 3 * 1024 ** 3, 'Budget de base de données dépassé (3 Go)');
      console.log(
        `Historique: ${day + 1}/${historyDepth}, ${Math.round(report.databaseBytes / 1024 ** 2)} Mio`,
      );
    }
    await owner.query('ANALYZE');
  });
  const counts = await owner.query(`SELECT
    (SELECT count(*)::int FROM groupements) AS groups,
    (SELECT count(*)::int FROM memberships) AS memberships,
    (SELECT count(*)::int FROM participations) AS participations,
    (SELECT count(*)::int FROM contributions) AS contributions`);
  report.fixture = counts.rows[0];
  assert.deepEqual(report.fixture, {
    groups,
    memberships: groups * members,
    participations: groups * members,
    contributions: groups * members * historyDepth,
  });
  verified('fixture_1001_groupements_201201_adhesions');
  app = await NestFactory.create(AppModule, { logger: false });
  configure(app);
  await app.get(Database).assertRuntimeRole();
  verified('role_applicatif_sans_privilege_et_non_proprietaire');
  await app.listen(0, '127.0.0.1');
  const base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`;
  async function request(path, cookie, body, expected = body ? 201 : 200) {
    const res = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'AvecLesFemmes',
        'X-Confirm-Password': 'utf8:' + Buffer.from(password).toString('base64'),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(res.status, expected, `${path}: HTTP ${res.status}`);
    return { data: await res.json(), cookie: res.headers.get('set-cookie')?.split(';')[0] };
  }
  const admin = (await request('/auth/login', null, { login: 'admin', password })).cookie;
  const other = (await request('/auth/login', null, { login: 'other', password })).cookie;
  const member = (await request('/auth/login', null, { login: 'member', password })).cookie;
  await request(`/groupements/${id('g-1')}/campaigns/${id('c-1')}/savings-session`, admin, {});
  await request(`/groupements/${id('g-2')}/campaigns/${id('c-2')}/savings-session`, other, {});
  const groupPath = `/groupements/${id('g-1')}`;
  const campaignPath = `${groupPath}/campaigns/${id('c-1')}`;
  await measured('recherche_et_pagination_ms', async () => {
    const search = (await request(`${groupPath}/members?q=201&limit=1`, admin)).data;
    assert.equal(search.total, 1);
    assert.equal(search.items[0].name, 'Membre 201');
    const beyond = (await request(`${groupPath}/members?q=201&limit=1&page=2`, admin)).data;
    assert.equal(beyond.total, 1);
    assert.equal(beyond.items.length, 0);
    const history = (await request(`${campaignPath}/contributions?q=201&limit=1`, admin)).data;
    assert.equal(history.total, historyDepth);
    assert.equal(history.items[0].amount, '100');
  });
  verified('recherche_paginee_sur_volume');
  const scoped = (await request(`${campaignPath}/contributions`, member)).data;
  assert.equal(scoped.total, historyDepth);
  assert.equal(scoped.items[0].participation_id, id('p-1-2'));
  await request(`${campaignPath}/contributions`, other, undefined, 404);
  // Direct SQL with runtime role verifies RLS independently from controller guards.
  const restricted = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const c = await restricted.connect();
    try {
      await c.query('BEGIN');
      await c.query("SELECT set_config('app.user_id',$1,true)", [id('other')]);
      const hidden = await c.query(
        'SELECT count(*)::int AS n FROM contributions WHERE group_id=$1',
        [id('g-1')],
      );
      assert.equal(hidden.rows[0].n, 0);
      await c.query('ROLLBACK');
    } finally {
      c.release();
    }
  } finally {
    await restricted.end();
  }
  verified('isolation_RLS_et_portee_membre');
  const payload = {
    participationId: id('p-1-2'),
    amount: 750,
    paidOn: new Date().toISOString().slice(0, 10),
    idempotencyKey: randomUUID(),
  };
  const duplicates = await measured('20_confirmations_meme_cle_ms', () =>
    Promise.all(
      Array.from({ length: 20 }, () => request(`${campaignPath}/contributions`, admin, payload)),
    ),
  );
  assert.equal(new Set(duplicates.map((r) => r.data.id)).size, 1);
  await request(`${campaignPath}/contributions`, admin, { ...payload, amount: 751 }, 409);
  await measured('20_versements_distincts_ms', () =>
    Promise.all(
      Array.from({ length: 20 }, () =>
        request(`${campaignPath}/contributions`, admin, {
          ...payload,
          amount: 100,
          idempotencyKey: randomUUID(),
        }),
      ),
    ),
  );
  const total = await owner.query(
    'SELECT count(*)::int AS n,sum(amount)::text AS total FROM contributions WHERE group_id=$1',
    [id('g-1')],
  );
  assert.deepEqual(total.rows[0], {
    n: members * historyDepth + 21,
    total: String(members * historyDepth * 100 + 750 + 2000),
  });
  const duplicatesInDb = await owner.query(
    'SELECT count(*)::int AS n FROM contributions WHERE group_id=$1 AND idempotency_key=$2',
    [id('g-1'), payload.idempotencyKey],
  );
  assert.equal(duplicatesInDb.rows[0].n, 1);
  report.afterConcurrentWrites = total.rows[0];
  verified('concurrence_idempotence_conflit_et_rapprochement_des_totaux');
  if (loadRounds) {
    const latencies = { read: [], write: [] };
    const errors = [];
    const start = performance.now();
    // Two independently authenticated administrators; existing limits stay enabled.
    const actors = [
      { group: 1, cookie: admin, baselineExtra: 21, baselineAmount: 2750 },
      { group: 2, cookie: other, baselineExtra: 0, baselineAmount: 0 },
    ];
    async function sample(kind, fn) {
      const begin = performance.now();
      try {
        return await fn();
      } catch (error) {
        errors.push(error.message);
        throw error;
      } finally {
        latencies[kind].push(performance.now() - begin);
      }
    }
    for (let round = 0; round < loadRounds; round++) {
      await Promise.all(
        actors.map(async (actor) => {
          const path = `/groupements/${id('g-' + actor.group)}/campaigns/${id('c-' + actor.group)}`;
          await sample('read', () => request(`${path}/contributions?limit=25`, actor.cookie));
          await sample('write', () =>
            request(`${path}/contributions`, actor.cookie, {
              ...payload,
              participationId: id('p-' + actor.group + '-2'),
              amount: 125,
              idempotencyKey: randomUUID(),
            }),
          );
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    function stats(values) {
      const sorted = [...values].sort((a, b) => a - b);
      const percentile = (p) => Math.round(sorted[Math.ceil(sorted.length * p) - 1]);
      return {
        count: values.length,
        p50: percentile(0.5),
        p95: percentile(0.95),
        p99: percentile(0.99),
        max: Math.round(sorted.at(-1)),
      };
    }
    report.mixedLoad = {
      durationMs: Math.round(performance.now() - start),
      errors,
      readMs: stats(latencies.read),
      writeMs: stats(latencies.write),
      groups: actors.length,
    };
    for (const actor of actors) {
      const sums = await owner.query(
        'SELECT count(*)::int AS n,sum(amount)::text AS total FROM contributions WHERE group_id=$1',
        [id('g-' + actor.group)],
      );
      assert.deepEqual(sums.rows[0], {
        n: members * historyDepth + actor.baselineExtra + loadRounds,
        total: String(members * historyDepth * 100 + actor.baselineAmount + loadRounds * 125),
      });
      const dashboard = (
        await request(
          `/groupements/${id('g-' + actor.group)}/campaigns/${id('c-' + actor.group)}/dashboard`,
          actor.cookie,
        )
      ).data;
      assert.equal(String(dashboard.total), sums.rows[0].total);
    }
    assert(report.mixedLoad.readMs.p95 < 2000, 'Seuil exploratoire p95 lectures dépassé (2 s)');
    assert(report.mixedLoad.writeMs.p95 < 2000, 'Seuil exploratoire p95 écritures dépassé (2 s)');
    verified('charge_mixte_deux_groupements_et_totaux_API_SQL');
  }
  // Real PostgreSQL pool, independent connections: no serialized test adapter.
  await measured('auth_concurrence_postgresql_ms', async () => {
    const login = 'race-security',
      uid = randomUUID();
    await owner.query(
      "INSERT INTO app_users(id,login,name,phone,password_hash,secret_code_hash) VALUES($1,$2,$2,'+221779900004',$3,$4)",
      [uid, login, hashPassword(password), hashPassword('2468')],
    );
    const first = await fetch(base + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'AvecLesFemmes' },
      body: JSON.stringify({ login, password }),
    });
    assert.equal(first.status, 201);
    const device = first.headers
      .getSetCookie()
      .find((v) => v.startsWith('alf_device='))
      .split(';')[0];
    const attempt = (code, legacy = false) =>
      fetch(base + (legacy ? '/auth/login/pin' : '/auth/login/secret-code'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'AvecLesFemmes',
          Cookie: device,
        },
        body: JSON.stringify(legacy ? { phone: '+221779900004', pin: code } : { login, code }),
      });
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => attempt('0000', i % 2 === 0)),
    );
    assert(results.every((r) => r.status === 401));
    const row = (
      await owner.query('SELECT failed_attempts,locked_until FROM app_users WHERE id=$1', [uid])
    ).rows[0];
    assert.equal(row.failed_attempts, 5);
    assert(row.locked_until > new Date());
    assert.equal((await attempt('2468')).status, 401);
    report.security = {
      concurrentFailures: 8,
      failuresPersisted: row.failed_attempts,
      locked: true,
      correctCodeAfterFailures: 401,
      database: 'PostgreSQL 18, real pool',
    };
  });
  verified('auth_huit_echecs_concurrents_verrouillage_cinq_postgresql');
  report.status = 'passed';
}
main()
  .catch((error) => {
    report.status = 'failed';
    report.error = error.message;
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (app) await app.close();
    await owner.end();
    await writeFile(`/reports/${reportFile}`, JSON.stringify(report, null, 2) + '\n');
    console.log(`Qualification: ${report.status}`);
  });
