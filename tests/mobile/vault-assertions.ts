import { expect, type Page } from '@playwright/test';

// Un chiffrement encodé en base64 peut contenir fortuitement un prénom court.
// Vérifier les seuls champs persistables ; l’ouverture avec un mauvais puis le
// bon mot de passe est vérifiée dans les parcours, pas par une recherche aléatoire.
export async function expectEncryptedVault(page: Page) {
  const envelopes = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => key.startsWith('alf:pwa:vault:'))
      .map((key) => JSON.parse(localStorage.getItem(key)!)),
  );
  expect(envelopes.length).toBeGreaterThan(0);
  const encoded = (value: string, bytes?: number) => {
    expect(typeof value).toBe('string');
    expect(value).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    if (bytes) expect(Buffer.from(value, 'base64').length).toBe(bytes);
    else expect(Buffer.from(value, 'base64').length).toBeGreaterThanOrEqual(16);
  };
  const wrapping = (value: { salt: string; iv: string; ciphertext: string }) => {
    expect(Object.keys(value).sort()).toEqual(['ciphertext', 'iv', 'salt']);
    encoded(value.salt, 16);
    encoded(value.iv, 12);
    encoded(value.ciphertext);
  };
  for (const envelope of envelopes) {
    expect([1, 3]).toContain(envelope.version);
    const allowed =
      envelope.version === 1
        ? ['ciphertext', 'iv', 'salt', 'version']
        : ['ciphertext', 'iv', 'online', 'recovery', 'version'].filter((key) => key in envelope);
    expect(Object.keys(envelope).sort()).toEqual(allowed.sort());
    encoded(envelope.iv, 12);
    encoded(envelope.ciphertext);
    if (envelope.version === 1) encoded(envelope.salt, 16);
    else {
      expect(envelope.recovery).toBeDefined();
      wrapping(envelope.recovery);
      if (envelope.online) wrapping(envelope.online);
    }
  }
}
