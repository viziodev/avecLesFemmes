import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { deflateSync } from 'node:zlib';
import { request as httpRequest } from 'node:http';
import { fileURLToPath } from 'node:url';

// Processus isolé : une régression de décompression ne doit pas tuer le runner.
// Scénario fondé sur le correctif upstream GHSA-27r3-jxmh-p828 : les derniers
// octets doivent arriver après la fin du décodeur, et non dans un seul paquet.
if (process.argv.includes('--serve')) {
  const { createServer } = await import('node:http');
  const { default: parser } = await import('body-parser');
  const json = parser.json();
  createServer((request, response) => {
    json(request, response, (error) => {
      if (error) {
        response.writeHead(400);
        response.end();
        return;
      }
      if (request.method === 'POST') {
        process.stdout.write('parsed\n');
        request.on('end', () => response.end('ok'));
      } else response.end('ok');
    });
  }).listen(0, '127.0.0.1', function () {
    console.log(this.address().port);
  });
} else {
  test(
    'décompression : octets tardifs après une trame valide, requête terminée et serveur disponible',
    { timeout: 10000 },
    async () => {
      const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--serve'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stderr = '';
      child.stderr.on('data', (data) => (stderr += data));
      try {
        const [chunk] = await once(child.stdout, 'data');
        const origin = `http://127.0.0.1:${Number(String(chunk).trim())}`;
        const first = Buffer.concat([deflateSync('{"value":1}'), Buffer.from([0])]);
        const trailing = Buffer.alloc(1024, 255);
        const completed = new Promise((resolve, reject) => {
          const request = httpRequest(
            origin,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Encoding': 'deflate',
                'Content-Length': first.length + trailing.length,
              },
            },
            (response) => {
              response.resume();
              response.on('end', () => resolve(response.statusCode));
              response.on('error', reject);
            },
          );
          request.on('error', reject);
          request.setTimeout(3000, () =>
            request.destroy(new Error('La requête comprimée ne se termine pas.')),
          );
          child.stdout.once('data', (data) => {
            assert.equal(String(data).trim(), 'parsed');
            request.end(trailing);
          });
          request.write(first);
        });
        assert.equal(await completed, 200, stderr);
        const health = await fetch(origin + '/health');
        assert.equal(health.status, 200);
        await health.text();
        assert.equal(child.exitCode, null, stderr);
        assert.equal(stderr, '');
      } finally {
        child.kill();
        if (child.exitCode === null && child.signalCode === null) await once(child, 'exit');
      }
    },
  );
}
