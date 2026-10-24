import { expectEncryptedVault } from './vault-assertions';
import { test, expect, testCode } from './fixtures';
import { mockSpace, unlockMockSpace } from './pwa-space';
import { config } from 'dotenv';
config({ path: '.env', quiet: true });
const password = process.env.DEMO_PASSWORD || 'Test-password-only';
test.use({ autoConfirmSensitive: false, serviceWorkers: 'block' });

test('réponse 502 incertaine : conservation chiffrée, abandon protégé et reprise de connexion', async ({
  page,
}) => {
  await mockSpace(page);
  let writes = 0;
  await page.route('**/contributions/self', (route) => {
    writes++;
    return route.fulfill({ status: 502, json: { message: 'Gateway unavailable' } });
  });
  await page.goto('/');
  await unlockMockSpace(page);
  await page.getByRole('button', { name: 'Faire un versement', exact: true }).click();
  await page.getByRole('button', { name: 'Vérifier mon versement', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmer mon versement', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Confirmer avec mon code secret' });
  await confirm.getByLabel('Code secret de confirmation').fill(testCode);
  await confirm.getByRole('button', { name: 'Confirmer l’opération' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Saisie conservée' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).click();
  await page.getByRole('button', { name: /1 saisie\(s\) en attente/ }).click();
  await page.getByRole('button', { name: 'Abandonner cette saisie locale' }).click();
  await confirm.getByLabel('Code secret de confirmation').fill('Incorrect-password-for-this-vault');
  await confirm.getByRole('button', { name: 'Confirmer l’opération' }).click();
  await expect(page.getByRole('alert')).toContainText('incorrect');
  await page.getByRole('button', { name: 'Abandonner cette saisie locale' }).click();
  await confirm.getByLabel('Code secret de confirmation').fill(testCode);
  await confirm.getByRole('button', { name: 'Confirmer l’opération' }).click();
  await expect(page.getByText('Aucune saisie en attente.')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).click();
  await page.getByRole('button', { name: 'Réessayer la connexion', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'État de connexion et synchronisation' }),
  ).not.toContainText('Hors connexion');
  expect(writes).toBe(1);
});

test('PIN à chaque ouverture et verrouillage après cinq minutes sans activité réelle', async ({
  page,
}) => {
  await page.clock.install();
  await mockSpace(page);
  await page.goto('/');
  await unlockMockSpace(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Bon retour' })).toBeVisible();
  await expect(page.locator('.pwa-day-card')).toHaveCount(0);
  await unlockMockSpace(page);
  await page.clock.fastForward(4 * 60 * 1000);
  await page.getByRole('heading', { name: 'Mon groupement', exact: true }).click();
  await page.clock.fastForward(4 * 60 * 1000);
  await expect(page.getByRole('heading', { name: 'Mon groupement', exact: true })).toBeVisible();
  await page.clock.fastForward(61000);
  await expect(page.getByRole('heading', { name: 'Bon retour' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Bon retour', exact: true })).toContainText(
    '5 minutes',
  );
  await expect(page.locator('.pwa-day-card')).toHaveCount(0);
});

test('confirmation sensible : annulation sans envoi, mot de passe transmis uniquement pour l’opération', async ({
  page,
}) => {
  await mockSpace(page);
  let writes = 0;
  await page.route('**/contributions/self', async (route) => {
    writes++;
    expect(route.request().headers()['x-confirm-password']).toBe(
      'utf8:' + Buffer.from(password).toString('base64'),
    );
    return route.fulfill({
      status: 201,
      json: {
        id: 'saved',
        reference: 'TEST-SENSITIVE',
        amount: '1500',
        paid_on: '2026-10-22',
        name: 'Awa Fall',
        voided_at: null,
      },
    });
  });
  await page.goto('/');
  await unlockMockSpace(page);
  await page.getByRole('button', { name: 'Faire un versement', exact: true }).click();
  await page.getByRole('button', { name: 'Vérifier mon versement', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmer mon versement', exact: true }).click();
  const confirm = page.getByRole('dialog', {
    name: 'Confirmer avec mon code secret',
    exact: true,
  });
  await expect(confirm).toBeVisible();
  expect(writes).toBe(0);
  await confirm.getByRole('button', { name: 'Annuler', exact: true }).click();
  expect(writes).toBe(0);
  await page.getByRole('button', { name: 'Confirmer mon versement', exact: true }).click();
  await confirm.getByLabel('Code secret de confirmation').fill(testCode);
  await confirm.getByRole('button', { name: 'Confirmer l’opération', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Versement confirmé' })).toContainText(
    'TEST-SENSITIVE',
  );
  expect(writes).toBe(1);
});

test('responsable : palette du groupement avec aperçu et confirmation, membre sans accès à l’édition', async ({
  page,
}) => {
  await mockSpace(page, true);
  let palette = {
    primary: '#155d50',
    savings: '#197647',
    tontine: '#471976',
    solidarity: '#764019',
  };
  let writes = 0;
  await page.route('**/groupements/group/appearance', (route) => {
    if (route.request().method() === 'PUT') {
      writes++;
      palette = route.request().postDataJSON();
    }
    return route.fulfill({ json: palette });
  });
  await page.goto('/');
  await unlockMockSpace(page);
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await nav.getByRole('button', { name: 'Plus', exact: true }).click();
  await page.getByRole('button', { name: 'Paramètres du groupement', exact: true }).click();
  const colors = page.getByRole('region', { name: 'Couleurs de l’application' });
  await expect(colors.getByRole('heading', { name: 'Couleurs du groupement' })).toBeVisible();
  await colors.getByLabel('Couleur principale', { exact: true }).fill('#0044cc');
  expect(writes).toBe(0);
  await colors.getByRole('button', { name: 'Enregistrer les couleurs' }).click();
  const confirm = page.getByRole('dialog', { name: 'Confirmer avec mon code secret' });
  await confirm.getByLabel('Code secret de confirmation').fill(testCode);
  await confirm.getByRole('button', { name: 'Confirmer l’opération' }).click();
  await expect(colors.getByRole('status')).toContainText('votre groupement');
  expect(writes).toBe(1);
  await page.screenshot({
    path: test.info().outputPath('apparence-groupement.png'),
    fullPage: true,
  });
});

test('hors ligne : brouillon chiffré, verrouillage, réouverture puis synchronisation idempotente et refus conservé', async ({
  page,
  context,
}) => {
  await mockSpace(page);
  let writes = 0;
  let fail = true;
  const keys: string[] = [];
  await page.route('**/contributions/self', async (route) => {
    writes++;
    keys.push(route.request().postDataJSON().idempotencyKey);
    if (fail)
      return route.fulfill({
        status: 400,
        json: { message: 'La séance doit être ouverte le jour de la saisie.' },
      });
    return route.fulfill({
      status: 201,
      json: {
        id: 'saved',
        reference: 'OFFLINE-TEST',
        amount: '1500',
        paid_on: '2026-10-22',
        name: 'Awa Fall',
        voided_at: null,
      },
    });
  });
  await page.goto('/');
  await unlockMockSpace(page);
  await expect(page.getByRole('button', { name: 'Faire un versement', exact: true })).toBeEnabled();
  await context.setOffline(true);
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
  expect(writes).toBe(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).click();
  await expectEncryptedVault(page);
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bon retour' })).toBeVisible();
  // Reload the app shell online; unlock offline from the encrypted snapshot.
  // A separate real-service-worker scenario verifies shell loading offline.
  await context.setOffline(false);
  await page.reload();
  await context.setOffline(true);
  await expect(page.getByRole('heading', { name: 'Bon retour' })).toBeVisible();
  await page.getByLabel('Mot de passe', { exact: true }).fill('Incorrect-password-for-this-vault');
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('incorrect');
  await page.getByLabel('Mot de passe', { exact: true }).fill(testCode);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mon groupement', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /1 saisie\(s\) en attente/ }).click();
  await expect(page.getByRole('button', { name: 'Synchroniser cette saisie' })).toBeDisabled();
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Synchroniser cette saisie' }).click();
  await confirm.getByLabel('Code secret de confirmation').fill(testCode);
  await confirm.getByRole('button', { name: 'Confirmer l’opération', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('La séance doit être ouverte');
  await page.screenshot({
    path: test.info().outputPath('synchronisation-attente.png'),
    fullPage: true,
  });
  fail = false;
  await page.getByRole('button', { name: 'Synchroniser cette saisie' }).click();
  await confirm.getByLabel('Code secret de confirmation').fill(testCode);
  await confirm.getByRole('button', { name: 'Confirmer l’opération', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Versement confirmé' })).toContainText(
    'OFFLINE-TEST',
  );
  await expect(page.getByRole('button', { name: /1 saisie\(s\) en attente/ })).toHaveCount(0);
  expect(writes).toBe(2);
  expect(keys[0]).toBe(keys[1]);
});
