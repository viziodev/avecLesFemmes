// Local fixtures only: uses normal authenticated API checks, never modifies existing campaigns.
import { config } from 'dotenv';
import { createHash } from 'node:crypto';
config({ path: '.env', quiet: true });
const base = 'http://127.0.0.1:3005/api/v1';
let cookie = '';
async function call(path, body) {
  const res = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'AvecLesFemmes',
      'X-Confirm-Password':
        'utf8:' + Buffer.from(process.env.DEMO_PASSWORD || '').toString('base64'),
      Cookie: cookie,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.headers.get('set-cookie')) cookie = res.headers.get('set-cookie').split(';')[0];
  const data = await res.json();
  if (!res.ok) throw new Error(`${path}: ${res.status} ${JSON.stringify(data.message)}`);
  return data;
}
await call('/auth/login', { login: 'admin.ndeye', password: process.env.DEMO_PASSWORD });
const groups = await call('/groupements?limit=100');
const group = groups.items.find((g) => g.name === 'Les Femmes de Grand Yoff');
if (!group) throw new Error('Groupement de démonstration absent.');
const root = `/groupements/${group.id}`;
const types = await call('/campaign-types');
const type = (types.items || types).find((t) => t.code === 'AVEC');
const members = (await call(`${root}/members?limit=100`)).items.filter(
  (m) => m.active && !m.is_blocked && ['Ndèye Diop', 'Awa Fall', 'Mariama Bâ'].includes(m.name),
);
if (members.length < 2) throw new Error('Au moins deux membres de démonstration sont requis.');
const today = new Date().toISOString().slice(0, 10);
const existing = (await call(`${root}/campaigns?limit=100`)).items;
for (const state of ['À ouvrir', 'Encaisser']) {
  const name = `Épargne TEST ${state} · ${today}`;
  let campaign = existing.find((c) => c.name === name);
  if (!campaign)
    campaign = await call(`${root}/campaigns`, {
      name,
      typeId: type.id,
      startDate: today,
      endDate: today,
      weekday: new Date().getUTCDay(),
      intervalWeeks: 1,
      standardAmount: 2000,
    });
  const path = `${root}/campaigns/${campaign.id}`;
  const enrolled = (await call(`${path}/participants?limit=100`)).items;
  for (const [i, m] of members.entries())
    if (!enrolled.some((p) => p.membership_id === m.id))
      await call(`${path}/participants`, {
        membershipId: m.id,
        isRandom: i === 0 || !campaign.standard_amount,
      });
  if (state === 'Encaisser') {
    await call(`${path}/savings-session`, {});
    const participants = (await call(`${path}/participants?limit=100`)).items;
    const recorded = (
      await call(`${path}/contributions?limit=100&from=${today}&to=${today}&status=valid`)
    ).items;
    // Deterministic keys make reruns safe. Leave one member unpaid for visual status checks.
    for (let i = 0; i < 6 && participants.length > 1; i++) {
      const p = participants[i % (participants.length - 1)];
      const existingCount = recorded.filter((payment) => payment.participation_id === p.id).length;
      if (existingCount >= Math.floor(i / (participants.length - 1)) + 1) continue;
      const hash = createHash('sha256').update(`${campaign.id}:fixed-free-v2:${i}`).digest('hex');
      const key = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
      await call(`${path}/contributions`, {
        participationId: p.id,
        amount: !p.is_random && p.forfait ? Number(p.forfait) : i % 2 ? 2000 : 1000,
        paidOn: today,
        idempotencyKey: key,
      });
    }
  }
  console.log(`${name} : prête`);
}
