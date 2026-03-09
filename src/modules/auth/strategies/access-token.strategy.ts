import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { env } from '../../../config/env';

type JwtPayload = {
  sub: string;
  tenantId: string;
  tenantSlug: string;
  role: string;
};

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: env.JWT_ACCESS_SECRET, // ✅ must be correct and non-empty
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload) {
    return payload; // becomes req.user
  }
}
