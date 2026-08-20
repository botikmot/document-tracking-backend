import { Injectable, UnauthorizedException } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { PassportStrategy } from '@nestjs/passport';

import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class ClientJwtStrategy extends PassportStrategy(
  Strategy,
  'client-jwt',
) {
  constructor(private readonly configService: ConfigService) {
    const secret = configService.get<string>('CLIENT_JWT_SECRET');

    if (!secret) {
      throw new Error('CLIENT_JWT_SECRET is not configured.');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      ignoreExpiration: false,

      secretOrKey: secret,
    });
  }

  validate(payload: { sub: string; email: string; accountType: string }) {
    if (payload.accountType !== 'CLIENT') {
      throw new UnauthorizedException('Invalid client access token.');
    }

    return {
      clientId: payload.sub,
      email: payload.email,
      accountType: payload.accountType,
    };
  }
}
