import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configure, openapi } from './bootstrap';
import { Database } from './database/database.module';
import { settings } from './config';
async function main() {
  if (!settings.databaseUrl) throw new Error('DATABASE_URL obligatoire.');
  if (
    settings.smsMode !== 'disabled' &&
    (!process.env.OTP_SECRET || process.env.OTP_SECRET.length < 32)
  )
    throw new Error('OTP_SECRET doit contenir au moins 32 caractères.');
  if (settings.production && settings.smsMode === 'development')
    throw new Error('Le mode SMS development est interdit en production.');
  if (
    settings.smsMode === 'webhook' &&
    (!process.env.SMS_WEBHOOK_URL?.startsWith('https://') || !process.env.SMS_WEBHOOK_TOKEN)
  )
    throw new Error('Configurer un webhook SMS HTTPS et son jeton.');
  const app = await NestFactory.create(AppModule);
  configure(app);
  app.enableShutdownHooks();
  await app.get(Database).assertRuntimeRole();
  if (!settings.production) SwaggerModule.setup('api/docs', app, openapi(app));
  await app.listen(settings.port, '0.0.0.0');
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
