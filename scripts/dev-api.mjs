import { spawn } from 'node:child_process';
let server;
const compiler = spawn('tsc', ['--watch', '--preserveWatchOutput'], {
  stdio: ['inherit', 'pipe', 'inherit'],
});
compiler.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  if (chunk.toString().includes('Found 0 errors.')) {
    server?.kill();
    server = spawn(process.execPath, ['dist/main.js'], { stdio: 'inherit' });
  }
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    server?.kill();
    compiler.kill();
    process.exit();
  });
