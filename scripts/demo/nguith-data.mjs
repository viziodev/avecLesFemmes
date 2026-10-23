import { randomUUID } from 'node:crypto';
import { hashPassword } from '../../apps/api/dist/auth/password.js';

// Le propriétaire de la connexion gère BEGIN/COMMIT, sauvegarde et choix de cible.
export async function resetNguith(c, credentials) {
  if (
    !credentials.NGUITH_PASSWORD ||
    credentials.NGUITH_PASSWORD.length < 12 ||
    !/^\d{4}$/.test(credentials.NGUITH_PIN || '')
  )
    throw new Error('Secrets de Nguith invalides.');
  if (!(await c.query('SELECT 1 FROM app_users WHERE is_super AND active')).rowCount)
    throw new Error('Super Admin actif requis, il sera conservé.');
  for (const table of [
    'audit_events',
    'contribution_grace_periods',
    'tontine_rounds',
    'contributions',
    'savings_sessions',
    'participations',
    'campaign_shortcut_preferences',
    'member_campaign_shortcut_preferences',
    'group_appearance',
    'groupment_events',
    'groupment_functions',
    'groupment_types',
    'campaigns',
    'memberships',
    'groupements',
    'trusted_devices',
    'sessions',
    'otp_challenges',
  ])
    await c.query(`DELETE FROM ${table}`);
  await c.query('DELETE FROM app_users WHERE NOT is_super');

  const group = randomUUID(),
    user = randomUUID(),
    membership = randomUUID();
  const type = (code) =>
    c.query('SELECT id FROM campaign_types WHERE code=$1', [code]).then((r) => r.rows[0]?.id);
  const event = (code) =>
    c.query('SELECT id FROM campaign_events WHERE code=$1', [code]).then((r) => r.rows[0]?.id);
  const savings = await type('AVEC'),
    tontine = await type('TONTINE');
  const tabaski = await event('TABASKI'),
    ramadan = await event('RAMADAN');
  if (!savings || !tontine || !tabaski || !ramadan)
    throw new Error('Catalogues Épargne/Tontine et Tabaski/Ramadan requis.');
  const president = (await c.query("SELECT id FROM group_functions WHERE code='PRESIDENTE'"))
    .rows[0]?.id;
  if (!president) throw new Error('Fonction Présidente introuvable.');
  await c.query("UPDATE campaign_events SET name='Fêtes de Tabaski' WHERE id=$1", [tabaski]);
  await c.query("UPDATE campaign_events SET name='Ramadan' WHERE id=$1", [ramadan]);
  await c.query(
    "INSERT INTO app_users(id,login,name,password_hash,secret_code_hash) VALUES($1,'awa','Awa',$2,$3)",
    [user, hashPassword(credentials.NGUITH_PASSWORD), hashPassword(credentials.NGUITH_PIN)],
  );
  await c.query(
    "INSERT INTO groupements(id,name,address,responsible,phone) VALUES($1,'Cabalabasse des Femmes de Nguith','Nguith','Awa','')",
    [group],
  );
  for (const id of [savings, tontine])
    await c.query('INSERT INTO groupment_types(group_id,type_id) VALUES($1,$2)', [group, id]);
  await c.query(
    'INSERT INTO groupment_functions(group_id,function_id) SELECT $1,id FROM group_functions',
    [group],
  );
  for (const [id, amount] of [
    [tabaski, 5000],
    [ramadan, 3000],
  ])
    await c.query(
      'INSERT INTO groupment_events(group_id,event_id,default_amount) VALUES($1,$2,$3)',
      [group, id, amount],
    );
  await c.query(
    "INSERT INTO memberships(id,group_id,user_id,name,role,address,gender,function_id) VALUES($1,$2,$3,'Awa','ADMIN','Nguith','F',$4)",
    [membership, group, user, president],
  );
  const campaigns = [
    {
      name: 'Avec',
      type: savings,
      event: tabaski,
      amount: 5000,
      start: '2026-10-25',
      end: '2027-10-24',
      monthly: false,
    },
    {
      name: 'Sokorou Kor',
      type: savings,
      event: ramadan,
      amount: 3000,
      start: '2026-11-01',
      end: '2027-08-31',
      monthly: true,
    },
    {
      name: 'Natte-10000',
      type: tontine,
      event: null,
      amount: 1000,
      start: '2026-11-01',
      end: '2027-08-31',
      monthly: true,
    },
  ];
  const ids = [];
  for (const x of campaigns) {
    const id = randomUUID();
    ids.push(id);
    await c.query(
      'INSERT INTO campaigns(id,group_id,type_id,name,start_date,end_date,weekday,interval_weeks,rule_version,event_id,standard_amount,rotation_interval,monthly_week) VALUES($1,$2,$3,$4,$5,$6,0,1,1,$7,$8,$9,$10)',
      [
        id,
        group,
        x.type,
        x.name,
        x.start,
        x.end,
        x.event,
        x.amount,
        x.monthly ? 'MONTHLY' : null,
        x.monthly ? 1 : null,
      ],
    );
    await c.query(
      'INSERT INTO participations(id,group_id,campaign_id,membership_id,forfait,is_random) VALUES($1,$2,$3,$4,$5,false)',
      [randomUUID(), group, id, membership, x.amount],
    );
    await c.query("UPDATE campaigns SET created_at=now()-($1 * interval '1 second') WHERE id=$2", [
      ids.length - 1,
      id,
    ]);
  }
  for (const table of ['campaign_shortcut_preferences', 'member_campaign_shortcut_preferences'])
    await c.query(`INSERT INTO ${table}(user_id,group_id,campaign_ids) VALUES($1,$2,$3)`, [
      user,
      group,
      ids,
    ]);
  await c.query(
    "INSERT INTO audit_events(id,group_id,actor_id,action,entity_id,payload) VALUES($1,$2,$3,'LOCAL_NGUITH_INITIALIZED',$2,$4)",
    [randomUUID(), group, user, JSON.stringify({ campaigns: campaigns.map((x) => x.name) })],
  );
  const counts = (
    await c.query(
      'SELECT (SELECT count(*)::int FROM groupements) groupements,(SELECT count(*)::int FROM campaigns) campagnes,(SELECT count(*)::int FROM memberships) membres,(SELECT count(*)::int FROM contributions) versements',
    )
  ).rows[0];
  if (
    counts.groupements !== 1 ||
    counts.campagnes !== 3 ||
    counts.membres !== 1 ||
    counts.versements !== 0
  )
    throw new Error('Contrôle final du jeu local échoué.');
  return { ...counts, login: 'awa', groupId: group, campaigns };
}
