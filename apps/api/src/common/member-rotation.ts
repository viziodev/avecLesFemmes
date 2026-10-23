import { SqlClient } from '../database/database.module';
import { addTontineInterval } from './tontine-schedule';
export async function memberRotation(c: SqlClient, campaign: any) {
  const result = await c.query('SELECT app_member_rotation($1) data', [campaign.id]);
  return buildMemberRotation(campaign, result.rows[0]?.data);
}
export function buildMemberRotation(campaign: any, data: any) {
  if (!data) return [];
  const size = Math.max(Number(data.size), ...data.rounds.map((r: any) => r.round_number), 0);
  const start = new Date(campaign.start_date).toISOString().slice(0, 10);
  const dates = Array.from(
    { length: size + 1 },
    (_, i) =>
      data.rounds.find((r: any) => r.round_number === i + 1)?.expected_date ||
      addTontineInterval(
        start,
        i,
        campaign.rotation_interval,
        campaign.weekday,
        campaign.monthly_week,
      ),
  );
  return Array.from({ length: size }, (_, i) => {
    const stored = data.rounds.find((r: any) => r.round_number === i + 1);
    return {
      round_number: i + 1,
      expected_date: dates[i],
      period_end: dates[i + 1],
      beneficiary_name: stored?.beneficiary_name || null,
      paid: !!stored?.paid,
      drawn: !!stored?.drawn_at,
      my_paid_amount: '0',
    };
  });
}

export async function memberCalendars(c: SqlClient, campaigns: any[]) {
  const tontines = campaigns.filter((x) => /tontine/i.test(`${x.type_code} ${x.type_name}`));
  const result = tontines.length
    ? await c.query(
        'SELECT id,app_member_rotation(id) data FROM campaigns WHERE id=ANY($1::uuid[])',
        [tontines.map((x) => x.id)],
      )
    : { rows: [] };
  return new Map(
    tontines.map((campaign) => [
      campaign.id,
      buildMemberRotation(campaign, result.rows.find((r: any) => r.id === campaign.id)?.data),
    ]),
  );
}
