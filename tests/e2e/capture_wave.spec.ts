import { test } from '@playwright/test';
import { config } from 'dotenv';
config({ path: '.env', quiet: true });

const password = process.env.DEMO_PASSWORD || 'Secret123!';
const pwa = process.env.PWA_URL || 'http://localhost:8086';
const artifactDir = '/Users/douvewane/.gemini/antigravity-ide/brain/b57b82e7-be24-4ec8-844a-0189236e4483';

test('capture des interfaces Wave Membre et Admin Groupement', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  // 1. Connexion Membre (Wave Particulier)
  await page.goto(pwa);
  await page.getByRole('button', { name: 'Identifiant', exact: true }).click();
  await page.getByLabel('Identifiant', { exact: true }).fill('membre.awa');
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page.waitForTimeout(1000);

  // Capture Membre Home (Wave Particulier)
  await page.screenshot({ path: `${artifactDir}/wave_membre_home.png`, fullPage: true });

  // 2. Déconnexion et Connexion Admin Groupement (Wave Business)
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await page.waitForTimeout(500);

  await page.getByRole('button', { name: 'Identifiant', exact: true }).click();
  await page.getByLabel('Identifiant', { exact: true }).fill('admin.ndeye');
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page.waitForTimeout(1000);

  // Capture Admin Home (Wave Business)
  await page.screenshot({ path: `${artifactDir}/wave_admin_business_home.png`, fullPage: true });

  // 3. Ouvrir l'écran Chiffres
  await page.getByRole('button', { name: 'Afficher les chiffres', exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${artifactDir}/wave_admin_chiffres.png` });

  // Basculer sur l'onglet Semaine
  await page.getByRole('button', { name: 'Semaine', exact: true }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${artifactDir}/wave_admin_chiffres_semaine.png` });

  // Retour au dashboard
  await page.getByRole('button', { name: 'Retour', exact: true }).click();
  await page.waitForTimeout(500);

  // 4. Ouvrir l'écran Paramètres
  await page.getByRole('button', { name: 'Paramètres du groupement', exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${artifactDir}/wave_admin_settings.png` });

  // Retour au dashboard
  await page.getByRole('button', { name: 'Retour', exact: true }).click();
  await page.waitForTimeout(500);

  // 5. Ouvrir la modal d'encaissement avec le pavé numérique géant
  await page.getByRole('button', { name: 'Enregistrer une cotisation', exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${artifactDir}/wave_keypad_modal.png` });
});
