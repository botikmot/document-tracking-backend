import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { CreateOfficeDto } from './dto/create-office.dto';
import { UpdateOfficeDto } from './dto/update-office.dto';
import { AssignUserOfficeDto } from './dto/assign-user-office.dto';
import type { AuthenticatedUser } from '../common/types/authenticated-request.type';

@Injectable()
export class OfficesService {
  constructor(private prisma: PrismaService) {}

  /*
   |--------------------------------------------------------------------------
   | CREATE OFFICE
   |--------------------------------------------------------------------------
   */

  async create(dto: CreateOfficeDto) {
    const existingOffice = await this.prisma.office.findUnique({
      where: {
        officeCode: dto.officeCode,
      },
    });

    if (existingOffice) {
      throw new BadRequestException('Office code already exists');
    }

    return this.prisma.office.create({
      data: {
        officeCode: dto.officeCode,
        officeName: dto.officeName,
        description: dto.description,
        organizationUnitId: dto.organizationUnitId,
      },
    });
  }

  /*
   |--------------------------------------------------------------------------
   | LIST OFFICES
   |--------------------------------------------------------------------------
   */

  async findAll() {
    return this.prisma.office.findMany({
      include: {
        organizationUnit: true,
        users: {
          include: {
            user: true,
          },
        },
      },

      orderBy: {
        officeName: 'asc',
      },
    });
  }

  /*
   |--------------------------------------------------------------------------
   | FIND ONE OFFICE
   |--------------------------------------------------------------------------
   */

  async findOne(id: string) {
    const office = await this.prisma.office.findUnique({
      where: {
        id,
      },

      include: {
        organizationUnit: true,

        users: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!office) {
      throw new NotFoundException('Office not found');
    }

    return office;
  }

  /*
   |--------------------------------------------------------------------------
   | UPDATE OFFICE
   |--------------------------------------------------------------------------
   */

  async update(
    id: string,
    dto: UpdateOfficeDto,
    currentUser: AuthenticatedUser,
  ) {
    /*
   |--------------------------------------------------------------------------
   | Find Office
   |--------------------------------------------------------------------------
   */
    const office = await this.prisma.office.findUnique({
      where: {
        id,
      },

      include: {
        users: true,
      },
    });

    if (!office) {
      throw new NotFoundException('Office not found');
    }

    /*
   |--------------------------------------------------------------------------
   | SUPER_ADMIN
   |--------------------------------------------------------------------------
   */
    if (currentUser.roles.includes('SUPER_ADMIN')) {
      return this.prisma.office.update({
        where: {
          id,
        },

        data: dto,
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
     | Check if current user is admin of THIS office
     |--------------------------------------------------------------------------
     */

      const officeAdmin = office.users.find(
        (officeUser) =>
          officeUser.userId === currentUser.userId && officeUser.isOfficeAdmin,
      );

      if (!officeAdmin) {
        throw new ForbiddenException('You are not an admin of this office');
      }

      return this.prisma.office.update({
        where: {
          id,
        },

        data: dto,
      });
    }

    /*
   |--------------------------------------------------------------------------
   | Default deny
   |--------------------------------------------------------------------------
   */

    throw new ForbiddenException('Unauthorized');
  }

  /*
   |--------------------------------------------------------------------------
   | DELETE OFFICE
   |--------------------------------------------------------------------------
   */

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.office.delete({
      where: {
        id,
      },
    });
  }

  /*
   |--------------------------------------------------------------------------
   | ASSIGN USER TO OFFICE
   |--------------------------------------------------------------------------
   */

  async assignUser(officeId: string, dto: AssignUserOfficeDto) {
    const office = await this.prisma.office.findUnique({
      where: {
        id: officeId,
      },
    });

    if (!office) {
      throw new NotFoundException('Office not found');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: dto.userId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.officeUser.upsert({
      where: {
        officeId_userId: {
          officeId,
          userId: dto.userId,
        },
      },

      update: {
        designation: dto.designation,
        isOfficeAdmin: dto.isOfficeAdmin,
      },

      create: {
        officeId,
        userId: dto.userId,
        designation: dto.designation,
        isOfficeAdmin: dto.isOfficeAdmin ?? false,
      },
    });
  }

  /*
   |--------------------------------------------------------------------------
   | ACCESSIBLE OFFICES BASED ON USER ORGANIZATION
   |--------------------------------------------------------------------------
   */
  async getAccessibleOffices(currentUser: AuthenticatedUser) {
    /*
   |--------------------------------------------------------
   | Get current user's offices
   |--------------------------------------------------------
   */

    const user = await this.prisma.user.findUnique({
      where: {
        id: currentUser.userId,
      },

      include: {
        offices: {
          include: {
            office: {
              include: {
                organizationUnit: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    /*
   |--------------------------------------------------------
   | Get organization unit IDs
   |--------------------------------------------------------
   */

    const organizationUnitIds = user.offices.map(
      (officeUser) => officeUser.office.organizationUnitId,
    );

    /*
   |--------------------------------------------------------
   | Get current user office IDs
   |--------------------------------------------------------
   */

    const userOfficeIds = user.offices.map((officeUser) => officeUser.officeId);

    /*
   |--------------------------------------------------------
   | Return accessible offices
   |--------------------------------------------------------
   */

    return this.prisma.office.findMany({
      where: {
        organizationUnitId: {
          in: organizationUnitIds,
        },

        id: {
          notIn: userOfficeIds,
        },
      },

      orderBy: {
        officeName: 'asc',
      },
    });
  }
}
