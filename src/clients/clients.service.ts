import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.client.findUnique({
      where: {
        email: email.toLowerCase().trim(),
      },
    });
  }

  async findById(id: string) {
    return this.prisma.client.findUnique({
      where: {
        id,
      },
    });
  }

  async create(data: {
    firstName: string;
    middleName?: string;
    lastName: string;
    suffix?: string;

    email: string;
    mobileNumber?: string;
    address?: string;
    organizationName?: string;

    passwordHash: string;

    emailVerificationToken: string;
    emailVerificationTokenExpiry: Date;
  }) {
    return this.prisma.client.create({
      data: {
        firstName: data.firstName.trim(),
        middleName: data.middleName?.trim() || null,
        lastName: data.lastName.trim(),
        suffix: data.suffix?.trim() || null,

        email: data.email.toLowerCase().trim(),

        mobileNumber: data.mobileNumber?.trim() || null,
        address: data.address?.trim() || null,
        organizationName: data.organizationName?.trim() || null,

        passwordHash: data.passwordHash,

        emailVerificationToken: data.emailVerificationToken,

        emailVerificationTokenExpiry: data.emailVerificationTokenExpiry,
      },
    });
  }

  async findByVerificationToken(tokenHash: string) {
    return this.prisma.client.findFirst({
      where: {
        emailVerificationToken: tokenHash,
      },
    });
  }

  async updateVerificationToken(
    clientId: string,
    tokenHash: string,
    expiry: Date,
  ) {
    return this.prisma.client.update({
      where: {
        id: clientId,
      },
      data: {
        emailVerificationToken: tokenHash,
        emailVerificationTokenExpiry: expiry,
      },
    });
  }

  async markEmailAsVerified(clientId: string) {
    return this.prisma.client.update({
      where: {
        id: clientId,
      },
      data: {
        emailVerifiedAt: new Date(),

        emailVerificationToken: null,
        emailVerificationTokenExpiry: null,

        status: 'ACTIVE',
      },
    });
  }
}
