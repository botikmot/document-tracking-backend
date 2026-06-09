import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { CreateOrganizationUnitDto } from './dto/create-organization-unit.dto';
import { UpdateOrganizationUnitDto } from './dto/update-organization-unit.dto';

export type OrganizationTreeNode = {
  id: string;
  code: string;
  name: string;
  type: string;
  description: string | null;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  offices: unknown[];
  children: OrganizationTreeNode[];
};

@Injectable()
export class OrganizationUnitsService {
  constructor(private prisma: PrismaService) {}

  /*
   |--------------------------------------------------------------------------
   | CREATE
   |--------------------------------------------------------------------------
   */

  async create(dto: CreateOrganizationUnitDto) {
    /*
     |--------------------------------------------------------------------------
     | Unique Code
     |--------------------------------------------------------------------------
     */

    const existing = await this.prisma.organizationUnit.findUnique({
      where: {
        code: dto.code,
      },
    });

    if (existing) {
      throw new BadRequestException('Code already exists');
    }

    /*
     |--------------------------------------------------------------------------
     | Parent Validation
     |--------------------------------------------------------------------------
     */

    if (dto.parentId) {
      const parent = await this.prisma.organizationUnit.findUnique({
        where: {
          id: dto.parentId,
        },
      });

      if (!parent) {
        throw new NotFoundException('Parent organization not found');
      }
    }

    return this.prisma.organizationUnit.create({
      data: {
        code: dto.code,
        name: dto.name,
        type: dto.type,
        description: dto.description,
        parentId: dto.parentId,
      },
    });
  }

  /*
   |--------------------------------------------------------------------------
   | FIND ALL
   |--------------------------------------------------------------------------
   */

  async findAll() {
    return this.prisma.organizationUnit.findMany({
      include: {
        parent: true,

        children: true,

        offices: true,
      },

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
    const unit = await this.prisma.organizationUnit.findUnique({
      where: {
        id,
      },

      include: {
        parent: true,

        children: true,

        offices: true,
      },
    });

    if (!unit) {
      throw new NotFoundException('Organization unit not found');
    }

    return unit;
  }

  /*
   |--------------------------------------------------------------------------
   | UPDATE
   |--------------------------------------------------------------------------
   */

  async update(id: string, dto: UpdateOrganizationUnitDto) {
    await this.findOne(id);

    return this.prisma.organizationUnit.update({
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
    const unit = await this.findOne(id);

    /*
     |--------------------------------------------------------------------------
     | Prevent delete if has children
     |--------------------------------------------------------------------------
     */

    if (unit.children.length > 0) {
      throw new BadRequestException(
        'Cannot delete organization with child units',
      );
    }

    return this.prisma.organizationUnit.delete({
      where: {
        id,
      },
    });
  }

  /*
   |--------------------------------------------------------------------------
   | ORGANIZATION TREE
   |--------------------------------------------------------------------------
   */

  async getTree() {
    const organizations = await this.prisma.organizationUnit.findMany({
      include: {
        offices: true,
      },
    });

    const map = new Map<string, OrganizationTreeNode>();

    const roots: OrganizationTreeNode[] = [];

    /*
     |--------------------------------------------------------------------------
     | Build map
     |--------------------------------------------------------------------------
     */

    for (const org of organizations) {
      map.set(org.id, {
        ...org,
        children: [],
      });
    }

    /*
     |--------------------------------------------------------------------------
     | Build tree
     |--------------------------------------------------------------------------
     */

    for (const org of organizations) {
      const node = map.get(org.id);

      if (!node) {
        continue;
      }

      if (org.parentId) {
        const parent = map.get(org.parentId);

        if (parent) {
          parent.children.push(node);
        }
      } else {
        roots.push(node);
      }
    }

    return roots;
  }
}
