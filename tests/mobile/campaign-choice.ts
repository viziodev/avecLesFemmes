import { expect, type Page } from '@playwright/test';

export async function chooseCampaign(page: Page, name: string) {
  await expect(
    page.locator('.wave-actions-grid .overview-campaign-shortcut').first(),
  ).toBeVisible();
  const choice = page.getByRole('button', { name: `Choisir la campagne ${name}`, exact: true });
  if (!(await choice.count()))
    await page.getByRole('button', { name: 'Plus de campagnes', exact: true }).click();
  await choice.click();
}
