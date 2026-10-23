import { test, expect } from './fixtures';
import { mockSpace, savingsId, unlockMockSpace } from './pwa-space';

test.use({ serviceWorkers: 'block' });

for (const responsible of [false, true]) {
  test(`Action du jour : ${responsible ? 'responsable' : 'membre'}, deux thèmes et trois largeurs`, async ({
    page,
  }, info) => {
    await mockSpace(page, responsible, 6);
    await page.goto('/');
    await unlockMockSpace(page);
    const card = page.getByRole('region', { name: 'Action du jour', exact: true });
    const action = card.getByRole('button', {
      name: responsible ? 'Enregistrer une cotisation' : 'Faire un versement',
      exact: true,
    });
    await expect(action).toBeEnabled();
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      for (const width of [360, 390, 430]) {
        await page.setViewportSize({ width, height: 844 });
        const identity = page.getByRole('region', { name: 'Identité du groupement et du membre' });
        await expect(identity).toContainText(responsible ? 'Ndèye Diop' : 'Awa Fall');
        expect((await identity.boundingBox())!.height).toBeLessThanOrEqual(110);
        // No large QR above the action; it remains one tap away in the real card.
        await expect(page.locator('.wave-qr-code-svg')).toHaveCount(0);
        await expect(card).toContainText('Épargne 2026');
        await expect(card).toContainText('Séance du 22 oct. 2026');
        const bounds = (await action.boundingBox())!;
        const nav = (await page
          .getByRole('navigation', { name: 'Navigation principale' })
          .boundingBox())!;
        expect(bounds.y + bounds.height).toBeLessThan(nav.y);
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({
          path: info.outputPath(
            `${responsible ? 'responsable' : 'membre'}-${colorScheme}-${width}.png`,
          ),
        });
      }
    }
    await page
      .getByRole('button', {
        name: responsible ? 'Afficher le QR du groupement' : 'Présenter mon QR',
        exact: true,
      })
      .click();
    const qr = page.getByRole('dialog');
    await expect(qr).toContainText('+221770000002');
    await expect(qr).toContainText('Grand Yoff, Dakar');
    await expect(qr.locator('.qr-box')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    expect((await qr.locator('.qr-box svg').boundingBox())!.width).toBeGreaterThanOrEqual(180);
  });
}

test('membre : vérification avant envoi, montant fixe, confirmation unique et saisie hors connexion', async ({
  page,
  context,
}) => {
  await mockSpace(page);
  let posts = 0;
  await page.route('**/member/campaigns/' + savingsId, (r) =>
    r.fulfill({
      json: {
        today: '2026-10-22',
        can_pay: !posts,
        already_paid: !!posts,
        reason: posts ? 'Versement déjà effectué.' : 'Versement disponible.',
        total_paid: posts ? '9000' : '7500',
        sessions: ['2026-10-22'],
        rounds: [],
        payouts_count: 0,
        remaining_months: 0,
      },
    }),
  );
  await page.route('**/contributions/self', async (r) => {
    expect(r.request().method()).toBe('POST');
    expect(r.request().postDataJSON().amount).toBe(1500);
    posts++;
    await r.fulfill({
      status: 201,
      json: {
        id: 'saved',
        reference: 'VERSEMENT-TEST',
        name: 'Awa Fall',
        amount: '1500',
        paid_on: '2026-10-22',
        voided_at: null,
      },
    });
  });
  await page.goto('/');
  await unlockMockSpace(page);
  const pay = page.getByRole('button', { name: 'Faire un versement', exact: true });
  await expect(pay).toBeEnabled();
  await context.setOffline(true);
  await expect(pay).toBeEnabled();
  expect(posts).toBe(0);
  await expect(page.getByRole('region', { name: 'Action du jour' })).toContainText(
    'Hors connexion',
  );
  await context.setOffline(false);
  await expect(pay).toBeEnabled();
  await pay.click();
  await expect(page.getByLabel('Montant à verser (FCFA)', { exact: true })).toHaveAttribute(
    'readonly',
    '',
  );
  await page.getByRole('button', { name: 'Vérifier mon versement', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Vérifier mon versement', exact: true });
  for (const text of ['Awa Fall', 'Épargne 2026', 'Séance du 22 oct. 2026'])
    await expect(review).toContainText(text);
  expect(posts).toBe(0);
  await review.getByRole('button', { name: 'Modifier', exact: true }).click();
  await expect(page.getByLabel('Montant à verser (FCFA)', { exact: true })).toHaveValue('1500');
  await page.getByRole('button', { name: 'Vérifier mon versement', exact: true }).click();
  await review.getByRole('button', { name: 'Confirmer mon versement', exact: true }).click();
  await expect(review).toHaveCount(0);
  await expect(pay).toBeDisabled();
  await expect(page.getByRole('dialog', { name: 'Versement confirmé' })).toContainText(
    'VERSEMENT-TEST',
  );
  expect(posts).toBe(1);
});

test('responsable : ouvrir la séance et tirer une bénéficiaire avant encaissement', async ({
  page,
}) => {
  await mockSpace(page, true);
  let opened = false,
    drawn = false;
  await page.route('**/savings-session', (r) => {
    if (r.request().method() === 'POST') opened = true;
    return r.fulfill({
      json: { today: '2026-10-22', scheduled: true, opened, can_collect: opened },
    });
  });
  await page.route('**/tontine/status', (r) =>
    r.fulfill({
      json: {
        today: '2026-10-22',
        round_number: 1,
        round_date: '2026-10-22',
        scheduled: true,
        drawn,
        can_draw: !drawn,
        can_collect: drawn,
        beneficiary_name: drawn ? 'Awa Fall' : null,
      },
    }),
  );
  await page.route('**/tontine/draw', (r) => {
    drawn = true;
    return r.fulfill({ json: {} });
  });
  await page.goto('/');
  await unlockMockSpace(page);
  const card = page.getByRole('region', { name: 'Action du jour' });
  await expect(card).toContainText('À ouvrir');
  await expect(card.getByRole('button', { name: 'Enregistrer une cotisation' })).toHaveCount(0);
  await card.getByRole('button', { name: 'Ouvrir la séance d’épargne' }).click();
  await expect(card.getByRole('button', { name: 'Enregistrer une cotisation' })).toBeEnabled();
  await page.getByRole('button', { name: 'Choisir la campagne Tontine des projets' }).click();
  await expect(card).toContainText('À tirer');
  await card.getByRole('button', { name: 'Tirer la bénéficiaire du tour 1' }).click();
  await expect(card).toContainText('Bénéficiaire : Awa Fall');
  await expect(card.getByRole('button', { name: 'Enregistrer une cotisation' })).toBeEnabled();
});

test('historique : erreur de page puis reprise sans sauter de versements', async ({ page }) => {
  await mockSpace(page);
  let fail = true;
  const pages: number[] = [];
  await page.route('**/member/history?*', (r) => {
    const p = Number(new URL(r.request().url()).searchParams.get('page'));
    pages.push(p);
    if (p === 2 && fail) {
      fail = false;
      return r.fulfill({
        status: 503,
        json: { message: 'Historique temporairement indisponible.' },
      });
    }
    return r.fulfill({
      json: {
        items: Array.from({ length: p === 3 ? 2 : 5 }, (_, i) => ({
          id: `pay-${(p - 1) * 5 + i}`,
          campaign_name: 'Épargne 2026',
          campaign_active: true,
          amount: '1500',
          paid_on: '2026-10-22',
          session_date: '2026-10-22',
          type_name: 'Avec Épargne',
          reference: `R-${(p - 1) * 5 + i}`,
        })),
        total: 12,
        total_paid: '18000',
      },
    });
  });
  await page.goto('/');
  await unlockMockSpace(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Mes versements' }).click();
  const rows = page.locator('.member-history-results .member-payment-card');
  const more = page.getByRole('button', { name: 'Voir plus de versements' });
  await expect(rows).toHaveCount(5);
  await more.click();
  await expect(page.getByRole('alert')).toContainText('temporairement indisponible');
  await expect(more).toBeDisabled();
  await page.getByRole('button', { name: 'Réessayer', exact: true }).click();
  await expect(rows).toHaveCount(10);
  await more.click();
  await expect(rows).toHaveCount(12);
  expect(pages).toEqual([1, 2, 2, 3]);
});

test('erreur de séances distincte du vide, confidentialité persistante et retour du navigateur', async ({
  page,
}) => {
  await mockSpace(page, true);
  await page.route('**/sessions', (r) =>
    r.fulfill({ status: 503, json: { message: 'Séances indisponibles.' } }),
  );
  await page.goto('/');
  await unlockMockSpace(page);
  await expect(page.getByRole('alert').filter({ hasText: 'Séances indisponibles' })).toBeVisible();
  await expect(page.getByText('Aucune séance enregistrée.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Masquer les montants', exact: true }).click();
  await page.reload();
  await unlockMockSpace(page);
  await expect(page.locator('.pwa-day-metrics')).toContainText('••••••');
  const nav = page.getByRole('navigation', { name: 'Navigation principale' });
  await nav.getByRole('button', { name: 'Campagnes', exact: true }).click();
  await nav.getByRole('button', { name: 'Membres', exact: true }).click();
  await expect.poll(() => page.evaluate(() => history.state.alfPwaPage?.tab)).toBe('members');
  await page.goBack();
  await expect(nav.getByRole('button', { name: 'Campagnes', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.goBack();
  await expect(page.getByRole('region', { name: 'Action du jour', exact: true })).toBeVisible();
});
