import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';

import { ClientAuthService } from './client-auth.service';

import { LoginClientDto } from './dto/login-client.dto';
import { RegisterClientDto } from './dto/register-client.dto';
import { ResendClientVerificationDto } from './dto/resend-client-verification.dto';
import { VerifyClientEmailDto } from './dto/verify-client-email.dto';

import { ClientJwtAuthGuard } from './guards/client-jwt-auth.guard';

@Controller('client-auth')
export class ClientAuthController {
  constructor(private readonly clientAuthService: ClientAuthService) {}

  @Post('register')
  register(
    @Body()
    dto: RegisterClientDto,
  ) {
    return this.clientAuthService.register(dto);
  }

  @Post('login')
  login(
    @Body()
    dto: LoginClientDto,
  ) {
    return this.clientAuthService.login(dto);
  }

  @UseGuards(ClientJwtAuthGuard)
  @Get('me')
  getProfile(
    @Req()
    req: {
      user: {
        clientId: string;
      };
    },
  ) {
    return this.clientAuthService.getProfile(req.user.clientId);
  }

  @Post('verify-email')
  verifyEmail(
    @Body()
    dto: VerifyClientEmailDto,
  ) {
    return this.clientAuthService.verifyEmail(dto);
  }

  @Post('resend-verification')
  resendVerification(
    @Body()
    dto: ResendClientVerificationDto,
  ) {
    return this.clientAuthService.resendVerification(dto);
  }
}
