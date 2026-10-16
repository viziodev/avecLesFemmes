import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Real browser worker lifecycle, using the production update coordinator.
// The isolated origin avoids replacing the worker of the user's local app.
let server: Server;
let origin: string;
let revision = 1;
let failWorker = false;
let workerRequests = 0;
const source = ts.transpileModule(
  readFileSync('apps/membres-pwa/src/pwa-update.ts', 'utf8')
    .replaceAll('import.meta.env.PROD', 'true')
    .replaceAll('import.meta.env.BASE_URL', "'/'"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } },
).outputText;

test.beforeAll(async () => {
  server = createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.url === '/sw.js') {
      workerRequests++;
      res.setHeader('Content-Type', 'application/javascript');
      if (failWorker) {
        res.writeHead(503);
        res.end();
        return;
      }
      res.end(`// revision ${revision}
        self.addEventListener('activate', e => e.waitUntil(clients.claim()));
        self.addEventListener('message', e => { if(e.data.type === 'SKIP_WAITING') self.skipWaiting(); });`);
    } else if (req.url === '/updates.js') {
      res.setHeader('Content-Type', 'application/javascript');
      res.end(source);
    } else {
      res.setHeader('Content-Type', 'text/html');
      res.end(`<label>Saisie<input id="draft"></label><button id="finish">Terminer</button><output id="boots"></output>
        <script type="module">
          import { startPwaUpdates } from '/updates.js';
          const boots = Number(sessionStorage.getItem('boots') || 0) + 1;
          sessionStorage.setItem('boots', String(boots));
          document.querySelector('#boots').textContent = String(boots);
          const safe = startPwaUpdates(); safe(true);
          document.querySelector('#draft').addEventListener('input', () => safe(false));
          document.querySelector('#finish').addEventListener('click', () => safe(true));
        </script>`);
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
test.beforeEach(() => {
  revision = 1;
  failWorker = false;
  workerRequests = 0;
});

test('PWA : deux versions réelles attendent la fin de saisie avant rechargement', async ({
  page,
}) => {
  await page.goto(origin);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await expect(page.locator('#boots')).toHaveText('1'); // No reload on first installation.
  await page.getByLabel('Saisie').fill('750');
  revision = 2;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect
    .poll(() =>
      page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting),
    )
    .toBe(true);
  await expect(page.getByLabel('Saisie')).toHaveValue('750');
  await expect(page.locator('#boots')).toHaveText('1');
  await page.getByRole('button', { name: 'Terminer' }).click();
  await expect(page.locator('#boots')).toHaveText('2');
  await expect
    .poll(() =>
      page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting),
    )
    .toBe(false);
});

test('PWA : un échec initial du worker est réessayé sans relancer la page', async ({ page }) => {
  failWorker = true;
  await page.goto(origin);
  await expect.poll(() => workerRequests).toBeGreaterThan(0);
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller === null))
    .toBe(true);
  failWorker = false;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await expect(page.locator('#boots')).toHaveText('1');
});

test('PWA : activation dans un autre onglet sans perte du brouillon', async ({ page, context }) => {
  await page.goto(origin);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.getByLabel('Saisie').fill('1250');
  const other = await context.newPage();
  await other.goto(origin);
  await expect(other.locator('#boots')).toHaveText('1');
  revision = 3;
  await other.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(other.locator('#boots')).toHaveText('2');
  await page.bringToFront();
  await expect(page.locator('#boots')).toHaveText('1');
  await expect(page.getByLabel('Saisie')).toHaveValue('1250');
  await page.getByRole('button', { name: 'Terminer' }).click();
  await expect(page.locator('#boots')).toHaveText('2');
});
