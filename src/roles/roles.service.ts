import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  /*
   |--------------------------------------------------------------------------
   | CREATE ROLE
   |--------------------------------------------------------------------------
   */

  async create(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({
      where: {
        name: dto.name,
      },
    });

    if (existing) {
      throw new BadRequestException('Role already exists');
    }

    return this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
      },
    });
  }

  /*
   |--------------------------------------------------------------------------
   | LIST ROLES
   |--------------------------------------------------------------------------
   */

  async findAll() {
    return this.prisma.role.findMany({
      orderBy: {
        name: 'asc',
      },
    });
  }

  /*
   |--------------------------------------------------------------------------
   | FIND ONE
   |--------------------------------------------------------------------------
   */

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: {
        id,
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  /*
   |--------------------------------------------------------------------------
   | UPDATE
   |--------------------------------------------------------------------------
   */

  async update(id: string, dto: UpdateRoleDto) {
    await this.findOne(id);

    return this.prisma.role.update({
      where: {
        id,
      },

      data: dto,
    });
  }

  /*
   |--------------------------------------------------------------------------
   | DELETE
   |--------------------------------------------------------------------------
   */

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.role.delete({
      where: {
        id,
      },
    });
  }
}
