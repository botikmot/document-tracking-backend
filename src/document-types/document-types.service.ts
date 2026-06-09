import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

export class CreateDocumentTypeDto {
  name!: string;

  description?: string;
}

@Injectable()
export class DocumentTypesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateDocumentTypeDto) {
    const existing = await this.prisma.documentType.findUnique({
      where: {
        name: dto.name,
      },
    });

    if (existing) {
      throw new BadRequestException('Document type already exists');
    }

    return this.prisma.documentType.create({
      data: {
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async findAll() {
    return this.prisma.documentType.findMany({
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const type = await this.prisma.documentType.findUnique({
      where: {
        id,
      },
    });

    if (!type) {
      throw new NotFoundException('Document type not found');
    }

    return type;
  }
}
