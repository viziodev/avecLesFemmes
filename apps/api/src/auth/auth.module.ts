import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Module,
  Post,
  Req,
  Res,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { SetMetadata } from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiProperty,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { randomBytes, randomInt } from 'node:crypto';
import type { Request, Response } from 'express';
import { Actor, Database } from '../database/database.module';
import { settings } from '../config';
import { digest, hashPassword, verifyPassword } from './password';
import { ActorView } from '../common/dto';
export const Public = () => SetMetadata('public', true);
export type AuthRequest = Request & { actor: Actor };
export class LoginDto {
  @ApiProperty() @IsString() @MaxLength(100) login!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(128) password!: string;
}
export class PhoneDto {
  @ApiProperty() @IsString() @Matches(/^\+[1-9]\d{7,14}$/) phone!: string;
}
export class OtpDto extends PhoneDto {
  @ApiProperty() @IsString() @Matches(/^\d{6}$/) code!: string;
}
class OtpRequestView {
  @ApiProperty() message!: string;
  @ApiPropertyOptional() developmentCode?: string;
}
@Injectable()
export class AuthService {
  private readonly dummy = hashPassword(randomBytes(20).toString('hex'));
  constructor(private readonly db: Database) {}
  async login(input: LoginDto) {
    const r = await this.db.query('SELECT * FROM app_users WHERE login=$1 AND active', [
      input.login,
    ]);
    const u = r.rows[0];
    const matches = verifyPassword(input.password, u?.password_hash || this.dummy);
    if (!u || !u.password_hash || !matches)
      throw new UnauthorizedException('Identifiants incorrects.');
    return this.session(u);
  }
  async session(u: any) {
    const token = randomBytes(32).toString('hex');
    await this.db.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",
      [digest(token), u.id],
    );
    return { token, actor: { id: u.id, login: u.login, name: u.name, isSuper: u.is_super } };
  }
  async requestOtp(input: PhoneDto) {
    if (settings.smsMode === 'disabled')
      throw new BadRequestException('La connexion SMS n’est pas encore configurée.');
    const u = await this.db.query('SELECT id FROM app_users WHERE phone=$1 AND active', [
      input.phone,
    ]);
    const code = String(randomInt(100000, 1000000));
    if (!u.rows.length)
      return { message: 'Si ce numéro correspond à un compte actif, un code est envoyé.' };
    const r = await this.db.query(
      "INSERT INTO otp_challenges(phone,code_hash,expires_at) VALUES($1,$2,now()+interval '5 minutes') ON CONFLICT(phone) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0,sent_at=now() WHERE otp_challenges.sent_at<now()-interval '60 seconds' RETURNING phone",
      [input.phone, digest(`${input.phone}:${code}:${process.env.OTP_SECRET}`)],
    );
    if (!r.rows.length)
      return { message: 'Patientez une minute avant de demander un nouveau code.' };
    if (settings.smsMode === 'development' && !settings.production)
      return { message: 'Mode local : aucun SMS réel envoyé.', developmentCode: code };
    try {
      const response = await fetch(process.env.SMS_WEBHOOK_URL!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.SMS_WEBHOOK_TOKEN}`,
        },
        body: JSON.stringify({
          to: input.phone,
          text: `AvecLesFemmes : votre code est ${code}. Valable 5 minutes.`,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('SMS');
    } catch {
      await this.db.query('DELETE FROM otp_challenges WHERE phone=$1 AND code_hash=$2', [
        input.phone,
        digest(`${input.phone}:${code}:${process.env.OTP_SECRET}`),
      ]);
      throw new BadRequestException('Envoi indisponible. Réessayez plus tard.');
    }
    return { message: 'Si ce numéro correspond à un compte actif, un code est envoyé.' };
  }
  async verifyOtp(input: OtpDto) {
    if (settings.smsMode === 'disabled')
      throw new UnauthorizedException('Connexion SMS indisponible.');
    // Une seule instruction atomique consomme le code ou compte l’échec, y compris sous concurrence.
    const hash = digest(`${input.phone}:${input.code}:${process.env.OTP_SECRET}`);
    const r = await this.db.query(
      'UPDATE otp_challenges SET attempts=attempts+1,expires_at=CASE WHEN code_hash=$2 THEN now() ELSE expires_at END WHERE phone=$1 AND expires_at>now() AND attempts<5 RETURNING code_hash',
      [input.phone, hash],
    );
    if (!r.rows[0] || r.rows[0].code_hash !== hash)
      throw new UnauthorizedException('Code invalide ou expiré.');
    const u = await this.db.query('SELECT * FROM app_users WHERE phone=$1 AND active', [
      input.phone,
    ]);
    if (!u.rows[0]) throw new UnauthorizedException('Compte indisponible.');
    return this.session(u.rows[0]);
  }
  async actor(token?: string): Promise<Actor> {
    if (!token) throw new UnauthorizedException();
    const r = await this.db.query(
      'SELECT u.id,u.login,u.name,u.is_super FROM sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active',
      [digest(token)],
    );
    const u = r.rows[0];
    if (!u) throw new UnauthorizedException();
    return { id: u.id, login: u.login, name: u.name, isSuper: u.is_super };
  }
  async logout(token?: string) {
    if (token) await this.db.query('DELETE FROM sessions WHERE token_hash=$1', [digest(token)]);
  }
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    if (this.reflector.getAllAndOverride('public', [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    req.actor = await this.auth.actor(req.cookies?.alf_session);
    return true;
  }
}
@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  private cookie(res: Response, token: string) {
    res.cookie('alf_session', token, {
      httpOnly: true,
      secure: settings.production,
      sameSite: 'lax',
      path: '/api/v1',
      maxAge: 8 * 60 * 60 * 1000,
    });
  }
  @Public()
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ operationId: 'login' })
  @ApiCreatedResponse({ type: ActorView })
  async login(@Body() input: LoginDto, @Res({ passthrough: true }) res: Response) {
    const s = await this.auth.login(input);
    this.cookie(res, s.token);
    return s.actor;
  }
  @Public()
  @Post('otp/request')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ operationId: 'requestOtp' })
  @ApiCreatedResponse({ type: OtpRequestView })
  requestOtp(@Body() input: PhoneDto) {
    return this.auth.requestOtp(input);
  }
  @Public()
  @Post('otp/verify')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ operationId: 'verifyOtp' })
  @ApiCreatedResponse({ type: ActorView })
  async verifyOtp(@Body() input: OtpDto, @Res({ passthrough: true }) res: Response) {
    const s = await this.auth.verifyOtp(input);
    this.cookie(res, s.token);
    return s.actor;
  }
  @Get('me') @ApiOperation({ operationId: 'currentUser' }) @ApiOkResponse({ type: ActorView }) me(
    @Req() req: AuthRequest,
  ) {
    return req.actor;
  }
  @Post('logout') @ApiOperation({ operationId: 'logout' }) async logout(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(req.cookies?.alf_session);
    res.clearCookie('alf_session', {
      path: '/api/v1',
      httpOnly: true,
      secure: settings.production,
      sameSite: 'lax',
    });
    return { ok: true };
  }
}
@Module({
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [AuthService],
})
export class AuthModule {}
