import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          {
            email: dto.email,
          },
          {
            username: dto.username,
          },
        ],
      },
    });

    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        employeeId: dto.employeeId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        username: dto.username,
        passwordHash,
        roles: dto.roleIds?.length
          ? {
              create: dto.roleIds.map((roleId) => ({
                role: {
                  connect: {
                    id: roleId,
                  },
                },
              })),
            }
          : undefined,

        offices: dto.officeIds?.length
          ? {
              create: dto.officeIds.map((officeId) => ({
                office: {
                  connect: {
                    id: officeId,
                  },
                },
              })),
            }
          : undefined,
      },

      include: {
        roles: {
          include: {
            role: true,
          },
        },

        offices: {
          include: {
            office: true,
          },
        },
      },
    });

    return user;
  }

  async findAll() {
    return this.prisma.user.findMany({
      include: {
        roles: {
          include: {
            role: true,
          },
        },

        offices: {
          include: {
            office: true,
          },
        },
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id,
      },

      include: {
        roles: {
          include: {
            role: true,
          },
        },

        offices: {
          include: {
            office: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto, currentUser: AuthenticatedUser) {
    /*
   |--------------------------------------------------------------------------
   | Find Target User
   |--------------------------------------------------------------------------
   */

    const targetUser = await this.prisma.user.findUnique({
      where: {
        id,
      },

      include: {
        offices: true,
      },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    /*
   |--------------------------------------------------------------------------
   | SUPER_ADMIN can update anyone
   |--------------------------------------------------------------------------
   */

    if (currentUser.roles.includes('SUPER_ADMIN')) {
      const updateData: Prisma.UserUpdateInput = {
        employeeId: dto.employeeId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        username: dto.username,
      };

      // hash password if provided
      if (dto.password) {
        updateData.passwordHash = await bcrypt.hash(dto.password, 10);
      }

      return this.prisma.user.update({
        where: {
          id,
        },

        data: updateData,
      });
    }

    /*
   |--------------------------------------------------------------------------
   | OFFICE_ADMIN restriction
   |--------------------------------------------------------------------------
   */

    if (currentUser.roles.includes('OFFICE_ADMIN')) {
      /*
     |--------------------------------------------------------------------------
     | Get target user's office IDs
     |--------------------------------------------------------------------------
     */

      const targetOfficeIds = targetUser.offices.map(
        (office) => office.officeId,
      );

      /*
     |--------------------------------------------------------------------------
     | Check if they share office
     |--------------------------------------------------------------------------
     */

      const hasSharedOffice = targetOfficeIds.some((officeId) =>
        currentUser.officeIds.includes(officeId),
      );

      if (!hasSharedOffice) {
        throw new ForbiddenException(
          'You cannot update users outside your office',
        );
      }

      const updateData: Prisma.UserUpdateInput = {
        employeeId: dto.employeeId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        username: dto.username,
      };

      // hash password if provided
      if (dto.password) {
        updateData.passwordHash = await bcrypt.hash(dto.password, 10);
      }

      return this.prisma.user.update({
        where: {
          id,
        },

        data: updateData,
      });
    }

    /*
   |--------------------------------------------------------------------------
   | Default deny
   |--------------------------------------------------------------------------
   */

    throw new ForbiddenException('Unauthorized');
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.user.update({
      where: {
        id,
      },

      data: {
        status: 'INACTIVE',
      },
    });
  }
}
