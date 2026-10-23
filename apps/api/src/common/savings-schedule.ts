import { SqlClient } from '../database/database.module';
import { monthlyMeeting } from './monthly-meeting';

// Dakar uses UTC year-round. The server owns the session date, never the client.
export function savingsToday(): string {
  return new Date().toISOString().slice(0, 10);
}
export function scheduledSavingsDay(campaign: any, day: string): boolean {
  const start = new Date(campaign.start_date).toISOString().slice(0, 10);
  const end = new Date(campaign.end_date).toISOString().slice(0, 10);
  if (!campaign.active || day < start || day > end) return false;
  if (campaign.rotation_interval === 'MONTHLY' && campaign.monthly_week) {
    const first = monthlyMeeting(start, 0, campaign.weekday, campaign.monthly_week);
    const offset =
      (Number(day.slice(0, 4)) - Number(first.slice(0, 4))) * 12 +
      Number(day.slice(5, 7)) -
      Number(first.slice(5, 7));
    return (
      offset >= 0 && day === monthlyMeeting(first, offset, campaign.weekday, campaign.monthly_week)
    );
  }
  const first = new Date(start + 'T00:00:00Z');
  first.setUTCDate(first.getUTCDate() + ((Number(campaign.weekday) - first.getUTCDay() + 7) % 7));
  const elapsed = (Date.parse(day + 'T00:00:00Z') - first.getTime()) / 86400000;
  return elapsed >= 0 && elapsed % (7 * Number(campaign.interval_weeks)) === 0;
}
export async function savingsType(c: SqlClient, typeId: string): Promise<boolean> {
  const result = await c.query('SELECT code,name FROM campaign_types WHERE id=$1', [typeId]);
  const type = result.rows[0];
  return (
    !!type &&
    /avec|epargne/.test(
      `${type.code} ${type.name}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase(),
    )
  );
}
