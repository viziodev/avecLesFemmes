import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { Test } from '@nestjs/testing';
import request from 'supertest';
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
const headers = { 'X-Requested-With': 'AvecLesFemmes' };
const testPassword = 'Test-only-password-2026';
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

test('authentification membre par code PIN à 4 chiffres et verrouillage anti-bruteforce', async () => {
  const pinPhone = '+221770000099';
  const pinUser = randomUUID();
  const { hashPassword } = await import('../dist/auth/password.js');
  await pg.query(
    'INSERT INTO app_users(id,login,name,phone,password_hash) VALUES($1,$2,$2,$2,$3)',
    [pinUser, pinPhone, hashPassword('1234')],
  );

  // Échec avec mauvais code PIN
  await request(app.getHttpServer())
    .post('/api/v1/auth/login/pin')
    .set(headers)
    .send({ phone: pinPhone, pin: '0000' })
    .expect(401);

  // Succès avec le bon PIN
  const success = await request(app.getHttpServer())
    .post('/api/v1/auth/login/pin')
    .set(headers)
    .send({ phone: pinPhone, pin: '1234' })
    .expect(201);
  assert.equal(success.body.id, pinUser);

  // 5 tentatives erronées successives
  for (let i = 0; i < 5; i++) {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login/pin')
      .set(headers)
      .send({ phone: pinPhone, pin: '9999' })
      .expect(401);
  }

  // 6ème tentative : compte temporairement bloqué même avec le bon PIN
  const blocked = await request(app.getHttpServer())
    .post('/api/v1/auth/login/pin')
    .set(headers)
    .send({ phone: pinPhone, pin: '1234' })
    .expect(401);
  assert.ok(blocked.body.message.includes('bloqué'));
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
      pin: '5678',
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
    .send({ membershipId: created.body.id, forfait: 5000 })
    .expect(201);

  // Cotisation réussit
  await request(app.getHttpServer())
    .post(`/api/v1/groupements/${g}/campaigns/${camp}/contributions`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send({
      participationId: partOk.body.id,
      amount: 5000,
      paidOn: '2026-06-03',
      idempotencyKey: randomUUID(),
    })
    .expect(201);
});

test('tontine rotative, tirage au sort, séances et état de la caisse', async () => {
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
  assert.equal(rounds.body.length, 2);
  assert.equal(rounds.body[0].payout_amount, '20000');

  // Marquer le tour 1 comme versé
  await request(app.getHttpServer())
    .patch(`/api/v1/groupements/${g}/campaigns/${tontineCamp.body.id}/tontine/rounds/1/pay`)
    .set(headers)
    .set('Cookie', adminCookie)
    .expect(200);

  // Délai de grâce individuel
  const grace = await request(app.getHttpServer())
    .post(`/api/v1/groupements/${g}/campaigns/${tontineCamp.body.id}/grace-periods`)
    .set(headers)
    .set('Cookie', adminCookie)
    .send({
      membershipId: memberId,
      periodDate: '2026-06-05',
      extendedDeadline: '2026-06-15',
      reason: 'Déplacement familial',
    })
    .expect(201);
  assert.equal(grace.body.extended_deadline, '2026-06-15');

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
