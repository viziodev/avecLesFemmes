// Security regression tests on synthetic data only.
import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const out =
  'docs/audits/securite-2026-10-23/preuves-apres' +
  (process.env.PWA_URL?.endsWith(':8087') ? '/render-local' : '');
test.beforeAll(async () => {
  await mkdir(out, { recursive: true });
});

test('SEC-04 : CSP et protections présentes sur HTML, script et API', async ({ request }) => {
  const root = await request.get('/');
  expect(root.status()).toBe(200);
  const html = await root.text();
  const asset = html.match(/src="([^" ]+\.js)"/)?.[1];
  expect(asset).toBeTruthy();
  const module = html.match(/type="module"[^>]*src="([^"]+)"/)?.[1];
  expect(module).toBeTruthy();
  const checks = [];
  for (const path of [
    '/',
    asset!,
    module!,
    '/api/v1/health/live',
    ...(process.env.PWA_URL?.endsWith(':8087') ? ['/admin/'] : []),
  ]) {
    const response = await request.get(path);
    const headers = response.headers();
    checks.push({
      path,
      status: response.status(),
      headers: Object.fromEntries(
        [
          'content-security-policy',
          'x-frame-options',
          'x-content-type-options',
          'referrer-policy',
          'strict-transport-security',
          'cache-control',
        ].map((k) => [k, headers[k] || null]),
      ),
    });
  }
  for (const check of checks) {
    expect(check.headers['content-security-policy']).toContain("script-src 'self'");
    expect(check.headers['content-security-policy']).not.toContain(
      "script-src 'self' 'unsafe-inline'",
    );
    expect(check.headers['x-frame-options']).toBe('DENY');
    expect(check.headers['x-content-type-options']).toBe('nosniff');
    expect(check.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  }
  await writeFile(`${out}/http-headers.json`, JSON.stringify(checks, null, 2) + '\n');
});

test('SEC-05 : aucune clé PIN hors ligne et accès par mot de passe après suppression des compteurs', async ({
  page,
}) => {
  const built = await build({
    entryPoints: [resolve('packages/ui/src/OfflineVault.ts')],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'AuditVault',
    platform: 'browser',
  });
  // No business API request or existing account is used by this reproduction.
  await page.route('**/api/**', (r) =>
    r.fulfill({ status: 503, json: { message: 'Audit isolé : API bloquée.' } }),
  );
  await page.goto('/');
  await page.route('**/audit-only-vault.js', (r) =>
    r.fulfill({ contentType: 'application/javascript', body: built.outputFiles[0].text }),
  );
  await page.addScriptTag({ url: '/audit-only-vault.js' });
  const result = await page.evaluate(async () => {
    const Vault = (window as any).AuditVault.OfflineVault;
    const login = 'audit-synthetic-only';
    const actor = {
      id: crypto.randomUUID(),
      login,
      name: 'Données fictives',
      isSuper: false,
      hasSecretCode: true,
    };
    const password = 'Long-audit-only-recovery-password';
    const serverKey = crypto
      .getRandomValues(new Uint8Array(32))
      .reduce((a, b) => a + b.toString(16).padStart(2, '0'), '');
    const fixture = await Vault.openOnline(login, serverKey, actor, password);
    await fixture.remember('/synthetic', { amount: '12345', synthetic: true });
    fixture.close();
    const stored = localStorage.getItem('alf:pwa:vault:' + encodeURIComponent(login))!;
    const envelope = JSON.parse(stored);
    let rejected = 0;
    for (const pin of ['0000', '0001', '0002', '2468']) {
      localStorage.removeItem('alf:pwa:code-attempts:' + encodeURIComponent(login));
      try {
        await Vault.openCode(login, pin, actor);
      } catch {
        rejected++;
      }
    }
    let wrongPasswordRejected = false;
    try {
      await Vault.open(login, 'wrong-long-audit-password');
    } catch {
      wrongPasswordRejected = true;
    }
    const opened = await Vault.open(login, password);
    const readable = opened.read('/synthetic')?.data.synthetic === true;
    opened.close();
    return {
      scope: 'Fresh context, synthetic vault only',
      envelopeVersion: envelope.version,
      hasPinWrapper: !!envelope.code,
      serverKeyStored: stored.includes(serverKey),
      passwordStored: stored.includes(password),
      rejectedIncludingCorrectPin: rejected,
      wrongPasswordRejected,
      recoveryPasswordWorks: readable,
    };
  });
  expect(result.envelopeVersion).toBe(3);
  expect(result.hasPinWrapper).toBe(false);
  expect(result.serverKeyStored).toBe(false);
  expect(result.passwordStored).toBe(false);
  expect(result.rejectedIncludingCorrectPin).toBe(4);
  expect(result.wrongPasswordRejected).toBe(true);
  expect(result.recoveryPasswordWorks).toBe(true);
  await writeFile(`${out}/offline-counter.json`, JSON.stringify(result, null, 2) + '\n');
});

test('migration v1/v2 : mot de passe exigé, brouillons conservés et wrapper PIN supprimé', async ({
  page,
}) => {
  const built = await build({
    entryPoints: [resolve('packages/ui/src/OfflineVault.ts')],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'AuditVault',
    platform: 'browser',
  });
  await page.route('**/api/**', (r) =>
    r.fulfill({ status: 503, json: { message: 'Audit isolé' } }),
  );
  await page.route('**/audit-only-vault.js', (r) =>
    r.fulfill({ contentType: 'application/javascript', body: built.outputFiles[0].text }),
  );
  await page.goto('/');
  await page.addScriptTag({ url: '/audit-only-vault.js' });
  const checks = await page.evaluate(async () => {
    const Vault = (window as any).AuditVault.OfflineVault;
    const enc = new TextEncoder();
    const b64 = (v: Uint8Array) => btoa(String.fromCharCode(...v));
    async function derive(secret: string, salt: Uint8Array) {
      const material = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, [
        'deriveKey',
      ]);
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );
    }
    const results = [];
    for (const version of [1, 2]) {
      const actor = {
        id: crypto.randomUUID(),
        login: 'audit-migration-' + version,
        name: 'Fictive',
        isSuper: false,
        hasSecretCode: true,
      };
      const password = 'Strong-original-audit-password',
        serverKey = 'b'.repeat(64);
      const body = { amount: 1500, paidOn: '2026-10-23', idempotencyKey: crypto.randomUUID() };
      const data = {
        actor,
        entries: { '/synthetic': { data: { synthetic: true }, savedAt: new Date().toISOString() } },
        pending: [
          {
            id: body.idempotencyKey,
            path: '/api/v1/groupements/g/campaigns/c/contributions/self',
            body,
            createdAt: new Date().toISOString(),
          },
        ],
      };
      const salt = crypto.getRandomValues(new Uint8Array(16)),
        iv = crypto.getRandomValues(new Uint8Array(12));
      const rawKey = crypto.getRandomValues(new Uint8Array(32));
      const key =
        version === 1
          ? await derive(password, salt)
          : await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt', 'decrypt']);
      const ciphertext = b64(
        new Uint8Array(
          await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            enc.encode(JSON.stringify(data)),
          ),
        ),
      );
      let envelope: any = { version, salt: b64(salt), iv: b64(iv), ciphertext };
      if (version === 2) {
        const recoveryIv = crypto.getRandomValues(new Uint8Array(12));
        const recoveryCipher = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv: recoveryIv },
          await derive(password, salt),
          rawKey,
        );
        envelope = {
          version,
          code: { salt: 'legacy-pin-wrapper' },
          recovery: {
            salt: b64(salt),
            iv: b64(recoveryIv),
            ciphertext: b64(new Uint8Array(recoveryCipher)),
          },
          iv: b64(iv),
          ciphertext,
        };
      }
      const slot = 'alf:pwa:vault:' + encodeURIComponent(actor.login);
      const before = JSON.stringify(envelope);
      localStorage.setItem(slot, before);
      let wrongRefused = false;
      try {
        await Vault.openOnline(actor.login, serverKey, actor, 'Wrong-audit-password');
      } catch {
        wrongRefused = true;
      }
      const unchanged = localStorage.getItem(slot) === before;
      const migrated = await Vault.openOnline(actor.login, serverKey, actor, password);
      const preserved =
        JSON.stringify(migrated.data.pending) === JSON.stringify(data.pending) &&
        migrated.read('/synthetic').data.synthetic;
      const stored = JSON.parse(localStorage.getItem(slot)!);
      migrated.close();
      const online = await Vault.openOnline(actor.login, serverKey, actor);
      online.close();
      const offline = await Vault.open(actor.login, password);
      offline.close();
      results.push({
        from: version,
        wrongRefused,
        unchanged,
        preserved,
        to: stored.version,
        pinWrapper: !!stored.code,
        onlineAndOfflineReopen: true,
      });
    }
    return results;
  });
  for (const check of checks) {
    expect(check.wrongRefused).toBe(true);
    expect(check.unchanged).toBe(true);
    expect(check.preserved).toBe(true);
    expect(check.to).toBe(3);
    expect(check.pinWrapper).toBe(false);
    expect(check.onlineAndOfflineReopen).toBe(true);
  }
  await writeFile(`${out}/vault-migration.json`, JSON.stringify(checks, null, 2) + '\n');
});
