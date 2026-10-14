import {
  Catch,
  ArgumentsHost,
  ExceptionFilter,
  HttpException,
  Module,
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Database, DatabaseModule } from './database/database.module';
import { AuthModule, Public } from './auth/auth.module';
import { GroupementsModule } from './groupements/groupements.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { ContributionsModule } from './contributions/contributions.module';
import { PRODUCT_VERSION } from './version';
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (error instanceof HttpException) {
      const body = error.getResponse();
      res.status(error.getStatus()).json(typeof body === 'string' ? { message: body } : body);
      return;
    }
    const code = (error as { code?: string }).code;
    if (code === '23505') {
      res.status(409).json({
        message: 'Une donnée identique existe déjà (identifiant, téléphone ou référence).',
      });
      return;
    }
    if (code === '23503' || code === '23514' || code === '22007' || code === '22008') {
      res.status(400).json({ message: 'Données incompatibles avec les règles de gestion.' });
      return;
    }
    if (code === '42501') {
      res.status(403).json({ message: 'Action non autorisée.' });
      return;
    }
    console.error('API_ERROR', code || 'unexpected');
    res.status(500).json({ message: 'Le service est temporairement indisponible.' });
  }
}
@ApiTags('Exploitation')
@Controller('health')
class HealthController {
  constructor(private readonly db: Database) {}
  @Public() @Get('live') @ApiOperation({ operationId: 'liveness' }) live() {
    return { status: 'ok', version: PRODUCT_VERSION };
  }
  @Public() @Get('ready') @ApiOperation({ operationId: 'readiness' }) async ready() {
    try {
      await this.db.query('SELECT 1');
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException();
    }
  }
}
@Module({
  imports: [
    DatabaseModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    AuthModule,
    GroupementsModule,
    CampaignsModule,
    ContributionsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
