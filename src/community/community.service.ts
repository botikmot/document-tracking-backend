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

  private async requireOwner(communityId: string, userId: string) {
    const member = await this.prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId,

          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this channel.');
    }

    if (member.role !== MemberRole.OWNER) {
      throw new ForbiddenException(
        'Only the channel owner can perform this action.',
      );
    }

    const community = await this.prisma.community.findUnique({
      where: {
        id: communityId,
      },
    });

    if (!community) {
      throw new NotFoundException('Channel not found.');
    }

    return community;
  }

  // =====================================================
  // COMMUNITIES
  // =====================================================

  async findOne(communityId: string, userId: string) {
    return this.prisma.community.findFirst({
      where: {
        id: communityId,
        members: {
          some: {
            userId,
          },
        },
      },
      include: {
        members: {
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
        },
        _count: {
          select: {
            members: true,
            messages: true,
          },
        },
      },
    });
  }

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
      where: {
        type: 'CHANNEL',

        members: {
          some: {
            userId,
          },
        },
      },

      include: {
        members: {
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
          create: [
            {
              userId: ownerId,
              role: MemberRole.OWNER,
            },

            ...(dto.memberIds ?? []).map((id) => ({
              userId: id,
              role: MemberRole.MEMBER,
            })),
          ],
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

  async update(communityId: string, userId: string, dto: UpdateCommunityDto) {
    const community = await this.requireOwner(communityId, userId);

    if (community.isGeneral) {
      throw new BadRequestException('General channel cannot be modified.');
    }

    return this.prisma.community.update({
      where: {
        id: communityId,
      },

      data: dto,

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
    });
  }

  async remove(communityId: string, userId: string) {
    const community = await this.requireOwner(communityId, userId);

    if (community.isGeneral) {
      throw new BadRequestException('General channel cannot be deleted.');
    }

    return this.prisma.community.delete({
      where: {
        id: communityId,
      },
    });
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

  async removeMember(communityId: string, ownerId: string, memberId: string) {
    await this.requireOwner(communityId, ownerId);

    if (ownerId === memberId) {
      throw new BadRequestException('Owner cannot remove themselves.');
    }

    await this.prisma.communityMember.delete({
      where: {
        communityId_userId: {
          communityId,

          userId: memberId,
        },
      },
    });

    return {
      success: true,
    };
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

  async createDirectConversation(currentUserId: string, targetUserId: string) {
    if (currentUserId === targetUserId) {
      throw new BadRequestException('Cannot message yourself.');
    }

    const target = await this.prisma.user.findUnique({
      where: {
        id: targetUserId,
      },
    });

    if (!target) {
      throw new NotFoundException('User not found.');
    }

    const existing = await this.prisma.community.findFirst({
      where: {
        type: 'DIRECT',

        AND: [
          {
            members: {
              some: {
                userId: currentUserId,
              },
            },
          },
          {
            members: {
              some: {
                userId: targetUserId,
              },
            },
          },
        ],
      },

      include: {
        members: {
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
        },

        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    if (existing && existing.members.length === 2) {
      return existing;
    }

    const community = await this.prisma.community.create({
      data: {
        type: 'DIRECT',

        isPrivate: true,

        name: '',

        members: {
          create: [
            {
              userId: currentUserId,
              role: 'MEMBER',
            },
            {
              userId: targetUserId,
              role: 'MEMBER',
            },
          ],
        },
      },

      include: {
        members: {
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
        },

        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    return community;
  }

  async findAllUsers(currentUserId: string) {
    return this.prisma.user.findMany({
      where: {
        id: {
          not: currentUserId,
        },
      },
      orderBy: {
        firstName: 'asc',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profileImageUrl: true,
        offices: {
          include: {
            office: true,
          },
        },
      },
    });
  }

  async addMembers(communityId: string, userId: string, memberIds: string[]) {
    await this.requireOwner(communityId, userId);

    const ids = memberIds.filter((id) => id !== userId);

    await this.prisma.communityMember.createMany({
      data: ids.map((id) => ({
        communityId,

        userId: id,

        role: MemberRole.MEMBER,
      })),

      skipDuplicates: true,
    });

    return this.prisma.community.findUnique({
      where: {
        id: communityId,
      },
      include: {
        members: {
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
        },
        _count: {
          select: {
            members: true,
            messages: true,
          },
        },
      },
    });
  }
}
