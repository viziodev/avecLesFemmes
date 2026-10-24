import { before, after, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { digest, hashPassword } from '../src/auth/password';
process.env.SMS_MODE = 'development';
process.env.OTP_SECRET = 'test-only-otp-secret-with-at-least-32-characters';
let app: any, pg: PGlite;
let superCookie: string, adminCookie: string, memberCookie: string, otherCookie: string;
let g: string,
  otherGroup: string,
  camp: string,
  part: string,
  memberPart: string,
  adminId: string,
  memberId: string,
  contribution: string;
const testPassword = 'Test-only-password-2026';
const headers = { 'X-Requested-With': 'AvecLesFemmes', 'X-Confirm-Password': testPassword };
before(async () => {
  const { AppModule } = await import('../dist/app.module.js');
  const { Database } = await import('../dist/database/database.module.js');
  const { configure } = await import('../dist/bootstrap.js');
  const { hashPassword } = await import('../dist/auth/password.js');
  pg = new PGlite();
  await pg.exec('CREATE ROLE aveclesfemmes_app;');
  await pg.exec(await readFile(resolve('../../database/migrations/001_initial.sql'), 'utf8'));
  await pg.exec(
    await readFile(resolve('../../database/migrations/002_fonctions_tontines_qr.sql'), 'utf8'),
  );
  await pg.exec(
    await readFile(resolve('../../database/migrations/003_group_types_assignment.sql'), 'utf8'),
  );
  await pg.exec(
    await readFile(resolve('../../database/migrations/004_types_crud_permissions.sql'), 'utf8'),
  );
  await pg.exec(
    await readFile(resolve('../../database/migrations/005_groupements_archive_status.sql'), 'utf8'),
  );
  await pg.exec(
    await readFile(resolve('../../database/migrations/006_savings_sessions.sql'), 'utf8'),
  );
  await pg.exec(
    await readFile(resolve('../../database/migrations/007_tontine_round_draw.sql'), 'utf8'),
  );
  await pg.exec(
    await readFile(resolve('../../database/migrations/008_campaign_shortcuts.sql'), 'utf8'),
  );
  await pg.exec(
    await readFile(resolve('../../database/migrations/009_member_payments.sql'), 'utf8'),
  );
  await pg.exec(
    await readFile(resolve('../../database/migrations/010_member_shortcuts.sql'), 'utf8'),
  );
  await pg.exec(
    await readFile(resolve('../../database/migrations/011_platform_appearance.sql'), 'utf8'),
  );
  await pg.exec(
    await readFile(
      resolve('../../database/migrations/012_group_appearance_session_activity.sql'),
      'utf8',
    ),
  );
  await pg.exec(await readFile(resolve('../../database/migrations/013_secret_code.sql'), 'utf8'));
  await pg.exec(
    await readFile(resolve('../../database/migrations/014_charter_default_palette.sql'), 'utf8'),
  );
  await pg.exec(
    await readFile(resolve('../../database/migrations/015_trusted_devices.sql'), 'utf8'),
  );
  await pg.exec(
    await readFile(resolve('../../database/migrations/016_revoke_legacy_pwa_sessions.sql'), 'utf8'),
  );
  await pg.exec(
    await readFile(resolve('../../database/migrations/017_monthly_weekday.sql'), 'utf8'),
  );
  mock.method(require('../dist/common/savings-schedule.js'), 'savingsToday', () => '2026-06-02');
  const users = ['super', 'admin', 'member', 'other'].map((login, i) => ({
    id: randomUUID(),
    login,
    phone: `+22177000001${i}`,
  }));
  for (const u of users)
    await pg.query(
      'INSERT INTO app_users(id,login,name,phone,password_hash,is_super) VALUES($1,$2,$2,$3,$4,$5)',
      [u.id, u.login, u.phone, hashPassword(testPassword), u.login === 'super'],
    );
  g = randomUUID();
  otherGroup = randomUUID();
  for (const id of [g, otherGroup])
    await pg.query(
      "INSERT INTO groupements(id,name,address,responsible,phone) VALUES($1,'Groupement test','Dakar','Responsable','+221770000010')",
      [id],
    );
  adminId = randomUUID();
  memberId = randomUUID();
  for (const [idx, uid, role, group] of [
    [adminId, users[1].id, 'ADMIN', g],
    [memberId, users[2].id, 'MEMBER', g],
    [randomUUID(), users[3].id, 'ADMIN', otherGroup],
  ])
    await pg.query(
      'INSERT INTO memberships(id,group_id,user_id,name,role) VALUES($1,$2,$3,$4,$5)',
      [idx, group, uid, role, role],
    );
  const type = randomUUID();
  camp = randomUUID();
  await pg.query("INSERT INTO campaign_types(id,name,code) VALUES($1,'Avec','AVEC')", [type]);
  await pg.query(
    "INSERT INTO campaigns(id,group_id,type_id,name,start_date,end_date,weekday,rule_version) VALUES($1,$2,$3,'Test','2026-01-01','2026-12-31',2,1)",
    [camp, g, type],
  );
  await pg.query(
    'INSERT INTO savings_sessions(id,group_id,campaign_id,session_date,created_by) VALUES($1,$2,$3,$4,$5)',
    [randomUUID(), g, camp, '2026-06-02', users[1].id],
  );
  part = randomUUID();
  memberPart = randomUUID();
  for (const [id, m] of [
    [part, adminId],
    [memberPart, memberId],
  ])
    await pg.query(
      'INSERT INTO participations(id,group_id,campaign_id,membership_id) VALUES($1,$2,$3,$4)',
      [id, g, camp, m],
    );
  await pg.exec('SET ROLE aveclesfemmes_app');
  let tail = Promise.resolve();
  const queue = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = tail.then(fn);
    tail = next.then(
      () => {},
      () => {},
    );
    return next;
  };
  const db = {
    query: (sql: string, args: any[]) => queue(() => pg.query(sql, args)),
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
  const mod = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(Database)
    .useValue(db)
    .compile();
  app = mod.createNestApplication();
  configure(app);
  await app.init();
  const cookies = [];
  for (const u of users) {
    const r = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set(headers)
      .send({ login: u.login, password: testPassword })
      .expect(201);
    cookies.push(r.headers['set-cookie'][0]);
  }
  [superCookie, adminCookie, memberCookie, otherCookie] = cookies;
});
after(async () => {
  await app?.close();
  await pg?.close();
});
const path = () => `/api/v1/groupements/${g}/campaigns/${camp}`;
test('palette groupement : responsable uniquement, isolation et héritage de la plateforme', async () => {
  const url = `/api/v1/groupements/${g}/appearance`;
  const global = await request(app.getHttpServer()).get('/api/v1/appearance').expect(200);
  const initial = await request(app.getHttpServer())
    .get(url)
    .set('Cookie', memberCookie)
    .expect(200);
  assert.deepEqual(initial.body, global.body);
  const custom = { ...global.body, primary: '#0044cc' };
  await request(app.getHttpServer())
    .put(url)
    .set(headers)
    .set('Cookie', memberCookie)
    .send(custom)
    .expect(403);
  await request(app.getHttpServer())
    .put(url)
    .set(headers)
    .set('Cookie', otherCookie)
    .send(custom)
    .expect(404);
  await request(app.getHttpServer()).get(url).set('Cookie', otherCookie).expect(404);
  await request(app.getHttpServer())
    .put(url)
    .set(headers)
    .set('Cookie', adminCookie)
    .send(custom)
    .expect(200);
  assert.deepEqual(
    (await request(app.getHttpServer()).get(url).set('Cookie', memberCookie)).body,
    custom,
  );
  assert.deepEqual(
    (await request(app.getHttpServer()).get('/api/v1/appearance')).body,
    global.body,
  );
  await request(app.getHttpServer())
    .delete(url)
    .set(headers)
    .set('Cookie', adminCookie)
    .expect(200);
  assert.deepEqual(
    (await request(app.getHttpServer()).get(url).set('Cookie', memberCookie)).body,
    global.body,
  );
});
test('opération sensible protégée côté serveur, y compris sans l’interface PWA', async () => {
  const url = `/api/v1/groupements/${g}/appearance`;
  const palette = (await request(app.getHttpServer()).get('/api/v1/appearance')).body;
  for (const secret of [undefined, 'incorrect']) {
    const req = request(app.getHttpServer())
      .put(url)
      .set('X-Requested-With', 'AvecLesFemmes')
      .set('Cookie', adminCookie);
    if (secret) req.set('X-Confirm-Password', secret);
    await req.send(palette).expect(403);
  }
  await request(app.getHttpServer())
    .put(url)
    .set(headers)
    .set('Cookie', adminCookie)
    .send(palette)
    .expect(200);
  await request(app.getHttpServer())
    .delete(url)
    .set(headers)
    .set('Cookie', adminCookie)
    .expect(200);
});
test('cinq minutes d’inactivité côté serveur, les lectures automatiques ne prolongent pas la session', async () => {
  const login = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set(headers)
    .send({ login: 'admin', password: testPassword })
    .expect(201);
  const cookie = login.headers['set-cookie'][0];
  await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', cookie).expect(200);
  const { digest } = await import('../dist/auth/password.js');
  const token = decodeURIComponent(cookie.split(';')[0].split('=')[1]);
  await pg.query(
    "UPDATE sessions SET last_activity_at=now()-interval '4 minutes' WHERE token_hash=$1",
    [digest(token)],
  );
  await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', cookie).expect(200);
  const before = await pg.query('SELECT last_activity_at FROM sessions WHERE token_hash=$1', [
    digest(token),
  ]);
  await request(app.getHttpServer()).get(`/api/v1/groupements`).set('Cookie', cookie).expect(200);
  const after = await pg.query('SELECT last_activity_at FROM sessions WHERE token_hash=$1', [
    digest(token),
  ]);
  assert.equal(String(before.rows[0].last_activity_at), String(after.rows[0].last_activity_at));
  await request(app.getHttpServer())
    .post('/api/v1/auth/activity')
    .set(headers)
    .set('Cookie', cookie)
    .expect(201);
  await pg.query(
    "UPDATE sessions SET last_activity_at=now()-interval '6 minutes' WHERE token_hash=$1",
    [digest(token)],
  );
  await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', cookie).expect(401);
  await request(app.getHttpServer())
    .post('/api/v1/auth/activity')
    .set(headers)
    .set('Cookie', cookie)
    .expect(401);
  await request(app.getHttpServer())
    .post('/api/v1/auth/logout')
    .set(headers)
    .set('Cookie', cookie)
    .expect(201);
});
test('verrouillage serveur lié au compte de la visite et refus d’une autre identité', async () => {
  const login = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set(headers)
    .send({ login: 'admin', password: testPassword })
    .expect(201);
  const cookie = login.headers['set-cookie'][0];
  await request(app.getHttpServer())
    .get('/api/v1/auth/me')
    .set('Cookie', cookie)
    .set('X-PWA-Actor', 'another-account')
    .expect(401);
  await request(app.getHttpServer())
    .post('/api/v1/auth/lock')
    .set(headers)
    .set('Cookie', cookie)
    .set('X-PWA-Actor', 'another-account')
    .expect(201);
  await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', cookie).expect(200);
  await request(app.getHttpServer())
    .post('/api/v1/auth/lock')
    .set(headers)
    .set('Cookie', cookie)
    .set('X-PWA-Actor', login.body.id)
    .expect(201);
  await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', cookie).expect(401);
});
test('un versement personnel hors ligne ne change jamais de date à la synchronisation', async () => {
  const response = await request(app.getHttpServer())
    .post(path() + '/contributions/self')
    .set(headers)
    .set('Cookie', memberCookie)
    .send({ amount: 1000, idempotencyKey: randomUUID(), paidOn: '2026-06-01' })
    .expect(400);
  assert.match(response.body.message, /date.*passée/i);
});
test('palette publique sans données personnelles, modification réservée au super admin et auditée', async () => {
  const original = await request(app.getHttpServer()).get('/api/v1/appearance').expect(200);
  assert.deepEqual(Object.keys(original.body).sort(), [
    'primary',
    'savings',
    'solidarity',
    'tontine',
  ]);
  const palette = {
    primary: '#FFFF00',
    savings: '#008899',
    tontine: '#cc3344',
    solidarity: '#ffaa22',
  };
  await request(app.getHttpServer())
    .put('/api/v1/appearance')
    .set(headers)
    .send(palette)
    .expect(401);
  for (const cookie of [adminCookie, memberCookie])
    await request(app.getHttpServer())
      .put('/api/v1/appearance')
      .set(headers)
      .set('Cookie', cookie)
      .send(palette)
      .expect(403);
  await request(app.getHttpServer())
    .put('/api/v1/appearance')
    .set('Cookie', superCookie)
    .send(palette)
    .expect(403);
  for (const invalid of [
    { ...palette, primary: 'red' },
    { ...palette, savings: '#fff' },
    { ...palette, tontine: 'url(https://invalid)' },
    { primary: '#123456' },
    { ...palette, extra: true },
  ])
    await request(app.getHttpServer())
      .put('/api/v1/appearance')
      .set(headers)
      .set('Cookie', superCookie)
      .send(invalid)
      .expect(400);
  await request(app.getHttpServer())
    .put('/api/v1/appearance')
    .set(headers)
    .set('Cookie', superCookie)
    .send(palette)
    .expect(200);
  const saved = await request(app.getHttpServer()).get('/api/v1/appearance').expect(200);
  assert.deepEqual(saved.body, { ...palette, primary: '#ffff00' });
  await pg.exec('BEGIN');
  try {
    const user = await pg.query<{ id: string }>("SELECT id FROM app_users WHERE login='member'");
    await pg.query("SELECT set_config('app.user_id',$1,true)", [user.rows[0].id]);
    const denied = await pg.query(
      "UPDATE platform_appearance SET primary_color='#123456' RETURNING id",
    );
    assert.equal(denied.rows.length, 0, 'RLS refuse aussi une écriture directe du membre');
    const superUser = await pg.query<{ id: string }>(
      "SELECT id FROM app_users WHERE login='super'",
    );
    await pg.query("SELECT set_config('app.user_id',$1,true)", [superUser.rows[0].id]);
    const audited = await pg.query(
      "SELECT payload FROM audit_events WHERE action='APPEARANCE_UPDATED'",
    );
    assert.deepEqual(audited.rows.at(-1)?.payload, saved.body);
  } finally {
    await pg.exec('ROLLBACK');
  }
  await request(app.getHttpServer())
    .put('/api/v1/appearance')
    .set(headers)
    .set('Cookie', superCookie)
    .send(original.body)
    .expect(200);
});
test('authentification obligatoire et CSRF contrôlé', async () => {
  await request(app.getHttpServer()).get('/api/v1/groupements').expect(401);
  await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ login: 'super', password: testPassword })
    .expect(403);
  await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set(headers)
    .set('Origin', 'https://attacker.invalid')
    .send({ login: 'super', password: testPassword })
    .expect(403);
});
test('isolation RLS entre groupements et contexte de transaction', async () => {
  const r = await request(app.getHttpServer())
    .get('/api/v1/groupements')
    .set('Cookie', otherCookie)
    .expect(200);
  assert.equal(r.body.total, 1);
  assert.equal(r.body.items[0].id, otherGroup);
  await request(app.getHttpServer())
    .get(path() + '/dashboard')
    .set('Cookie', otherCookie)
    .expect(404);
  const direct = await pg.query('SELECT * FROM campaigns');
  assert.equal(direct.rows.length, 0);
});
test('droits super administrateur en consultation sauf activation', async () => {
  await request(app.getHttpServer())
    .post(path() + '/contributions')
    .set(headers)
    .set('Cookie', superCookie)
    .send({
      participationId: part,
      amount: 2000,
      paidOn: '2026-06-02',
      idempotencyKey: randomUUID(),
    })
    .expect(403);
  await request(app.getHttpServer())
    .get(path() + '/dashboard')
    .set('Cookie', superCookie)
    .expect(200);
  await request(app.getHttpServer())
    .post('/api/v1/groupements')
    .set(headers)
    .set('Cookie', superCookie)
    .send({
      name: 'Nouveau groupement',
      address: 'Dakar',
      phone: '+221770000099',
    })
    .expect(201);
});
test('les membres ne créent pas de campagne et ne voient pas la liste complète des membres', async () => {
  await request(app.getHttpServer())
    .post('/api/v1/groupements')
    .set(headers)
    .set('Cookie', memberCookie)
    .send({ name: 'Refus', address: 'Dakar', responsible: 'Awa', phone: '+221770000001' })
    .expect(403);
  const members = await request(app.getHttpServer())
    .get(`/api/v1/groupements/${g}/members`)
    .set('Cookie', memberCookie)
    .expect(200);
  assert.equal(members.body.total, 1);
});
test('rôle administrateur attribué uniquement par super administrateur', async () => {
  await request(app.getHttpServer())
    .post(`/api/v1/groupements/${g}/members`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send({ name: 'Nouvelle', login: 'nouvelle', password: testPassword, admin: true })
    .expect(403);
});
test('cotisation idempotente et détection de contenu différent', async () => {
  const key = randomUUID(),
    payload = { participationId: part, amount: 2000, paidOn: '2026-06-02', idempotencyKey: key };
  const a = await request(app.getHttpServer())
    .post(path() + '/contributions')
    .set(headers)
    .set('Cookie', adminCookie)
    .send(payload)
    .expect(201);
  contribution = a.body.id;
  const b = await request(app.getHttpServer())
    .post(path() + '/contributions')
    .set(headers)
    .set('Cookie', adminCookie)
    .send(payload)
    .expect(201);
  assert.equal(a.body.id, b.body.id);
  assert.ok(!Number.isNaN(Date.parse(a.body.created_at)));
  assert.equal(a.body.created_at, b.body.created_at);
  await request(app.getHttpServer())
    .post(path() + '/contributions')
    .set(headers)
    .set('Cookie', adminCookie)
    .send({ ...payload, amount: 3000 })
    .expect(409);
  const d = await request(app.getHttpServer())
    .get(path() + '/dashboard')
    .set('Cookie', adminCookie)
    .expect(200);
  assert.equal(d.body.total, '2000');
  assert.equal(d.body.payments, '1');
});
test('versement libre et confidentialité de la vue membre', async () => {
  await request(app.getHttpServer())
    .post(path() + '/contributions')
    .set(headers)
    .set('Cookie', adminCookie)
    .send({
      participationId: memberPart,
      amount: 3500,
      paidOn: '2026-06-02',
      idempotencyKey: randomUUID(),
    })
    .expect(201);
  const d = await request(app.getHttpServer())
    .get(path() + '/dashboard')
    .set('Cookie', memberCookie)
    .expect(200);
  assert.equal(d.body.total, '3500');
  assert.equal(d.body.personal, true);
  const list = await request(app.getHttpServer())
    .get(path() + '/contributions')
    .set('Cookie', memberCookie)
    .expect(200);
  assert.equal(list.body.items.length, 1);
  assert.equal(list.body.items[0].participation_id, memberPart);
});
test('contrôles montants, dates et pagination', async () => {
  for (const payload of [
    { amount: 0, paidOn: '2026-06-02' },
    { amount: 1.5, paidOn: '2026-06-02' },
    { amount: 100, paidOn: '2026-02-30' },
    { amount: 100, paidOn: '2025-01-01' },
  ])
    await request(app.getHttpServer())
      .post(path() + '/contributions')
      .set(headers)
      .set('Cookie', adminCookie)
      .send({ ...payload, participationId: part, idempotencyKey: randomUUID() })
      .expect(400);
  await request(app.getHttpServer())
    .get('/api/v1/groupements?limit=1000')
    .set('Cookie', superCookie)
    .expect(400);
});
test('une administratrice conserve une vue de sa propre épargne', async () => {
  const d = await request(app.getHttpServer())
    .get(path() + '/dashboard?scope=personal')
    .set('Cookie', adminCookie)
    .expect(200);
  assert.equal(d.body.personal, true);
  assert.equal(d.body.total, '2000');
  const c = await request(app.getHttpServer())
    .get(path() + '/contributions?scope=personal')
    .set('Cookie', adminCookie)
    .expect(200);
  assert.equal(c.body.total, 1);
  assert.equal(c.body.items[0].participation_id, part);
});
test('désactivation bloque la saisie et reste consultable', async () => {
  await request(app.getHttpServer())
    .patch(path() + '/activation')
    .set(headers)
    .set('Cookie', adminCookie)
    .send({ active: false })
    .expect(403);
  await request(app.getHttpServer())
    .patch(path() + '/activation')
    .set(headers)
    .set('Cookie', superCookie)
    .send({ active: false })
    .expect(200);
  await request(app.getHttpServer())
    .post(path() + '/contributions')
    .set(headers)
    .set('Cookie', adminCookie)
    .send({
      participationId: part,
      amount: 100,
      paidOn: '2026-06-02',
      idempotencyKey: randomUUID(),
    })
    .expect(400);
  await request(app.getHttpServer())
    .get(path() + '/dashboard')
    .set('Cookie', memberCookie)
    .expect(200);
  await request(app.getHttpServer())
    .patch(path() + '/activation')
    .set(headers)
    .set('Cookie', superCookie)
    .send({ active: true })
    .expect(200);
});
test('annulation conserve la cotisation et corrige les totaux', async () => {
  await request(app.getHttpServer())
    .post(path() + `/contributions/${contribution}/void`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send({ reason: 'Erreur de montant' })
    .expect(201);
  const d = await request(app.getHttpServer())
    .get(path() + '/dashboard')
    .set('Cookie', adminCookie)
    .expect(200);
  assert.equal(d.body.total, '3500');
  const rows = await request(app.getHttpServer())
    .get(path() + '/contributions')
    .set('Cookie', adminCookie)
    .expect(200);
  assert.equal(rows.body.total, 2);
  assert.ok(rows.body.items.find((c: any) => c.id === contribution).voided_at);
});
test('OTP à usage unique, nombre de tentatives limité', async () => {
  const r = await request(app.getHttpServer())
    .post('/api/v1/auth/otp/request')
    .set(headers)
    .send({ phone: '+221770000012' })
    .expect(201);
  assert.match(r.body.developmentCode, /^\d{6}$/);
  await request(app.getHttpServer())
    .post('/api/v1/auth/otp/verify')
    .set(headers)
    .send({ phone: '+221770000012', code: r.body.developmentCode })
    .expect(201);
  await request(app.getHttpServer())
    .post('/api/v1/auth/otp/verify')
    .set(headers)
    .send({ phone: '+221770000012', code: r.body.developmentCode })
    .expect(401);
  const second = await request(app.getHttpServer())
    .post('/api/v1/auth/otp/request')
    .set(headers)
    .send({ phone: '+221770000013' })
    .expect(201);
  for (let i = 0; i < 5; i++)
    await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .set(headers)
      .send({ phone: '+221770000013', code: '000000' })
      .expect(401);
  await request(app.getHttpServer())
    .post('/api/v1/auth/otp/verify')
    .set(headers)
    .send({ phone: '+221770000013', code: second.body.developmentCode })
    .expect(401);
});
test('déconnexion invalide la session', async () => {
  await request(app.getHttpServer())
    .post('/api/v1/auth/logout')
    .set(headers)
    .set('Cookie', otherCookie)
    .expect(201);
  await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', otherCookie).expect(401);
});

test('authentification PIN historique : appareil enrôlé requis et verrouillage anti-bruteforce', async () => {
  const id = randomUUID(),
    login = 'pin.' + randomUUID().slice(0, 8),
    phone = '+221771234567';
  await pg.query(
    'INSERT INTO app_users(id,login,name,phone,password_hash,secret_code_hash) VALUES($1,$2,$2,$3,$4,$5)',
    [id, login, phone, hashPassword(testPassword), hashPassword('2468')],
  );
  const server = app.getHttpServer();
  await request(server)
    .post('/api/v1/auth/login/pin')
    .set(headers)
    .send({ phone, pin: '2468' })
    .expect(403);
  const first = await request(server)
    .post('/api/v1/auth/login')
    .set(headers)
    .send({ login, password: testPassword })
    .expect(201);
  const device = first.headers['set-cookie']
    .find((v: string) => v.startsWith('alf_device='))
    .split(';')[0];
  await request(server)
    .post('/api/v1/auth/login/pin')
    .set(headers)
    .set('Cookie', device)
    .send({ phone, pin: '2468' })
    .expect(201);
  for (let i = 0; i < 5; i++)
    await request(server)
      .post('/api/v1/auth/login/pin')
      .set(headers)
      .set('Cookie', device)
      .send({ phone, pin: '0000' })
      .expect(401);
  await request(server)
    .post('/api/v1/auth/login/pin')
    .set(headers)
    .set('Cookie', device)
    .send({ phone, pin: '2468' })
    .expect(401);
});

test('gestion membre : adresse, sexe, fonction, blocage et déblocage', async () => {
  // 1. Consultation des fonctions
  const fns = await request(app.getHttpServer())
    .get('/api/v1/group-functions')
    .set('Cookie', adminCookie)
    .expect(200);
  assert.ok(fns.body.length >= 4);

  // 2. Création membre avec adresse, sexe, fonction
  const created = await request(app.getHttpServer())
    .post(`/api/v1/groupements/${g}/members`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send({
      name: 'Fatou Sow',
      phone: '+221770000055',
      address: 'Grand Yoff, Villa 42',
      gender: 'F',
      functionId: fns.body[0].id,
      password: testPassword,
    })
    .expect(201);
  assert.equal(created.body.name, 'Fatou Sow');
  assert.equal(created.body.is_blocked, false);

  // 3. Blocage du membre
  await request(app.getHttpServer())
    .patch(`/api/v1/groupements/${g}/members/${created.body.id}/block`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send({ blocked: true })
    .expect(200);

  // 4. Inscription à la campagne refusée car bloquée
  await request(app.getHttpServer())
    .post(`/api/v1/groupements/${g}/campaigns/${camp}/participants`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send({ membershipId: created.body.id })
    .expect(403);

  // 5. Déblocage du membre
  await request(app.getHttpServer())
    .patch(`/api/v1/groupements/${g}/members/${created.body.id}/block`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send({ blocked: false })
    .expect(200);

  // Inscription réussit maintenant
  const partOk = await request(app.getHttpServer())
    .post(`/api/v1/groupements/${g}/campaigns/${camp}/participants`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send({ membershipId: created.body.id, isRandom: true })
    .expect(201);

  // Cotisation réussit
  await request(app.getHttpServer())
    .post(`/api/v1/groupements/${g}/campaigns/${camp}/contributions`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send({
      participationId: partOk.body.id,
      amount: 5000,
      paidOn: '2026-06-02',
      idempotencyKey: randomUUID(),
    })
    .expect(201);
});

test('tontine rotative, tirage au sort, séances et état de la caisse', async (t) => {
  const clock = mock.method(
    require('../dist/common/savings-schedule.js'),
    'savingsToday',
    () => '2026-01-01',
  );
  t.after(() => clock.mock.restore());
  // Créer une campagne tontine
  const types = await request(app.getHttpServer())
    .get('/api/v1/campaign-types')
    .set('Cookie', adminCookie)
    .expect(200);
  const tontineType = types.body.find((t: any) => t.code === 'TONTINE') || types.body[0];

  const tontineCamp = await request(app.getHttpServer())
    .post(`/api/v1/groupements/${g}/campaigns`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send({
      name: 'Tontine Mensuelle Solidarité',
      typeId: tontineType.id,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      weekday: 3,
      intervalWeeks: 4,
      standardAmount: 10000,
      rotationInterval: 'MONTHLY',
      dueDay: 5,
    })
    .expect(201);

  // Inscrire 2 participantes
  await request(app.getHttpServer())
    .post(`/api/v1/groupements/${g}/campaigns/${tontineCamp.body.id}/participants`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send({ membershipId: adminId })
    .expect(201);

  await request(app.getHttpServer())
    .post(`/api/v1/groupements/${g}/campaigns/${tontineCamp.body.id}/participants`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send({ membershipId: memberId })
    .expect(201);

  // Tirage au sort de la tontine
  const rounds = await request(app.getHttpServer())
    .post(`/api/v1/groupements/${g}/campaigns/${tontineCamp.body.id}/tontine/draw`)
    .set(headers)
    .set('Cookie', adminCookie)
    .expect(201);
  assert.equal(rounds.body.length, 1);
  assert.equal(rounds.body[0].payout_amount, '20000');

  // Marquer le tour 1 comme versé
  await request(app.getHttpServer())
    .patch(`/api/v1/groupements/${g}/campaigns/${tontineCamp.body.id}/tontine/rounds/1/pay`)
    .set(headers)
    .set('Cookie', adminCookie)
    .expect(200);

  const graceMemberId = [adminId, memberId].find((id) => id !== rounds.body[0].beneficiary_id)!;
  // Délai de grâce individuel
  const grace = await request(app.getHttpServer())
    .post(`/api/v1/groupements/${g}/campaigns/${tontineCamp.body.id}/grace-periods`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send({
      membershipId: graceMemberId,
      periodDate: '2026-01-01',
      extendedDeadline: '2026-01-15',
      reason: 'Déplacement familial',
    })
    .expect(201);
  assert.equal(grace.body.extended_deadline, '2026-01-15');
  const graceRoot = `/api/v1/groupements/${g}/campaigns/${tontineCamp.body.id}`;
  const roster = async () =>
    (
      await request(app.getHttpServer())
        .get(`${graceRoot}/tontine/members?roundNumber=1`)
        .set('Cookie', adminCookie)
        .expect(200)
    ).body.items.find((m: any) => m.member_id === graceMemberId);
  assert.equal((await roster()).absent, false);
  assert.equal((await roster()).grace_deadline, '2026-01-15');
  // Deadline inclusive; absence starts the next day, using server time.
  clock.mock.mockImplementation(() => '2026-01-15');
  assert.equal((await roster()).absent, false);
  clock.mock.mockImplementation(() => '2026-01-16');
  assert.equal((await roster()).absent, true);
  const grant = (body: any, cookie = adminCookie) =>
    request(app.getHttpServer())
      .post(`${graceRoot}/grace-periods`)
      .set(headers)
      .set('Cookie', cookie)
      .send(body);
  const input = {
    membershipId: graceMemberId,
    periodDate: '2026-01-01',
    extendedDeadline: '2026-01-20',
    reason: 'Prolongation',
  };
  await grant({ ...input, membershipId: rounds.body[0].beneficiary_id }).expect(409);
  const beneficiaryRoster = (
    await request(app.getHttpServer())
      .get(`${graceRoot}/tontine/members?roundNumber=1`)
      .set('Cookie', adminCookie)
      .expect(200)
  ).body.items.find((m: any) => m.member_id === rounds.body[0].beneficiary_id);
  assert.equal(beneficiaryRoster.is_beneficiary, true);
  assert.equal(beneficiaryRoster.can_grant_grace, false);
  assert.equal(beneficiaryRoster.absent, false);
  await grant(input, memberCookie).expect(403);
  await grant(input, superCookie).expect(403);
  await grant({ ...input, membershipId: randomUUID() }).expect(404);
  await grant({ ...input, extendedDeadline: '2026-02-01' }).expect(400);
  await grant({ ...input, extendedDeadline: '2026-02-30' }).expect(400);
  await grant({ ...input, periodDate: '2026-01-02' }).expect(400);
  await grant({ ...input, extendedDeadline: '2026-01-15' }).expect(400);
  await grant(input).expect(201);
  assert.equal((await roster()).absent, false);
  assert.equal((await roster()).grace_deadline, '2026-01-20');
  await grant(input).expect(409);
  await grant({ ...input, extendedDeadline: '2026-01-18' }).expect(409);
  const participation = await request(app.getHttpServer())
    .get(`${graceRoot}/participants`)
    .set('Cookie', adminCookie)
    .expect(200);
  const graceParticipation = participation.body.items.find(
    (p: any) => p.membership_id === graceMemberId,
  );
  await request(app.getHttpServer())
    .post(`${graceRoot}/contributions`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send({
      participationId: graceParticipation.id,
      amount: 10000,
      paidOn: '2026-01-16',
      idempotencyKey: randomUUID(),
    })
    .expect(201);
  clock.mock.mockImplementation(() => '2026-01-21');
  assert.equal((await roster()).contributed, true);
  assert.equal((await roster()).absent, false);
  assert.equal((await roster()).can_grant_grace, false);
  await grant({ ...input, extendedDeadline: '2026-01-25' }).expect(409);
  clock.mock.mockImplementation(() => '2026-02-01');
  await grant({ ...input, extendedDeadline: '2026-02-02' }).expect(400);
  clock.mock.mockImplementation(() => '2026-01-01');

  // Consultation séances et état de la caisse
  await request(app.getHttpServer())
    .get(`/api/v1/groupements/${g}/campaigns/${tontineCamp.body.id}/sessions`)
    .set('Cookie', adminCookie)
    .expect(200);

  const cashbox = await request(app.getHttpServer())
    .get(`/api/v1/groupements/${g}/campaigns/${tontineCamp.body.id}/cashbox`)
    .set('Cookie', adminCookie)
    .expect(200);
  assert.equal(cashbox.body.campaign_id, tontineCamp.body.id);

  // Cockpit 360° Super Admin
  const superCockpit = await request(app.getHttpServer())
    .get('/api/v1/super-admin/dashboard')
    .set('Cookie', superCookie)
    .expect(200);
  assert.ok(superCockpit.body.total_groups >= 2);
  assert.ok(superCockpit.body.cashboxes.length >= 1);

  // Création d'un groupement avec affectation de types et d'événements
  const eventsList = await request(app.getHttpServer())
    .get('/api/v1/campaign-events')
    .set('Cookie', superCookie)
    .expect(200);
  const typesList = await request(app.getHttpServer())
    .get('/api/v1/campaign-types')
    .set('Cookie', superCookie)
    .expect(200);

  const customGroup = await request(app.getHttpServer())
    .post('/api/v1/groupements')
    .set(headers)
    .set('Cookie', superCookie)
    .send({
      name: 'Groupement Types & Events',
      address: 'Pikine, Dakar',
      phone: '+221776543210',
      typeIds: [typesList.body[0].id],
      eventIds: [eventsList.body[0].id],
    })
    .expect(201);

  // Vérifier les types affectés
  const grpTypes = await request(app.getHttpServer())
    .get(`/api/v1/groupements/${customGroup.body.id}/types`)
    .set('Cookie', superCookie)
    .expect(200);
  assert.equal(grpTypes.body.length, 1);
  assert.equal(grpTypes.body[0].id, typesList.body[0].id);

  // Vérifier les événements affectés
  const grpEvents = await request(app.getHttpServer())
    .get(`/api/v1/groupements/${customGroup.body.id}/events`)
    .set('Cookie', superCookie)
    .expect(200);
  assert.equal(grpEvents.body.length, 1);
  assert.equal(grpEvents.body[0].event_id, eventsList.body[0].id);

  // Modification des types affectés
  await request(app.getHttpServer())
    .put(`/api/v1/groupements/${customGroup.body.id}/types`)
    .set(headers)
    .set('Cookie', superCookie)
    .send({
      typeIds: typesList.body.map((t: { id: string }) => t.id),
    })
    .expect(200);

  const updatedGrpTypes = await request(app.getHttpServer())
    .get(`/api/v1/groupements/${customGroup.body.id}/types`)
    .set('Cookie', superCookie)
    .expect(200);
  assert.equal(updatedGrpTypes.body.length, typesList.body.length);

  // CRUD sur les types de campagne (Super Admin)
  const createdType = await request(app.getHttpServer())
    .post('/api/v1/campaign-types')
    .set(headers)
    .set('Cookie', superCookie)
    .send({ name: 'Type Temporaire', code: 'TEMP_TYPE' })
    .expect(201);
  assert.equal(createdType.body.name, 'Type Temporaire');

  const updatedType = await request(app.getHttpServer())
    .patch(`/api/v1/campaign-types/${createdType.body.id}`)
    .set(headers)
    .set('Cookie', superCookie)
    .send({ name: 'Type Modifié' })
    .expect(200);
  assert.equal(updatedType.body.name, 'Type Modifié');

  await request(app.getHttpServer())
    .delete(`/api/v1/campaign-types/${createdType.body.id}`)
    .set(headers)
    .set('Cookie', superCookie)
    .expect(200);

  // CRUD sur les événements (Super Admin)
  const createdEvent = await request(app.getHttpServer())
    .post('/api/v1/campaign-events')
    .set(headers)
    .set('Cookie', superCookie)
    .send({ name: 'Événement Temporaire', code: 'TEMP_EV', description: 'Test desc' })
    .expect(201);
  assert.equal(createdEvent.body.name, 'Événement Temporaire');

  const updatedEvent = await request(app.getHttpServer())
    .patch(`/api/v1/campaign-events/${createdEvent.body.id}`)
    .set(headers)
    .set('Cookie', superCookie)
    .send({ name: 'Événement Mis à Jour', description: 'Nouvelle description' })
    .expect(200);
  assert.equal(updatedEvent.body.name, 'Événement Mis à Jour');
  assert.equal(updatedEvent.body.description, 'Nouvelle description');

  await request(app.getHttpServer())
    .delete(`/api/v1/campaign-events/${createdEvent.body.id}`)
    .set(headers)
    .set('Cookie', superCookie)
    .expect(200);

  // Création d'une campagne par le Super Admin sur un groupement
  const superCamp = await request(app.getHttpServer())
    .post(`/api/v1/groupements/${customGroup.body.id}/campaigns`)
    .set(headers)
    .set('Cookie', superCookie)
    .send({
      name: 'Campagne Super Admin',
      typeId: typesList.body[0].id,
      eventId: eventsList.body[0].id,
      startDate: '2026-07-01',
      endDate: '2026-12-31',
      weekday: 3,
      intervalWeeks: 1,
    })
    .expect(201);
  assert.equal(superCamp.body.name, 'Campagne Super Admin');

  // Liste des campagnes avec métriques enrichies
  const campList = await request(app.getHttpServer())
    .get(`/api/v1/groupements/${customGroup.body.id}/campaigns`)
    .set('Cookie', superCookie)
    .expect(200);
  assert.ok(campList.body.items.length >= 1);
  const foundCamp = campList.body.items.find((c: any) => c.id === superCamp.body.id);
  assert.ok(foundCamp);
  assert.equal(typeof foundCamp.member_count, 'number');
  assert.equal(typeof foundCamp.session_count, 'number');
  assert.equal(typeof foundCamp.collected_amount, 'string');

  // Seul le Super Admin peut archiver (désactiver) un groupement
  await request(app.getHttpServer())
    .patch(`/api/v1/groupements/${customGroup.body.id}/activation`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send({ active: false })
    .expect(403);

  const deactGroup = await request(app.getHttpServer())
    .patch(`/api/v1/groupements/${customGroup.body.id}/activation`)
    .set(headers)
    .set('Cookie', superCookie)
    .send({ active: false })
    .expect(200);
  assert.equal(deactGroup.body.active, false);

  const reactGroup = await request(app.getHttpServer())
    .patch(`/api/v1/groupements/${customGroup.body.id}/activation`)
    .set(headers)
    .set('Cookie', superCookie)
    .send({ active: true })
    .expect(200);
  assert.equal(reactGroup.body.active, true);
  clock.mock.restore();
});

test('recherche serveur au-delà de 200 membres, pagination exacte et isolation', async () => {
  await pg.exec('RESET ROLE');
  try {
    for (let i = 0; i < 205; i++) {
      const membershipId = randomUUID();
      await pg.query('INSERT INTO memberships(id,group_id,name,phone) VALUES($1,$2,$3,$4)', [
        membershipId,
        g,
        `Recherche ${String(i).padStart(3, '0')}`,
        `+22178000${String(i).padStart(4, '0')}`,
      ]);
      await pg.query(
        'INSERT INTO participations(id,group_id,campaign_id,membership_id) VALUES($1,$2,$3,$4)',
        [randomUUID(), g, camp, membershipId],
      );
    }
  } finally {
    await pg.exec('SET ROLE aveclesfemmes_app');
  }
  const memberSearch = await request(app.getHttpServer())
    .get(`/api/v1/groupements/${g}/members?q=Recherche%20204&limit=1`)
    .set('Cookie', adminCookie)
    .expect(200);
  assert.equal(memberSearch.body.total, 1);
  assert.equal(memberSearch.body.items[0].name, 'Recherche 204');
  const search = await request(app.getHttpServer())
    .get(path() + '/participants?q=Recherche%20204&limit=1')
    .set('Cookie', adminCookie)
    .expect(200);
  assert.equal(search.body.total, 1);
  assert.equal(search.body.items[0].name, 'Recherche 204');
  const second = await request(app.getHttpServer())
    .get(path() + '/participants?q=Recherche%20204&limit=1&page=2')
    .set('Cookie', adminCookie)
    .expect(200);
  assert.equal(second.body.total, 1);
  assert.equal(second.body.items.length, 0);
  const personal = await request(app.getHttpServer())
    .get(path() + '/participants?q=Recherche&scope=personal')
    .set('Cookie', adminCookie)
    .expect(200);
  assert.equal(personal.body.total, 0);
  const otherLogin = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set(headers)
    .send({ login: 'other', password: testPassword })
    .expect(201);
  otherCookie = otherLogin.headers['set-cookie'][0];
  await request(app.getHttpServer())
    .get(path() + '/participants?q=Recherche')
    .set('Cookie', otherCookie)
    .expect(404);
  await request(app.getHttpServer())
    .post(path() + '/contributions')
    .set(headers)
    .set('Cookie', adminCookie)
    .send({
      participationId: search.body.items[0].id,
      amount: 375,
      paidOn: '2026-06-02',
      idempotencyKey: randomUUID(),
    })
    .expect(201);
  const history = await request(app.getHttpServer())
    .get(path() + '/contributions?q=Recherche%20204&paidOn=2026-06-02&limit=1')
    .set('Cookie', adminCookie)
    .expect(200);
  assert.equal(history.body.total, 1);
  assert.equal(history.body.items[0].amount, '375');
  const missing = await request(app.getHttpServer())
    .get(path() + '/contributions?q=Recherche%20204&paidOn=2026-06-03')
    .set('Cookie', adminCookie)
    .expect(200);
  assert.equal(missing.body.total, 0);
  await request(app.getHttpServer())
    .get(path() + '/contributions?paidOn=2026-02-30')
    .set('Cookie', adminCookie)
    .expect(400);
});

test('cahiers de séance : totaux, participantes sans versement et ordre des dates', async () => {
  const result = await request(app.getHttpServer())
    .get(path() + '/sessions')
    .set('Cookie', adminCookie)
    .expect(200);
  assert.ok(result.body.length > 0);
  assert.deepEqual(
    result.body.map((s: any) => s.session_date),
    result.body
      .map((s: any) => s.session_date)
      .sort()
      .reverse(),
  );
  const session = result.body.find((s: any) => s.session_date === '2026-06-02');
  assert.ok(session.members.some((m: any) => m.contributed));
  assert.ok(session.members.some((m: any) => !m.contributed));
  assert.equal(
    session.members.reduce((sum: bigint, m: any) => sum + BigInt(m.paid_amount), 0n).toString(),
    session.total_amount,
  );
  assert.equal(
    session.members
      .reduce((sum: bigint, m: any) => sum + BigInt(m.expected_amount || '0'), 0n)
      .toString(),
    session.expected_amount,
  );
  assert.equal(
    session.free_members_count,
    session.members.filter((m: any) => m.expected_amount === null).length,
  );
});

test('épargne : ouverture réservée au jour prévu et encaissement dans la séance du jour', async () => {
  const schedule = require('../dist/common/savings-schedule.js');
  const clock = mock.method(schedule, 'savingsToday', () => '2026-06-09');
  try {
    await request(app.getHttpServer())
      .post(path() + '/contributions')
      .set(headers)
      .set('Cookie', adminCookie)
      .send({
        participationId: part,
        amount: 100,
        paidOn: '2026-06-09',
        idempotencyKey: randomUUID(),
      })
      .expect(400);
    await request(app.getHttpServer())
      .post(path() + '/savings-session')
      .set(headers)
      .set('Cookie', memberCookie)
      .expect(403);
    await request(app.getHttpServer())
      .post(path() + '/savings-session')
      .set(headers)
      .set('Cookie', superCookie)
      .expect(403);
    await request(app.getHttpServer())
      .post(path() + '/savings-session')
      .set(headers)
      .set('Cookie', otherCookie)
      .expect(404);
    const opened = await request(app.getHttpServer())
      .post(path() + '/savings-session')
      .set(headers)
      .set('Cookie', adminCookie)
      .expect(201);
    assert.equal(opened.body.can_collect, true);
    await request(app.getHttpServer())
      .post(path() + '/savings-session')
      .set(headers)
      .set('Cookie', adminCookie)
      .expect(201);
    const ledger = await request(app.getHttpServer())
      .get(path() + '/sessions')
      .set('Cookie', adminCookie)
      .expect(200);
    assert.equal(ledger.body.filter((s: any) => s.session_date === '2026-06-09').length, 1);
    assert.equal(ledger.body.find((s: any) => s.session_date === '2026-06-09').total_amount, '0');
    const payload = {
      participationId: part,
      amount: 100,
      paidOn: '2026-06-09',
      idempotencyKey: randomUUID(),
    };
    const payment = await request(app.getHttpServer())
      .post(path() + '/contributions')
      .set(headers)
      .set('Cookie', adminCookie)
      .send(payload)
      .expect(201);
    clock.mock.mockImplementation(() => '2026-06-10');
    await request(app.getHttpServer())
      .post(path() + '/savings-session')
      .set(headers)
      .set('Cookie', adminCookie)
      .expect(400);
    await request(app.getHttpServer())
      .post(path() + '/contributions')
      .set(headers)
      .set('Cookie', adminCookie)
      .send({ ...payload, idempotencyKey: randomUUID() })
      .expect(400);
    const replay = await request(app.getHttpServer())
      .post(path() + '/contributions')
      .set(headers)
      .set('Cookie', adminCookie)
      .send(payload)
      .expect(201);
    assert.equal(replay.body.id, payment.body.id);
    assert.equal(
      schedule.scheduledSavingsDay(
        {
          active: true,
          start_date: '2026-06-01',
          end_date: '2026-06-30',
          weekday: 2,
          interval_weeks: 2,
        },
        '2026-06-09',
      ),
      false,
    );
    assert.equal(
      schedule.scheduledSavingsDay(
        {
          active: true,
          start_date: '2026-06-01',
          end_date: '2026-06-30',
          weekday: 2,
          interval_weeks: 2,
        },
        '2026-06-16',
      ),
      true,
    );
  } finally {
    clock.mock.restore();
  }
});

test('QR membre : résolution scoped, rejet des autres groupements et profils', async () => {
  const path = `/api/v1/groupements/${g}/campaigns/${camp}/resolve-member-qr`;
  const ok = await request(app.getHttpServer())
    .post(path)
    .set('Cookie', adminCookie)
    .set(headers)
    .send({ code: `ALF:MEMBER:${g}:${memberId}:ignored` })
    .expect(201);
  assert.equal(ok.body.id, memberPart);
  await request(app.getHttpServer())
    .post(path)
    .set('Cookie', adminCookie)
    .set(headers)
    .send({ code: `ALF:MEMBER:${otherGroup}:${memberId}` })
    .expect(400);
  await request(app.getHttpServer())
    .post(path)
    .set('Cookie', adminCookie)
    .set(headers)
    .send({ code: `ALF:GROUP:${g}:nom` })
    .expect(400);
  await request(app.getHttpServer())
    .post(path)
    .set('Cookie', memberCookie)
    .set(headers)
    .send({ code: `ALF:MEMBER:${g}:${memberId}` })
    .expect(403);
  await request(app.getHttpServer())
    .post(path)
    .set('Cookie', otherCookie)
    .set(headers)
    .send({ code: `ALF:MEMBER:${g}:${memberId}` })
    .expect(404);
});

test('historique : plage et statut filtrés avant pagination', async () => {
  const path = `/api/v1/groupements/${g}/campaigns/${camp}/contributions`;
  const result = await request(app.getHttpServer())
    .get(`${path}?from=2026-06-02&to=2026-06-02&status=valid&limit=1`)
    .set('Cookie', adminCookie)
    .expect(200);
  assert.ok(result.body.total > 0);
  assert.equal(result.body.items.length, 1);
  assert.equal(result.body.items[0].paid_on, '2026-06-02');
  assert.equal(result.body.items[0].voided_at, null);
  assert.ok(result.body.items[0].created_at);
  await request(app.getHttpServer())
    .get(`${path}?from=2026-06-03&to=2026-06-02`)
    .set('Cookie', adminCookie)
    .expect(400);
});

test('tontine : suivi du tour, filtres avant pagination et conservation du tirage', async () => {
  const clock = mock.method(
    require('../dist/common/savings-schedule.js'),
    'savingsToday',
    () => '2026-06-01',
  );
  const server = app.getHttpServer();
  const types = await request(server)
    .get('/api/v1/campaign-types')
    .set('Cookie', adminCookie)
    .expect(200);
  const type = types.body.find((t: any) => t.code === 'TONTINE');
  const created = await request(server)
    .post(`/api/v1/groupements/${g}/campaigns`)
    .set('Cookie', adminCookie)
    .set(headers)
    .send({
      name: 'Tontine hebdomadaire test suivi',
      typeId: type.id,
      startDate: '2026-06-01',
      endDate: '2026-12-31',
      weekday: 1,
      standardAmount: 2000,
      rotationInterval: 'WEEKLY',
    })
    .expect(201);
  const root = `/api/v1/groupements/${g}/campaigns/${created.body.id}`;
  const parts = [];
  for (const membershipId of [adminId, memberId]) {
    const p = await request(server)
      .post(`${root}/participants`)
      .set('Cookie', adminCookie)
      .set(headers)
      .send({ membershipId })
      .expect(201);
    parts.push(p.body.id);
  }
  const planned = await request(server)
    .get(`${root}/tontine/rounds`)
    .set('Cookie', adminCookie)
    .expect(200);
  assert.equal(planned.body.length, 2);
  assert.ok(planned.body.every((r: any) => r.beneficiary_id === null));
  const before = await request(server)
    .get(`${root}/tontine/status`)
    .set('Cookie', adminCookie)
    .expect(200);
  assert.equal(before.body.can_draw, true);
  assert.equal(before.body.can_collect, false);
  await request(server)
    .post(`${root}/contributions`)
    .set('Cookie', adminCookie)
    .set(headers)
    .send({
      participationId: parts[0],
      amount: 1000,
      paidOn: '2026-06-01',
      idempotencyKey: randomUUID(),
    })
    .expect(400);
  await request(server)
    .post(`${root}/tontine/draw`)
    .set('Cookie', memberCookie)
    .set(headers)
    .expect(403);
  await request(server)
    .post(`${root}/tontine/draw`)
    .set('Cookie', superCookie)
    .set(headers)
    .expect(403);
  await request(server)
    .post(`${root}/tontine/draw`)
    .set('Cookie', otherCookie)
    .set(headers)
    .expect(404);
  const draw = await request(server)
    .post(`${root}/tontine/draw`)
    .set('Cookie', adminCookie)
    .set(headers)
    .expect(201);
  assert.equal(draw.body.length, 1);
  const replay = await request(server)
    .post(`${root}/tontine/draw`)
    .set('Cookie', adminCookie)
    .set(headers)
    .expect(201);
  assert.equal(replay.body[0].id, draw.body[0].id);
  await request(server)
    .post(`${root}/participants`)
    .set('Cookie', adminCookie)
    .set(headers)
    .send({ membershipId: adminId, forfait: 2500 })
    .expect(409);
  assert.equal(draw.body[0].payout_amount, '4000');
  let firstPayment: any;
  for (const [participationId, paidOn, amount] of [
    [parts[0], '2026-06-02', 2000],
    [parts[1], '2026-06-08', 2000],
  ]) {
    clock.mock.mockImplementation(() => paidOn as string);
    if (paidOn === '2026-06-08') {
      await request(server)
        .post(`${root}/contributions`)
        .set('Cookie', adminCookie)
        .set(headers)
        .send({ participationId, paidOn, amount, idempotencyKey: randomUUID() })
        .expect(400);
      const second = await request(server)
        .post(`${root}/tontine/draw`)
        .set('Cookie', adminCookie)
        .set(headers)
        .expect(201);
      assert.notEqual(second.body[0].beneficiary_id, draw.body[0].beneficiary_id);
    } else {
      const status = await request(server)
        .get(`${root}/tontine/status`)
        .set('Cookie', adminCookie)
        .expect(200);
      assert.equal(status.body.can_collect, true);
      assert.equal(status.body.can_draw, false);
      await request(server)
        .post(`${root}/tontine/draw`)
        .set('Cookie', adminCookie)
        .set(headers)
        .expect(400);
    }
    const p = await request(server)
      .post(`${root}/contributions`)
      .set('Cookie', adminCookie)
      .set(headers)
      .send({ participationId, paidOn, amount, idempotencyKey: randomUUID() })
      .expect(201);
    if (!firstPayment) firstPayment = p.body;
  }
  const all = await request(server)
    .get(`${root}/tontine/members?roundNumber=1&limit=1`)
    .set('Cookie', adminCookie)
    .expect(200);
  assert.equal(all.body.total, 2);
  assert.equal(all.body.items.length, 1);
  assert.equal(all.body.contributed_count, 1);
  assert.equal(all.body.unpaid_count, 1);
  const paid = await request(server)
    .get(`${root}/tontine/members?roundNumber=1&state=paid`)
    .set('Cookie', adminCookie)
    .expect(200);
  assert.equal(paid.body.items[0].paid_amount, '2000');
  assert.equal(paid.body.items[0].expected_amount, '2000');
  const unpaid = await request(server)
    .get(`${root}/tontine/members?roundNumber=2&state=unpaid&q=ADMIN`)
    .set('Cookie', adminCookie)
    .expect(200);
  assert.equal(unpaid.body.total, 1);
  assert.equal(unpaid.body.items[0].member_id, adminId);
  await request(server)
    .get(`${root}/tontine/members?state=invalid`)
    .set('Cookie', adminCookie)
    .expect(400);
  await request(server)
    .get(`${root}/tontine/members?roundNumber=99`)
    .set('Cookie', adminCookie)
    .expect(404);
  await request(server).get(`${root}/tontine/members`).set('Cookie', memberCookie).expect(403);
  await request(server).get(`${root}/tontine/members`).set('Cookie', otherCookie).expect(404);
  const rounds = await request(server)
    .get(`${root}/tontine/rounds`)
    .set('Cookie', adminCookie)
    .expect(200);
  assert.deepEqual(
    rounds.body.map((r: any) => r.total_collected_amount),
    ['2000', '2000'],
  );
  await request(server)
    .post(`${root}/contributions/${firstPayment.id}/void`)
    .set('Cookie', adminCookie)
    .set(headers)
    .send({ reason: 'Annulation du versement fictif de test' })
    .expect(201);
  const after = await request(server)
    .get(`${root}/tontine/members?roundNumber=1&state=paid`)
    .set('Cookie', adminCookie)
    .expect(200);
  assert.equal(after.body.total, 0);
  assert.equal(after.body.unpaid_count, 2);
  await request(server)
    .post(`${root}/tontine/draw`)
    .set('Cookie', adminCookie)
    .set(headers)
    .expect(201);
  const kept = await request(server)
    .get(`${root}/tontine/rounds`)
    .set('Cookie', adminCookie)
    .expect(200);
  assert.deepEqual(
    kept.body.map((r: any) => r.id),
    rounds.body.map((r: any) => r.id),
  );
  clock.mock.mockImplementation(() => '2026-06-15');
  const closed = await request(server)
    .get(`${root}/tontine/status`)
    .set('Cookie', adminCookie)
    .expect(200);
  assert.equal(closed.body.can_collect, false);
  await request(server)
    .post(`${root}/contributions`)
    .set('Cookie', adminCookie)
    .set(headers)
    .send({
      participationId: parts[0],
      paidOn: '2026-06-02',
      amount: 1000,
      idempotencyKey: randomUUID(),
    })
    .expect(400);
  clock.mock.restore();
});

test('tontine : calendrier mensuel ancré et sans trou en fin de mois', async () => {
  const { tontineCalendar } = require('../dist/common/tontine-schedule.js');
  const c = {
    query: async (sql: string) => ({ rows: sql.includes('count(*)') ? [{ count: 2 }] : [] }),
  };
  const calendar = await tontineCalendar(c, {
    id: 'test',
    start_date: '2026-01-31',
    rotation_interval: 'MONTHLY',
  });
  assert.deepEqual(
    calendar.map((r: any) => [r.expected_date, r.period_end]),
    [
      ['2026-01-31', '2026-02-28'],
      ['2026-02-28', '2026-03-31'],
    ],
  );
});

test('raccourcis : choix persistants par responsable et groupement, six au maximum', async () => {
  const server = app.getHttpServer();
  const root = `/api/v1/groupements/${g}/campaigns/shortcuts`;
  const save = (campaignIds: string[], cookie = adminCookie) =>
    request(server).put(root).set(headers).set('Cookie', cookie).send({ campaignIds });
  await save([]).expect(200);
  assert.deepEqual(
    (await request(server).get(root).set('Cookie', adminCookie).expect(200)).body.campaignIds,
    [],
  );
  await save([camp]).expect(200);
  assert.deepEqual(
    (await request(server).get(root).set('Cookie', adminCookie).expect(200)).body.campaignIds,
    [camp],
  );
  await save([camp, camp]).expect(400);
  await save(Array.from({ length: 7 }, () => randomUUID())).expect(400);
  await save([randomUUID()]).expect(400);
  await save([], memberCookie).expect(403);
  await save([], superCookie).expect(403);
  await request(server).get(root).set('Cookie', otherCookie).expect(404);
  await request(server)
    .get(`/api/v1/groupements/${otherGroup}/campaigns/shortcuts`)
    .set('Cookie', adminCookie)
    .expect(404);
});

test('ajout campagne : recherche des non-inscrits avant pagination, libre ou fixe au standard', async () => {
  const server = app.getHttpServer();
  const types = (await request(server).get('/api/v1/campaign-types').set('Cookie', adminCookie))
    .body;
  const typeId = types.find((t: any) => t.code === 'AVEC').id;
  const created = await request(server)
    .post(`/api/v1/groupements/${g}/campaigns`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send({
      name: 'Épargne adhésion',
      typeId,
      startDate: '2026-06-01',
      endDate: '2026-12-31',
      weekday: 2,
      standardAmount: 1000,
    })
    .expect(201);
  const root = `/api/v1/groupements/${g}/campaigns/${created.body.id}`;
  const eligible = await request(server)
    .get(`${root}/eligible-members?q=ADMIN&limit=1`)
    .set('Cookie', adminCookie)
    .expect(200);
  assert.equal(eligible.body.total, 1);
  assert.equal(eligible.body.items[0].id, adminId);
  await request(server).get(`${root}/eligible-members`).set('Cookie', memberCookie).expect(403);
  await request(server).get(`${root}/eligible-members`).set('Cookie', otherCookie).expect(404);
  const enroll = (body: any) =>
    request(server).post(`${root}/participants`).set(headers).set('Cookie', adminCookie).send(body);
  await enroll({ membershipId: adminId, forfait: 2000 }).expect(400);
  const fixed = await enroll({ membershipId: adminId }).expect(201);
  assert.equal(fixed.body.forfait, '1000');
  assert.equal(fixed.body.is_random, false);
  await enroll({ membershipId: adminId }).expect(409);
  const excluded = await request(server)
    .get(`${root}/eligible-members?q=ADMIN&limit=1`)
    .set('Cookie', adminCookie)
    .expect(200);
  assert.equal(excluded.body.total, 0);
  const late = await request(server)
    .post(`/api/v1/groupements/${g}/members`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send({ name: 'Éligible Tardive', password: testPassword })
    .expect(201);
  const found = await request(server)
    .get(`${root}/eligible-members?q=eligible%20tardive&limit=1`)
    .set('Cookie', adminCookie)
    .expect(200);
  assert.equal(found.body.total, 1);
  assert.equal(found.body.items[0].id, late.body.id);
  const free = await enroll({ membershipId: late.body.id, isRandom: true }).expect(201);
  assert.equal(free.body.forfait, null);
  assert.equal(free.body.is_random, true);
  await request(server)
    .post(`${root}/savings-session`)
    .set(headers)
    .set('Cookie', adminCookie)
    .expect(201);
  const pay = (participationId: string, amount: number) =>
    request(server)
      .post(`${root}/contributions`)
      .set(headers)
      .set('Cookie', adminCookie)
      .send({ participationId, amount, paidOn: '2026-06-02', idempotencyKey: randomUUID() });
  await pay(fixed.body.id, 999).expect(400);
  await pay(fixed.body.id, 1000).expect(201);
  await pay(free.body.id, 37).expect(201);
  await pay(free.body.id, 1250).expect(201);
  await request(server)
    .patch(`/api/v1/groupements/${g}/members/${late.body.id}/block`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send({ blocked: true })
    .expect(200);
  const blocked = await request(server)
    .get(`${root}/eligible-members?q=eligible%20tardive`)
    .set('Cookie', adminCookie)
    .expect(200);
  assert.equal(blocked.body.total, 0);
});

test('tontine : montant commun obligatoire et aucun forfait individuel ou libre', async () => {
  const server = app.getHttpServer();
  const typeId = (
    await request(server).get('/api/v1/campaign-types').set('Cookie', adminCookie)
  ).body.find((t: any) => t.code === 'TONTINE').id;
  const payload = {
    name: 'Tontine montant commun',
    typeId,
    startDate: '2026-06-02',
    endDate: '2026-12-31',
    rotationInterval: 'WEEKLY',
  };
  await request(server)
    .post(`/api/v1/groupements/${g}/campaigns`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send(payload)
    .expect(400);
  const created = await request(server)
    .post(`/api/v1/groupements/${g}/campaigns`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send({ ...payload, standardAmount: 2000 })
    .expect(201);
  const root = `/api/v1/groupements/${g}/campaigns/${created.body.id}`;
  const enroll = (body: any) =>
    request(server).post(`${root}/participants`).set(headers).set('Cookie', adminCookie).send(body);
  await enroll({ membershipId: adminId, isRandom: true }).expect(400);
  await enroll({ membershipId: adminId, forfait: 1000 }).expect(400);
  const fixed = await enroll({ membershipId: adminId, forfait: 2000 }).expect(201);
  const second = await enroll({ membershipId: memberId }).expect(201);
  assert.equal(second.body.forfait, fixed.body.forfait);
  await request(server)
    .post(`${root}/tontine/draw`)
    .set(headers)
    .set('Cookie', adminCookie)
    .expect(201);
  await request(server)
    .post(`${root}/contributions`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send({
      participationId: fixed.body.id,
      amount: 1000,
      paidOn: '2026-06-02',
      idempotencyKey: randomUUID(),
    })
    .expect(400);
});

test('membres : campagnes inscrites et épargne versée nette des annulations, sans fuite', async () => {
  const server = app.getHttpServer();
  const typeId = (
    await request(server).get('/api/v1/campaign-types').set('Cookie', adminCookie)
  ).body.find((t: any) => t.code === 'AVEC').id;
  const created = await request(server)
    .post(`/api/v1/groupements/${g}/campaigns`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send({
      name: 'Épargne résumé membre',
      typeId,
      startDate: '2026-06-01',
      endDate: '2026-12-31',
      weekday: 2,
      standardAmount: 500,
    })
    .expect(201);
  const root = `/api/v1/groupements/${g}/campaigns/${created.body.id}`;
  const parts = [];
  for (const membershipId of [adminId, memberId])
    parts.push(
      (
        await request(server)
          .post(`${root}/participants`)
          .set(headers)
          .set('Cookie', adminCookie)
          .send({ membershipId, isRandom: membershipId === memberId })
          .expect(201)
      ).body.id,
    );
  await request(server)
    .post(`${root}/savings-session`)
    .set(headers)
    .set('Cookie', adminCookie)
    .expect(201);
  const pay = (participationId: string, amount: number) =>
    request(server)
      .post(`${root}/contributions`)
      .set(headers)
      .set('Cookie', adminCookie)
      .send({ participationId, amount, paidOn: '2026-06-02', idempotencyKey: randomUUID() });
  await pay(parts[0], 500).expect(201);
  const voided = await pay(parts[0], 500).expect(201);
  await request(server)
    .post(`${root}/contributions/${voided.body.id}/void`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send({ reason: 'Annulation pour vérifier le montant membre' })
    .expect(201);
  await pay(parts[1], 77).expect(201);
  const list = await request(server)
    .get(`/api/v1/groupements/${g}/members?q=ADMIN&limit=1`)
    .set('Cookie', adminCookie)
    .expect(200);
  assert.equal(list.body.total, 1);
  const registration = list.body.items[0].campaigns.find(
    (c: any) => c.campaign_id === created.body.id,
  );
  assert.equal(registration.paid_amount, '500');
  assert.equal(registration.is_savings, true);
  assert.equal(registration.name, 'Épargne résumé membre');
  const personal = await request(server)
    .get(`/api/v1/groupements/${g}/members?scope=personal`)
    .set('Cookie', memberCookie)
    .expect(200);
  assert.equal(personal.body.items.length, 1);
  assert.equal(personal.body.items[0].id, memberId);
  assert.equal(
    personal.body.items[0].campaigns.find((c: any) => c.campaign_id === created.body.id)
      .paid_amount,
    '77',
  );
  await request(server)
    .get(`/api/v1/groupements/${g}/members`)
    .set('Cookie', otherCookie)
    .expect(404);
  await request(server)
    .patch(`${root}/activation`)
    .set(headers)
    .set('Cookie', superCookie)
    .send({ active: false })
    .expect(200);
  const archived = await request(server)
    .get(`/api/v1/groupements/${g}/members?q=ADMIN`)
    .set('Cookie', adminCookie)
    .expect(200);
  assert.equal(
    archived.body.items[0].campaigns.find((c: any) => c.campaign_id === created.body.id).active,
    false,
  );
});

test('membre : versement épargne personnel, séance ouverte, unicité, rejeu et annulation', async () => {
  const server = app.getHttpServer();
  const clock = mock.method(
    require('../dist/common/savings-schedule.js'),
    'savingsToday',
    () => '2026-06-02',
  );
  try {
    const types = (await request(server).get('/api/v1/campaign-types').set('Cookie', adminCookie))
      .body;
    const created = await request(server)
      .post(`/api/v1/groupements/${g}/campaigns`)
      .set(headers)
      .set('Cookie', adminCookie)
      .send({
        name: 'Épargne personnelle',
        typeId: types.find((t: any) => t.code === 'AVEC').id,
        startDate: '2026-06-02',
        endDate: '2026-12-31',
        weekday: 2,
        standardAmount: 500,
      })
      .expect(201);
    const id = created.body.id,
      root = `/api/v1/groupements/${g}/campaigns/${id}`,
      own = `/api/v1/groupements/${g}/member/campaigns/${id}`;
    await request(server)
      .post(`${root}/participants`)
      .set(headers)
      .set('Cookie', adminCookie)
      .send({ membershipId: memberId, isRandom: true })
      .expect(201);
    await request(server)
      .post(`${root}/participants`)
      .set(headers)
      .set('Cookie', adminCookie)
      .send({ membershipId: adminId })
      .expect(201);
    const pay = (cookie = memberCookie, key = randomUUID(), amount = 73) =>
      request(server)
        .post(`${root}/contributions/self`)
        .set(headers)
        .set('Cookie', cookie)
        .send({ amount, idempotencyKey: key });
    await pay().expect(400);
    const before = await request(server).get(own).set('Cookie', memberCookie).expect(200);
    assert.equal(before.body.can_pay, false);
    await request(server)
      .post(`${root}/savings-session`)
      .set(headers)
      .set('Cookie', memberCookie)
      .expect(403);
    await request(server)
      .post(`${root}/savings-session`)
      .set(headers)
      .set('Cookie', adminCookie)
      .expect(201);
    assert.equal((await request(server).get(own).set('Cookie', memberCookie)).body.can_pay, true);
    const key = randomUUID();
    const results = await Promise.all([pay(memberCookie, key), pay(memberCookie, randomUUID())]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    const winner = results.find((r) => r.status === 201)!;
    // Retry the successful request's key, even if the session has since ended.
    const winningKey = results[0].status === 201 ? key : null;
    if (winningKey)
      assert.equal((await pay(memberCookie, winningKey).expect(201)).body.id, winner.body.id);
    const state = await request(server).get(own).set('Cookie', memberCookie).expect(200);
    assert.equal(state.body.total_paid, '73');
    assert.equal(state.body.already_paid, true);
    assert.equal(state.body.can_pay, false);
    await pay(adminCookie, randomUUID(), 73).expect(400);
    await pay(adminCookie, randomUUID(), 500).expect(201);
    await pay(superCookie).expect(403);
    await pay(otherCookie).expect(404);
    await request(server)
      .post(`${root}/contributions/self`)
      .set(headers)
      .set('Cookie', memberCookie)
      .send({ amount: 1, idempotencyKey: randomUUID(), participationId: part })
      .expect(400);
    await request(server)
      .post(`${root}/contributions/${winner.body.id}/void`)
      .set(headers)
      .set('Cookie', adminCookie)
      .send({ reason: 'Annulation du versement de test' })
      .expect(201);
    await pay().expect(201);
    mock.method(require('../dist/common/savings-schedule.js'), 'savingsToday', () => '2026-06-03');
    await pay().expect(400);
    if (winningKey) {
      const replay = await pay(memberCookie, winningKey).expect(201);
      assert.equal(replay.body.id, winner.body.id);
      assert.equal(replay.body.paid_on, '2026-06-02');
    }
    const list = await request(server)
      .get(`/api/v1/groupements/${g}/member/campaigns`)
      .set('Cookie', memberCookie)
      .expect(200);
    assert.equal(list.body.items.find((c: any) => c.id === id).total_paid, '73');
    await request(server)
      .patch(`${root}/activation`)
      .set(headers)
      .set('Cookie', superCookie)
      .send({ active: false })
      .expect(200);
    const archived = await request(server)
      .get(`/api/v1/groupements/${g}/member/campaigns`)
      .set('Cookie', memberCookie)
      .expect(200);
    assert.equal(
      archived.body.items.some((c: any) => c.id === id),
      false,
    );
    await pay().expect(400);
  } finally {
    clock.mock.restore();
    mock.method(require('../dist/common/savings-schedule.js'), 'savingsToday', () => '2026-06-02');
  }
});

test('membre : calendrier tontine complet, bénéficiaires limités aux inscrits et versement unique par tour', async () => {
  const server = app.getHttpServer();
  let today = '2026-06-02';
  const clock = mock.method(
    require('../dist/common/savings-schedule.js'),
    'savingsToday',
    () => today,
  );
  try {
    const type = (
      await request(server).get('/api/v1/campaign-types').set('Cookie', adminCookie)
    ).body.find((t: any) => t.code === 'TONTINE');
    const created = await request(server)
      .post(`/api/v1/groupements/${g}/campaigns`)
      .set(headers)
      .set('Cookie', adminCookie)
      .send({
        name: 'Tontine membre',
        typeId: type.id,
        startDate: today,
        endDate: '2026-12-31',
        rotationInterval: 'MONTHLY',
        standardAmount: 1000,
      })
      .expect(201);
    const id = created.body.id,
      root = `/api/v1/groupements/${g}/campaigns/${id}`,
      own = `/api/v1/groupements/${g}/member/campaigns/${id}`;
    for (const membershipId of [adminId, memberId])
      await request(server)
        .post(`${root}/participants`)
        .set(headers)
        .set('Cookie', adminCookie)
        .send({ membershipId })
        .expect(201);
    const pay = () =>
      request(server)
        .post(`${root}/contributions/self`)
        .set(headers)
        .set('Cookie', memberCookie)
        .send({ amount: 1000, idempotencyKey: randomUUID() });
    await pay().expect(400);
    await request(server)
      .post(`${root}/tontine/draw`)
      .set(headers)
      .set('Cookie', adminCookie)
      .expect(201);
    const state = await request(server).get(own).set('Cookie', memberCookie).expect(200);
    assert.equal(state.body.can_pay, true);
    assert.equal(state.body.remaining_months, 2);
    assert.ok(state.body.rounds[0].beneficiary_name);
    assert.equal(state.body.rounds[0].period_end, '2026-07-02');
    await pay().expect(201);
    await pay().expect(409);
    today = '2026-07-02';
    await pay().expect(400);
    await request(server)
      .post(`${root}/tontine/draw`)
      .set(headers)
      .set('Cookie', adminCookie)
      .expect(201);
    const next = await request(server).get(own).set('Cookie', memberCookie).expect(200);
    assert.equal(next.body.rounds[0].round_number, 2);
    assert.equal(next.body.can_pay, true);
    await pay().expect(201);
    await pay().expect(409);
    assert.equal(
      (await request(server).get(own).set('Cookie', memberCookie)).body.total_paid,
      '2000',
    );
    await request(server).get(own).set('Cookie', otherCookie).expect(404);
    await request(server).get(own).set('Cookie', superCookie).expect(400);
    // RLS still hides other members' contact data.
    assert.equal(
      (await request(server).get(`/api/v1/groupements/${g}/members`).set('Cookie', memberCookie))
        .body.items.length,
      1,
    );
  } finally {
    clock.mock.restore();
  }
});

test('membre : retards limités aux séances ouvertes après inscription, blocage et non-inscrits', async () => {
  const server = app.getHttpServer();
  const type = (
    await request(server).get('/api/v1/campaign-types').set('Cookie', adminCookie)
  ).body.find((t: any) => t.code === 'AVEC');
  const created = await request(server)
    .post(`/api/v1/groupements/${g}/campaigns`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send({
      name: 'Badge épargne membre',
      typeId: type.id,
      startDate: '2026-05-01',
      endDate: '2026-12-31',
      weekday: 2,
    })
    .expect(201);
  const id = created.body.id,
    root = `/api/v1/groupements/${g}/campaigns/${id}`,
    mine = `/api/v1/groupements/${g}/member/campaigns`;
  await request(server).get(`${mine}/${id}`).set('Cookie', memberCookie).expect(400);
  assert.equal(
    (await request(server).get(mine).set('Cookie', memberCookie)).body.items.some(
      (c: any) => c.id === id,
    ),
    false,
  );
  const p = await request(server)
    .post(`${root}/participants`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send({ membershipId: memberId, isRandom: true })
    .expect(201);
  await pg.exec('RESET ROLE');
  try {
    await pg.query("UPDATE participations SET created_at='2026-05-12T00:00:00Z' WHERE id=$1", [
      p.body.id,
    ]);
    for (const day of ['2026-05-05', '2026-05-12', '2026-05-19', '2026-06-02'])
      await pg.query(
        'INSERT INTO savings_sessions(id,group_id,campaign_id,session_date,created_by) SELECT $1,$2,$3,$4,user_id FROM memberships WHERE id=$5',
        [randomUUID(), g, id, day, adminId],
      );
  } finally {
    await pg.exec('SET ROLE aveclesfemmes_app');
  }
  const list = await request(server).get(mine).set('Cookie', memberCookie).expect(200);
  assert.equal(list.body.items.find((c: any) => c.id === id).arrears_count, 2);
  await request(server)
    .patch(`/api/v1/groupements/${g}/members/${memberId}/block`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send({ blocked: true })
    .expect(200);
  try {
    await request(server)
      .post(`${root}/contributions/self`)
      .set(headers)
      .set('Cookie', memberCookie)
      .send({ amount: 100, idempotencyKey: randomUUID() })
      .expect(403);
    assert.equal(
      (await request(server).get(mine).set('Cookie', memberCookie)).body.items.length,
      0,
    );
  } finally {
    await request(server)
      .patch(`/api/v1/groupements/${g}/members/${memberId}/block`)
      .set(headers)
      .set('Cookie', adminCookie)
      .send({ blocked: false })
      .expect(200);
  }
});

test('membre : raccourcis personnels persistants, sélection vide et séparation de l’administration', async () => {
  const server = app.getHttpServer(),
    root = `/api/v1/groupements/${g}/member/campaigns`;
  const list = (await request(server).get(root).set('Cookie', memberCookie).expect(200)).body.items;
  assert.ok(list.length > 0);
  const save = (ids: string[], cookie = memberCookie) =>
    request(server)
      .put(`${root}/shortcuts`)
      .set(headers)
      .set('Cookie', cookie)
      .send({ campaignIds: ids });
  await save([list[0].id]).expect(200);
  assert.deepEqual(
    (await request(server).get(`${root}/shortcuts`).set('Cookie', memberCookie).expect(200)).body
      .campaignIds,
    [list[0].id],
  );
  await save([]).expect(200);
  assert.deepEqual(
    (await request(server).get(`${root}/shortcuts`).set('Cookie', memberCookie)).body.campaignIds,
    [],
  );
  await save([list[0].id, list[0].id]).expect(400);
  await save(Array.from({ length: 7 }, () => randomUUID())).expect(400);
  await save([randomUUID()]).expect(400);
  await request(server).get(`${root}/shortcuts`).set('Cookie', otherCookie).expect(404);
  const adminPins = (
    await request(server)
      .get(`/api/v1/groupements/${g}/campaigns/shortcuts`)
      .set('Cookie', adminCookie)
  ).body.campaignIds;
  await save([], adminCookie).expect(200);
  assert.deepEqual(
    (
      await request(server)
        .get(`/api/v1/groupements/${g}/campaigns/shortcuts`)
        .set('Cookie', adminCookie)
    ).body.campaignIds,
    adminPins,
  );
  assert.deepEqual(
    (await request(server).get(`${root}/shortcuts`).set('Cookie', memberCookie)).body.campaignIds,
    [],
  );
  await save([list[0].id]).expect(200);
  await request(server)
    .patch(`/api/v1/groupements/${g}/campaigns/${list[0].id}/activation`)
    .set(headers)
    .set('Cookie', superCookie)
    .send({ active: false })
    .expect(200);
  assert.deepEqual(
    (await request(server).get(`${root}/shortcuts`).set('Cookie', memberCookie)).body.campaignIds,
    [],
  );
});

test('membre : historique global, archives, filtres multiples avant pagination et badges par tour', async () => {
  const server = app.getHttpServer();
  const clock = mock.method(
    require('../dist/common/savings-schedule.js'),
    'savingsToday',
    () => '2026-06-02',
  );
  try {
    const types = (await request(server).get('/api/v1/campaign-types').set('Cookie', adminCookie))
      .body;
    const typeSavings = types.find((t: any) => t.code === 'AVEC'),
      typeTontine = types.find((t: any) => t.code === 'TONTINE');
    const ids: string[] = [],
      members: string[] = [];
    let otherPayment = '';
    for (const type of [typeSavings, typeTontine]) {
      const campaign = (
        await request(server)
          .post(`/api/v1/groupements/${g}/campaigns`)
          .set(headers)
          .set('Cookie', adminCookie)
          .send({
            name: `Historique personnel ${type.code}`,
            typeId: type.id,
            startDate: '2026-06-02',
            endDate: '2026-12-31',
            weekday: 2,
            standardAmount: 1000,
            rotationInterval: type === typeTontine ? 'MONTHLY' : undefined,
          })
          .expect(201)
      ).body;
      ids.push(campaign.id);
      const root = `/api/v1/groupements/${g}/campaigns/${campaign.id}`;
      let own = '';
      let adminPart = '';
      for (const membershipId of [memberId, adminId]) {
        const p = (
          await request(server)
            .post(`${root}/participants`)
            .set(headers)
            .set('Cookie', adminCookie)
            .send({ membershipId, isRandom: type === typeSavings })
            .expect(201)
        ).body;
        if (membershipId === memberId) own = p.id;
        else adminPart = p.id;
      }
      if (type === typeSavings)
        await request(server)
          .post(`${root}/savings-session`)
          .set(headers)
          .set('Cookie', adminCookie)
          .expect(201);
      else
        await request(server)
          .post(`${root}/tontine/draw`)
          .set(headers)
          .set('Cookie', adminCookie)
          .expect(201);
      await pg.exec('RESET ROLE');
      try {
        await pg.query("UPDATE participations SET created_at='2026-06-01T00:00:00Z' WHERE id=$1", [
          own,
        ]);
      } finally {
        await pg.exec('SET ROLE aveclesfemmes_app');
      }
      const before = (
        await request(server)
          .get(`/api/v1/groupements/${g}/member/campaigns`)
          .set('Cookie', memberCookie)
      ).body.items.find((c: any) => c.id === campaign.id);
      assert.equal(before.unpaid_count, 1);
      const paid = (
        await request(server)
          .post(`${root}/contributions/self`)
          .set(headers)
          .set('Cookie', memberCookie)
          .send({ amount: type === typeSavings ? 123 : 1000, idempotencyKey: randomUUID() })
          .expect(201)
      ).body;
      members.push(paid.id);
      assert.equal(
        (
          await request(server)
            .get(`/api/v1/groupements/${g}/member/campaigns`)
            .set('Cookie', memberCookie)
        ).body.items.find((c: any) => c.id === campaign.id).unpaid_count,
        0,
      );
      if (type === typeSavings) {
        otherPayment = (
          await request(server)
            .post(`${root}/contributions`)
            .set(headers)
            .set('Cookie', adminCookie)
            .send({
              participationId: adminPart,
              amount: 999,
              paidOn: '2026-06-02',
              idempotencyKey: randomUUID(),
            })
            .expect(201)
        ).body.id;
        await request(server)
          .patch(`${root}/activation`)
          .set(headers)
          .set('Cookie', superCookie)
          .send({ active: false })
          .expect(200);
      }
    }
    const root = `/api/v1/groupements/${g}/member/history`;
    const get = (query: any = {}, cookie = memberCookie) =>
      request(server).get(root).query(query).set('Cookie', cookie);
    const all = (await get({ limit: 100 }).expect(200)).body;
    for (const id of members) assert.ok(all.items.some((p: any) => p.id === id));
    assert.equal(
      all.items.some((p: any) => p.id === otherPayment),
      false,
    );
    const selected = (await get({ campaignIds: ids.join(','), limit: 1 }).expect(200)).body;
    assert.equal(selected.total, 2);
    assert.equal(selected.items.length, 1);
    assert.equal(selected.total_paid, '1123');
    const second = (await get({ campaignIds: ids.join(','), limit: 1, page: 2 }).expect(200)).body;
    assert.notEqual(selected.items[0].id, second.items[0].id);
    const filtered = (
      await get({
        campaignIds: ids.join(','),
        typeIds: typeSavings.id,
        sessions: '2026-06-02',
      }).expect(200)
    ).body;
    assert.equal(filtered.total, 1);
    assert.equal(filtered.items[0].id, members[0]);
    assert.equal(filtered.items[0].campaign_active, false);
    const tour = (await get({ rounds: `${ids[1]}:1` }).expect(200)).body;
    assert.equal(tour.total, 1);
    assert.equal(tour.items[0].id, members[1]);
    assert.equal(tour.items[0].round_number, 1);
    const combined = (
      await get({
        campaignIds: ids.join(','),
        typeIds: [typeSavings.id, typeTontine.id].join(','),
        sessions: '2026-06-02',
        rounds: `${ids[1]}:1`,
      }).expect(200)
    ).body;
    assert.equal(combined.total, 2);
    assert.equal(
      (await get({ typeIds: typeSavings.id, rounds: `${ids[1]}:1` }).expect(200)).body.total,
      0,
    );
    assert.equal((await get({ campaignIds: randomUUID() }).expect(200)).body.total, 0);
    const admin = (await get({ campaignIds: ids[0] }, adminCookie).expect(200)).body;
    assert.equal(admin.total, 1);
    assert.equal(admin.items[0].id, otherPayment);
    const options = (
      await request(server).get(`${root}/options`).set('Cookie', memberCookie).expect(200)
    ).body;
    assert.equal(options.campaigns.find((c: any) => c.id === ids[0]).active, false);
    assert.ok(options.sessions.includes('2026-06-02'));
    assert.ok(options.rounds.some((r: any) => r.key === `${ids[1]}:1`));
    await get({}, otherCookie).expect(404);
    await get({ campaignIds: 'invalid' }).expect(400);
    await get({ sessions: '2026-02-31' }).expect(400);
    await get({ rounds: 'invalid:1' }).expect(400);
  } finally {
    clock.mock.restore();
  }
});

test('code secret : configuration authentifiée, code distinct du mot de passe et rotation de session', async () => {
  const login = 'code.' + randomUUID().slice(0, 8),
    id = randomUUID();
  await pg.query('INSERT INTO app_users(id,login,name,password_hash) VALUES($1,$2,$2,$3)', [
    id,
    login,
    hashPassword(testPassword),
  ]);
  const initial = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set(headers)
    .send({ login, password: testPassword })
    .expect(201);
  const cookie = initial.headers['set-cookie'][0].split(';')[0];
  assert.equal(initial.body.hasSecretCode, false);
  await request(app.getHttpServer())
    .post('/api/v1/auth/secret-code')
    .set(headers)
    .send({ password: testPassword, code: '2468' })
    .expect(401);
  await request(app.getHttpServer())
    .post('/api/v1/auth/secret-code')
    .set('Cookie', cookie)
    .send({ password: testPassword, code: '2468' })
    .expect(403);
  await request(app.getHttpServer())
    .post('/api/v1/auth/secret-code')
    .set(headers)
    .set('Cookie', cookie)
    .send({ password: 'wrong', code: '2468' })
    .expect(401);
  await request(app.getHttpServer())
    .post('/api/v1/auth/secret-code')
    .set(headers)
    .set('Cookie', cookie)
    .send({ password: testPassword, code: 'abc4' })
    .expect(400);
  const configured = await request(app.getHttpServer())
    .post('/api/v1/auth/secret-code')
    .set(headers)
    .set('Cookie', cookie)
    .send({ password: testPassword, code: '2468' })
    .expect(201);
  assert.equal(configured.body.hasSecretCode, true);
  await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', cookie).expect(401);
  const device = configured.headers['set-cookie']
    .find((v: string) => v.startsWith('alf_device='))
    .split(';')[0];
  const pin = await request(app.getHttpServer())
    .post('/api/v1/auth/login/secret-code')
    .set('Cookie', device)
    .set(headers)
    .send({ login, code: '2468' })
    .expect(201);
  assert.equal(pin.body.id, id);
  await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set(headers)
    .send({ login, password: testPassword })
    .expect(201);
  const hashes = (
    await pg.query('SELECT password_hash,secret_code_hash FROM app_users WHERE id=$1', [id])
  ).rows[0];
  assert.notEqual(hashes.password_hash, hashes.secret_code_hash);
  assert.match(hashes.secret_code_hash, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
});

test('code secret : confirmation serveur, blocage après cinq erreurs et récupération par mot de passe', async () => {
  const login = 'secure.' + randomUUID().slice(0, 8),
    id = randomUUID(),
    group = randomUUID();
  await pg.query(
    'INSERT INTO app_users(id,login,name,password_hash,secret_code_hash) VALUES($1,$2,$2,$3,$4)',
    [id, login, hashPassword(testPassword), hashPassword('2468')],
  );
  await pg.exec('RESET ROLE');
  try {
    await pg.query(
      "INSERT INTO groupements(id,name,address,responsible,phone) VALUES($1,'Code','Dakar','','+221770000111')",
      [group],
    );
    await pg.query(
      "INSERT INTO memberships(id,group_id,user_id,name,role) VALUES($1,$2,$3,'Admin code','ADMIN')",
      [randomUUID(), group, id],
    );
  } finally {
    await pg.exec('SET ROLE aveclesfemmes_app');
  }
  const enrolled = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set(headers)
    .send({ login, password: testPassword })
    .expect(201);
  let device = enrolled.headers['set-cookie']
    .find((v: string) => v.startsWith('alf_device='))
    .split(';')[0];
  const auth = await request(app.getHttpServer())
    .post('/api/v1/auth/login/secret-code')
    .set('Cookie', device)
    .set(headers)
    .send({ login, code: '2468' })
    .expect(201);
  const cookie = auth.headers['set-cookie'][0].split(';')[0];
  const target = `/api/v1/groupements/${group}/appearance`,
    palette = { primary: '#155d50', savings: '#197647', tontine: '#471976', solidarity: '#764019' };
  await request(app.getHttpServer())
    .put(target)
    .set('X-Requested-With', 'AvecLesFemmes')
    .set('Cookie', cookie)
    .send(palette)
    .expect(403);
  await request(app.getHttpServer())
    .put(target)
    .set('X-Requested-With', 'AvecLesFemmes')
    .set('X-Confirm-Secret-Code', '0000')
    .set('Cookie', cookie)
    .send(palette)
    .expect(403);
  await request(app.getHttpServer())
    .put(target)
    .set('X-Requested-With', 'AvecLesFemmes')
    .set('X-Confirm-Secret-Code', '2468')
    .set('Cookie', cookie)
    .send(palette)
    .expect(200);
  for (let i = 0; i < 5; i++)
    await request(app.getHttpServer())
      .post('/api/v1/auth/login/secret-code')
      .set('Cookie', device)
      .set(headers)
      .send({ login, code: '0000' })
      .expect(401);
  await request(app.getHttpServer())
    .post('/api/v1/auth/login/secret-code')
    .set('Cookie', device)
    .set(headers)
    .send({ login, code: '2468' })
    .expect(401);
  await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set(headers)
    .send({ login, password: testPassword })
    .expect(401);
  await pg.query("UPDATE app_users SET locked_until=now()-interval '1 minute' WHERE id=$1", [id]);
  const recovery = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set(headers)
    .send({ login, password: testPassword })
    .expect(201);
  const reconfigured = await request(app.getHttpServer())
    .post('/api/v1/auth/secret-code')
    .set(headers)
    .set('Cookie', recovery.headers['set-cookie'][0].split(';')[0])
    .send({ password: testPassword, code: '1357' })
    .expect(201);
  device = reconfigured.headers['set-cookie']
    .find((v: string) => v.startsWith('alf_device='))
    .split(';')[0];
  await request(app.getHttpServer())
    .post('/api/v1/auth/login/secret-code')
    .set('Cookie', device)
    .set(headers)
    .send({ login, code: '2468' })
    .expect(401);
  await request(app.getHttpServer())
    .post('/api/v1/auth/login/secret-code')
    .set('Cookie', device)
    .set(headers)
    .send({ login, code: '1357' })
    .expect(201);
});

test('code secret : refus du Super Admin et limites de format', async () => {
  await request(app.getHttpServer())
    .post('/api/v1/auth/secret-code')
    .set(headers)
    .set('Cookie', superCookie)
    .send({ password: testPassword, code: '2468' })
    .expect(403);
  for (const code of ['123', '12345', 'abcd', '12 4'])
    await request(app.getHttpServer())
      .post('/api/v1/auth/login/secret-code')
      .set(headers)
      .send({ login: 'member', code })
      .expect(400);
});

test('synchronisation signée : sans session, portée exacte, validations métier, idempotence et révocation', async () => {
  const { offlineSignature } = await import('../dist/auth/password.js');
  const uid = randomUUID(),
    group = randomUUID(),
    campaign = randomUUID(),
    membership = randomUUID(),
    participation = randomUUID();
  const login = 'offline.' + randomUUID().slice(0, 8);
  const today = require('../dist/common/savings-schedule.js').savingsToday();
  await pg.exec('RESET ROLE');
  try {
    await pg.query('INSERT INTO app_users(id,login,name,password_hash) VALUES($1,$2,$2,$3)', [
      uid,
      login,
      hashPassword(testPassword),
    ]);
    await pg.query(
      "INSERT INTO groupements(id,name,address,responsible,phone) VALUES($1,'Offline','Dakar','','+221770000222')",
      [group],
    );
    await pg.query(
      "INSERT INTO memberships(id,group_id,user_id,name,role) VALUES($1,$2,$3,'Offline','ADMIN')",
      [membership, group, uid],
    );
    const type = (await pg.query("SELECT id FROM campaign_types WHERE code='AVEC' LIMIT 1")).rows[0]
      .id;
    await pg.query(
      "INSERT INTO campaigns(id,group_id,type_id,name,start_date,end_date,weekday,rule_version) VALUES($1,$2,$3,'Offline','2026-01-01','2026-12-31',$4,1)",
      [campaign, group, type, new Date(today + 'T12:00:00Z').getUTCDay()],
    );
    await pg.query(
      'INSERT INTO participations(id,group_id,campaign_id,membership_id) VALUES($1,$2,$3,$4)',
      [participation, group, campaign, membership],
    );
    await pg.query(
      'INSERT INTO savings_sessions(id,group_id,campaign_id,session_date,created_by) VALUES($1,$2,$3,$4,$5)',
      [randomUUID(), group, campaign, today, uid],
    );
  } finally {
    await pg.exec('SET ROLE aveclesfemmes_app');
  }
  const server = app.getHttpServer();
  const enrolled = await request(server)
    .post('/api/v1/auth/login')
    .set(headers)
    .send({ login, password: testPassword })
    .expect(201);
  const device = enrolled.headers['set-cookie']
    .find((v: string) => v.startsWith('alf_device='))
    .split(';')[0];
  const key = enrolled.headers['x-alf-sync-key'];
  assert.match(key, /^[a-f0-9]{64}$/);
  assert.notEqual(key, enrolled.headers['x-alf-vault-key']);
  const path = `/api/v1/groupements/${group}/campaigns/${campaign}/contributions`;
  const body = {
    participationId: participation,
    amount: 550,
    paidOn: today,
    idempotencyKey: randomUUID(),
  };
  const signed = (route = path, input: any = body) => {
    const payload = JSON.stringify(input);
    return { login, path: route, payload, signature: offlineSignature(key, login, route, payload) };
  };
  await pg.query('DELETE FROM sessions WHERE user_id=$1', [uid]);
  await request(server).post('/api/v1/auth/offline-replay').set(headers).send(signed()).expect(403);
  await request(server)
    .post('/api/v1/auth/offline-replay')
    .set('Cookie', device)
    .send(signed())
    .expect(403);
  await request(server)
    .post('/api/v1/auth/offline-replay')
    .set(headers)
    .set('Cookie', device)
    .send({ ...signed(), payload: JSON.stringify({ ...body, amount: 999 }) })
    .expect(403);
  await request(server)
    .post('/api/v1/auth/offline-replay')
    .set(headers)
    .set('Cookie', device)
    .send(signed('/api/v1/groupements/' + group + '/appearance'))
    .expect(400);
  await request(server)
    .post('/api/v1/auth/offline-replay')
    .set(headers)
    .set('Cookie', device)
    .send(signed(path, { ...body, amount: -1 }))
    .expect(400);
  await request(server)
    .post('/api/v1/auth/offline-replay')
    .set(headers)
    .set('Cookie', device)
    .send(signed(path, { ...body, extra: true }))
    .expect(400);
  await request(server)
    .post('/api/v1/auth/offline-replay')
    .set(headers)
    .set('Cookie', device)
    .send(signed(path.replace(group, otherGroup)))
    .expect(404);
  await pg.exec('RESET ROLE');
  await pg.query("UPDATE memberships SET role='MEMBER' WHERE id=$1", [membership]);
  await pg.exec('SET ROLE aveclesfemmes_app');
  await request(server)
    .post('/api/v1/auth/offline-replay')
    .set(headers)
    .set('Cookie', device)
    .send(signed())
    .expect(403);
  const self = signed(path + '/self', { amount: 777, paidOn: today, idempotencyKey: randomUUID() });
  await request(server)
    .post('/api/v1/auth/offline-replay')
    .set(headers)
    .set('Cookie', device)
    .send(self)
    .expect(201);
  await pg.exec('RESET ROLE');
  await pg.query("UPDATE memberships SET role='ADMIN' WHERE id=$1", [membership]);
  await pg.exec('SET ROLE aveclesfemmes_app');
  const responses = await Promise.all(
    Array.from({ length: 2 }, () =>
      request(server)
        .post('/api/v1/auth/offline-replay')
        .set(headers)
        .set('Cookie', device)
        .send(signed())
        .expect(201),
    ),
  );
  assert.equal(responses[0].body.id, responses[1].body.id);
  assert.equal(responses[0].body.amount, '550');
  assert.equal(responses[0].body.paid_on, today);
  await request(server).get('/api/v1/auth/me').set('Cookie', device).expect(401); // Replay never creates a general session.
  await request(server)
    .post('/api/v1/auth/offline-replay')
    .set(headers)
    .set('Cookie', device)
    .send(signed(path, { ...body, amount: 551 }))
    .expect(409);
  await request(server)
    .post('/api/v1/auth/offline-replay')
    .set(headers)
    .set('Cookie', device)
    .send(signed(path + '/self', { amount: 5, idempotencyKey: randomUUID() }))
    .expect(400);
  await request(server)
    .post('/api/v1/auth/offline-replay')
    .set(headers)
    .set('Cookie', device)
    .send(signed(path, { ...body, paidOn: '2026-06-01', idempotencyKey: randomUUID() }))
    .expect(400);
  await request(server)
    .post('/api/v1/auth/forget-device')
    .set(headers)
    .set('Cookie', device)
    .send({ login: 'super', password: testPassword })
    .expect(201);
  await request(server)
    .post('/api/v1/auth/offline-replay')
    .set(headers)
    .set('Cookie', device)
    .send(signed())
    .expect(403);
});

test('campagnes mensuelles : premier dimanche, ouverture et cotisation réelles, tontine sans événement', async () => {
  const types = (
    await request(app.getHttpServer())
      .get('/api/v1/campaign-types')
      .set('Cookie', adminCookie)
      .expect(200)
  ).body;
  const route = `/api/v1/groupements/${g}/campaigns`;
  const input = {
    name: 'Sokorou Kor mensuel',
    typeId: types.find((t: any) => t.code === 'AVEC').id,
    startDate: '2026-05-03',
    endDate: '2027-02-28',
    weekday: 0,
    rotationInterval: 'MONTHLY',
    monthlyWeek: 1,
    standardAmount: 3000,
  };
  for (const bad of [{ monthlyWeek: 0 }, { monthlyWeek: 5 }, { rotationInterval: 'WEEKLY' }])
    await request(app.getHttpServer())
      .post(route)
      .set('Cookie', adminCookie)
      .set(headers)
      .send({ ...input, ...bad })
      .expect(400);
  const campaign = (
    await request(app.getHttpServer())
      .post(route)
      .set('Cookie', adminCookie)
      .set(headers)
      .send(input)
      .expect(201)
  ).body;
  assert.equal(campaign.monthly_week, 1);
  assert.equal(campaign.rotation_interval, 'MONTHLY');
  assert.equal(campaign.weekday, 0);
  const membership = adminId;
  const part = (
    await request(app.getHttpServer())
      .post(`${route}/${campaign.id}/participants`)
      .set('Cookie', adminCookie)
      .set(headers)
      .send({ membershipId: membership })
      .expect(201)
  ).body;
  assert.equal(part.forfait, '3000');
  let today = '2026-05-03';
  const clock = mock.method(
    require('../dist/common/savings-schedule.js'),
    'savingsToday',
    () => today,
  );
  try {
    const path = `${route}/${campaign.id}`;
    await request(app.getHttpServer())
      .post(`${path}/savings-session`)
      .set('Cookie', adminCookie)
      .set(headers)
      .send({})
      .expect(201);
    await request(app.getHttpServer())
      .post(`${path}/contributions`)
      .set('Cookie', adminCookie)
      .set(headers)
      .send({ participationId: part.id, amount: 3000, paidOn: today, idempotencyKey: randomUUID() })
      .expect(201);
    today = '2026-05-10';
    await request(app.getHttpServer())
      .post(`${path}/savings-session`)
      .set('Cookie', adminCookie)
      .set(headers)
      .send({})
      .expect(400);
    today = '2026-06-07';
    await request(app.getHttpServer())
      .post(`${path}/savings-session`)
      .set('Cookie', adminCookie)
      .set(headers)
      .send({})
      .expect(201);
    const tontine = (
      await request(app.getHttpServer())
        .post(route)
        .set('Cookie', adminCookie)
        .set(headers)
        .send({
          ...input,
          name: 'Natte-10000 mensuel',
          standardAmount: 1000,
          typeId: types.find((t: any) => t.code === 'TONTINE').id,
        })
        .expect(201)
    ).body;
    assert.equal(tontine.event_id, null);
    await request(app.getHttpServer())
      .post(`${route}/${tontine.id}/participants`)
      .set('Cookie', adminCookie)
      .set(headers)
      .send({ membershipId: membership })
      .expect(201);
    today = '2026-05-03';
    const status = (
      await request(app.getHttpServer())
        .get(`${route}/${tontine.id}/tontine/status`)
        .set('Cookie', adminCookie)
        .expect(200)
    ).body;
    assert.equal(status.round_date, '2026-05-03');
  } finally {
    clock.mock.restore();
  }
});

test('démonstration : aucun ancien raccourci ni secret par défaut sans configuration explicite', async () => {
  const before = process.env.DEMO_PASSWORD;
  try {
    delete process.env.DEMO_PASSWORD;
    const disabled = await request(app.getHttpServer()).get('/api/v1/auth/demo').expect(200);
    assert.deepEqual(disabled.body, { demoPassword: null, isDemo: false });
    process.env.DEMO_PASSWORD = 'Synthetic-demo-password-2026';
    const enabled = await request(app.getHttpServer()).get('/api/v1/auth/demo').expect(200);
    assert.equal(enabled.body.isDemo, true);
    assert.equal(enabled.body.demoPassword, process.env.DEMO_PASSWORD);
  } finally {
    if (before === undefined) delete process.env.DEMO_PASSWORD;
    else process.env.DEMO_PASSWORD = before;
  }
});

test('assistance appareil : identifiants Super Admin obligatoires, aucune session administrative créée', async () => {
  const server = app.getHttpServer();
  const before = await pg.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM sessions s JOIN app_users u ON u.id=s.user_id WHERE u.login='super'",
  );
  const forget = () => request(server).post('/api/v1/auth/forget-device').set(headers);
  await forget().send({}).expect(400);
  await forget()
    .send({ login: 'super', password: 'Incorrect-password-for-assistance' })
    .expect(401);
  for (const login of ['admin', 'member'])
    await forget().send({ login, password: testPassword }).expect(403);
  const initial = await request(server)
    .post('/api/v1/auth/login')
    .set(headers)
    .send({ login: 'admin', password: testPassword })
    .expect(201);
  const device = initial.headers['set-cookie']
    .find((value: string) => value.startsWith('alf_device='))
    .split(';')[0];
  const result = await forget()
    .set('Cookie', device)
    .send({ login: 'super', password: testPassword })
    .expect(201);
  assert.ok(
    result.headers['set-cookie'].every((value: string) => !/^alf_session=[^;]+/.test(value)),
  );
  const after = await pg.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM sessions s JOIN app_users u ON u.id=s.user_id WHERE u.login='super'",
  );
  assert.equal(after.rows[0].count, before.rows[0].count);
  assert.equal(
    (
      await pg.query('SELECT 1 FROM trusted_devices WHERE token_hash=$1', [
        digest(device.slice('alf_device='.length)),
      ])
    ).rows.length,
    0,
  );
});

async function phoneTestSuper() {
  const r = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set(headers)
    .send({ login: 'super', password: testPassword })
    .expect(201);
  return r.headers['set-cookie'].find((s: string) => s.startsWith('alf_session=')).split(';')[0];
}
async function phoneTestMember(suffix: string, pin?: string, admin = false) {
  const server = app.getHttpServer(),
    cookie = await phoneTestSuper();
  const group = (
    await request(server)
      .post('/api/v1/groupements')
      .set(headers)
      .set('Cookie', cookie)
      .send({
        name: 'Téléphone test ' + suffix,
        address: 'Données synthétiques',
        phone: '+221770000099',
      })
      .expect(201)
  ).body;
  const phone = '+22177988' + suffix,
    login = 'telephone.' + suffix;
  const password = 'Personal-password-only-' + suffix;
  const member = (
    await request(server)
      .post(`/api/v1/groupements/${group.id}/members`)
      .set(headers)
      .set('Cookie', cookie)
      .send({
        name: 'Membre téléphone ' + suffix,
        phone,
        login,
        password,
        admin,
        ...(pin ? { initialPin: pin } : {}),
      })
      .expect(201)
  ).body;
  return { cookie, group: group.id, member: member.id, phone, login, password };
}
function phoneCookies(response: any) {
  return response.headers['set-cookie']
    .filter((s: string) => /^alf_(session|device)=/.test(s))
    .map((s: string) => s.split(';')[0]);
}

test('téléphone puis PIN existant : membre et responsable, normalisation, appareil et mot de passe personnel conservé', async () => {
  const server = app.getHttpServer();
  for (const [suffix, pin, admin] of [
    ['1001', '1379', true],
    ['1002', '8642', false],
  ] as const) {
    const u = await phoneTestMember(suffix, pin, admin);
    await request(server)
      .post('/api/v1/auth/login/phone-pin')
      .set(headers)
      .send({ phone: u.phone })
      .expect(400);
    const result = await request(server)
      .post('/api/v1/auth/login/phone-pin')
      .set(headers)
      .send({ phone: u.phone.slice(4), pin })
      .expect(201);
    assert.equal(result.body.login, u.login);
    assert.equal(result.body.phone, u.phone);
    assert.equal(result.body.isSuper, false);
    assert.equal(result.body.hasSecretCode, true);
    assert.equal(result.body.pin, undefined);
    assert.equal(result.body.password, undefined);
    assert.match(result.headers['x-alf-vault-key'], /^[a-f0-9]{64}$/);
    const cookies = phoneCookies(result);
    const list = (
      await request(server).get('/api/v1/groupements').set('Cookie', cookies).expect(200)
    ).body;
    assert.equal(list.items.find((g: any) => g.id === u.group).my_role, admin ? 'ADMIN' : 'MEMBER');
    const repeat = await request(server)
      .post('/api/v1/auth/login/phone-pin')
      .set(headers)
      .set('Cookie', cookies)
      .send({ phone: '00' + u.phone.slice(1), pin })
      .expect(201);
    assert.equal(repeat.headers['x-alf-vault-key'], result.headers['x-alf-vault-key']);
    await request(server)
      .post('/api/v1/auth/vault/password')
      .set(headers)
      .set(
        'Cookie',
        phoneCookies(repeat).filter((c: string) => c.startsWith('alf_session=')),
      )
      .send({ password: u.password })
      .expect(403);
    const recovery = await request(server)
      .post('/api/v1/auth/vault/password')
      .set(headers)
      .set('Cookie', phoneCookies(repeat))
      .send({ password: u.password })
      .expect(201);
    assert.equal(recovery.headers['x-alf-vault-key'], repeat.headers['x-alf-vault-key']);
    assert.deepEqual(recovery.body, { ok: true });
    const row = (await pg.query('SELECT password_hash FROM app_users WHERE login=$1', [u.login]))
      .rows[0];
    const { verifyPassword } = require('../src/auth/password');
    assert.ok(verifyPassword(u.password, row.password_hash));
    assert.equal(verifyPassword(pin, row.password_hash), false);
  }
});

test('PIN téléphone : cinq erreurs partagées entre première connexion et appareil mémorisé', async () => {
  const server = app.getHttpServer(),
    u = await phoneTestMember('1003', '1597');
  const first = await request(server)
    .post('/api/v1/auth/login/phone-pin')
    .set(headers)
    .send({ phone: u.phone, pin: '1597' })
    .expect(201);
  const device = phoneCookies(first).find((c: string) => c.startsWith('alf_device='));
  for (let n = 0; n < 3; n++)
    await request(server)
      .post('/api/v1/auth/login/phone-pin')
      .set(headers)
      .send({ phone: n % 2 ? u.phone : u.phone.slice(4), pin: '0000' })
      .expect(401);
  for (let n = 0; n < 2; n++)
    await request(server)
      .post('/api/v1/auth/login/secret-code')
      .set(headers)
      .set('Cookie', device)
      .send({ login: u.login, code: '0000' })
      .expect(401);
  await request(server)
    .post('/api/v1/auth/login/phone-pin')
    .set(headers)
    .send({ phone: u.phone, pin: '1597' })
    .expect(401);
  const row = (
    await pg.query('SELECT failed_attempts,locked_until FROM app_users WHERE login=$1', [u.login])
  ).rows[0];
  assert.equal(row.failed_attempts, 5);
  assert.ok(new Date(row.locked_until).getTime() > Date.now());
});

test('PIN personnel : initialisation par Super Admin, révocation effective et téléphone de connexion protégé', async () => {
  const server = app.getHttpServer(),
    u = await phoneTestMember('1004');
  const path = `/api/v1/groupements/${u.group}/members/${u.member}`;
  await request(server)
    .post('/api/v1/auth/login/phone-pin')
    .set(headers)
    .send({ phone: u.phone, pin: '1379' })
    .expect(401);
  const admin = await request(server)
    .post('/api/v1/auth/login')
    .set(headers)
    .send({ login: 'admin', password: testPassword })
    .expect(201);
  await request(server)
    .post(path + '/initial-pin')
    .set(headers)
    .set('Cookie', phoneCookies(admin))
    .send({ pin: '1379' })
    .expect(403);
  await request(server)
    .post(path + '/initial-pin')
    .set(headers)
    .set('Cookie', u.cookie)
    .send({ pin: '1379' })
    .expect(201);
  const first = await request(server)
    .post('/api/v1/auth/login/phone-pin')
    .set(headers)
    .send({ phone: u.phone, pin: '1379' })
    .expect(201);
  await request(server)
    .post(path + '/initial-pin')
    .set(headers)
    .set('Cookie', u.cookie)
    .send({ pin: '2468' })
    .expect(201);
  await request(server).get('/api/v1/auth/me').set('Cookie', phoneCookies(first)).expect(401);
  await request(server)
    .post('/api/v1/auth/login/phone-pin')
    .set(headers)
    .send({ phone: u.phone, pin: '1379' })
    .expect(401);
  await request(server)
    .post('/api/v1/auth/login/phone-pin')
    .set(headers)
    .send({ phone: u.phone, pin: '2468' })
    .expect(201);
  await pg.exec('RESET ROLE');
  let audit;
  try {
    audit = (
      await pg.query(
        "SELECT payload FROM audit_events WHERE entity_id=$1 AND action='MEMBER_PIN_INITIALIZED' ORDER BY created_at DESC LIMIT 1",
        [u.member],
      )
    ).rows[0];
  } finally {
    await pg.exec('SET ROLE aveclesfemmes_app');
  }
  assert.deepEqual(audit.payload, {});
  await request(server)
    .patch(path)
    .set(headers)
    .set('Cookie', u.cookie)
    .send({ phone: '779881005' })
    .expect(200);
  await request(server)
    .post('/api/v1/auth/login/phone-pin')
    .set(headers)
    .send({ phone: u.phone, pin: '2468' })
    .expect(401);
  await request(server)
    .post('/api/v1/auth/login/phone-pin')
    .set(headers)
    .send({ phone: '779881005', pin: '2468' })
    .expect(201);
});

test('PIN téléphone : numéro inconnu, PIN absent et compte Super Admin ne donnent aucun accès', async () => {
  const server = app.getHttpServer(),
    id = randomUUID();
  await pg.exec('RESET ROLE');
  await pg.query(
    'INSERT INTO app_users(id,login,name,phone,password_hash,secret_code_hash,is_super) VALUES($1,$2,$2,$3,$4,$5,true)',
    [id, 'super.phone-only', '+221779881006', hashPassword(testPassword), hashPassword('1379')],
  );
  await pg.exec('SET ROLE aveclesfemmes_app');
  for (const phone of ['+221779881006', '+221779881007'])
    await request(server)
      .post('/api/v1/auth/login/phone-pin')
      .set(headers)
      .send({ phone, pin: '1379' })
      .expect(401);
});
