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
import { UpdateMessageDto } from './dto/update-message.dto';
import { ToggleReactionDto } from './dto/toggle-reaction.dto';

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

    await this.prisma.communityRead.upsert({
      where: {
        communityId_userId: {
          communityId: general.id,
          userId,
        },
      },

      update: {},

      create: {
        communityId: general.id,
        userId,
        lastReadAt: new Date(),
      },
    });

    const communities = await this.prisma.community.findMany({
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

        reads: {
          where: {
            userId,
          },
        },

        /* messages: {
          select: {
            id: true,
            createdAt: true,
          },
        }, */
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

    const result = await Promise.all(
      communities.map(async (community) => {
        const read = community.reads[0];

        const unreadCount = await this.prisma.communityMessage.count({
          where: {
            communityId: community.id,

            createdAt: {
              gt: read?.lastReadAt ?? new Date(0),
            },

            userId: {
              not: userId,
            },
          },
        });

        return {
          ...community,
          unreadCount,
        };
      }),
    );

    return result;
  }

  async create(ownerId: string, dto: CreateCommunityDto) {
    const community = await this.prisma.community.create({
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

            ...(dto.memberIds ?? []).map((userId) => ({
              userId,
              role: MemberRole.MEMBER,
            })),
          ],
        },
      },

      include: {
        owner: true,

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

    await this.prisma.communityRead.create({
      data: {
        communityId: community.id,
        userId: ownerId,
        lastReadAt: new Date(),
      },
    });

    return community;
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
          reactions: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          attachments: true,
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
    file?: Express.Multer.File,
  ) {
    await this.ensureMember(communityId, userId);

    // ------------------------------------
    // Create the message first
    // ------------------------------------

    const message = await this.prisma.communityMessage.create({
      data: {
        message: dto.message ?? '',
        communityId,
        userId,
      },
    });

    // ------------------------------------
    // Save attachment (if any)
    // ------------------------------------

    if (file) {
      await this.prisma.communityAttachment.create({
        data: {
          messageId: message.id,
          fileName: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          path: `/uploads/community/${file.filename}`,
        },
      });
    }

    // ------------------------------------
    // Return complete message
    // ------------------------------------

    return this.prisma.communityMessage.findUnique({
      where: {
        id: message.id,
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

        reactions: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },

        attachments: true,
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

    await this.prisma.communityRead.createMany({
      data: [
        {
          communityId: community.id,
          userId: currentUserId,
          lastReadAt: new Date(),
        },
        {
          communityId: community.id,
          userId: targetUserId,
          lastReadAt: new Date(),
        },
      ],
    });

    return community;
  }

  async findAllUsers(currentUserId: string) {
    const users = await this.prisma.user.findMany({
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

    const result = await Promise.all(
      users.map(async (user) => {
        const direct = await this.prisma.community.findFirst({
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
                    userId: user.id,
                  },
                },
              },
            ],
          },

          include: {
            reads: {
              where: {
                userId: currentUserId,
              },
            },

            messages: {
              select: {
                createdAt: true,
                userId: true,
              },
            },
          },
        });

        let unreadCount = 0;

        if (direct) {
          const read = direct.reads[0];

          unreadCount = direct.messages.filter(
            (m) =>
              m.userId !== currentUserId &&
              (!read || m.createdAt > read.lastReadAt),
          ).length;
        }

        return {
          ...user,

          directCommunityId: direct?.id ?? null,

          unreadCount,
        };
      }),
    );

    return result;
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

  async markAsRead(userId: string, communityId: string) {
    return this.prisma.communityRead.upsert({
      where: {
        communityId_userId: {
          communityId,
          userId,
        },
      },

      update: {
        lastReadAt: new Date(),
      },

      create: {
        communityId,
        userId,
        lastReadAt: new Date(),
      },
    });
  }

  async getCommunityMembers(communityId: string) {
    return this.prisma.communityMember.findMany({
      where: {
        communityId,
      },
      select: {
        userId: true,
      },
    });
  }

  async getUnreadCount(userId: string, communityId: string) {
    const read = await this.prisma.communityRead.findUnique({
      where: {
        communityId_userId: {
          communityId,
          userId,
        },
      },
    });

    return this.prisma.communityMessage.count({
      where: {
        communityId,

        createdAt: {
          gt: read?.lastReadAt ?? new Date(0),
        },

        userId: {
          not: userId,
        },
      },
    });
  }

  async updateMessage(
    userId: string,
    messageId: string,
    dto: UpdateMessageDto,
  ) {
    const message = await this.prisma.communityMessage.findUnique({
      where: {
        id: messageId,
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found.');
    }

    if (message.userId !== userId) {
      throw new ForbiddenException('You can only edit your own message.');
    }

    if (message.isDeleted) {
      throw new BadRequestException('Message has already been deleted.');
    }

    const updated = await this.prisma.communityMessage.update({
      where: {
        id: messageId,
      },

      data: {
        message: dto.message,
        editedAt: new Date(),
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
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return updated;
  }

  async deleteMessage(userId: string, messageId: string) {
    const message = await this.prisma.communityMessage.findUnique({
      where: {
        id: messageId,
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found.');
    }

    if (message.userId !== userId) {
      throw new ForbiddenException('You can only delete your own message.');
    }

    if (message.isDeleted) {
      throw new BadRequestException('Message already deleted.');
    }

    const deleted = await this.prisma.communityMessage.update({
      where: {
        id: messageId,
      },

      data: {
        isDeleted: true,

        message: 'This message was deleted.',
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

    return deleted;
  }

  async toggleReaction(
    userId: string,
    messageId: string,
    dto: ToggleReactionDto,
  ) {
    const message = await this.prisma.communityMessage.findUnique({
      where: {
        id: messageId,
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found.');
    }

    await this.ensureMember(message.communityId, userId);

    const existing = await this.prisma.messageReaction.findFirst({
      where: {
        messageId,
        userId,
        emoji: dto.emoji,
      },
    });

    if (existing) {
      await this.prisma.messageReaction.delete({
        where: {
          id: existing.id,
        },
      });
    } else {
      await this.prisma.messageReaction.create({
        data: {
          messageId,
          userId,
          emoji: dto.emoji,
        },
      });
    }

    const updatedMessage = await this.prisma.communityMessage.findUnique({
      where: {
        id: messageId,
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

        reactions: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        attachments: true,
      },
    });

    if (!updatedMessage) {
      throw new NotFoundException('Message not found.');
    }

    return updatedMessage;
  }
}
