import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClientServiceTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async findActive() {
    return this.prisma.clientServiceType.findMany({
      where: {
        isActive: true,
      },

      orderBy: [
        {
          kind: 'asc',
        },
        {
          name: 'asc',
        },
      ],

      select: {
        id: true,
        code: true,
        name: true,
        description: true,

        kind: true,

        requiresLetterRequest: true,
        requiresTrackingNumber: true,
        allowsAttachments: true,

        receivingOffice: {
          select: {
            id: true,
            officeCode: true,
            officeName: true,
          },
        },

        requirements: {
          where: {
            isActive: true,
          },

          orderBy: {
            name: 'asc',
          },

          select: {
            id: true,
            code: true,
            name: true,
            description: true,

            isRequired: true,
            allowsMultiple: true,
          },
        },
      },
    });
  }

  async findActiveById(id: string) {
    const serviceType = await this.prisma.clientServiceType.findFirst({
      where: {
        id,
        isActive: true,
      },
    });

    if (!serviceType) {
      throw new NotFoundException(
        'The selected client service is not available.',
      );
    }

    return serviceType;
  }
}
