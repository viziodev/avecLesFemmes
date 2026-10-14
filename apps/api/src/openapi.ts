import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AppModule } from './app.module';
import { configure, openapi } from './bootstrap';
async function generate() {
  const app = await NestFactory.create(AppModule, { logger: false });
  configure(app);
  await writeFile(resolve('../../docs/openapi.json'), JSON.stringify(openapi(app), null, 2) + '\n');
  await app.close();
}
generate().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
