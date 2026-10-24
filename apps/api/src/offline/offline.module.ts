import {
  BadRequestException,
  Body,
  Controller,
  Module,
  Post,
  Req,
  ValidationPipe,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { AuthModule, AuthService, Public, type AuthRequest } from '../auth/auth.module';
import { ContributionsModule, ContributionsService } from '../contributions/contributions.module';
import { ContributionDto, ContributionView, SelfContributionDto } from '../common/dto';
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const payment = new RegExp(
  `^/api/v1/groupements/(${uuid})/campaigns/(${uuid})/contributions(/self)?$`,
  'i',
);
export class OfflineReplayDto {
  @ApiProperty() @IsString() @MaxLength(100) login!: string;
  @ApiProperty() @IsString() @MaxLength(250) @Matches(payment) path!: string;
  @ApiProperty({
    description: 'JSON exact de la saisie confirmée hors ligne ; date et référence requises.',
  })
  @IsString()
  @MaxLength(4096)
  payload!: string;
  @ApiProperty() @IsString() @Matches(/^[a-f0-9]{64}$/) signature!: string;
}
@ApiTags('Synchronisation hors ligne')
@Controller('auth')
class OfflineReplayController {
  constructor(
    private readonly auth: AuthService,
    private readonly contributions: ContributionsService,
  ) {}
  // Session expiry does not cancel a previously signed, narrowly scoped payment.
  // Device cookie + payload signature are BOTH mandatory; this is not a generic write bypass.
  @Public()
  @Post('offline-replay')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @ApiOperation({ operationId: 'replayOfflineContribution' })
  @ApiCreatedResponse({ type: ContributionView })
  async replay(@Body() input: OfflineReplayDto, @Req() req: AuthRequest) {
    const actor = await this.auth.authorizeOfflineReplay(input, req.cookies?.alf_device);
    const route = input.path.match(payment)!;
    let body: any;
    try {
      body = JSON.parse(input.payload);
    } catch {
      throw new BadRequestException('Saisie hors ligne invalide.');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new BadRequestException('Saisie hors ligne invalide.');
    const self = !!route[3];
    const validated = await new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }).transform(body, { type: 'body', metatype: self ? SelfContributionDto : ContributionDto });
    if (!validated.paidOn)
      throw new BadRequestException('La date de la saisie originale est obligatoire.');
    return this.contributions.record(
      actor,
      route[1],
      route[2],
      self ? { ...validated, participationId: '' } : validated,
      self,
    );
  }
}
@Module({ imports: [AuthModule, ContributionsModule], controllers: [OfflineReplayController] })
export class OfflineModule {}
