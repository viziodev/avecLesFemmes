// Dedicated local demo campaigns. Existing campaigns and draws are never overwritten.
import { config } from 'dotenv';
import { createHash } from 'node:crypto';
config({ path: '.env', quiet: true });
const base = 'http://127.0.0.1:3005/api/v1';
let cookie = '';
async function call(path, body, method = body ? 'POST' : 'GET') {
  const r = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'AvecLesFemmes',
      'X-Confirm-Password':
        'utf8:' + Buffer.from(process.env.DEMO_PASSWORD || '').toString('base64'),
      Cookie: cookie,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0];
  const data = await r.json();
  if (!r.ok) throw new Error(`${path}: ${r.status} ${JSON.stringify(data.message)}`);
  return data;
}
await call('/auth/login', { login: 'admin.ndeye', password: process.env.DEMO_PASSWORD });
const group = (await call('/groupements?limit=100')).items.find(
  (g) => g.name === 'Les Femmes de Grand Yoff',
);
if (!group) throw new Error('Groupement de démonstration absent.');
const types = await call('/campaign-types');
const type = (types.items || types).find((t) => /tontine/i.test(t.code + ' ' + t.name));
if (!type) throw new Error('Type Tontine absent.');
const root = `/groupements/${group.id}`;
const members = (await call(`${root}/members?limit=100`)).items.filter(
  (m) => m.active && !m.is_blocked && ['Ndèye Diop', 'Awa Fall', 'Mariama Bâ'].includes(m.name),
);
if (members.length !== 3) throw new Error('Trois membres de démonstration requis.');
const now = new Date(),
  today = now.toISOString().slice(0, 10);
const existing = (await call(`${root}/campaigns?limit=100`)).items;
for (const phase of ['À tirer', 'Encaisser']) {
  const name = `Tontine TOUR TEST ${phase} · ${today}`;
  let campaign = existing.find((c) => c.name === name);
  if (!campaign)
    campaign = await call(`${root}/campaigns`, {
      name,
      typeId: type.id,
      startDate: today,
      endDate: `${now.getUTCFullYear() + 1}-12-31`,
      weekday: now.getUTCDay(),
      intervalWeeks: 4,
      standardAmount: 2000,
      rotationInterval: 'MONTHLY',
    });
  const path = `${root}/campaigns/${campaign.id}`;
  let parts = (await call(`${path}/participants?limit=100`)).items;
  for (const m of members)
    if (!parts.some((p) => p.membership_id === m.id))
      await call(`${path}/participants`, { membershipId: m.id, forfait: 2000 });
  parts = (await call(`${path}/participants?limit=100`)).items;
  if (phase === 'Encaisser') {
    const status = await call(`${path}/tontine/status`);
    if (!status.drawn) await call(`${path}/tontine/draw`, {});
    const recorded = (
      await call(`${path}/contributions?limit=100&from=${today}&to=${today}&status=valid`)
    ).items;
    const payments = parts.slice(0, 2).map((p) => ({ p, paidOn: today, amount: 2000 }));
    for (const [i, payment] of payments.entries()) {
      if (recorded.some((paymentRow) => paymentRow.participation_id === payment.p.id)) continue;
      const hash = createHash('sha256').update(`${campaign.id}:fixed-round-v2:${i}`).digest('hex');
      const key = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
      await call(`${path}/contributions`, {
        participationId: payment.p.id,
        paidOn: payment.paidOn,
        amount: payment.amount,
        idempotencyKey: key,
      });
    }
    const cashbox = await call(`${path}/cashbox`);
    console.log(`${name} : tour du jour tiré, ${cashbox.total_collected} FCFA fictifs collectés.`);
  } else {
    const status = await call(`${path}/tontine/status`);
    console.log(
      `${name} : 3 membres inscrits, ${status.drawn ? 'tirage du jour déjà enregistré' : 'tirage du jour prêt'}.`,
    );
  }
}
