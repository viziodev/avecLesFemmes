import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
config({ path: resolve(process.cwd(), '.env'), quiet: true });
export const settings = {
  production: process.env.NODE_ENV === 'production',
  databaseUrl: process.env.DATABASE_URL || '',
  origins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5174').split(
    ',',
  ),
  port: Number(process.env.PORT || 3000),
  smsMode: process.env.SMS_MODE || 'disabled',
};
