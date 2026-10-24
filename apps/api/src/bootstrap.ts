import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { settings } from './config';
import { ApiExceptionFilter } from './app.module';
import { API_VERSION } from './version';
export function configure(app: INestApplication) {
  // Only the closest private/loopback reverse proxy is trusted by default.
  // Public direct clients cannot choose req.ip by supplying X-Forwarded-For.
  const proxyaddr = require('proxy-addr') as {
    compile: (ranges: string[]) => (address: string) => boolean;
  };
  const trusted = proxyaddr.compile(
    (process.env.TRUSTED_PROXY_CIDRS || 'loopback,uniquelocal').split(',').filter(Boolean),
  );
  app
    .getHttpAdapter()
    .getInstance()
    .set('trust proxy', (ip: string, hop: number) => hop === 0 && trusted(ip));
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: settings.origins,
    credentials: true,
    exposedHeaders: ['X-ALF-Vault-Key', 'X-ALF-Sync-Key'],
  });
  app.use((req: any, res: any, next: any) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (
        req.get('X-Requested-With') !== 'AvecLesFemmes' ||
        (req.get('Origin') && !settings.origins.includes(req.get('Origin')))
      )
        return res.status(403).json({ message: 'Origine de la requête non autorisée.' });
    }
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
}
export function openapi(app: INestApplication) {
  return SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('AvecLesFemmes')
      .setDescription('Premier incrément · API version 1')
      .setVersion(API_VERSION)
      .addCookieAuth('alf_session')
      .build(),
  );
}
