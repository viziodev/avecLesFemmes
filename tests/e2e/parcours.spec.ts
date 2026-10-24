import { test, expect, loginPwa, testCode, type Page } from '../mobile/fixtures';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
config({ path: '.env', quiet: true });
const password = process.env.DEMO_PASSWORD!;
const pwa = process.env.PWA_URL || 'http://localhost:8086';
async function login(page: Page, url: string, user: string) {
  await page.goto(url);
  const logoutBtn = page.getByRole('button', { name: 'Se déconnecter', exact: true });
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
    await expect(
      page.getByRole('heading', {
        name: /^(Bienvenue dans votre espace|Bon retour|Votre épargne, ensemble)$/,
      }),
    ).toBeVisible();
  }
  const method = page.getByRole('button', { name: 'Identifiant', exact: true });
  if (await method.isVisible()) await method.click();
  const forget = page.getByRole('button', { name: 'Changer de compte / oublier cet appareil' });
  if (await forget.isVisible()) await forget.click();
  await page.getByLabel('Identifiant', { exact: true }).fill(user);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: /^(Vue d’ensemble|Mon groupement)$/, exact: true }),
  ).toBeVisible();
}
test('super administrateur archive et réactive la même campagne puis crée un groupement', async ({
  page,
}) => {
  await login(page, './', 'superadmin');
  await page.locator('#group-select').selectOption({ label: 'Les Femmes de Grand Yoff' });
  await expect(page.getByRole('button', { name: 'Enregistrer une cotisation' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Campagnes', exact: true }).click();
  const targetCampaign = page.getByRole('row').filter({ hasText: 'Épargne solidaire 2026' });
  await expect(targetCampaign).toBeVisible();
  await targetCampaign.getByRole('button', { name: 'Désactiver', exact: true }).click();
  await page.getByRole('button', { name: 'Archives', exact: true }).click();
  await expect(targetCampaign.getByRole('button', { name: 'Activer', exact: true })).toBeVisible();
  await targetCampaign.getByRole('button', { name: 'Activer', exact: true }).click();
  await page.getByRole('button', { name: 'Campagnes', exact: true }).click();
  await expect(
    targetCampaign.getByRole('button', { name: 'Désactiver', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Masquer', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/super-admin.png', fullPage: true });
  await page.getByRole('button', { name: 'Créer un groupement', exact: true }).click();
  await page.getByLabel('Nom du groupement').fill('Pilote navigateur ' + Date.now());
  await page.getByLabel('Adresse', { exact: true }).fill('Dakar');
  await expect(page.getByLabel('Responsable', { exact: true })).toHaveCount(0);
  await page.getByLabel('Téléphone', { exact: true }).fill('+221771234567');
  await expect(page.getByText('Types de campagne autorisés', { exact: false })).toBeVisible();
  await expect(page.getByText('Événements applicables', { exact: false })).toBeVisible();
  await page.screenshot({ path: 'test-results/creer-groupement-modal.png' });
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Groupement créé');
});
test('membre créé avec son PIN personnel se connecte par téléphone et affiche son QR code vectoriel', async ({
  page,
}) => {
  await login(page, './', 'superadmin');
  const groups = await (await page.request.get('/api/v1/groupements')).json();
  const groupId = groups.items[0].id;
  const phone = '+2217' + Date.now().toString().slice(-8);
  const initialPassword = 'Member-E2E-only-2026';
  const memberLogin = 'pin.' + randomUUID().slice(0, 8);
  const created = await page.request.post(`/api/v1/groupements/${groupId}/members`, {
    headers: {
      'X-Requested-With': 'AvecLesFemmes',
      'X-Confirm-Password': 'utf8:' + Buffer.from(password).toString('base64'),
    },
    data: {
      name: 'Fatou Ndiaye Test PIN',
      login: memberLogin,
      phone,
      password: initialPassword,
      initialPin: testCode,
      gender: 'F',
      address: 'Medina Rue 6',
    },
  });
  expect(created.status()).toBe(201);
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: /^(Bienvenue dans votre espace|Bon retour|Votre épargne, ensemble)$/,
    }),
  ).toBeVisible();

  await page.goto(pwa);
  const pwaLogout = page.getByRole('button', { name: 'Se déconnecter', exact: true });
  if (await pwaLogout.isVisible()) {
    await pwaLogout.click();
    await expect(
      page.getByRole('heading', {
        name: /^(Bienvenue dans votre espace|Bon retour|Votre épargne, ensemble)$/,
      }),
    ).toBeVisible();
  }
  const forget = page.getByRole('button', { name: 'Changer de compte / oublier cet appareil' });
  if (await forget.isVisible()) await forget.click();
  await loginPwa(page, phone, { pin: testCode, password: initialPassword });
  await expect(
    page.getByRole('heading', { name: /^(Vue d’ensemble|Mon groupement)$/, exact: true }),
  ).toBeVisible();

  // Test affichage de la carte QR vectorielle
  await page.getByRole('button', { name: 'Présenter mon QR', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.qr-box svg')).toBeVisible();
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Déconnexion
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: /^(Bienvenue dans votre espace|Bon retour|Votre épargne, ensemble)$/,
    }),
  ).toBeVisible();
});

test('super administrateur gère le CRUD complet des événements et des types de campagne', async ({
  page,
}) => {
  await login(page, './', 'superadmin');
  await page.getByRole('button', { name: 'Types & Événements', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Catalogue des événements', exact: true }),
  ).toBeVisible();

  // 1. Création d'un événement
  const eventCode = 'EVT_' + Date.now().toString().slice(-6);
  await page.getByRole('button', { name: 'Créer un événement' }).first().click();
  await page.getByLabel('Nom de l’événement', { exact: true }).fill('Événement E2E Test');
  await page.getByLabel('Code unique en majuscules', { exact: true }).fill(eventCode);
  await page.getByLabel('Description', { exact: true }).fill('Description test automatisé');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Événement ajouté au catalogue.');
  const eventRow = page.locator('tr', { hasText: eventCode });
  await expect(eventRow).toBeVisible();

  // 2. Modification de l'événement
  await eventRow.getByRole('button', { name: 'Modifier', exact: true }).click();
  await page.getByLabel('Nom de l’événement', { exact: true }).fill('Événement E2E Modifié');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Événement mis à jour.');
  await expect(eventRow).toContainText('Événement E2E Modifié');

  // 3. Suppression de l'événement
  page.once('dialog', (dialog) => dialog.accept());
  await eventRow.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Événement supprimé.');
  await expect(page.locator('tr', { hasText: eventCode })).toHaveCount(0);

  // 4. Création d'un type de campagne
  const typeCode = 'TYP_' + Date.now().toString().slice(-6);
  await page.getByRole('button', { name: 'Créer un type de campagne' }).first().click();
  await page.getByLabel('Nom du type', { exact: true }).fill('Type E2E Test');
  await page.getByLabel('Code unique en majuscules', { exact: true }).fill(typeCode);
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Type de campagne créé.');
  const typeRow = page.locator('tr', { hasText: typeCode });
  await expect(typeRow).toBeVisible();

  // 5. Modification du type
  await typeRow.getByRole('button', { name: 'Modifier', exact: true }).click();
  await page.getByLabel('Nom du type', { exact: true }).fill('Type E2E Modifié');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Type de campagne mis à jour.');
  await expect(typeRow).toContainText('Type E2E Modifié');

  // 6. Suppression du type
  page.once('dialog', (dialog) => dialog.accept());
  await typeRow.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Type de campagne supprimé.');
  await expect(page.locator('tr', { hasText: typeCode })).toHaveCount(0);

  // Déconnexion
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: /^(Bienvenue dans votre espace|Bon retour|Votre épargne, ensemble)$/,
    }),
  ).toBeVisible();
});

test('recherche autocomplete groupement et affichage des détails (nom, adresse, téléphone, code QR)', async ({
  page,
}) => {
  await login(page, './', 'superadmin');

  // Recherche par autocomplétion
  const searchInput = page.locator('#group-search-input');
  await searchInput.fill('Grand Yoff');
  await expect(page.locator('.group-autocomplete-dropdown')).toBeVisible();
  await page.locator('.group-autocomplete-item', { hasText: 'Les Femmes de Grand Yoff' }).click();

  // Vérification de la carte détaillée du groupement
  const detailsCard = page.locator('.group-details-card');
  await expect(detailsCard).toBeVisible();
  await expect(detailsCard.locator('.group-details-name')).toHaveText('Les Femmes de Grand Yoff');
  await expect(detailsCard.getByText('Grand Yoff, Dakar')).toBeVisible();
  await expect(detailsCard.getByText('+221770000002')).toBeVisible();

  // Ouverture du QR code du groupement
  await detailsCard.getByRole('button', { name: 'Code QR du Groupement' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.qr-box svg')).toBeVisible();
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Déconnexion
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: /^(Bienvenue dans votre espace|Bon retour|Votre épargne, ensemble)$/,
    }),
  ).toBeVisible();
});

test('recherche de versements côté serveur et réinitialisation', async ({ page }) => {
  await login(page, './', 'superadmin');
  await page.locator('#group-select').selectOption({ label: 'Les Femmes de Grand Yoff' });
  const campaigns = page.getByLabel('Campagne suivie', { exact: true });
  await campaigns.selectOption(
    (await campaigns
      .locator('option', { hasText: 'Épargne solidaire 2026' })
      .getAttribute('value'))!,
  );
  const search = page.getByLabel('Rechercher un versement par nom ou téléphone');
  const response = page.waitForResponse(
    (r) => r.url().includes('/contributions?') && r.url().includes('q=Awa') && r.status() === 200,
  );
  await search.fill('Awa');
  const data = await (await response).json();
  expect(data.items.every((c: { name: string }) => c.name.includes('Awa'))).toBe(true);
  const date = page.getByLabel('Date du versement recherchée');
  await date.fill('2026-06-02');
  await page.getByRole('button', { name: 'Effacer les filtres', exact: true }).click();
  await expect(search).toHaveValue('');
  await expect(date).toHaveValue('');
});

test('informations de connexion et préremplissage automatique sur les pages de connexion', async ({
  page,
}) => {
  // 1. Page de connexion Super Admin
  await page.goto('./');
  const logoutBtn = page.getByRole('button', { name: 'Se déconnecter', exact: true });
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
    await expect(
      page.getByRole('heading', {
        name: /^(Bienvenue dans votre espace|Bon retour|Votre épargne, ensemble)$/,
      }),
    ).toBeVisible();
  }

  // Vérifier la présence de la carte des infos de connexion
  const superDemoCard = page.locator('.login-demo-card');
  await expect(superDemoCard).toBeVisible();
  await expect(superDemoCard).toContainText('superadmin');
  await expect(superDemoCard).toContainText('+221770000001');

  await page.screenshot({ path: 'test-results/superadmin-login-demo-info.png' });

  // Tester le bouton de pré-remplissage 1-clic pour superadmin
  await page.locator('.login-demo-btn-fill', { hasText: 'Remplir (Identifiant)' }).first().click();
  await expect(page.getByLabel('Identifiant', { exact: true })).toHaveValue('superadmin');
  if (!(await page.getByLabel('Mot de passe', { exact: true }).inputValue())) {
    await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  }
  await expect(page.getByLabel('Mot de passe', { exact: true })).not.toHaveValue('');

  // Se connecter avec les identifiants préremplis
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: /^(Vue d’ensemble|Mon groupement)$/, exact: true }),
  ).toBeVisible();

  // Déconnexion
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: /^(Bienvenue dans votre espace|Bon retour|Votre épargne, ensemble)$/,
    }),
  ).toBeVisible();

  // 2. Page de connexion Espace Membres & Groupements (PWA)
  await page.goto(pwa);
  const pwaLogout = page.getByRole('button', { name: 'Se déconnecter', exact: true });
  if (await pwaLogout.isVisible()) {
    await pwaLogout.click();
    await expect(
      page.getByRole('heading', {
        name: /^(Bienvenue dans votre espace|Bon retour|Votre épargne, ensemble)$/,
      }),
    ).toBeVisible();
  }

  const forget = page.getByRole('button', { name: 'Changer de compte / oublier cet appareil' });
  if (await forget.isVisible()) await forget.click();
  const pwaDemoCard = page.locator('.pwa-login-demo');
  await expect(pwaDemoCard).toBeVisible();
  await pwaDemoCard.locator('summary').click();
  await expect(pwaDemoCard).toContainText('+221770000002');
  await expect(pwaDemoCard).toContainText('+221770000003');
  await pwaDemoCard.getByRole('button', { name: 'Responsable · +221770000002' }).click();
  await expect(page.getByLabel('Numéro de téléphone', { exact: true })).toHaveValue(
    '+221770000002',
  );
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.getByLabel('Code secret', { exact: true }).fill(testCode);
  await expect(
    page.getByRole('heading', { name: /^(Vue d’ensemble|Mon groupement)$/, exact: true }),
  ).toBeVisible();

  // Déconnexion
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: /^(Bienvenue dans votre espace|Bon retour|Votre épargne, ensemble)$/,
    }),
  ).toBeVisible();
});
