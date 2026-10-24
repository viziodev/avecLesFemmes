import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthlyMeeting } from '../src/common/monthly-meeting';
import { scheduledSavingsDay } from '../src/common/savings-schedule';
import { addTontineInterval } from '../src/common/tontine-schedule';
import { buildMemberRotation } from '../src/common/member-rotation';

const dates = [
  '2026-11-01',
  '2026-12-06',
  '2027-01-03',
  '2027-02-07',
  '2027-03-07',
  '2027-04-04',
  '2027-05-02',
  '2027-06-06',
  '2027-07-04',
  '2027-08-01',
];
const campaign = {
  active: true,
  start_date: '2026-11-01',
  end_date: '2027-08-31',
  weekday: 0,
  interval_weeks: 1,
  rotation_interval: 'MONTHLY',
  monthly_week: 1,
};
test('dix rencontres mensuelles : premier dimanche réel, sans approximation de quatre semaines', () => {
  assert.deepEqual(
    dates.map((_, i) => monthlyMeeting(campaign.start_date, i, 0, 1)),
    dates,
  );
  for (const day of dates) assert.equal(scheduledSavingsDay(campaign, day), true);
  for (const day of [
    '2026-10-25',
    '2026-11-08',
    '2026-11-29',
    '2026-12-01',
    '2027-02-28',
    '2027-09-05',
  ])
    assert.equal(scheduledSavingsDay(campaign, day), false, day);
  assert.equal(monthlyMeeting('2026-10-23', 0, 0, 1), '2026-11-01');
});
test('calendriers admin et membre des tontines identiques, anciens calendriers conservés', () => {
  const rounds = buildMemberRotation(campaign, { size: 10, rounds: [] });
  assert.deepEqual(
    rounds.map((r) => r.expected_date),
    dates,
  );
  assert.equal(rounds[0].period_end, '2026-12-06');
  assert.deepEqual(
    dates.map((_, i) => addTontineInterval(campaign.start_date, i, 'MONTHLY', 0, 1)),
    dates,
  );
  assert.equal(addTontineInterval('2028-01-31', 1, 'MONTHLY'), '2028-02-29');
  assert.equal(addTontineInterval('2028-01-31', 2, 'MONTHLY'), '2028-03-31');
  assert.equal(addTontineInterval('2026-11-01', 1, 'BIWEEKLY'), '2026-11-15');
  assert.equal(
    scheduledSavingsDay({ ...campaign, rotation_interval: null, monthly_week: null }, '2026-11-08'),
    true,
  );
});
test('années bissextiles et changements d’année : chaque rendez-vous reste dans son mois', () => {
  for (let y = 2026; y <= 2032; y++)
    for (let month = 1; month <= 12; month++)
      for (let weekday = 0; weekday < 7; weekday++)
        for (let week = 1; week <= 4; week++) {
          const first = `${y}-${String(month).padStart(2, '0')}-01`;
          const result = new Date(monthlyMeeting(first, 0, weekday, week) + 'T12:00:00Z');
          assert.equal(result.getUTCMonth(), month - 1);
          assert.equal(result.getUTCDay(), weekday);
          assert.equal(Math.floor((result.getUTCDate() - 1) / 7) + 1, week);
        }
});
