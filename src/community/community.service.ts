import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  // =====================================================
  // COMMUNITIES
  // =====================================================

  async findAll(userId: string) {
    let general = await this.prisma.community.findFirst({
      where: {
        isGeneral: true,
      },
    });

    if (!general) {
      general = await this.prisma.community.create({
        data: {
          name: 'General',
          description: 'Regionwide discussion for all DENR Caraga personnel.',
          isGeneral: true,
          isPrivate: false,
        },
      });
    }

    // Ensure current user is a member
    await this.prisma.communityMember.upsert({
      where: {
        communityId_userId: {
          communityId: general.id,
          userId: userId,
        },
      },
      update: {},
      create: {
        communityId: general.id,
        userId: userId,
        role: MemberRole.MEMBER,
      },
    });

    return this.prisma.community.findMany({
      include: {
        members: {
          include: {
            user: true,
          },
        },
        _count: {
          select: {
            members: true,
            messages: true,
          },
        },
      },
      orderBy: [
        {
          isGeneral: 'desc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });
  }

  async create(ownerId: string, dto: CreateCommunityDto) {
    return this.prisma.community.create({
      data: {
        name: dto.name,
        description: dto.description,
        isPrivate: dto.isPrivate,
        ownerId,

        members: {
          create: {
            userId: ownerId,
            role: MemberRole.OWNER,
          },
        },
      },
      include: {
        owner: true,
        members: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdateCommunityDto) {
    const community = await this.prisma.community.findUnique({
      where: { id },
    });

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    return this.prisma.community.update({
      where: {
        id,
      },
      data: dto,
    });
  }

  async remove(id: string) {
    const community = await this.prisma.community.findUnique({
      where: { id },
    });

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    if (community.isGeneral) {
      throw new ForbiddenException('General community cannot be deleted.');
    }

    await this.prisma.$transaction([
      this.prisma.communityMessage.deleteMany({
        where: {
          communityId: id,
        },
      }),

      this.prisma.communityMember.deleteMany({
        where: {
          communityId: id,
        },
      }),

      this.prisma.community.delete({
        where: {
          id,
        },
      }),
    ]);

    return {
      message: 'Community deleted successfully.',
    };
  }

  // =====================================================
  // MESSAGES
  // =====================================================

  async getMessages(communityId: string, userId: string, page = 1, limit = 20) {
    await this.ensureMember(communityId, userId);

    return this.prisma.communityMessage
      .findMany({
        where: {
          communityId,
        },

        include: {
          user: {
            include: {
              offices: {
                include: {
                  office: true,
                },
              },
            },
          },
        },

        orderBy: {
          createdAt: 'desc',
        },

        skip: (page - 1) * limit,

        take: limit,
      })
      .then((messages) => messages.reverse());
  }

  async sendMessage(
    userId: string,
    communityId: string,
    dto: CreateMessageDto,
  ) {
    await this.ensureMember(communityId, userId);

    return this.prisma.communityMessage.create({
      data: {
        message: dto.message,
        communityId,
        userId,
      },
      include: {
        user: {
          include: {
            offices: {
              include: {
                office: true,
              },
            },
          },
        },
      },
    });
  }

  // =====================================================
  // MEMBERS
  // =====================================================

  async join(userId: string, communityId: string) {
    await this.ensureCommunityExists(communityId);

    const exists = await this.prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId,
          userId,
        },
      },
    });

    if (exists) {
      throw new BadRequestException('Already a member.');
    }

    return this.prisma.communityMember.create({
      data: {
        communityId,
        userId,
      },
    });
  }

  async leave(userId: string, communityId: string) {
    await this.ensureMember(communityId, userId);

    return this.prisma.communityMember.delete({
      where: {
        communityId_userId: {
          communityId,
          userId,
        },
      },
    });
  }

  async invite(communityId: string, userId: string) {
    await this.ensureCommunityExists(communityId);

    const exists = await this.prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId,
          userId,
        },
      },
    });

    if (exists) {
      throw new BadRequestException('User already belongs to this community.');
    }

    return this.prisma.communityMember.create({
      data: {
        communityId,
        userId,
      },
    });
  }

  async removeMember(communityId: string, userId: string) {
    await this.ensureMember(communityId, userId);

    return this.prisma.communityMember.delete({
      where: {
        communityId_userId: {
          communityId,
          userId,
        },
      },
    });
  }

  // =====================================================
  // PRIVATE HELPERS
  // =====================================================

  private async ensureCommunityExists(communityId: string) {
    const community = await this.prisma.community.findUnique({
      where: {
        id: communityId,
      },
    });

    if (!community) {
      throw new NotFoundException('Community not found.');
    }

    return community;
  }

  private async ensureMember(communityId: string, userId: string) {
    const member = await this.prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this community.');
    }

    return member;
  }

  async getUser(userId: string) {
    return this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        offices: {
          include: {
            office: true,
          },
        },
      },
    });
  }
}
