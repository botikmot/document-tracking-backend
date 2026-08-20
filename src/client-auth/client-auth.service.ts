import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import * as bcrypt from 'bcrypt';

import { ClientsService } from '../clients/clients.service';
import { MailService } from '../mail/mail.service';
import { createHash, randomBytes } from 'crypto';

import { LoginClientDto } from './dto/login-client.dto';
import { RegisterClientDto } from './dto/register-client.dto';
import { ResendClientVerificationDto } from './dto/resend-client-verification.dto';
import { VerifyClientEmailDto } from './dto/verify-client-email.dto';

@Injectable()
export class ClientAuthService {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  private generateVerificationToken() {
    const rawToken = randomBytes(32).toString('hex');

    const tokenHash = this.hashVerificationToken(rawToken);

    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    return {
      rawToken,
      tokenHash,
      expiry,
    };
  }

  private hashVerificationToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  async register(dto: RegisterClientDto) {
    const email = dto.email.toLowerCase().trim();

    const existingClient = await this.clientsService.findByEmail(email);

    if (existingClient) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const { rawToken, tokenHash, expiry } = this.generateVerificationToken();

    const client = await this.clientsService.create({
      firstName: dto.firstName,
      middleName: dto.middleName,
      lastName: dto.lastName,
      suffix: dto.suffix,

      email,

      mobileNumber: dto.mobileNumber,
      address: dto.address,
      organizationName: dto.organizationName,

      passwordHash,

      emailVerificationToken: tokenHash,
      emailVerificationTokenExpiry: expiry,
    });

    const portalUrl = this.configService.get<string>('CLIENT_PORTAL_URL');

    if (!portalUrl) {
      throw new Error('CLIENT_PORTAL_URL is not configured.');
    }

    const verificationUrl =
      `${portalUrl}/client/verify-email` +
      `?token=${encodeURIComponent(rawToken)}`;

    const verificationEmailSent =
      await this.mailService.sendClientVerificationEmail(
        client.email,
        client.firstName,
        verificationUrl,
      );

    return {
      message: verificationEmailSent
        ? 'Registration successful. Please check your email to verify your account.'
        : 'Registration successful, but the verification email could not be sent. Please request a new verification email.',

      verificationEmailSent,

      email: client.email,
    };
  }

  async login(dto: LoginClientDto) {
    const email = dto.email.toLowerCase().trim();

    const client = await this.clientsService.findByEmail(email);

    if (!client) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      client.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (!client.emailVerifiedAt) {
      throw new UnauthorizedException(
        'Please verify your email address before logging in.',
      );
    }

    if (client.status !== 'ACTIVE') {
      throw new UnauthorizedException('Your account is currently inactive.');
    }

    const accessToken = await this.generateAccessToken({
      id: client.id,
      email: client.email,
    });

    return {
      message: 'Login successful.',
      accessToken,

      client: {
        id: client.id,
        firstName: client.firstName,
        middleName: client.middleName,
        lastName: client.lastName,
        suffix: client.suffix,

        email: client.email,
        mobileNumber: client.mobileNumber,
        address: client.address,
        organizationName: client.organizationName,

        status: client.status,
      },
    };
  }

  async getProfile(clientId: string) {
    const client = await this.clientsService.findById(clientId);

    if (!client) {
      throw new UnauthorizedException('Client account not found.');
    }

    return {
      id: client.id,

      firstName: client.firstName,
      middleName: client.middleName,
      lastName: client.lastName,
      suffix: client.suffix,

      email: client.email,
      mobileNumber: client.mobileNumber,
      address: client.address,
      organizationName: client.organizationName,

      status: client.status,

      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    };
  }

  private async generateAccessToken(client: { id: string; email: string }) {
    return this.jwtService.signAsync({
      sub: client.id,
      email: client.email,

      accountType: 'CLIENT',
    });
  }

  async verifyEmail(dto: VerifyClientEmailDto) {
    const tokenHash = this.hashVerificationToken(dto.token);

    const client = await this.clientsService.findByVerificationToken(tokenHash);

    if (!client) {
      throw new BadRequestException('Invalid verification link.');
    }

    if (
      !client.emailVerificationTokenExpiry ||
      client.emailVerificationTokenExpiry < new Date()
    ) {
      throw new BadRequestException(
        'This verification link has expired. Please request a new verification email.',
      );
    }

    if (client.emailVerifiedAt) {
      return {
        message: 'This email address has already been verified.',
      };
    }

    await this.clientsService.markEmailAsVerified(client.id);

    return {
      message:
        'Email verified successfully. You can now log in to the eDATS Client Portal.',
    };
  }

  async resendVerification(dto: ResendClientVerificationDto) {
    const email = dto.email.toLowerCase().trim();

    const client = await this.clientsService.findByEmail(email);

    /*
     * Generic response kung nonexistent account
     * aron dili ma-check sa attacker kung registered ba ang email.
     */
    if (!client) {
      return {
        message:
          'If an unverified account exists for this email, a verification email has been sent.',
      };
    }

    if (client.emailVerifiedAt) {
      return {
        message: 'This email address is already verified.',
      };
    }

    const { rawToken, tokenHash, expiry } = this.generateVerificationToken();

    await this.clientsService.updateVerificationToken(
      client.id,
      tokenHash,
      expiry,
    );

    const portalUrl = this.configService.get<string>('CLIENT_PORTAL_URL');

    if (!portalUrl) {
      throw new Error('CLIENT_PORTAL_URL is not configured.');
    }

    const verificationUrl =
      `${portalUrl}/client/verify-email` +
      `?token=${encodeURIComponent(rawToken)}`;

    const sent = await this.mailService.sendClientVerificationEmail(
      client.email,
      client.firstName,
      verificationUrl,
    );

    if (!sent) {
      throw new BadRequestException(
        'Unable to send verification email at this time.',
      );
    }

    return {
      message: 'A new verification email has been sent.',
    };
  }
}
