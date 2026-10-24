import { createHmac } from 'node:crypto';
import { test, expect, type Page, testCode } from './fixtures';
import { mockSpace, unlockMockSpace } from './pwa-space';
const password = process.env.DEMO_PASSWORD || 'Test-password-only';
const signingKey = 'c'.repeat(64);
test.use({ serviceWorkers: 'block', autoConfirmSensitive: false });

async function fixture(page: Page, mode: 'ok' | 'reject' | 'lost' = 'ok') {
  await mockSpace(page);
  const actor = {
    id: 'actor',
    login: 'membre.awa',
    name: 'Awa Fall',
    isSuper: false,
    hasSecretCode: true,
  };
  const state = {
    automatic: [] as any[],
    manual: [] as any[],
    committed: new Set<string>(),
    ready: 0,
  };
  const receipt = (body: any) => ({
    id: 'saved-' + body.idempotencyKey,
    reference: 'AUTO-' + body.idempotencyKey,
    amount: String(body.amount),
    paid_on: body.paidOn,
    name: 'Awa Fall',
    created_at: new Date().toISOString(),
    voided_at: null,
  });
  await page.route('**/api/v1/health/ready', (r) => {
    state.ready++;
    return r.fulfill({ json: { status: 'ok' } });
  });
  await page.route('**/api/v1/auth/**', (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path.endsWith('/demo')) return r.fulfill({ json: { isDemo: false } });
    if (path.endsWith('/me')) return r.fulfill({ json: actor });
    if (
      path.endsWith('/login') ||
      path.endsWith('/login/secret-code') ||
      path.endsWith('/login/phone-pin')
    )
      return r.fulfill({
        status: 201,
        headers: { 'X-ALF-Vault-Key': 'a'.repeat(64), 'X-ALF-Sync-Key': signingKey },
        json: actor,
      });
    if (path.endsWith('/vault/password'))
      return r.fulfill({
        headers: { 'X-ALF-Vault-Key': 'a'.repeat(64), 'X-ALF-Sync-Key': signingKey },
        json: { ok: true },
      });
    if (path.endsWith('/offline-replay')) {
      const body = r.request().postDataJSON();
      const headers = r.request().headers();
      expect(headers['x-confirm-secret-code']).toBeUndefined();
      expect(headers['x-confirm-password']).toBeUndefined();
      expect(body.login).toBe(actor.login);
      expect(body.signature).toBe(
        createHmac('sha256', Buffer.from(signingKey, 'hex'))
          .update(JSON.stringify(['alf:offline:v1', body.login, body.path, body.payload]))
          .digest('hex'),
      );
      const original = JSON.parse(body.payload);
      state.automatic.push(body);
      if (mode === 'reject')
        return r.fulfill({ status: 400, json: { message: 'La séance est fermée.' } });
      state.committed.add(original.idempotencyKey);
      if (mode === 'lost' && state.automatic.length === 1)
        return r.fulfill({ status: 503, json: { message: 'Réponse perdue après validation' } });
      return r.fulfill({ status: 201, json: receipt(original) });
    }
    return r.fulfill({ status: 201, json: { ok: true } });
  });
  await page.route('**/contributions/self', (r) => {
    expect(r.request().headers()['x-confirm-secret-code']).toBe('2468');
    const body = r.request().postDataJSON();
    state.manual.push(body);
    return r.fulfill({ status: 201, json: receipt(body) });
  });
  await page.goto('/');
  await unlockMockSpace(page, { pin: '2468' });
  // Do not cut the network until the session data has reached the encrypted cache.
  await expect(page.getByRole('button', { name: 'Faire un versement', exact: true })).toBeEnabled();
  return state;
}
async function draft(page: Page) {
  await expect(page.getByRole('button', { name: 'Faire un versement', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Faire un versement', exact: true }).click();
  await page.getByRole('button', { name: 'Vérifier mon versement', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmer mon versement', exact: true }).click();
  const confirm = page.getByRole('dialog', {
    name: 'Confirmer avec mon code secret',
    exact: true,
  });
  await confirm.getByLabel('Code secret de confirmation').fill(testCode);
  await confirm.getByRole('button', { name: 'Confirmer l’opération', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Saisie conservée' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(page.getByRole('button', { name: /1 saisie\(s\) en attente/ })).toBeVisible();
}

test('automatique : reconnexion sans code supplémentaire, signature exacte et un seul envoi', async ({
  page,
  context,
}) => {
  const state = await fixture(page);
  await context.setOffline(true);
  await draft(page);
  await context.setOffline(false);
  await expect.poll(() => state.automatic.length).toBe(1);
  await expect(page.getByRole('button', { name: /saisie\(s\) en attente/ })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Confirmer avec mon code secret' })).toHaveCount(0);
  expect(state.committed.size).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => state.ready).toBeGreaterThanOrEqual(2);
  expect(state.automatic).toHaveLength(1);
  expect(state.manual).toHaveLength(0);
});

test('automatique : refus conservé, aucune boucle et reprise manuelle avec le même identifiant', async ({
  page,
  context,
}) => {
  const state = await fixture(page, 'reject');
  await context.setOffline(true);
  await draft(page);
  await context.setOffline(false);
  await expect.poll(() => state.automatic.length).toBe(1);
  await expect(
    page.getByRole('region', { name: 'État de connexion et synchronisation' }),
  ).toContainText('restent à vérifier');
  // Dismiss the visible notice before opening the action it can cover on mobile.
  const notices = page.getByRole('button', { name: 'Masquer la notification', exact: true });
  while (await notices.count()) await notices.first().click();
  await page.getByRole('button', { name: /1 saisie\(s\) en attente/ }).click();
  await expect(page.getByRole('alert')).toContainText('La séance est fermée');
  await page.getByRole('button', { name: 'Synchroniser cette saisie', exact: true }).click();
  await page.getByLabel('Code secret de confirmation', { exact: true }).fill('2468');
  await expect(page.getByRole('dialog', { name: 'Versement confirmé' })).toBeVisible();
  expect(state.automatic).toHaveLength(1);
  expect(state.manual).toHaveLength(1);
  expect(state.manual[0].idempotencyKey).toBe(
    JSON.parse(state.automatic[0].payload).idempotencyKey,
  );
});

test('automatique : réponse perdue, réessai différé et aucune double comptabilisation', async ({
  page,
  context,
}) => {
  await page.clock.install();
  const state = await fixture(page, 'lost');
  await context.setOffline(true);
  await draft(page);
  await context.setOffline(false);
  await expect.poll(() => state.automatic.length).toBe(1);
  await expect(
    page.getByRole('region', { name: 'État de connexion et synchronisation' }),
  ).toContainText('Hors connexion');
  await page.clock.fastForward(31000);
  await expect.poll(() => state.automatic.length).toBe(2);
  await expect(page.getByRole('button', { name: /saisie\(s\) en attente/ })).toHaveCount(0);
  expect(state.automatic[1]).toEqual(state.automatic[0]);
  expect(state.committed.size).toBe(1);
});

test('automatique : aucun envoi verrouillé, reprise après déverrouillage et clé chiffrée', async ({
  page,
  context,
}) => {
  const state = await fixture(page);
  await context.setOffline(true);
  await draft(page);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(signingKey);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect(page.getByRole('heading', { name: 'Bon retour', exact: true })).toBeVisible();
  await context.setOffline(false);
  await page.getByLabel('Code secret', { exact: true }).fill('2468');
  await expect.poll(() => state.automatic.length).toBe(1);
  await expect(page.getByRole('button', { name: /saisie\(s\) en attente/ })).toHaveCount(0);
});

test('mode manuel : choix persistant et confirmation par code conservée', async ({
  page,
  context,
}) => {
  const state = await fixture(page);
  await context.setOffline(true);
  await draft(page);
  await page.getByRole('button', { name: /1 saisie\(s\) en attente/ }).click();
  await page
    .getByRole('checkbox', { name: 'Synchronisation automatique au retour de la connexion' })
    .uncheck();
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).click();
  await context.setOffline(false);
  await expect.poll(() => state.ready).toBeGreaterThanOrEqual(1);
  expect(state.automatic).toHaveLength(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Bon retour', exact: true })).toBeVisible();
  await page.getByLabel('Code secret', { exact: true }).fill('2468');
  await expect(page.getByRole('heading', { name: 'Mon groupement', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /1 saisie\(s\) en attente/ }).click();
  await expect(
    page.getByRole('checkbox', { name: 'Synchronisation automatique au retour de la connexion' }),
  ).not.toBeChecked();
  await page.getByRole('button', { name: 'Synchroniser cette saisie', exact: true }).click();
  await page.getByLabel('Code secret de confirmation', { exact: true }).fill('2468');
  await expect(page.getByRole('dialog', { name: 'Versement confirmé' })).toBeVisible();
  expect(state.manual).toHaveLength(1);
  expect(state.automatic).toHaveLength(0);
});
