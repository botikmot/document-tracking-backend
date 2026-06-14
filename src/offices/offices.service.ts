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
import { OfficeCategory } from '@prisma/client';
import type { AuthenticatedUser } from '../common/types/authenticated-request.type';

@Injectable()
export class OfficesService {
  constructor(private prisma: PrismaService) {}

  /*
   |----------------------------------------------------------------------
   | CREATE OFFICE
   |----------------------------------------------------------------------
   */

  async create(dto: CreateOfficeDto) {
    /*
     |------------------------------------------------------------------
     | Check duplicate office code
     |------------------------------------------------------------------
     */

    const existingOffice = await this.prisma.office.findUnique({
      where: {
        officeCode: dto.officeCode.trim(),
      },
    });

    if (existingOffice) {
      throw new BadRequestException('Office code already exists');
    }

    /*
     |------------------------------------------------------------------
     | Validate organization unit
     |------------------------------------------------------------------
     */

    const organizationUnit = await this.prisma.organizationUnit.findUnique({
      where: {
        id: dto.organizationUnitId,
      },
    });

    if (!organizationUnit) {
      throw new BadRequestException('Organization unit not found');
    }

    /*
     |------------------------------------------------------------------
     | Prevent multiple RECORDS office per organization
     |------------------------------------------------------------------
     */

    if (dto.category === OfficeCategory.RECORDS) {
      const existingRecordsOffice = await this.prisma.office.findFirst({
        where: {
          organizationUnitId: dto.organizationUnitId,

          category: 'RECORDS',
        },
      });

      if (existingRecordsOffice) {
        throw new BadRequestException(
          'Records office already exists for this organization',
        );
      }
    }

    /*
     |------------------------------------------------------------------
     | Create office
     |------------------------------------------------------------------
     */

    return this.prisma.office.create({
      data: {
        officeCode: dto.officeCode.trim(),
        officeName: dto.officeName.trim(),
        description: dto.description,

        organizationUnitId: dto.organizationUnitId,

        category: dto.category,
      },

      include: {
        organizationUnit: true,
      },
    });
  }

  /*
   |----------------------------------------------------------------------
   | UPDATE OFFICE
   |----------------------------------------------------------------------
   */

  async update(
    id: string,
    dto: UpdateOfficeDto,
    currentUser: AuthenticatedUser,
  ) {
    /*
     |------------------------------------------------------------------
     | Find office
     |------------------------------------------------------------------
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
     |------------------------------------------------------------------
     | Check duplicate office code
     |------------------------------------------------------------------
     */

    if (dto.officeCode) {
      const duplicateOffice = await this.prisma.office.findFirst({
        where: {
          officeCode: dto.officeCode.trim(),

          NOT: {
            id,
          },
        },
      });

      if (duplicateOffice) {
        throw new BadRequestException('Office code already exists');
      }
    }

    /*
     |------------------------------------------------------------------
     | Validate organization unit
     |------------------------------------------------------------------
     */

    if (dto.organizationUnitId) {
      const organizationUnit = await this.prisma.organizationUnit.findUnique({
        where: {
          id: dto.organizationUnitId,
        },
      });

      if (!organizationUnit) {
        throw new BadRequestException('Organization unit not found');
      }
    }

    /*
     |------------------------------------------------------------------
     | Prevent multiple RECORDS office
     |------------------------------------------------------------------
     */

    if (dto.category === 'RECORDS') {
      const organizationUnitId =
        dto.organizationUnitId ?? office.organizationUnitId;

      const existingRecordsOffice = await this.prisma.office.findFirst({
        where: {
          organizationUnitId,

          category: 'RECORDS',

          NOT: {
            id,
          },
        },
      });

      if (existingRecordsOffice) {
        throw new BadRequestException(
          'Records office already exists for this organization',
        );
      }
    }

    /*
     |------------------------------------------------------------------
     | SUPER ADMIN
     |------------------------------------------------------------------
     */

    if (currentUser.roles.includes('SUPER_ADMIN')) {
      return this.prisma.office.update({
        where: {
          id,
        },

        data: {
          officeCode: dto.officeCode?.trim(),

          officeName: dto.officeName?.trim(),

          description: dto.description,

          organizationUnitId: dto.organizationUnitId,

          category: dto.category,
        },

        include: {
          organizationUnit: true,
        },
      });
    }

    /*
     |------------------------------------------------------------------
     | OFFICE ADMIN
     |------------------------------------------------------------------
     */

    if (currentUser.roles.includes('OFFICE_ADMIN')) {
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

        data: {
          officeCode: dto.officeCode?.trim(),

          officeName: dto.officeName?.trim(),

          description: dto.description,

          category: dto.category,
        },

        include: {
          organizationUnit: true,
        },
      });
    }

    throw new ForbiddenException('Unauthorized');
  }

  /*
   |----------------------------------------------------------------------
   | GET ACCESSIBLE OFFICES
   |----------------------------------------------------------------------
   */

  async getAccessibleOffices(currentUser: AuthenticatedUser) {
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

    if (!user || user.offices.length === 0) {
      throw new NotFoundException('User office not found');
    }

    const currentOffice = user.offices[0].office;
    const currentOrganization = currentOffice.organizationUnit;
    const isRecordsOffice = currentOffice.category === 'RECORDS';

    const excludeCurrentOffice = {
      NOT: {
        id: currentOffice.id,
      },
    };
    /*
     |------------------------------------------------------------------
     | REGIONAL
     |------------------------------------------------------------------
     */

    if (currentOrganization.type === 'REGIONAL') {
      /*
       |--------------------------------------------------------------
       | REGIONAL RECORDS
       |--------------------------------------------------------------
       */

      if (isRecordsOffice) {
        return this.prisma.office.findMany({
          where: {
            OR: [
              /*
               | All regional offices
               */

              {
                organizationUnitId: currentOrganization.id,
              },

              /*
               | PENRO records offices
               */

              {
                category: 'RECORDS',

                organizationUnit: {
                  type: 'PENRO',
                },
              },
            ],
            ...excludeCurrentOffice,
          },

          include: {
            organizationUnit: true,
          },

          orderBy: {
            officeName: 'asc',
          },
        });
      }

      /*
       |--------------------------------------------------------------
       | NORMAL REGIONAL OFFICE
       |--------------------------------------------------------------
       */

      return this.prisma.office.findMany({
        where: {
          organizationUnitId: currentOrganization.id,
          ...excludeCurrentOffice,
        },

        include: {
          organizationUnit: true,
        },

        orderBy: {
          officeName: 'asc',
        },
      });
    }

    /*
     |------------------------------------------------------------------
     | PENRO
     |------------------------------------------------------------------
     */

    if (currentOrganization.type === 'PENRO') {
      /*
       |--------------------------------------------------------------
       | PENRO RECORDS
       |--------------------------------------------------------------
       */

      if (isRecordsOffice) {
        return this.prisma.office.findMany({
          where: {
            OR: [
              /*
               | Same PENRO offices
               */

              {
                organizationUnitId: currentOrganization.id,
              },

              /*
               | Regional records
               */

              {
                category: 'RECORDS',

                organizationUnit: {
                  type: 'REGIONAL',
                },
              },

              /*
               | Child CENRO records
               */

              {
                category: 'RECORDS',

                organizationUnit: {
                  parentId: currentOrganization.id,
                },
              },
            ],
            ...excludeCurrentOffice,
          },

          include: {
            organizationUnit: true,
          },

          orderBy: {
            officeName: 'asc',
          },
        });
      }

      /*
       |--------------------------------------------------------------
       | NORMAL PENRO OFFICE
       |--------------------------------------------------------------
       */

      return this.prisma.office.findMany({
        where: {
          organizationUnitId: currentOrganization.id,
          ...excludeCurrentOffice,
        },

        include: {
          organizationUnit: true,
        },

        orderBy: {
          officeName: 'asc',
        },
      });
    }

    /*
     |------------------------------------------------------------------
     | CENRO
     |------------------------------------------------------------------
     */

    if (currentOrganization.type === 'CENRO') {
      /*
       |--------------------------------------------------------------
       | CENRO RECORDS
       |--------------------------------------------------------------
       */

      if (isRecordsOffice) {
        return this.prisma.office.findMany({
          where: {
            OR: [
              /*
               | Same CENRO offices
               */

              {
                organizationUnitId: currentOrganization.id,
              },

              /*
               | Parent PENRO records
               */

              {
                category: 'RECORDS',

                organizationUnitId: currentOrganization.parentId!,
              },
            ],
            ...excludeCurrentOffice,
          },

          include: {
            organizationUnit: true,
          },

          orderBy: {
            officeName: 'asc',
          },
        });
      }

      /*
       |--------------------------------------------------------------
       | NORMAL CENRO OFFICE
       |--------------------------------------------------------------
       */

      return this.prisma.office.findMany({
        where: {
          organizationUnitId: currentOrganization.id,
          ...excludeCurrentOffice,
        },

        include: {
          organizationUnit: true,
        },

        orderBy: {
          officeName: 'asc',
        },
      });
    }

    return [];
  }

  /*
 |----------------------------------------------------------------------
 | LIST OFFICES
 |----------------------------------------------------------------------
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
 |----------------------------------------------------------------------
 | FIND ONE OFFICE
 |----------------------------------------------------------------------
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
 |----------------------------------------------------------------------
 | DELETE OFFICE
 |----------------------------------------------------------------------
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
 |----------------------------------------------------------------------
 | ASSIGN USER TO OFFICE
 |----------------------------------------------------------------------
 */

  async assignUser(officeId: string, dto: AssignUserOfficeDto) {
    /*
   |------------------------------------------------------------------
   | Validate office
   |------------------------------------------------------------------
   */

    const office = await this.prisma.office.findUnique({
      where: {
        id: officeId,
      },
    });

    if (!office) {
      throw new NotFoundException('Office not found');
    }

    /*
   |------------------------------------------------------------------
   | Validate user
   |------------------------------------------------------------------
   */

    const user = await this.prisma.user.findUnique({
      where: {
        id: dto.userId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    /*
   |------------------------------------------------------------------
   | Assign / update office membership
   |------------------------------------------------------------------
   */

    return this.prisma.officeUser.upsert({
      where: {
        officeId_userId: {
          officeId,
          userId: dto.userId,
        },
      },

      update: {
        designation: dto.designation,

        isOfficeAdmin: dto.isOfficeAdmin ?? false,
      },

      create: {
        officeId,

        userId: dto.userId,

        designation: dto.designation,

        isOfficeAdmin: dto.isOfficeAdmin ?? false,
      },
    });
  }
}
