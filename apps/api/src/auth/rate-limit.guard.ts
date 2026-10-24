import { Inject, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.module';
import { digest } from './password';

@Injectable()
export class AccountThrottlerGuard extends ThrottlerGuard {
  @Inject(AuthService) private readonly auth!: AuthService;
  protected async getTracker(req: Record<string, any>): Promise<string> {
    if (req.cookies?.alf_session) {
      try {
        return `user:${(await this.auth.actor(req.cookies.alf_session)).id}`;
      } catch {
        /* Invalid sessions retain the network quota. */
      }
    }
    if (req.path.startsWith('/api/v1/auth/login') || req.path === '/api/v1/auth/offline-replay') {
      const login = req.body?.login || req.body?.phone;
      if (typeof login === 'string' && login.length <= 100) return `login:${digest(login)}`;
    }
    return req.ip;
  }
}
