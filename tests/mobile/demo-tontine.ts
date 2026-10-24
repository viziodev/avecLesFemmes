import type { Page } from '@playwright/test';
// Les tests de présentation ne dépendent pas d’une tontine créée manuellement en local.
export async function mockDemoTontine(page: Page) {
  const campaign = {
    id: '22222222-2222-4222-a222-222222222222',
    name: 'Tontine solidaire 2026',
    type_code: 'TONTINE',
    type_name: 'Tontine rotative',
    active: true,
    standard_amount: '2000',
    rotation_interval: 'MONTHLY',
    due_day: 2,
    start_date: '2026-06-02',
    end_date: '2027-06-02',
    weekday: 2,
    interval_weeks: 1,
  };
  await page.route('**/campaigns/' + campaign.id + '/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET') return route.fallback();
    let json: unknown = [];
    if (path.endsWith('/participants') || path.endsWith('/contributions'))
      json = { items: [], total: 0 };
    if (path.endsWith('/dashboard')) json = { total: '0', payments: 0, participants: 2 };
    if (path.endsWith('/cashbox'))
      json = { balance: '0', total_collected: '0', total_paid_out: '0' };
    if (path.endsWith('/tontine/status'))
      json = {
        today: '2026-10-21',
        round_number: 3,
        round_date: '2026-10-21',
        scheduled: true,
        drawn: false,
        can_draw: true,
        can_collect: false,
      };
    return route.fulfill({ json });
  });
  await page.route(/\/groupements\/[^/]+\/campaigns(\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    await route.fulfill({
      json: { ...json, items: [...json.items, campaign], total: json.total + 1 },
    });
  });
  await page.route('**/groupements/*/campaigns/shortcuts', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    await route.fulfill({ json: { campaignIds: [...json.campaignIds.slice(0, 5), campaign.id] } });
  });
}
