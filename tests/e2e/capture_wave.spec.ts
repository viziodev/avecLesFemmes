import { forgetDeviceAsSuperAdmin } from '../mobile/device-administration';
import { existsSync, mkdirSync } from 'node:fs';
import { test, loginPwa } from '../mobile/fixtures';
import { config } from 'dotenv';
config({ path: '.env', quiet: true });

const password = process.env.DEMO_PASSWORD!;
const pwa = process.env.PWA_URL || 'http://localhost:8086';
const preferredDir =
  '/Users/douvewane/.gemini/antigravity-ide/brain/b57b82e7-be24-4ec8-844a-0189236e4483';
const artifactDir =
  process.env.ARTIFACT_DIR || (existsSync(preferredDir) ? preferredDir : 'test-results');

test('capture des interfaces Wave Membre et Admin Groupement', async ({ page }) => {
  test.skip(process.env.CAPTURE_WAVE !== '1', 'Capture manuelle : CAPTURE_WAVE=1');
  mkdirSync(artifactDir, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });

  // 1. Connexion Membre (Wave Particulier)
  await page.goto(pwa);

  await loginPwa(page, 'membre.awa');
  await page.waitForTimeout(1000);

  // Capture Membre Home (Wave Particulier)
  await page.screenshot({ path: `${artifactDir}/wave_membre_home.png`, fullPage: true });

  // 2. Déconnexion et Connexion Admin Groupement (Wave Business)
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await page.waitForTimeout(500);

  await forgetDeviceAsSuperAdmin(page, password);
  await loginPwa(page, 'admin.ndeye');
  await page.waitForTimeout(1000);

  // Capture Admin Home (Wave Business)
  await page.screenshot({ path: `${artifactDir}/wave_admin_business_home.png`, fullPage: true });

  // 3. Ouvrir l'écran Chiffres
  await page.getByRole('button', { name: 'Afficher les chiffres', exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${artifactDir}/wave_admin_chiffres.png` });

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
