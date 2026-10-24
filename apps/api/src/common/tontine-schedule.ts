import { SqlClient } from '../database/database.module';
import { monthlyMeeting } from './monthly-meeting';

export function addTontineInterval(
  base: string,
  index: number,
  interval?: string | null,
  weekday = 0,
  monthlyWeek?: number | null,
): string {
  if (interval === 'MONTHLY' && monthlyWeek)
    return monthlyMeeting(base, index, weekday, monthlyWeek);
  const d = new Date(base + 'T12:00:00Z');
  if (interval === 'WEEKLY' || interval === 'BIWEEKLY')
    d.setUTCDate(d.getUTCDate() + index * (interval === 'WEEKLY' ? 7 : 14));
  else {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + index);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
  }
  return d.toISOString().slice(0, 10);
}
export async function isTontine(c: SqlClient, typeId: string) {
  const r = await c.query('SELECT code,name FROM campaign_types WHERE id=$1', [typeId]);
  return /tontine/i.test(`${r.rows[0]?.code} ${r.rows[0]?.name}`);
}
export async function tontineCalendar(c: SqlClient, campaign: any) {
  const count = await c.query(
    'SELECT count(*)::int count FROM participations WHERE campaign_id=$1',
    [campaign.id],
  );
  const stored = await c.query(
    'SELECT round_number, expected_date::text FROM tontine_rounds WHERE campaign_id=$1',
    [campaign.id],
  );
  const size = Math.max(count.rows[0].count, ...stored.rows.map((r: any) => r.round_number), 0);
  const start = new Date(campaign.start_date).toISOString().slice(0, 10);
  const dates = Array.from(
    { length: size + 1 },
    (_, i) =>
      stored.rows.find((r: any) => r.round_number === i + 1)?.expected_date ||
      addTontineInterval(
        start,
        i,
        campaign.rotation_interval,
        campaign.weekday,
        campaign.monthly_week,
      ),
  );
  return Array.from({ length: size }, (_, i) => ({
    round_number: i + 1,
    expected_date: dates[i],
    period_end: dates[i + 1],
  }));
}
export async function tontinePeriod(c: SqlClient, campaign: any, day: string) {
  return (await tontineCalendar(c, campaign)).find(
    (r) => day >= r.expected_date && day < r.period_end,
  );
}
