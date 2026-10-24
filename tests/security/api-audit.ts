// Isolated security reproductions. Never connects to the project's PostgreSQL.
// Regression tests: every reproduced exploit must now be refused.
import 'reflect-metadata';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { Test } from '@nestjs/testing';
import request from 'supertest';

process.env.NODE_ENV = 'production';
process.env.SMS_MODE = 'disabled';
process.env.ALLOWED_ORIGINS = 'https://audit.invalid';
const secret = 'Audit-only-original-password-2026';
const code = '8417';
const actors = {
  admin: randomUUID(),
  victim: randomUUID(),
  member: randomUUID(),
  race: randomUUID(),
  device: randomUUID(),
  super: randomUUID(),
};
const groups = { a: randomUUID(), b: randomUUID() };
const victimMembership = randomUUID();
const evidence: Record<string, unknown> = {
  scope: 'PGlite isolated; synthetic identities only; production configuration',
  version: require('../../package.json').version,
};
let app: any, pg: PGlite;
let adminCookie: string, memberCookie: string, superCookie: string;
const deviceCookie = (r: any) =>
  r.headers['set-cookie'].find((v: string) => v.startsWith('alf_device=')).split(';')[0];
const headers = { 'X-Requested-With': 'AvecLesFemmes', 'X-Confirm-Password': secret };
before(async () => {
  const { AppModule } = await import('../../apps/api/dist/app.module.js');
  const { Database } = await import('../../apps/api/dist/database/database.module.js');
  const { configure } = await import('../../apps/api/dist/bootstrap.js');
  const { hashPassword } = await import('../../apps/api/dist/auth/password.js');
  pg = new PGlite();
  await pg.exec('CREATE ROLE aveclesfemmes_app');
  for (const file of (await readdir('database/migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await pg.exec(await readFile(resolve('database/migrations', file), 'utf8'));
  for (const [name, id] of Object.entries(actors))
    await pg.query(
      'INSERT INTO app_users(id,login,name,phone,password_hash,is_super) VALUES($1,$2,$2,$3,$4,$5)',
      [
        id,
        'audit.' + name,
        name === 'victim' ? '+221779900002' : name === 'race' ? '+221779900004' : null,
        hashPassword(secret),
        name === 'super',
      ],
    );
  await pg.query('UPDATE app_users SET secret_code_hash=$1 WHERE id=$2', [
    hashPassword('7914'),
    actors.device,
  ]);
  for (const [name, id] of Object.entries(groups))
    await pg.query(
      "INSERT INTO groupements(id,name,address,responsible,phone) VALUES($1,$2,'Audit','','+221779900000')",
      [id, 'Audit ' + name],
    );
  for (const [id, group, user, role] of [
    [randomUUID(), groups.a, actors.admin, 'ADMIN'],
    [victimMembership, groups.a, actors.victim, 'MEMBER'],
    [randomUUID(), groups.b, actors.victim, 'ADMIN'],
    [randomUUID(), groups.a, actors.member, 'MEMBER'],
  ])
    await pg.query(
      'INSERT INTO memberships(id,group_id,user_id,name,role) VALUES($1,$2,$3,$4,$5)',
      [id, group, user, 'Audit member', role],
    );
  await pg.exec('SET ROLE aveclesfemmes_app');
  let tail = Promise.resolve();
  const queue = <T>(fn: () => Promise<T>) => {
    const next = tail.then(fn);
    tail = next.then(
      () => {},
      () => {},
    );
    return next;
  };
  const db = {
    query: async (sql: string, args: any[]) => {
      const result = await queue(() => pg.query(sql, args));
      return result;
    },
    run: (actor: any, op: any) =>
      queue(async () => {
        await pg.exec('BEGIN');
        try {
          await pg.query("SELECT set_config('app.user_id',$1,true)", [actor.id]);
          const value = await op({ query: (sql: string, args: any[]) => pg.query(sql, args) });
          await pg.exec('COMMIT');
          return value;
        } catch (e) {
          await pg.exec('ROLLBACK');
          throw e;
        }
      }),
    onModuleDestroy: async () => {},
  };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(Database)
    .useValue(db)
    .compile();
  app = module.createNestApplication();
  app
    .getHttpAdapter()
    .getInstance()
    .get('/audit-only-peer', (req: any, res: any) => res.json({ peer: req.ip }));
  configure(app);
  await app.init();
  for (const name of ['admin', 'member', 'super']) {
    const r = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set(headers)
      .send({ login: 'audit.' + name, password: secret })
      .expect(201);
    const cookie = r.headers['set-cookie'][0].split(';')[0];
    if (name === 'admin') {
      adminCookie = cookie;
      evidence.cookieFlags = {
        secure: /; Secure/i.test(r.headers['set-cookie'][0]),
        httpOnly: /; HttpOnly/i.test(r.headers['set-cookie'][0]),
        sameSiteLax: /SameSite=Lax/i.test(r.headers['set-cookie'][0]),
      };
    } else if (name === 'member') memberCookie = cookie;
    else superCookie = cookie;
  }
});
after(async () => {
  if (app) await app.close();
  if (pg) await pg.close();
  await mkdir('docs/audits/securite-2026-10-23/preuves-apres', { recursive: true });
  await writeFile(
    'docs/audits/securite-2026-10-23/preuves-apres/api.json',
    JSON.stringify(evidence, null, 2) + '\n',
  );
});

test('contrôles positifs : authentification, CSRF, confirmation et séparation des groupements', async () => {
  const server = app.getHttpServer();
  await request(server).get('/api/v1/groupements').expect(401);
  await request(server)
    .post('/api/v1/auth/login')
    .send({ login: 'audit.admin', password: secret })
    .expect(403);
  await request(server)
    .post('/api/v1/auth/login')
    .set(headers)
    .set('Origin', 'https://untrusted.invalid')
    .send({ login: 'audit.admin', password: secret })
    .expect(403);
  await request(server)
    .get(`/api/v1/groupements/${groups.b}/members`)
    .set('Cookie', adminCookie)
    .expect(404);
  await request(server)
    .post(`/api/v1/groupements/${groups.a}/members/${victimMembership}/reset-pin`)
    .set('Cookie', adminCookie)
    .set('X-Requested-With', 'AvecLesFemmes')
    .send({})
    .expect(403);
  await request(server)
    .post(`/api/v1/groupements/${groups.a}/members/${victimMembership}/reset-pin`)
    .set('Cookie', memberCookie)
    .set(headers)
    .send({})
    .expect(403);
  evidence.positiveControls = {
    unauthenticated: 401,
    csrfMissing: 403,
    foreignOrigin: 403,
    crossGroup: 404,
    missingConfirmation: 403,
    memberReset: 403,
  };
});

test('SEC-01 : un admin de A ne peut pas réinitialiser les identifiants globaux d’un membre', async () => {
  const server = app.getHttpServer();
  await request(server)
    .post(`/api/v1/groupements/${groups.a}/members/${victimMembership}/reset-pin`)
    .set('Cookie', adminCookie)
    .set(headers)
    .send({})
    .expect(403);
  await request(server)
    .post('/api/v1/auth/login')
    .set(headers)
    .send({ login: 'audit.victim', password: code })
    .expect(401);
  const original = await request(server)
    .post('/api/v1/auth/login')
    .set(headers)
    .send({ login: 'audit.victim', password: secret })
    .expect(201);
  assert.equal(original.body.id, actors.victim);
  await request(server)
    .get(`/api/v1/groupements/${groups.b}/members`)
    .set('Cookie', adminCookie)
    .expect(404);
  evidence['SEC-01'] = {
    adminReset: 403,
    loginWithChosenPinAsPassword: 401,
    originalPassword: 201,
    otherGroupAsAdminA: 404,
  };
});

test('SEC-01 : révocation globale par Super Admin sans remplacement du mot de passe', async () => {
  const server = app.getHttpServer();
  const hashPassword = (await import('../../apps/api/dist/auth/password.js')).hashPassword;
  await pg.query('UPDATE app_users SET secret_code_hash=$1 WHERE id=$2', [
    hashPassword('7319'),
    actors.victim,
  ]);
  const initial = await request(server)
    .post('/api/v1/auth/login')
    .set(headers)
    .send({ login: 'audit.victim', password: secret })
    .expect(201);
  const device = deviceCookie(initial),
    session = initial.headers['set-cookie'][0].split(';')[0];
  const before = (
    await pg.query<{ password_hash: string }>('SELECT password_hash FROM app_users WHERE id=$1', [
      actors.victim,
    ])
  ).rows[0].password_hash;
  await request(server)
    .post(`/api/v1/groupements/${groups.a}/members/${victimMembership}/reset-pin`)
    .set(headers)
    .set('Cookie', superCookie)
    .send({ pin: code })
    .expect(400);
  await request(server)
    .post(`/api/v1/groupements/${groups.a}/members/${victimMembership}/reset-pin`)
    .set(headers)
    .set('Cookie', superCookie)
    .send({})
    .expect(201);
  const after = (
    await pg.query<{ password_hash: string; secret_code_hash: string | null }>(
      'SELECT password_hash,secret_code_hash FROM app_users WHERE id=$1',
      [actors.victim],
    )
  ).rows[0];
  assert.equal(after.password_hash, before);
  assert.equal(after.secret_code_hash, null);
  await request(server).get('/api/v1/auth/me').set('Cookie', session).expect(401);
  await request(server)
    .post('/api/v1/auth/login/secret-code')
    .set(headers)
    .set('Cookie', device)
    .send({ login: 'audit.victim', code: '7319' })
    .expect(403);
  await request(server)
    .post('/api/v1/auth/login')
    .set(headers)
    .send({ login: 'audit.victim', password: secret })
    .expect(201);
  evidence.recovery = {
    originalHashPreserved: true,
    chosenSecretRefused: 400,
    oldSessionRevoked: 401,
    oldDeviceRevoked: 403,
    originalPasswordWorks: 201,
  };
});

test('SEC-02 : essais concurrents sérialisés et verrouillage persistant au cinquième échec', async () => {
  const server = app.getHttpServer();
  await pg.query('UPDATE app_users SET secret_code_hash=$1 WHERE id=$2', [
    (await import('../../apps/api/dist/auth/password.js')).hashPassword('9732'),
    actors.race,
  ]);
  const enrolled = await request(server)
    .post('/api/v1/auth/login')
    .set(headers)
    .send({ login: 'audit.race', password: secret })
    .expect(201);
  const device = deviceCookie(enrolled);
  const results = await Promise.all(
    Array.from({ length: 8 }, () =>
      request(server)
        .post('/api/v1/auth/login/pin')
        .set(headers)
        .set('Cookie', device)
        .send({ phone: '+221779900004', pin: '0000' }),
    ),
  );
  assert.ok(results.every((r) => r.status === 401));
  const row = (
    await pg.query<{ failed_attempts: number; locked_until: string | null }>(
      'SELECT failed_attempts,locked_until FROM app_users WHERE id=$1',
      [actors.race],
    )
  ).rows[0];
  assert.equal(row.failed_attempts, 5);
  assert.ok(row.locked_until);
  await request(server)
    .post('/api/v1/auth/login/pin')
    .set(headers)
    .set('Cookie', device)
    .send({ phone: '+221779900004', pin: '9732' })
    .expect(401);
  evidence['SEC-02'] = {
    concurrentFailures: 8,
    statuses: results.map((r) => r.status),
    persistedAttempts: row.failed_attempts,
    locked: true,
    correctPinAfterEightFailures: 401,
  };
});

test('SEC-03 : proxy borné, IP séparées et quotas indépendants par compte', async () => {
  const express = app.getHttpAdapter().getInstance();
  const trusted = express.get('trust proxy');
  assert.equal(trusted('127.0.0.1', 0), true);
  assert.equal(trusted('198.51.100.22', 0), false);
  assert.equal(trusted('127.0.0.1', 1), false);
  const first = await request(app.getHttpServer())
    .get('/audit-only-peer')
    .set('X-Forwarded-For', '192.0.2.99, 198.51.100.10')
    .expect(200);
  const second = await request(app.getHttpServer())
    .get('/audit-only-peer')
    .set('X-Forwarded-For', '203.0.113.10')
    .expect(200);
  assert.equal(first.body.peer, '198.51.100.10');
  assert.notEqual(first.body.peer, second.body.peer);
  const limiter = app.config
    .getGlobalGuards()
    .find((g: any) => g.constructor.name === 'AccountThrottlerGuard');
  assert.ok(limiter);
  const a = await limiter.getTracker({
    cookies: { alf_session: adminCookie.split('=')[1] },
    ip: '10.0.0.1',
  });
  const b = await limiter.getTracker({
    cookies: { alf_session: memberCookie.split('=')[1] },
    ip: '10.0.0.1',
  });
  assert.notEqual(a, b);
  evidence['SEC-03'] = {
    privateFirstHopOnly: true,
    forgedLeftmostIgnored: true,
    clientAddressesSeparated: true,
    authenticatedAccountQuotasSeparated: true,
  };
});

test('production : identifiants de démonstration non publiés et session périmée non réactivable', async () => {
  const server = app.getHttpServer();
  const demo = await request(server).get('/api/v1/auth/demo').expect(200);
  assert.equal(demo.body.isDemo, false);
  assert.equal(demo.body.demoPassword, null);
  await pg.query(
    "UPDATE sessions SET last_activity_at=now()-interval '6 minutes' WHERE user_id=$1",
    [actors.member],
  );
  await request(server).get('/api/v1/auth/me').set('Cookie', memberCookie).expect(401);
  await request(server)
    .post('/api/v1/auth/activity')
    .set('Cookie', memberCookie)
    .set(headers)
    .expect(401);
  evidence.productionControls = {
    demoCredentialsHidden: true,
    expiredSessionMe: 401,
    expiredSessionHeartbeat: 401,
  };
});

test('contrôle positif : les confirmations refusées traversent le limiteur avant la cryptographie', async () => {
  const guards = app.config.getGlobalGuards();
  const limiter = guards.find((g: any) => g.constructor.name === 'AccountThrottlerGuard');
  assert.ok(limiter);
  const original = limiter.canActivate;
  let calls = 0;
  limiter.canActivate = function (ctx: any) {
    calls++;
    return original.call(this, ctx);
  };
  try {
    await request(app.getHttpServer())
      .put(`/api/v1/groupements/${groups.a}/appearance`)
      .set('Cookie', adminCookie)
      .set('X-Requested-With', 'AvecLesFemmes')
      .set('X-Confirm-Password', 'wrong-audit-confirmation')
      .send({ primary: '#155d50', savings: '#197647', tontine: '#6d3fc0', solidarity: '#a85d12' })
      .expect(403);
    assert.equal(calls, 1);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', adminCookie)
      .expect(200);
    assert.equal(calls, 2);
    evidence.throttleOrderControl = {
      guardOrder: guards.map((g: any) => g.constructor.name),
      limiterCallsForRejectedConfirmation: 1,
      additionalLimiterCallsForSuccessfulRead: 1,
      loadTestPerformed: false,
    };
  } finally {
    limiter.canActivate = original;
  }
});

// Legacy password/device endpoints only. ADR 025 deliberately adds first-device
// phone + existing PIN authentication; its role, lockout and vault checks are in integration.test.ts.
test('SEC-06 historique : un PIN ne peut pas servir de mot de passe initial', async () => {
  const server = app.getHttpServer();
  await request(server)
    .post('/api/v1/auth/login')
    .set(headers)
    .send({ login: 'audit.device', password: '7914' })
    .expect(401);
  await request(server)
    .post(`/api/v1/groupements/${groups.a}/members`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send({ name: 'Compte court interdit', pin: '2468' })
    .expect(400);
  await request(server)
    .post(`/api/v1/groupements/${groups.a}/members`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send({ name: 'Mot de passe court interdit', password: '2468' })
    .expect(400);
  evidence.shortCredentials = {
    codeAsPassword: 401,
    creationWithPinOnly: 400,
    creationWithShortPassword: 400,
  };
});

test('SEC-06 historique : route secret-code liée à l’appareil, portée et révocation', async () => {
  const server = app.getHttpServer();
  const loginCode = () =>
    request(server).post('/api/v1/auth/login/secret-code').set('X-Requested-With', 'AvecLesFemmes');
  await loginCode().send({ login: 'audit.device', code: '7914' }).expect(403);
  const initial = await request(server)
    .post('/api/v1/auth/login')
    .set(headers)
    .send({ login: 'audit.device', password: secret })
    .expect(201);
  const device = deviceCookie(initial);
  const flags = initial.headers['set-cookie'].find((s: string) => s.startsWith('alf_device='));
  assert.match(flags, /HttpOnly/);
  assert.match(flags, /Secure/);
  assert.match(flags, /SameSite=Strict/);
  assert.match(initial.headers['x-alf-vault-key'], /^[a-f0-9]{64}$/);
  const accepted = await loginCode()
    .set('Cookie', device)
    .send({ login: 'audit.device', code: '7914' })
    .expect(201);
  assert.equal(accepted.body.id, actors.device);
  assert.equal(accepted.headers['x-alf-vault-key'], initial.headers['x-alf-vault-key']);
  assert.equal(accepted.body.vaultSecret, undefined);
  await loginCode().set('Cookie', device).send({ login: 'audit.victim', code: '7914' }).expect(403);
  await request(server)
    .post('/api/v1/auth/forget-device')
    .set(headers)
    .set('Cookie', device)
    .send({})
    .expect(400);
  for (const name of ['member', 'admin'])
    await request(server)
      .post('/api/v1/auth/forget-device')
      .set(headers)
      .set('Cookie', device)
      .send({ login: 'audit.' + name, password: secret })
      .expect(403);
  await request(server)
    .post('/api/v1/auth/forget-device')
    .set(headers)
    .set('Cookie', device)
    .send({ login: 'audit.super', password: 'Incorrect-password-for-assistance' })
    .expect(401);
  await request(server)
    .post('/api/v1/auth/forget-device')
    .set(headers)
    .set('Cookie', device)
    .send({ login: 'audit.super', password: secret })
    .expect(201);
  await loginCode().set('Cookie', device).send({ login: 'audit.device', code: '7914' }).expect(403);
  evidence['SEC-06'] = {
    newClientCodeOnly: 403,
    validatedDevice: 201,
    crossAccountProof: 403,
    revokedDevice: 403,
    deviceCookieHttpOnlySecureStrict: true,
    vaultKeyInActor: false,
    deviceAdministration: 'Super Admin credentials for this action only, no admin session created',
  };
});
