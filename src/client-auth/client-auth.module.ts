import { Module } from '@nestjs/common';

import { ConfigModule, ConfigService } from '@nestjs/config';

import { JwtModule } from '@nestjs/jwt';

import { ClientsModule } from '../clients/clients.module';

import { ClientAuthController } from './client-auth.controller';
import { ClientAuthService } from './client-auth.service';

import { ClientJwtAuthGuard } from './guards/client-jwt-auth.guard';
import { ClientJwtStrategy } from './strategies/client-jwt.strategy';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    ConfigModule,
    MailModule,
    ClientsModule,

    JwtModule.registerAsync({
      imports: [ConfigModule],

      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('CLIENT_JWT_SECRET'),

        signOptions: {
          expiresIn: '7d',
        },
      }),
    }),
  ],

  controllers: [ClientAuthController],

  providers: [ClientAuthService, ClientJwtStrategy, ClientJwtAuthGuard],

  exports: [ClientAuthService, ClientJwtAuthGuard],
})
export class ClientAuthModule {}
