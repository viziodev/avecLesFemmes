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
  ForbiddenException,
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
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { Actor, Database } from '../database/database.module';
import { settings } from '../config';
import {
  digest,
  demoPin,
  hashPassword,
  verifyPassword,
  offlineSigningKey,
  offlineSignature,
} from './password';
import { ActorView, PinLoginDto } from '../common/dto';
export const Public = () => SetMetadata('public', true);
export type AuthRequest = Request & { actor: Actor };
export class LoginDto {
  @ApiProperty() @IsString() @MaxLength(100) login!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(128) password!: string;
}
export class CodeLoginDto {
  @ApiProperty() @IsString() @MaxLength(100) login!: string;
  @ApiProperty() @IsString() @Matches(/^\d{4}$/) code!: string;
}
export class VaultPasswordDto {
  @ApiProperty() @IsString() @MinLength(12) @MaxLength(128) password!: string;
}
export class SetSecretCodeDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(128) password!: string;
  @ApiProperty() @IsString() @Matches(/^\d{4}$/) code!: string;
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
    return this.session(await this.initialAccount(input));
  }
  async authorizeDeviceAdministration(input: LoginDto) {
    const user = await this.initialAccount(input);
    if (!user.is_super) throw new ForbiddenException('Opération réservée au Super Admin.');
  }
  private async initialAccount(input: LoginDto) {
    if (input.password.length < 12)
      throw new UnauthorizedException(
        'Un mot de passe initial d’au moins douze caractères est requis. Contactez le Super Admin pour la récupération d’un ancien accès court.',
      );
    const r = await this.db.query('SELECT * FROM app_users WHERE login=$1 AND active', [
      input.login,
    ]);
    const u = r.rows[0];
    return this.checkPassword(u, input.password);
  }
  private async checkPassword(
    candidate: any,
    password: string,
    kind: 'password_hash' | 'secret_code_hash' = 'password_hash',
  ) {
    if (!candidate) {
      verifyPassword(password, this.dummy);
      throw new UnauthorizedException('Identifiants incorrects.');
    }
    // Serialize every credential attempt for this account, across all endpoints.
    // Return the failure before throwing: throwing inside run would roll back the counter.
    const outcome = await this.db.run(
      { id: candidate.id, login: '', name: '', isSuper: false },
      async (c) => {
        const row = await c.query('SELECT * FROM app_users WHERE id=$1 AND active FOR UPDATE', [
          candidate.id,
        ]);
        const u = row.rows[0];
        if (!u) return { error: 'Identifiants incorrects.' };
        if (u.locked_until && new Date(u.locked_until).getTime() > Date.now())
          return { error: 'Trop de tentatives. Réessayez dans quinze minutes.' };
        if (!verifyPassword(password, u[kind] || this.dummy) || !u[kind]) {
          await c.query(
            `UPDATE app_users SET
            failed_attempts=CASE WHEN locked_until IS NOT NULL THEN 1 ELSE least(failed_attempts+1,5) END,
            locked_until=CASE WHEN locked_until IS NULL AND failed_attempts>=4
              THEN now()+interval '15 minutes' ELSE NULL END WHERE id=$1`,
            [u.id],
          );
          return { error: 'Identifiants incorrects.' };
        }
        await c.query('UPDATE app_users SET failed_attempts=0,locked_until=NULL WHERE id=$1', [
          u.id,
        ]);
        return { user: u };
      },
    );
    if (outcome.error) throw new UnauthorizedException(outcome.error);
    return outcome.user;
  }
  async trustedDevice(login: string, token?: string) {
    if (!token || !/^[a-f0-9]{64}$/.test(token))
      throw new ForbiddenException(
        'Appareil non autorisé. Contactez le Super Admin pour rétablir votre accès.',
      );
    const r = await this.db.query(
      `SELECT d.* FROM trusted_devices d JOIN app_users u ON u.id=d.user_id
      WHERE d.token_hash=$1 AND u.login=$2 AND u.active AND NOT u.is_super AND d.expires_at>now()`,
      [digest(token), login],
    );
    if (!r.rows[0])
      throw new ForbiddenException(
        'Appareil non autorisé. Contactez le Super Admin pour rétablir votre accès.',
      );
    return r.rows[0];
  }
  async authorizeOfflineReplay(
    input: { login: string; path: string; payload: string; signature: string },
    token?: string,
  ): Promise<Actor> {
    const device = await this.trustedDevice(input.login, token);
    const expected = offlineSignature(
      offlineSigningKey(device.vault_secret),
      input.login,
      input.path,
      input.payload,
    );
    if (
      !/^[a-f0-9]{64}$/.test(input.signature) ||
      !timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(input.signature, 'hex'))
    )
      throw new ForbiddenException(
        'Autorisation de cette saisie invalide. Confirmez-la manuellement.',
      );
    const r = await this.db.query(
      `SELECT id,login,name,is_super,secret_code_hash IS NOT NULL AS has_secret_code
      FROM app_users WHERE id=$1 AND active AND NOT is_super AND (locked_until IS NULL OR locked_until<=now())`,
      [device.user_id],
    );
    const u = r.rows[0];
    if (!u) throw new ForbiddenException('Compte indisponible ou temporairement bloqué.');
    return {
      id: u.id,
      login: u.login,
      name: u.name,
      isSuper: false,
      hasSecretCode: u.has_secret_code,
    };
  }
  async enroll(actor: Actor, token?: string) {
    if (actor.isSuper) return null;
    if (token && /^[a-f0-9]{64}$/.test(token)) {
      const r = await this.db.query(
        'SELECT * FROM trusted_devices WHERE token_hash=$1 AND user_id=$2 AND expires_at>now()',
        [digest(token), actor.id],
      );
      if (r.rows[0]) return { token, vaultSecret: r.rows[0].vault_secret };
    }
    const next = randomBytes(32).toString('hex');
    const vaultSecret = randomBytes(32).toString('hex');
    await this.db.query(
      `INSERT INTO trusted_devices(token_hash,user_id,vault_secret,expires_at)
      VALUES($1,$2,$3,now()+interval '30 days')`,
      [digest(next), actor.id, vaultSecret],
    );
    return { token: next, vaultSecret };
  }
  async forgetDevice(token?: string) {
    if (token)
      await this.db.query('DELETE FROM trusted_devices WHERE token_hash=$1', [digest(token)]);
  }
  async loginCode(input: CodeLoginDto, token?: string) {
    const device = await this.trustedDevice(input.login, token);
    const r = await this.db.query('SELECT * FROM app_users WHERE id=$1 AND active', [
      device.user_id,
    ]);
    const u = await this.checkPassword(r.rows[0], input.code, 'secret_code_hash');
    // Recheck after the account lock: reset or expiry must not revive a revoked device.
    await this.trustedDevice(input.login, token);
    return { ...(await this.session(u)), vaultSecret: device.vault_secret };
  }
  async setCode(actor: Actor, input: SetSecretCodeDto) {
    if (actor.isSuper) throw new ForbiddenException('Code secret réservé aux espaces PWA.');
    const r = await this.db.query('SELECT * FROM app_users WHERE id=$1 AND active', [actor.id]);
    const u = r.rows[0];
    await this.checkPassword(u, input.password);
    const hash = hashPassword(input.code);
    await this.db.run(actor, async (c) => {
      const updated = await c.query(
        'UPDATE app_users SET secret_code_hash=$1,failed_attempts=0,locked_until=NULL WHERE id=$2 AND password_hash=$3 AND active RETURNING id',
        [hash, actor.id, u.password_hash],
      );
      if (!updated.rows.length)
        throw new UnauthorizedException('Le compte a changé. Reconnectez-vous.');
      await c.query('DELETE FROM sessions WHERE user_id=$1', [actor.id]);
      await c.query('DELETE FROM trusted_devices WHERE user_id=$1', [actor.id]);
    });
    return this.session({ ...u, secret_code_hash: hash });
  }
  async confirmCode(actor: Actor, code: string) {
    if (!/^\d{4}$/.test(code))
      throw new ForbiddenException('Code secret à quatre chiffres requis.');
    const r = await this.db.query('SELECT * FROM app_users WHERE id=$1 AND active', [actor.id]);
    try {
      await this.checkPassword(r.rows[0], code, 'secret_code_hash');
    } catch {
      throw new ForbiddenException('Code secret incorrect ou compte temporairement bloqué.');
    }
  }
  async confirm(actor: Actor, password?: string) {
    if (!password)
      throw new ForbiddenException('Confirmez cette opération avec votre mot de passe.');
    if (password.startsWith('utf8:'))
      password = Buffer.from(password.slice(5), 'base64').toString('utf8');
    if (password.length > 128) throw new ForbiddenException('Confirmation invalide.');
    const r = await this.db.query('SELECT * FROM app_users WHERE id=$1 AND active', [actor.id]);
    try {
      await this.checkPassword(r.rows[0], password);
    } catch {
      throw new ForbiddenException('Mot de passe incorrect ou compte temporairement bloqué.');
    }
  }
  async activity(token: string) {
    await this.db.query('UPDATE sessions SET last_activity_at=now() WHERE token_hash=$1', [
      digest(token),
    ]);
    return { ok: true };
  }
  async loginPin(input: PinLoginDto, token?: string) {
    const r = await this.db.query('SELECT login FROM app_users WHERE phone=$1 AND active', [
      input.phone,
    ]);
    if (!r.rows[0])
      throw new ForbiddenException('Reconnectez cet appareil avec votre mot de passe initial.');
    return this.loginCode({ login: r.rows[0].login, code: input.pin }, token);
  }
  async loginPhonePin(input: PinLoginDto) {
    const r = await this.db.query(
      'SELECT * FROM app_users WHERE phone=$1 AND active AND NOT is_super',
      [input.phone],
    );
    const checked = await this.checkPassword(r.rows[0], input.pin, 'secret_code_hash');
    return this.session(checked);
  }
  async session(u: any) {
    const token = randomBytes(32).toString('hex');
    const inserted = await this.db.query(
      `INSERT INTO sessions(token_hash,user_id,expires_at)
       SELECT $1,id,now()+interval '8 hours' FROM app_users WHERE id=$2 AND active
       AND password_hash=$3 AND secret_code_hash IS NOT DISTINCT FROM $4
       AND (locked_until IS NULL OR locked_until<=now()) RETURNING user_id`,
      [digest(token), u.id, u.password_hash, u.secret_code_hash || null],
    );
    if (!inserted.rows.length)
      throw new UnauthorizedException('Le compte a changé. Reconnectez-vous.');
    return {
      token,
      actor: {
        id: u.id,
        login: u.login,
        name: u.name,
        isSuper: u.is_super,
        hasSecretCode: !!u.secret_code_hash,
        phone: u.phone || null,
      },
    };
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
      `SELECT u.id,u.login,u.name,u.phone,u.is_super,u.secret_code_hash IS NOT NULL AS has_secret_code FROM sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active AND (u.is_super OR s.last_activity_at>now()-interval '5 minutes')`,
      [digest(token)],
    );
    const u = r.rows[0];
    if (!u) throw new UnauthorizedException();
    return {
      id: u.id,
      login: u.login,
      name: u.name,
      isSuper: u.is_super,
      hasSecretCode: u.has_secret_code,
      phone: u.phone || null,
    };
  }
  async logout(token?: string, expectedUserId?: string) {
    if (token)
      await this.db.query(
        'DELETE FROM sessions WHERE token_hash=$1 AND ($2::text IS NULL OR user_id::text=$2)',
        [digest(token), expectedUserId || null],
      );
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
    if (req.get('X-PWA-Actor') && req.get('X-PWA-Actor') !== req.actor.id)
      throw new UnauthorizedException(
        'Le compte a changé dans un autre espace. Saisissez à nouveau votre mot de passe.',
      );
    if (
      !req.actor.isSuper &&
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      !req.path.startsWith('/api/v1/auth/') &&
      !req.path.endsWith('/shortcuts') &&
      !req.path.endsWith('/resolve-member-qr')
    )
      if (req.get('X-Confirm-Secret-Code'))
        await this.auth.confirmCode(req.actor, req.get('X-Confirm-Secret-Code')!);
      else await this.auth.confirm(req.actor, req.get('X-Confirm-Password'));
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
  private async device(res: Response, actor: Actor, token?: string) {
    const device = await this.auth.enroll(actor, token);
    if (!device) return;
    res.cookie('alf_device', device.token, {
      httpOnly: true,
      secure: settings.production,
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    // Used only in memory to unwrap the local vault after online authentication.
    res.setHeader('X-ALF-Vault-Key', device.vaultSecret);
    res.setHeader('X-ALF-Sync-Key', offlineSigningKey(device.vaultSecret));
  }
  @Public()
  @Post('login')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ operationId: 'login' })
  @ApiCreatedResponse({ type: ActorView })
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: AuthRequest,
  ) {
    const s = await this.auth.login(input);
    await this.auth.logout(req.cookies?.alf_session);
    this.cookie(res, s.token);
    await this.device(res, s.actor, req.cookies?.alf_device);
    return s.actor;
  }
  @Public()
  @Post('login/secret-code')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ operationId: 'loginSecretCode' })
  @ApiCreatedResponse({ type: ActorView })
  async loginCode(
    @Body() input: CodeLoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: AuthRequest,
  ) {
    const s = await this.auth.loginCode(input, req.cookies?.alf_device);
    res.setHeader('X-ALF-Vault-Key', s.vaultSecret);
    res.setHeader('X-ALF-Sync-Key', offlineSigningKey(s.vaultSecret));
    await this.auth.logout(req.cookies?.alf_session);
    this.cookie(res, s.token);
    return s.actor;
  }
  @Post('secret-code')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ operationId: 'setSecretCode' })
  @ApiCreatedResponse({ type: ActorView })
  async setCode(
    @Body() input: SetSecretCodeDto,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const s = await this.auth.setCode(req.actor, input);
    this.cookie(res, s.token);
    await this.device(res, s.actor);
    return s.actor;
  }
  @Public()
  @Post('login/pin')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ operationId: 'loginPin' })
  @ApiCreatedResponse({ type: ActorView })
  async loginPin(
    @Body() input: PinLoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: AuthRequest,
  ) {
    const s = await this.auth.loginPin(input, req.cookies?.alf_device);
    await this.auth.logout(req.cookies?.alf_session);
    res.setHeader('X-ALF-Vault-Key', s.vaultSecret);
    res.setHeader('X-ALF-Sync-Key', offlineSigningKey(s.vaultSecret));
    this.cookie(res, s.token);
    return s.actor;
  }
  @Public()
  @Post('login/phone-pin')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    operationId: 'loginPhonePin',
    summary: 'PWA : téléphone puis PIN personnel existant',
  })
  @ApiCreatedResponse({ type: ActorView })
  async loginPhonePin(
    @Body() input: PinLoginDto,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const s = await this.auth.loginPhonePin(input);
    await this.auth.logout(req.cookies?.alf_session);
    this.cookie(res, s.token);
    await this.device(res, s.actor, req.cookies?.alf_device);
    return s.actor;
  }
  @Post('vault/password')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ operationId: 'prepareOfflineVault' })
  async prepareOfflineVault(
    @Body() input: VaultPasswordDto,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (req.actor.isSuper) throw new ForbiddenException('Coffre réservé aux espaces PWA.');
    const device = await this.auth.trustedDevice(req.actor.login, req.cookies?.alf_device);
    await this.auth.confirm(req.actor, input.password);
    res.setHeader('X-ALF-Vault-Key', device.vault_secret);
    res.setHeader('X-ALF-Sync-Key', offlineSigningKey(device.vault_secret));
    return { ok: true };
  }
  @Public()
  @Post('otp/request')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ operationId: 'requestOtp' })
  @ApiCreatedResponse({ type: OtpRequestView })
  requestOtp(@Body() input: PhoneDto) {
    return this.auth.requestOtp(input);
  }
  @Public()
  @Post('otp/verify')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
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
  @Post('activity')
  @ApiOperation({ operationId: 'sessionActivity' })
  activity(@Req() req: AuthRequest) {
    return this.auth.activity(req.cookies.alf_session);
  }
  @Public()
  @Post('lock')
  @ApiOperation({ operationId: 'lockSession' })
  async lock(@Req() req: AuthRequest) {
    await this.auth.logout(req.cookies?.alf_session, req.get('X-PWA-Actor'));
    return { ok: true };
  }
  @Public()
  @Post('forget-device')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ operationId: 'forgetDevice', summary: 'Super Admin : oublier cet appareil PWA' })
  async forgetDevice(
    @Body() input: LoginDto,
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Credentials authorize only this action, without opening an admin session on a member's device.
    await this.auth.authorizeDeviceAdministration(input);
    await this.auth.forgetDevice(req.cookies?.alf_device);
    await this.auth.logout(req.cookies?.alf_session);
    res.clearCookie('alf_device', {
      path: '/api/v1/auth',
      httpOnly: true,
      secure: settings.production,
      sameSite: 'strict',
    });
    res.clearCookie('alf_session', {
      path: '/api/v1',
      httpOnly: true,
      secure: settings.production,
      sameSite: 'lax',
    });
    return { ok: true };
  }
  @Public()
  @Post('logout')
  @ApiOperation({ operationId: 'logout' })
  async logout(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.alf_session);
    res.clearCookie('alf_session', {
      path: '/api/v1',
      httpOnly: true,
      secure: settings.production,
      sameSite: 'lax',
    });
    return { ok: true };
  }
  @Public()
  @Get('demo')
  @ApiOperation({ operationId: 'demoCredentials' })
  demoCredentials() {
    if (settings.production || !process.env.DEMO_PASSWORD) {
      return { demoPassword: null, isDemo: false };
    }
    return {
      demoPassword: process.env.DEMO_PASSWORD,
      demoPin: demoPin(process.env.DEMO_PASSWORD),
      smsMode: process.env.SMS_MODE || 'development',
      isDemo: true,
    };
  }
}
@Module({
  controllers: [AuthController],
  providers: [AuthService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [AuthService],
})
export class AuthModule {}
