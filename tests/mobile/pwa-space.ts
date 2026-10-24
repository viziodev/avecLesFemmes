import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { config } from 'dotenv';
import { loginPwa } from './fixtures';
config({ path: '.env', quiet: true });
export async function unlockMockSpace(
  page: Page,
  options: { prepareOffline?: boolean; pin?: string } = {},
) {
  if (await page.getByLabel('Mot de passe', { exact: true }).isVisible()) {
    await page
      .getByLabel('Mot de passe', { exact: true })
      .fill(process.env.DEMO_PASSWORD || 'Test-password-only');
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Mon groupement', exact: true })).toBeVisible();
  } else await loginPwa(page, 'mock.user', options);
}
export const savingsId = '11111111-1111-4111-a111-111111111111';
const tontineId = '22222222-2222-4222-a222-222222222222';

// All API calls are mocked: these checks never create financial transactions.
export async function mockSpace(page: Page, responsible = false, count = 2) {
  const campaigns = [
    { id: savingsId, name: 'Épargne 2026', type_name: 'Avec Épargne', type_code: 'AVEC' },
    {
      id: tontineId,
      name: 'Tontine des projets',
      type_name: 'Tontine rotative',
      type_code: 'TONTINE',
    },
  ].map((c) => ({
    ...c,
    active: true,
    start_date: '2026-01-01',
    end_date: '2027-12-31',
    weekday: 4,
    interval_weeks: 1,
    standard_amount: '1500',
    forfait: '1500',
    is_random: false,
    participation_id: 'own-' + c.id,
    total_paid: '7500',
    arrears_count: 1,
  }));
  for (let i = 2; i < count; i++)
    campaigns.push({
      ...campaigns[0],
      id: `11111111-1111-4111-a111-${String(i).padStart(12, '0')}`,
      name: `Épargne projet ${i + 1}`,
    });
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/vault/password'))
      return route.fulfill({ headers: { 'X-ALF-Vault-Key': 'a'.repeat(64) }, json: { ok: true } });
    if (path.endsWith('/auth/login') || path.endsWith('/auth/login/phone-pin'))
      return route.fulfill({
        status: 201,
        headers: { 'X-ALF-Vault-Key': 'a'.repeat(64) },
        json: {
          id: 'actor',
          name: responsible ? 'Ndèye Diop' : 'Awa Fall',
          login: responsible ? 'admin.ndeye' : 'membre.awa',
          isSuper: false,
        },
      });
    if (path.endsWith('/auth/activity')) return route.fulfill({ status: 201, json: { ok: true } });
    if (route.request().method() !== 'GET') return route.abort();
    let json: unknown = { items: [], total: 0 };
    if (path.endsWith('/appearance'))
      json = { primary: '#155d50', savings: '#197647', tontine: '#471976', solidarity: '#764019' };
    else if (path.endsWith('/auth/me'))
      json = {
        id: 'actor',
        name: responsible ? 'Ndèye Diop' : 'Awa Fall',
        login: responsible ? 'admin.ndeye' : 'membre.awa',
        isSuper: false,
      };
    else if (path.endsWith('/groupements'))
      json = {
        items: [
          {
            id: 'group',
            name: 'Les Femmes de Grand Yoff',
            address: 'Grand Yoff, Dakar',
            phone: '+221770000002',
            active: true,
            my_role: responsible ? 'ADMIN' : 'MEMBER',
            member_count: 3,
          },
        ],
        total: 1,
      };
    else if (
      /\/(campaign-types|group-functions|campaign-events|sessions|rounds|grace-periods)$/.test(path)
    )
      json = [];
    else if (path.endsWith('/shortcuts')) json = { campaignIds: campaigns.map((c) => c.id) };
    else if (path.endsWith('/campaigns')) json = { items: campaigns, total: campaigns.length };
    else if (path.includes('/member/campaigns/'))
      json = {
        today: '2026-10-22',
        can_pay: true,
        already_paid: false,
        reason: 'Versement disponible.',
        total_paid: '7500',
        sessions: ['2026-10-22'],
        rounds: [],
        payouts_count: 2,
        remaining_months: 4,
      };
    else if (path.endsWith('/member/history/options'))
      json = {
        campaigns: campaigns.map((c) => ({ ...c, type_id: c.id })),
        sessions: ['2026-10-22'],
        rounds: [],
      };
    else if (path.endsWith('/member/history')) json = { items: [], total: 0, total_paid: '7500' };
    else if (path.endsWith('/savings-session'))
      json = { today: '2026-10-22', scheduled: true, opened: true, can_collect: true };
    else if (path.endsWith('/dashboard')) json = { total: '7500', payments: 5, participants: 3 };
    else if (path.endsWith('/cashbox'))
      json = { balance: '7500', total_collected: '7500', total_paid_out: '0' };
    else if (path.endsWith('/contributions'))
      json = {
        items: [
          {
            id: 'payment',
            name: 'Awa Fall',
            amount: '1500',
            paid_on: '2026-10-22',
            participation_id: 'own-' + savingsId,
            reference: 'DEMO',
            voided_at: null,
          },
        ],
        total: 1,
      };
    return route.fulfill({ json });
  });
}
