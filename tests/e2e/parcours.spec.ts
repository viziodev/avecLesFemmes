import { test, expect, type Page } from '@playwright/test';
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
    await expect(page.getByRole('heading', { name: 'Bienvenue dans votre espace' })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Identifiant', exact: true }).click();
  await page.getByLabel('Identifiant', { exact: true }).fill(user);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Vue d’ensemble', exact: true })).toBeVisible();
}
test('super administrateur consulte, crée et active une campagne', async ({ page }) => {
  await login(page, './', 'superadmin');
  await page.locator('#group-select').selectOption({ label: 'Les Femmes de Grand Yoff' });
  await expect(page.getByRole('button', { name: 'Enregistrer une cotisation' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Campagnes', exact: true }).click();
  await expect(page.getByText('Épargne solidaire 2026', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Désactiver', exact: true }).first().click();
  await page.getByRole('button', { name: 'Archives', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Activer', exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Activer', exact: true }).first().click();
  await page.getByRole('button', { name: 'Campagnes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Désactiver', exact: true }).first()).toBeVisible();
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
test('administratrice enregistre et retrouve sa vue membre', async ({ page }) => {
  await login(page, pwa, 'admin.ndeye');
  const campSelect = page.getByLabel('Campagne suivie', { exact: true });
  await expect(campSelect).toBeVisible();
  const epargneOption = campSelect.locator('option', { hasText: 'Épargne solidaire 2026' });
  await expect(epargneOption).toBeAttached();
  const value = await epargneOption.getAttribute('value');
  if (value) {
    await campSelect.selectOption(value);
  }
  await page.getByRole('button', { name: 'Enregistrer une cotisation', exact: true }).click();
  const selection = page.getByRole('combobox', { name: 'Participante', exact: true });
  await expect(selection).toHaveValue('');
  const ndeye = await selection.locator('option', { hasText: 'Ndèye' }).getAttribute('value');
  await selection.selectOption(ndeye!);
  await page.getByLabel('Montant réellement versé en FCFA').fill('2000');
  await page.getByLabel('Date du versement', { exact: true }).fill('2026-06-02');
  await page.getByRole('button', { name: 'Vérifier la cotisation', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Récapitulatif de la cotisation' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmer la cotisation', exact: true }).click();
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
  await page.getByRole('button', { name: 'Mes campagnes', exact: true }).click();
  await page.getByRole('button', { name: 'Ma participation', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Ma participation', exact: true })).toBeVisible();
});
test('connexion par code téléphone et déconnexion', async ({ page }) => {
  await login(page, './', 'superadmin');
  const groups = await (await page.request.get('/api/v1/groupements?limit=100')).json();
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
  const targetGroup =
    groups.items.find((g: any) => g.name === 'Les Femmes de Grand Yoff') || groups.items[0];
  const groupId = targetGroup.id;
  const campaigns = await (
    await page.request.get(pwa + `/api/v1/groupements/${groupId}/campaigns`)
  ).json();
  const targetCampaign =
    campaigns.items.find((c: any) => c.name === 'Épargne solidaire 2026') || campaigns.items[0];
  const campaignId = targetCampaign.id;
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
test('membre se connecte par code PIN et affiche son QR code vectoriel', async ({ page }) => {
  await login(page, './', 'superadmin');
  const groups = await (await page.request.get('/api/v1/groupements')).json();
  const groupId = groups.items[0].id;
  const phone = '+2217' + Date.now().toString().slice(-8);
  const pin = '5678';
  const created = await page.request.post(`/api/v1/groupements/${groupId}/members`, {
    headers: { 'X-Requested-With': 'AvecLesFemmes' },
    data: {
      name: 'Fatou Ndiaye Test PIN',
      login: 'pin.' + randomUUID().slice(0, 8),
      phone,
      pin,
      gender: 'F',
      address: 'Medina Rue 6',
    },
  });
  expect(created.status()).toBe(201);
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenue dans votre espace' })).toBeVisible();

  await page.goto(pwa);
  const pwaLogout = page.getByRole('button', { name: 'Se déconnecter', exact: true });
  if (await pwaLogout.isVisible()) {
    await pwaLogout.click();
    await expect(page.getByRole('heading', { name: 'Bienvenue dans votre espace' })).toBeVisible();
  }
  const pinTab = page.getByRole('button', { name: 'Code PIN', exact: true });
  if (await pinTab.isVisible()) {
    await pinTab.click();
  }
  await page.getByLabel('Téléphone avec indicatif', { exact: true }).fill(phone);
  await page.getByLabel('Code secret (4 chiffres)', { exact: true }).fill(pin);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Vue d’ensemble', exact: true })).toBeVisible();

  // Test affichage de la carte QR vectorielle
  await page.getByRole('button', { name: 'Mon Code QR' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.qr-box svg')).toBeVisible();
  await page.getByRole('button', { name: 'Fermer', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Déconnexion
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenue dans votre espace' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Bienvenue dans votre espace' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Bienvenue dans votre espace' })).toBeVisible();
});

test('bouton Créer une campagne sur l’onglet Campagnes à la sélection d’un groupement', async ({
  page,
}) => {
  await login(page, './', 'superadmin');
  await page.locator('#group-select').selectOption({ label: 'Les Femmes de Grand Yoff' });
  await page.getByRole('button', { name: 'Campagnes', exact: true }).click();

  const createButton = page
    .getByRole('button', { name: 'Créer une campagne', exact: true })
    .first();
  await expect(createButton).toBeVisible();
  await createButton.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Créer une campagne' })).toBeVisible();
  await page.locator('.dialog-header button[aria-label="Fermer"]').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Déconnexion
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenue dans votre espace' })).toBeVisible();
});

test('champs conditionnels du modal création de campagne selon Type Épargne vs Tontine rotative', async ({
  page,
}) => {
  await login(page, './', 'superadmin');
  await page.locator('#group-select').selectOption({ label: 'Les Femmes de Grand Yoff' });
  await page.getByRole('button', { name: 'Campagnes', exact: true }).click();

  const createButton = page
    .getByRole('button', { name: 'Créer une campagne', exact: true })
    .first();
  await createButton.click();
  await expect(page.getByRole('dialog')).toBeVisible();

  // Par défaut : Type Épargne (ex: Avec Épargne)
  await expect(page.getByLabel('Montant standard / forfait (FCFA)')).toBeVisible();
  await expect(page.getByLabel('Date de début')).toBeVisible();
  await expect(page.getByLabel('Date de fin')).toBeVisible();
  await expect(page.getByLabel('Jour de cotisation hebdomadaire')).toBeVisible();
  await expect(page.getByLabel('Intervalle en semaines')).toBeVisible();
  await expect(page.getByLabel("Jour d'échéance du mois (Option C)")).toHaveCount(0);
  await expect(page.getByLabel('Intervalle de rotation (si Tontine rotative)')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/modal-epargne.png' });

  // Changement vers Tontine rotative
  const typeSelect = page.locator('select[name="typeId"]');
  const tontineOption = await typeSelect
    .locator('option')
    .filter({ hasText: /tontine/i })
    .first();
  const tontineVal = await tontineOption.getAttribute('value');
  if (tontineVal) {
    await typeSelect.selectOption(tontineVal);

    // Vérification des champs Tontine
    await expect(page.getByLabel("Jour d'échéance du mois (Option C)")).toBeVisible();
    await expect(page.getByLabel('Intervalle de rotation (si Tontine rotative)')).toBeVisible();
    // Les champs Épargne ne doivent plus être affichés
    await expect(page.getByLabel('Montant standard / forfait (FCFA)')).toHaveCount(0);
    await expect(page.getByLabel('Date de début')).toHaveCount(0);
    await expect(page.getByLabel('Date de fin')).toHaveCount(0);
    await expect(page.getByLabel('Jour de cotisation hebdomadaire')).toHaveCount(0);
    await expect(page.getByLabel('Intervalle en semaines')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/modal-tontine.png' });
  }

  await page.locator('.dialog-header button[aria-label="Fermer"]').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Déconnexion
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenue dans votre espace' })).toBeVisible();
});

test('tableau des campagnes actives avec métriques et onglet Archives', async ({ page }) => {
  await login(page, './', 'superadmin');
  await page.locator('#group-select').selectOption({ label: 'Les Femmes de Grand Yoff' });

  // 1. Onglet Campagnes : Table enrichie
  await page.getByRole('button', { name: 'Campagnes', exact: true }).click();
  await expect(page.locator('.campaigns-table')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Campagnes actives du groupement' }),
  ).toBeVisible();

  // Vérification de la présence des colonnes
  const headers = page.locator('.campaigns-table th');
  await expect(headers.filter({ hasText: 'Campagne' })).toBeVisible();
  await expect(headers.filter({ hasText: 'Membres' })).toBeVisible();
  await expect(headers.filter({ hasText: 'Suivi & Métriques' })).toBeVisible();
  await expect(headers.filter({ hasText: 'Période & Fréquence' })).toBeVisible();
  await expect(headers.filter({ hasText: 'Actions' })).toBeVisible();

  // Vérification du bouton "Ajouter un membre"
  const addMemberBtn = page.locator('.btn-add-member-mini').first();
  await expect(addMemberBtn).toBeVisible();
  await addMemberBtn.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Configurer une participation')).toBeVisible();
  await page.locator('.dialog-header button[aria-label="Fermer"]').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.screenshot({ path: 'test-results/campaigns-table.png' });

  // 1.b Vérification des sous-onglets lors de la sélection d'une campagne
  await expect(page.getByRole('button', { name: /1\. Participantes et forfaits/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /2\. Sessions/i })).toBeVisible();

  // Onglet Participantes : colonnes présentes
  await expect(page.getByRole('columnheader', { name: 'Membres' }).first()).toBeVisible();

  // Bascule vers l'onglet Sessions
  await page.getByRole('button', { name: /2\. Sessions/i }).click();
  await expect(
    page.getByRole('heading', { name: 'Cahier des Sessions de cotisation' }),
  ).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Date' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Montant récupéré' })).toBeVisible();
  await expect(
    page.getByRole('columnheader', { name: 'Nbre Membre ayant de cotisation' }),
  ).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Détails' })).toBeVisible();
  await page.screenshot({ path: 'test-results/selection-sessions-tab.png' });

  // Retour vers l'onglet Participantes
  await page.getByRole('button', { name: /1\. Participantes et forfaits/i }).click();

  // Vérifier qu'il n'y a plus le bouton "Consulter les versements"
  await expect(page.getByText('Consulter les versements')).toHaveCount(0);

  await page.screenshot({ path: 'test-results/selection-subtabs.png' });

  // 1.c Vue d'ensemble : vérification du tri de l'historique des cotisations
  await page.getByRole('button', { name: 'Vue d’ensemble', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Historique des cotisations' })).toBeVisible();
  await expect(page.getByText('Trier par :')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Date (décroissant)' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Par session|Par période/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Par membre' })).toBeVisible();

  // Test du changement de tri vers "Par membre"
  await page.getByRole('button', { name: 'Par membre' }).click();
  await expect(page.getByRole('button', { name: 'Par membre' })).toHaveClass(/active/);

  // Test du retour au tri par Date
  await page.getByRole('button', { name: 'Date (décroissant)' }).click();
  await expect(page.getByRole('button', { name: 'Date (décroissant)' })).toHaveClass(/active/);
  await page.screenshot({ path: 'test-results/overview-cotisations-sort.png' });

  // Sélection de la campagne Épargne solidaire 2026 pour afficher le tableau des cotisations
  const campSelect = page.getByLabel('Campagne suivie', { exact: true });
  const epargneOption = campSelect.locator('option', { hasText: 'Épargne solidaire 2026' });
  if (await epargneOption.count()) {
    const val = await epargneOption.getAttribute('value');
    if (val) {
      await campSelect.selectOption(val);
      await expect(page.locator('.contribution-table')).toBeVisible();
      await page.screenshot({ path: 'test-results/overview-cotisations-data.png', fullPage: true });
    }
  }

  // 2. Onglet Archives
  await page.getByRole('button', { name: 'Archives', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Archives/i })).toBeVisible();
  await expect(page.getByText('Campagnes fermées / archivées')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Groupements inactifs', exact: true }),
  ).toBeVisible();

  await page.screenshot({ path: 'test-results/archives-tab.png' });

  // Déconnexion
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenue dans votre espace' })).toBeVisible();
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
    await expect(page.getByRole('heading', { name: 'Bienvenue dans votre espace' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Vue d’ensemble', exact: true })).toBeVisible();

  // Déconnexion
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenue dans votre espace' })).toBeVisible();

  // 2. Page de connexion Espace Membres & Groupements (PWA)
  await page.goto(pwa);
  const pwaLogout = page.getByRole('button', { name: 'Se déconnecter', exact: true });
  if (await pwaLogout.isVisible()) {
    await pwaLogout.click();
    await expect(page.getByRole('heading', { name: 'Bienvenue dans votre espace' })).toBeVisible();
  }

  // Vérifier la présence de la carte des infos de connexion PWA
  const pwaDemoCard = page.locator('.login-demo-card');
  await expect(pwaDemoCard).toBeVisible();
  await expect(pwaDemoCard).toContainText('admin.ndeye');
  await expect(pwaDemoCard).toContainText('membre.awa');
  await expect(pwaDemoCard).toContainText('+221770000002');
  await expect(pwaDemoCard).toContainText('+221770000003');

  await page.screenshot({ path: 'test-results/membres-pwa-login-demo-info.png' });

  // Tester le pré-remplissage 1-clic pour l'administratrice de groupement
  await page.locator('.login-demo-btn-fill', { hasText: 'Remplir (Identifiant)' }).first().click();
  await expect(page.getByLabel('Identifiant', { exact: true })).toHaveValue('admin.ndeye');
  if (!(await page.getByLabel('Mot de passe', { exact: true }).inputValue())) {
    await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  }
  await expect(page.getByLabel('Mot de passe', { exact: true })).not.toHaveValue('');

  // Connexion avec les identifiants préremplis
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Vue d’ensemble', exact: true })).toBeVisible();

  // Déconnexion
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenue dans votre espace' })).toBeVisible();
});

test('un refus de cotisation reste visible et conserve la saisie', async ({ page }) => {
  await login(page, pwa, 'admin.ndeye');
  const campaigns = page.getByLabel('Campagne suivie', { exact: true });
  const id = await campaigns
    .locator('option', { hasText: 'Épargne solidaire 2026' })
    .getAttribute('value');
  await campaigns.selectOption(id!);
  await page.getByRole('button', { name: 'Enregistrer une cotisation', exact: true }).click();
  const selection = page.getByRole('combobox', { name: 'Participante', exact: true });
  await expect(selection).toHaveValue('');
  const member = await selection.locator('option', { hasText: 'Awa' }).getAttribute('value');
  await selection.selectOption(member!);
  await page.getByLabel('Montant réellement versé en FCFA').fill('2000');
  await page.route('**/contributions', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Membre bloquée (test)' }),
      });
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'Vérifier la cotisation', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Récapitulatif de la cotisation' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmer la cotisation', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Membre bloquée');
  await page.getByRole('button', { name: 'Modifier la saisie' }).click();
  await expect(page.getByLabel('Montant réellement versé en FCFA')).toHaveValue('2000');
  await expect(page.getByRole('status')).not.toContainText('Cotisation enregistrée');
});

for (const width of [360, 390, 430]) {
  for (const user of ['admin.ndeye', 'membre.awa']) {
    test(`socle mobile ${user} à ${width}px : navigation et dialogue`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await login(page, pwa, user);
      const nav = page.getByRole('navigation', { name: 'Navigation principale' });
      await expect(nav.getByRole('button', { name: 'Accueil', exact: true })).toBeVisible();
      const bounds = await nav.boundingBox();
      expect(bounds!.y).toBeGreaterThan(700);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      await expect(page.getByLabel('Sélectionner un groupement')).toBeHidden();
      if (user === 'admin.ndeye') {
        const encaisser = page.getByRole('button', {
          name: 'Enregistrer une cotisation',
          exact: true,
        });
        await expect(encaisser).toBeVisible();
        const action = await encaisser.boundingBox();
        expect(action!.y + action!.height).toBeLessThan(bounds!.y);
      }
      const qr = page.getByRole('button', { name: 'Mon Code QR', exact: true });
      await qr.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(qr).toBeFocused();
    });
  }
}

test.describe('Consultation personnelle avec réponses contrôlées', () => {
  test.use({ serviceWorkers: 'block' });
  test('membre : campagne désactivée, historique personnel et confidentialité', async ({
    page,
  }) => {
    await page.route('**/campaigns?*', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.items = body.items.map((c: { active: boolean }) => ({ ...c, active: false }));
      await route.fulfill({ response, json: body });
    });
    await page.route('**/contributions?*', async (route) => {
      await route.fulfill({
        json: {
          items: [
            {
              id: 'test-versement',
              name: 'Awa Fall',
              participation_id: 'test',
              amount: '2500',
              paid_on: '2026-06-02',
              reference: 'TEST-MEMBRE-001',
              voided_at: null,
            },
          ],
          total: 1,
        },
      });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, pwa, 'membre.awa');
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    await nav.getByRole('button', { name: 'Mes campagnes', exact: true }).click();
    await expect(page.getByText('Désactivée', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Ma participation', exact: true }).first().click();
    await expect(
      page.getByRole('heading', { name: 'Ma participation', exact: true }),
    ).toBeVisible();
    await nav.getByRole('button', { name: 'Mes versements', exact: true }).click();
    await expect(page.getByText('Référence : TEST-MEMBRE-001')).toBeVisible();
    await expect(page.locator('.member-payment-heading strong')).toContainText('2');
    await page.getByRole('button', { name: 'Masquer les montants', exact: true }).click();
    await expect(page.locator('.member-payment-heading strong')).toHaveText('•••••• FCFA');
    await nav.getByRole('button', { name: 'Accueil', exact: true }).click();
    await expect(page.locator('.member-balance-card > strong')).toHaveText('•••••• FCFA');
    await nav.getByRole('button', { name: 'Mon compte', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Mon adhésion' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enregistrer une cotisation' })).toHaveCount(0);
  });
});

test('gestion mobile : recherche globale et récapitulatif sans enregistrement anticipé', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, pwa, 'admin.ndeye');
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await nav.getByRole('button', { name: 'Membres', exact: true }).click();
  await page.getByLabel('Rechercher une membre par nom ou téléphone').fill('Awa');
  await expect(page.locator('.admin-member-list tbody tr')).toHaveCount(1);
  await expect(page.locator('.admin-member-list tbody')).toContainText('Awa');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await nav.getByRole('button', { name: 'Accueil', exact: true }).click();
  const campaign = page.getByLabel('Campagne suivie', { exact: true });
  const id = await campaign
    .locator('option', { hasText: 'Épargne solidaire 2026' })
    .getAttribute('value');
  await campaign.selectOption(id!);
  await nav.getByRole('button', { name: 'Encaisser', exact: true }).click();
  await page.getByLabel('Rechercher une participante par nom ou téléphone').fill('Awa');
  const payer = page.getByRole('combobox', { name: 'Participante', exact: true });
  const option = payer.locator('option', { hasText: 'Awa' });
  await expect(option).toBeAttached();
  await payer.selectOption((await option.getAttribute('value'))!);
  await page.getByLabel('Montant réellement versé en FCFA').fill('750');
  let writes = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/contributions')) writes++;
  });
  await page.getByRole('button', { name: 'Vérifier la cotisation', exact: true }).click();
  const review = page.getByRole('region', { name: 'Récapitulatif de la cotisation' });
  await expect(review).toContainText('Awa');
  await expect(review).toContainText('750');
  expect(writes).toBe(0);
  await page.getByRole('button', { name: 'Modifier la saisie' }).click();
  await expect(page.getByLabel('Montant réellement versé en FCFA')).toHaveValue('750');
  await page.getByRole('dialog').getByRole('button', { name: 'Annuler', exact: true }).click();
});

test.describe('Reprise réseau du lot 5', () => {
  test.use({ serviceWorkers: 'block' });
  test('coupure pendant la confirmation : saisie et clé conservées sans envoi automatique', async ({
    page,
    context,
  }) => {
    await login(page, pwa, 'admin.ndeye');
    const campaigns = page.getByLabel('Campagne suivie', { exact: true });
    await campaigns.selectOption(
      (await campaigns
        .locator('option', { hasText: 'Épargne solidaire 2026' })
        .getAttribute('value'))!,
    );
    await page.getByRole('button', { name: 'Enregistrer une cotisation', exact: true }).click();
    const selection = page.getByRole('combobox', { name: 'Participante', exact: true });
    await selection.selectOption(
      (await selection.locator('option', { hasText: 'Awa' }).getAttribute('value'))!,
    );
    await page.getByLabel('Montant réellement versé en FCFA').fill('750');
    const attempts: Record<string, unknown>[] = [];
    await page.route('**/contributions', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      attempts.push(route.request().postDataJSON());
      // Simulate a lost response, then an acknowledged retry; no local money is recorded.
      if (attempts.length === 1) await route.abort('connectionreset');
      else await route.fulfill({ status: 201, json: { id: 'network-retry-test' } });
    });
    await page.getByRole('button', { name: 'Vérifier la cotisation', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmer la cotisation', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
      'enregistrement non confirmé',
    );
    await context.setOffline(true);
    await expect(
      page.getByRole('button', { name: 'Confirmer la cotisation', exact: true }),
    ).toBeDisabled();
    await context.setOffline(false);
    await expect(
      page.getByRole('button', { name: 'Confirmer la cotisation', exact: true }),
    ).toBeEnabled();
    expect(attempts).toHaveLength(1);
    await page.screenshot({ path: 'test-results/lot5-reprise-reseau.png', fullPage: false });
    await expect(
      page.getByRole('region', { name: 'Récapitulatif de la cotisation' }),
    ).toContainText('750');
    await page.getByRole('button', { name: 'Confirmer la cotisation', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Cotisation enregistrée');
    expect(attempts).toHaveLength(2);
    expect(attempts[1]).toEqual(attempts[0]);
    expect(attempts[0].idempotencyKey).toBeTruthy();
  });

  test('session inaccessible au démarrage : reprise explicite sans fausse déconnexion', async ({
    page,
  }) => {
    let unavailable = true;
    await page.route('**/auth/me', async (route) => {
      if (unavailable) await route.abort('connectionreset');
      else await route.continue();
    });
    await page.goto(pwa);
    await expect(page.getByRole('alert')).toContainText('session n’a pas pu être vérifiée');
    unavailable = false;
    await page.getByRole('button', { name: 'Réessayer la connexion' }).click();
    await expect(page.getByRole('heading', { name: 'Bienvenue dans votre espace' })).toBeVisible();
  });
});
