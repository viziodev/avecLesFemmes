import { test, expect } from './fixtures';
import { mockSpace, unlockMockSpace } from './pwa-space';

test.use({ serviceWorkers: 'block' });
const receipt = {
  id: 'receipt-1',
  participation_id: 'own',
  name: 'Awa Fall',
  amount: '1500',
  paid_on: '2026-10-22',
  created_at: '2026-10-22T19:47:00Z',
  reference: 'AV-01234567-89ab-cdef-0123-456789abcdef',
  voided_at: null,
};
async function memberPayment(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Faire un versement', exact: true }).click();
  await page.getByRole('button', { name: 'Vérifier mon versement', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmer mon versement', exact: true }).click();
}

test('admin : reçu après acquittement serveur uniquement, détails et fermeture', async ({
  page,
}) => {
  await mockSpace(page, true);
  await page.route('**/participants?*', (r) =>
    r.fulfill({
      json: {
        items: [{ id: 'part', name: 'Awa Fall', forfait: '1500', is_random: false }],
        total: 1,
      },
    }),
  );
  let writes = 0;
  let respond: (() => void) | undefined;
  await page.route('**/contributions', async (r) => {
    if (r.request().method() !== 'POST') return r.fallback();
    writes++;
    await new Promise<void>((resolve) => {
      respond = resolve;
    });
    await r.fulfill({ status: 201, json: receipt });
  });
  await page.goto('/');
  await unlockMockSpace(page);
  await page.getByRole('button', { name: 'Enregistrer une cotisation', exact: true }).click();
  await page.getByRole('combobox', { name: 'Participante', exact: true }).selectOption('part');
  await page.getByRole('button', { name: 'Vérifier la cotisation', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmer la cotisation', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Confirmer avec mon mot de passe', exact: true }),
  ).toHaveCount(0);
  await expect.poll(() => writes).toBe(1);
  const confirmation = page.getByRole('dialog', { name: 'Encaissement confirmé', exact: true });
  await expect(confirmation).toHaveCount(0);
  respond!();
  await expect(confirmation).toBeVisible();
  for (const value of [
    'Awa Fall',
    'Épargne 2026',
    'Les Femmes de Grand Yoff',
    '22 octobre 2026',
    receipt.reference,
  ])
    await expect(confirmation).toContainText(value);
  await expect(confirmation.locator('.receipt-amount')).toContainText(/1.?500 FCFA/);
  await expect(confirmation.locator('.receipt-details').last()).toContainText('Enregistré le');
  await expect(page.locator('.pwa-notification.success')).toContainText('Cotisation enregistrée.');
  expect(await confirmation.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.getByRole('button', { name: 'Masquer la notification' }).click();
  await page.screenshot({ path: test.info().outputPath('recu-encaissement-clair.png') });
  await confirmation
    .locator('.receipt-actions')
    .getByRole('button', { name: 'Fermer', exact: true })
    .click();
  await expect(confirmation).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Enregistrer une cotisation', exact: true }),
  ).toBeFocused();
  expect(writes).toBe(1);
});

test('membre : reçu sombre, copie, référence longue et confidentialité au verrouillage', async ({
  page,
}) => {
  await mockSpace(page);
  await page.addInitScript(() => {
    localStorage.setItem('alf:pwa:appearance', 'dark');
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (text: string) => {
          (window as any).copiedReceipt = text;
        },
      },
      configurable: true,
    });
  });
  let writes = 0;
  await page.route('**/contributions/self', (r) => {
    writes++;
    return r.fulfill({ status: 201, json: receipt });
  });
  await page.goto('/');
  await unlockMockSpace(page);
  await memberPayment(page);
  const confirmation = page.getByRole('dialog', { name: 'Versement confirmé', exact: true });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Copier le reçu', exact: true }).click();
  const copied = await page.evaluate(() => (window as any).copiedReceipt);
  expect(copied).toContain(receipt.reference);
  expect(copied).toContain('Awa Fall');
  expect(copied).toContain('Épargne 2026');
  await expect(page.locator('.pwa-notification.success').last()).toContainText('Reçu copié');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Masquer la notification' }).click();
  await confirmation.evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({ path: test.info().outputPath('recu-versement-sombre.png') });
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect(page.getByRole('heading', { name: 'Bon retour' })).toBeVisible();
  await expect(confirmation).toHaveCount(0);
  await expect(page.locator('.pwa-notification')).toHaveCount(0);
  expect(writes).toBe(1);
});

test('refus : notification d’échec, saisie conservée et aucun faux reçu', async ({ page }) => {
  await mockSpace(page);
  let writes = 0;
  const keys: string[] = [];
  await page.route('**/contributions/self', (r) => {
    keys.push(r.request().postDataJSON().idempotencyKey);
    writes++;
    return writes === 1
      ? r.fulfill({ status: 400, json: { message: 'La séance est fermée.' } })
      : r.fulfill({ status: 201, json: receipt });
  });
  await page.goto('/');
  await unlockMockSpace(page);
  await memberPayment(page);
  await expect(page.locator('.pwa-notification.error')).toContainText('La séance est fermée.');
  await expect(page.getByRole('dialog', { name: 'Versement confirmé' })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Vérifier mon versement' })).toBeVisible();
  await page.getByRole('button', { name: 'Masquer la notification' }).click();
  await expect(page.locator('.pwa-notification')).toHaveCount(0);
  await page.getByRole('button', { name: 'Confirmer mon versement', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Versement confirmé' })).toContainText(
    receipt.reference,
  );
  expect(keys[0]).toBe(keys[1]);
  expect(writes).toBe(2);
});

test('action de gestion : ouverture de séance et notification uniforme', async ({ page }) => {
  await mockSpace(page, true);
  let opened = false;
  await page.route('**/savings-session', (r) => {
    if (r.request().method() === 'POST') opened = true;
    return r.fulfill({
      json: { today: '2026-10-22', scheduled: true, opened, can_collect: opened },
    });
  });
  await page.goto('/');
  await unlockMockSpace(page);
  await page.getByRole('button', { name: 'Ouvrir la séance d’épargne', exact: true }).click();
  await expect(page.locator('.pwa-notification.success')).toContainText('Séance');
  await expect(
    page.getByRole('button', { name: 'Enregistrer une cotisation', exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole('dialog', { name: 'Encaissement confirmé' })).toHaveCount(0);
});
