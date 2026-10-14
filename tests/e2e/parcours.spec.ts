import { test, expect, type Page } from '@playwright/test';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
config({ path: '.env', quiet: true });
const password = process.env.DEMO_PASSWORD!;
const pwa = process.env.PWA_URL || 'http://localhost:8086';
async function login(page: Page, url: string, user: string) {
  await page.goto(url);
  await page.getByLabel('Identifiant', { exact: true }).fill(user);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Vue d’ensemble', exact: true })).toBeVisible();
  await page.locator('#group-select').selectOption({ label: 'Les Femmes de Grand Yoff' });
}
test('super administrateur consulte, crée et active une campagne', async ({ page }) => {
  await login(page, '/', 'superadmin');
  await expect(page.getByRole('button', { name: 'Enregistrer une cotisation' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Campagnes', exact: true }).click();
  await expect(page.getByText('Épargne solidaire 2026', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Désactiver', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Activer', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Activer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Désactiver', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Masquer', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/super-admin.png', fullPage: true });
  await page.getByRole('button', { name: 'Créer un groupement', exact: true }).click();
  await page.getByLabel('Nom du groupement').fill('Pilote navigateur ' + Date.now());
  await page.getByLabel('Adresse', { exact: true }).fill('Dakar');
  await page.getByLabel('Responsable', { exact: true }).fill('Responsable test');
  await page.getByLabel('Téléphone', { exact: true }).fill('+221771234567');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Groupement créé');
});
test('administratrice enregistre et retrouve sa vue membre', async ({ page }) => {
  await login(page, pwa, 'admin.ndeye');
  await page.getByRole('button', { name: 'Enregistrer une cotisation', exact: true }).click();
  const selection = page.getByRole('combobox', { name: 'Participante', exact: true });
  // Les deux participantes du seed sont affichées dans l’ordre Awa puis Ndèye.
  await selection.selectOption({ index: 1 });
  await page.getByLabel('Montant réellement versé en FCFA').fill('2000');
  await page.getByLabel('Date du versement').fill('2026-06-02');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Cotisation enregistrée');
  await page.getByRole('button', { name: 'Mon épargne personnelle', exact: true }).click();
  await expect(page.getByText('Mon montant versé', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Enregistrer une cotisation', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Masquer', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/admin-personal.png', fullPage: true });
});
test('membre sur téléphone et manifest PWA', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, pwa, 'membre.awa');
  await expect(page.getByText('Mon montant versé', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enregistrer une cotisation' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Créer un groupement' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/member-mobile.png', fullPage: true });
  const manifest = await page.request.get(pwa + '/manifest.webmanifest');
  expect(manifest.ok()).toBeTruthy();
  expect((await manifest.json()).display).toBe('standalone');
  await page.getByRole('button', { name: 'Campagnes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ma participation', exact: true })).toBeVisible();
});
test('connexion par code téléphone et déconnexion', async ({ page }) => {
  await login(page, '/', 'superadmin');
  const groups = await (await page.request.get('/api/v1/groupements')).json();
  const groupId = groups.items.find(
    (g: { name: string }) => g.name === 'Les Femmes de Grand Yoff',
  ).id;
  const phone = '+2217' + Date.now().toString().slice(-8);
  const created = await page.request.post(`/api/v1/groupements/${groupId}/members`, {
    headers: { 'X-Requested-With': 'AvecLesFemmes' },
    data: { name: 'Membre test OTP', login: 'otp.' + randomUUID().slice(0, 8), phone },
  });
  expect(created.status()).toBe(201);
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await page.goto(pwa);
  await page.getByRole('button', { name: 'Code SMS', exact: true }).click();
  await page.getByLabel('Téléphone avec indicatif', { exact: true }).fill(phone);
  await page.getByRole('button', { name: 'Recevoir un code', exact: true }).click();
  const text = await page.locator('.local-code').innerText();
  const code = text.match(/\d{6}/)?.[0];
  expect(code).toBeTruthy();
  await page.getByLabel('Code reçu par SMS').fill(code!);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Vue d’ensemble', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenue dans votre espace' })).toBeVisible();
});
test('un double envoi concurrent produit un seul versement', async ({ page }) => {
  await login(page, pwa, 'admin.ndeye');
  const groups = await (await page.request.get(pwa + '/api/v1/groupements')).json();
  const groupId = groups.items[0].id;
  const campaigns = await (
    await page.request.get(pwa + `/api/v1/groupements/${groupId}/campaigns`)
  ).json();
  const campaignId = campaigns.items[0].id;
  const base = pwa + `/api/v1/groupements/${groupId}/campaigns/${campaignId}`;
  const participants = await (await page.request.get(base + '/participants')).json();
  const before = await (await page.request.get(base + '/dashboard')).json();
  const body = {
    participationId: participants.items[0].id,
    amount: 100,
    paidOn: '2026-06-02',
    idempotencyKey: randomUUID(),
  };
  const responses = await Promise.all(
    [1, 2, 3].map(() =>
      page.request.post(base + '/contributions', {
        headers: { 'X-Requested-With': 'AvecLesFemmes' },
        data: body,
      }),
    ),
  );
  for (const r of responses) expect(r.status()).toBe(201);
  const records = await Promise.all(responses.map((r) => r.json()));
  expect(new Set(records.map((r) => r.id)).size).toBe(1);
  const after = await (await page.request.get(base + '/dashboard')).json();
  expect(BigInt(after.total) - BigInt(before.total)).toBe(100n);
});
