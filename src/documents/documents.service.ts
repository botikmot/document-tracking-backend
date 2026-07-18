import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import type { AuthenticatedUser } from '../common/types/authenticated-request.type';

import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { RouteDocumentDto } from './dto/route-document.dto';
import { ReturnDocumentDto } from './dto/return-document.dto';
import { DecisionDocumentDto } from './dto/decision-document.dto';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { Prisma } from '@prisma/client';

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  private async buildDocumentWhere(
    currentUser: AuthenticatedUser,
  ): Promise<Prisma.DocumentWhereInput> {
    const where: Prisma.DocumentWhereInput = {};

    // OFFICE FILTER
    if (!currentUser.roles.includes('SUPER_ADMIN')) {
      const officeUsers = await this.prisma.officeUser.findMany({
        where: { userId: currentUser.userId },
      });

      const officeIds = officeUsers.map((o) => o.officeId);

      where.currentOfficeId = {
        in: officeIds,
      };
    }

    return where;
  }

  /*
   |--------------------------------------------------------------------------
   | Generate Tracking Number
   |--------------------------------------------------------------------------
   */

  private async generateTrackingNumber() {
    const year = new Date().getFullYear();
    const count = await this.prisma.document.count();
    const sequence = String(count + 1).padStart(6, '0');
    return `DOC-${year}-${sequence}`;
  }

  /*
   |--------------------------------------------------------------------------
   | CREATE DOCUMENT
   |--------------------------------------------------------------------------
   */

  async create(
    dto: CreateDocumentDto,

    currentUser: AuthenticatedUser,
  ) {
    /*
     |--------------------------------------------------------------------------
     | Verify user belongs to office
     |--------------------------------------------------------------------------
     */

    const officeUser = await this.prisma.officeUser.findFirst({
      where: {
        //officeId: dto.currentOfficeId,
        userId: currentUser.userId,
      },
      include: {
        office: true,
      },
    });

    if (!officeUser) {
      throw new ForbiddenException('You are not assigned to this office');
    }

    /*
     |--------------------------------------------------------------------------
     | Generate Tracking Number
     |--------------------------------------------------------------------------
     */

    const trackingNumber = await this.generateTrackingNumber();

    /*
     |--------------------------------------------------------------------------
     | Get Default Status
     |--------------------------------------------------------------------------
     */

    const draftStatus = await this.prisma.documentStatus.findUnique({
      where: {
        name: 'DRAFT',
      },
    });

    if (!draftStatus) {
      throw new Error('DRAFT status not found');
    }

    /*
     |--------------------------------------------------------------------------
     | Create Document
     |--------------------------------------------------------------------------
     */

    const document = await this.prisma.document.create({
      data: {
        trackingNumber,
        documentTypeId: dto.documentTypeId,
        currentStatusId: draftStatus.id,
        currentOfficeId: officeUser.officeId,
        title: dto.title,
        description: dto.description,
        referenceNumber: dto.referenceNumber,
        priority: dto.priority,
        confidentialityLevel: dto.confidentialityLevel,
        classification: dto.classification,
        deadline: dto.deadline,
        addressee: dto.addressee,
        createdById: currentUser.userId,
        senderType: dto.senderType,
        senderOfficeId:
          dto.senderType === 'OFFICE' ? officeUser.officeId : null,
        senderName: dto.senderType === 'CLIENT' ? dto.senderName : null,
        senderOrganization:
          dto.senderType === 'COMPANY' || dto.senderType === 'AGENCY'
            ? dto.senderOrganization
            : null,
        senderContact:
          dto.senderType === 'AGENCY' ||
          dto.senderType === 'CLIENT' ||
          dto.senderType === 'COMPANY'
            ? dto.senderName
            : null,
        attachments: {
          create:
            dto.attachments?.map((file) => ({
              fileName: file.fileName,
              filePath: file.filePath,
              mimeType: file.mimeType,
              fileSize: file.fileSize,
              publicId: file.publicId,
            })) || [],
        },
      },

      include: {
        documentType: true,
        currentStatus: true,
        currentOffice: true,
        senderOffice: true,
        createdBy: true,
        attachments: true,
      },
    });

    /*
     |--------------------------------------------------------------------------
     | Audit Log
     |--------------------------------------------------------------------------
     */

    await this.prisma.documentLog.create({
      data: {
        documentId: document.id,
        userId: currentUser.userId,
        action: 'DOCUMENT_CREATED',
        description: 'Document created',
      },
    });

    return document;
  }

  /*
   |--------------------------------------------------------------------------
   | LIST DOCUMENTS
   |--------------------------------------------------------------------------
   */

  async findAll(
    currentUser: AuthenticatedUser,
    page = 1,
    limit = 10,
    status?: string,
    search?: string,
  ) {
    const skip = (page - 1) * limit;

    /*
   |------------------------------------------------------------
   | BASE WHERE
   |------------------------------------------------------------
   */

    const where: Prisma.DocumentWhereInput = {};

    /*
   |------------------------------------------------------------
   | STATUS FILTER
   |------------------------------------------------------------
   */

    if (status && status !== 'ALL') {
      where.currentStatus = {
        name: status,
      };
    }

    /*
   |------------------------------------------------------------
   | SEARCH
   |------------------------------------------------------------
   */

    if (search) {
      where.OR = [
        {
          title: {
            contains: search,
            mode: 'insensitive',
          },
        },

        {
          trackingNumber: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    /*
   |------------------------------------------------------------
   | OFFICE FILTER
   |------------------------------------------------------------
   */

    if (!currentUser.roles.includes('SUPER_ADMIN')) {
      const officeUsers = await this.prisma.officeUser.findMany({
        where: {
          userId: currentUser.userId,
        },
      });

      const officeIds = officeUsers.map((office) => office.officeId);

      where.currentOfficeId = {
        in: officeIds,
      };
    }

    /*
   |------------------------------------------------------------
   | GET DATA
   |------------------------------------------------------------
   */

    const [documents, total] = await Promise.all([
      this.prisma.document.findMany({
        where,

        skip,
        take: limit,

        include: {
          documentType: true,
          currentStatus: true,
          currentOffice: true,
          senderOffice: true,
          createdBy: true,
          attachments: true,
          routes: {
            include: {
              fromOffice: true,
              toOffice: true,
              sentBy: true,
              receivedBy: true,
            },

            orderBy: {
              sentAt: 'asc',
            },
          },
        },

        orderBy: {
          createdAt: 'desc',
        },
      }),

      this.prisma.document.count({
        where,
      }),
    ]);

    return {
      data: documents,

      meta: {
        total,
        page,
        limit,

        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /*
   |--------------------------------------------------------------------------
   | FIND ONE DOCUMENT
   |--------------------------------------------------------------------------
   */

  async findOne(id: string) {
    const document = await this.prisma.document.findUnique({
      where: {
        id,
      },

      include: {
        documentType: true,
        currentStatus: true,
        currentOffice: true,
        createdBy: true,
        attachments: true,
        routes: {
          include: {
            fromOffice: true,
            toOffice: true,
            sentBy: true,
            receivedBy: true,
          },

          orderBy: {
            sentAt: 'asc',
          },
        },

        logs: {
          include: {
            user: true,
          },

          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  /*
   |--------------------------------------------------------------------------
   | UPDATE DOCUMENT
   |--------------------------------------------------------------------------
   */

  async update(
    id: string,
    dto: UpdateDocumentDto,
    currentUser: AuthenticatedUser,
  ) {
    const document = await this.prisma.document.findUnique({
      where: {
        id,
      },
      include: { attachments: true },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    /*
     |--------------------------------------------------------------------------
     | Only creator can update for now
     |--------------------------------------------------------------------------
     */

    if (document.createdById !== currentUser.userId) {
      throw new ForbiddenException('You cannot update this document');
    }

    const { attachments, ...data } = dto;

    const updatedDocument = await this.prisma.document.update({
      where: {
        id,
      },
      data,
    });

    if (attachments && attachments.length > 0) {
      await this.prisma.documentAttachment.deleteMany({
        where: { documentId: id },
      });

      await this.prisma.documentAttachment.createMany({
        data: attachments.map((file) => ({
          documentId: id,
          fileName: file.fileName,
          filePath: file.filePath,
          mimeType: file.mimeType,
          fileSize: file.fileSize,
          publicId: file.publicId,
        })),
        skipDuplicates: true,
      });
    }

    /*
     |--------------------------------------------------------------------------
     | Audit Log
     |--------------------------------------------------------------------------
     */

    await this.prisma.documentLog.create({
      data: {
        documentId: id,
        userId: currentUser.userId,
        action: 'DOCUMENT_UPDATED',
        description: 'Document updated',
      },
    });

    return updatedDocument;
  }

  /*
   |--------------------------------------------------------------------------
   | ROUTE DOCUMENT
   |--------------------------------------------------------------------------
   */

  async routeDocument(
    documentId: string,
    dto: RouteDocumentDto,
    currentUser: AuthenticatedUser,
  ) {
    const document = await this.prisma.document.findUnique({
      where: {
        id: documentId,
      },
      include: {
        documentType: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    /*
     |--------------------------------------------------------------------------
     | Verify sender belongs to current office
     |--------------------------------------------------------------------------
     */

    const officeUser = await this.prisma.officeUser.findFirst({
      where: {
        officeId: document.currentOfficeId,

        userId: currentUser.userId,
      },
    });

    if (!officeUser) {
      throw new ForbiddenException(
        'You cannot route documents from this office',
      );
    }

    await this.prisma.documentRoute.updateMany({
      where: {
        documentId,
        toOfficeId: {
          in: currentUser.officeIds,
        },
        status: 'RECEIVED',
        completedAt: null,
      },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    /*
     |--------------------------------------------------------------------------
     | Create Route
     |--------------------------------------------------------------------------
     */

    const route = await this.prisma.documentRoute.create({
      data: {
        documentId,
        fromOfficeId: document.currentOfficeId,
        toOfficeId: dto.toOfficeId,
        sentByUserId: currentUser.userId,
        remarks: dto.remarks,
      },

      include: {
        fromOffice: true,
        toOffice: true,
        sentBy: true,
      },
    });

    /*
 |--------------------------------------------------------------------------
 | Get IN_TRANSIT status
 |--------------------------------------------------------------------------
 */

    const inTransitStatus = await this.prisma.documentStatus.findUnique({
      where: {
        name: 'IN_TRANSIT',
      },
    });

    if (!inTransitStatus) {
      throw new NotFoundException('IN_TRANSIT status not found');
    }

    /*
 |--------------------------------------------------------------------------
 | Update Document
 |--------------------------------------------------------------------------
 */

    const updatedDocument = await this.prisma.document.update({
      where: {
        id: documentId,
      },

      data: {
        currentOfficeId: dto.toOfficeId,
        currentStatusId: inTransitStatus.id,
      },

      include: {
        documentType: true,
        currentStatus: true,
        currentOffice: true,
      },
    });

    /*
     |--------------------------------------------------------------------------
     | Audit Log
     |--------------------------------------------------------------------------
     */

    await this.prisma.documentLog.create({
      data: {
        documentId,
        userId: currentUser.userId,
        action: 'DOCUMENT_ROUTED',
        description: 'Document routed',
      },
    });

    /*
 |--------------------------------------------------------------------------
 | CREATE NOTIFICATION
 |--------------------------------------------------------------------------
 */

    const officeUsers = await this.prisma.officeUser.findMany({
      where: {
        officeId: dto.toOfficeId,
      },

      include: {
        user: true,
      },
    });

    for (const officeUser of officeUsers) {
      /*
   |------------------------------------------------------------
   | SAVE DATABASE NOTIFICATION
   |------------------------------------------------------------
   */

      const notification = await this.prisma.notification.create({
        data: {
          userId: officeUser.userId,
          title: 'New Incoming Document',
          message: `${document.title} has been routed to your office.`,
          documentId: document.id,
          type: 'ROUTED',
        },
      });

      /*
   |------------------------------------------------------------
   | REALTIME SOCKET
   |------------------------------------------------------------
   */

      this.notificationsGateway.sendNotification(
        officeUser.userId,
        notification,
      );
    }

    /*
   |--------------------------------------------------------------------------
   | REALTIME INCOMING DOCUMENT
   |--------------------------------------------------------------------------
   */

    const destinationUsers = await this.prisma.officeUser.findMany({
      where: {
        officeId: dto.toOfficeId,
      },

      include: {
        user: true,
      },
    });

    for (const officeUser of destinationUsers) {
      this.notificationsGateway.sendIncomingDocument(officeUser.userId, {
        id: route.id,
        status: 'PENDING',
        remarks: route.remarks,
        sentAt: route.sentAt,
        fromOffice: route.fromOffice,
        toOffice: route.toOffice,
        sentBy: route.sentBy,
        document: updatedDocument,
      });
    }

    return route;
  }

  /*
 |--------------------------------------------------------------------------
 | Get Incoming Documents
 |--------------------------------------------------------------------------
 */

  async getIncomingDocuments(
    currentUser: AuthenticatedUser,
    page = 1,
    limit = 5,
    search?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.DocumentRouteWhereInput = {
      toOfficeId: {
        in: currentUser.officeIds,
      },

      receivedAt: null,

      NOT: {
        fromOfficeId: {
          in: currentUser.officeIds,
        },
      },

      document: {
        currentOfficeId: {
          in: currentUser.officeIds,
        },
      },
    };

    /*
   |------------------------------------------------------------
   | SEARCH
   |------------------------------------------------------------
   */

    if (search) {
      where.document = {
        OR: [
          {
            title: {
              contains: search,
              mode: 'insensitive',
            },
          },

          {
            trackingNumber: {
              contains: search,
              mode: 'insensitive',
            },
          },
        ],
      };
    }

    /*
   |------------------------------------------------------------
   | FETCH
   |------------------------------------------------------------
   */

    const [routes, total] = await Promise.all([
      this.prisma.documentRoute.findMany({
        where,

        skip,
        take: limit,

        include: {
          document: {
            include: {
              documentType: true,
              currentStatus: true,
              currentOffice: true,
              senderOffice: true,
              createdBy: true,
            },
          },

          fromOffice: true,
          toOffice: true,
          sentBy: true,
        },

        orderBy: {
          sentAt: 'desc',
        },
      }),

      this.prisma.documentRoute.count({
        where,
      }),
    ]);

    const pendingCount = await this.prisma.document.count({
      where: {
        currentOfficeId: {
          in: currentUser.officeIds,
        },

        currentStatus: {
          name: 'PENDING',
        },
      },
    });

    return {
      data: routes,

      meta: {
        total,
        page,
        limit,

        totalPages: Math.ceil(total / limit),
      },
      stats: {
        pending: pendingCount,
      },
    };
  }

  /*
     |--------------------------------------------------------------------------
     | Get Outgoing Documents
     |--------------------------------------------------------------------------
     */

  async getOutgoingDocuments(
    currentUser: AuthenticatedUser,
    page = 1,
    limit = 5,
    search?: string,
  ) {
    const skip = (page - 1) * limit;

    /*
   |------------------------------------------------------------
   | WHERE
   |------------------------------------------------------------
   */

    const where: Prisma.DocumentRouteWhereInput = {
      fromOfficeId: {
        in: currentUser.officeIds,
      },
    };

    /*
   |------------------------------------------------------------
   | SEARCH
   |------------------------------------------------------------
   */

    if (search) {
      where.document = {
        OR: [
          {
            title: {
              contains: search,
              mode: 'insensitive',
            },
          },

          {
            trackingNumber: {
              contains: search,
              mode: 'insensitive',
            },
          },
        ],
      };
    }

    /*
   |------------------------------------------------------------
   | FETCH
   |------------------------------------------------------------
   */

    const [routes, total, activeRoutes] = await Promise.all([
      this.prisma.documentRoute.findMany({
        where,

        skip,
        take: limit,

        include: {
          document: {
            include: {
              documentType: true,
              currentStatus: true,
              currentOffice: true,
              senderOffice: true,
              createdBy: true,

              routes: {
                include: {
                  fromOffice: true,
                  toOffice: true,
                  sentBy: true,
                  receivedBy: true,
                },

                orderBy: {
                  sentAt: 'asc',
                },
              },
            },
          },

          fromOffice: true,
          toOffice: true,
          sentBy: true,
          receivedBy: true,
        },

        orderBy: {
          sentAt: 'desc',
        },
      }),

      this.prisma.documentRoute.count({
        where,
      }),
      /*
       |--------------------------------------------------------
       | ACTIVE ROUTES COUNT
       |--------------------------------------------------------
       */
      this.prisma.documentRoute.count({
        where: {
          fromOfficeId: {
            in: currentUser.officeIds,
          },

          document: {
            currentStatus: {
              name: {
                in: [
                  'PENDING',
                  'FOR_REVIEW',
                  'FOR_APPROVAL',
                  'ON_PROCESS',
                  'IN_TRANSIT',
                ],
              },
            },
          },
        },
      }),
    ]);

    return {
      data: routes,

      meta: {
        total,
        page,
        limit,

        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalOutgoing: total,
        activeRoutes,
      },
    };
  }

  /*
     |--------------------------------------------------------------------------
     | Get Pending Documents
     |--------------------------------------------------------------------------
     */
  async getPendingDocuments(
    currentUser: AuthenticatedUser,
    page = 1,
    limit = 5,
    search?: string,
  ) {
    const skip = (page - 1) * limit;

    /*
   |------------------------------------------------------------
   | WHERE
   |------------------------------------------------------------
   */

    const where: Prisma.DocumentWhereInput = {
      currentOfficeId: {
        in: currentUser.officeIds,
      },

      currentStatus: {
        name: {
          in: ['PENDING', 'FOR_REVIEW', 'FOR_APPROVAL', 'ON_PROCESS'],
        },
      },
    };

    /*
   |------------------------------------------------------------
   | SEARCH
   |------------------------------------------------------------
   */

    if (search) {
      where.OR = [
        {
          title: {
            contains: search,
            mode: 'insensitive',
          },
        },

        {
          trackingNumber: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    /*
   |------------------------------------------------------------
   | FETCH
   |------------------------------------------------------------
   */

    const [documents, total] = await Promise.all([
      this.prisma.document.findMany({
        where,

        skip,
        take: limit,

        include: {
          documentType: true,
          currentStatus: true,
          currentOffice: true,
          senderOffice: true,
          createdBy: true,

          routes: {
            include: {
              fromOffice: true,
              toOffice: true,
              sentBy: true,
              receivedBy: true,
            },

            orderBy: {
              sentAt: 'asc',
            },
          },
        },

        orderBy: {
          updatedAt: 'desc',
        },
      }),

      this.prisma.document.count({
        where,
      }),
    ]);

    /*
   |------------------------------------------------------------
   | RETURN
   |------------------------------------------------------------
   */

    return {
      data: documents,

      meta: {
        total,
        page,
        limit,

        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /*
     |--------------------------------------------------------------------------
     | Get Received Documents
     |--------------------------------------------------------------------------
     */
  async getReceivedDocuments(currentUser: AuthenticatedUser) {
    return this.prisma.documentRoute.findMany({
      where: {
        toOfficeId: {
          in: currentUser.officeIds,
        },

        receivedAt: {
          not: null,
        },
      },

      include: {
        document: {
          include: {
            documentType: true,
            currentStatus: true,
          },
        },

        fromOffice: true,
        toOffice: true,
        receivedBy: true,
      },

      orderBy: {
        receivedAt: 'desc',
      },
    });
  }

  /*
 |--------------------------------------------------------------------------
 | Get Archived Documents
 |--------------------------------------------------------------------------
 */

  async getArchivedDocuments(
    currentUser: AuthenticatedUser,
    page = 1,
    limit = 5,
    search?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.DocumentWhereInput = {
      currentOfficeId: {
        in: currentUser.officeIds,
      },

      currentStatus: {
        name: 'COMPLETED',
      },
    };

    /*
   |------------------------------------------------------------
   | SEARCH
   |------------------------------------------------------------
   */

    if (search) {
      where.OR = [
        {
          title: {
            contains: search,
            mode: 'insensitive',
          },
        },

        {
          trackingNumber: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    /*
   |------------------------------------------------------------
   | FETCH
   |------------------------------------------------------------
   */

    const [documents, total] = await Promise.all([
      this.prisma.document.findMany({
        where,

        skip,
        take: limit,

        include: {
          documentType: true,
          currentStatus: true,
          currentOffice: true,
          senderOffice: true,
          createdBy: true,
          routes: {
            include: {
              fromOffice: true,
              toOffice: true,
              sentBy: true,
              receivedBy: true,
            },

            orderBy: {
              sentAt: 'asc',
            },
          },
        },

        orderBy: {
          updatedAt: 'desc',
        },
      }),

      this.prisma.document.count({
        where,
      }),
    ]);

    const totalDocuments = await this.prisma.document.count({
      where: {
        currentOfficeId: {
          in: currentUser.officeIds,
        },
      },
    });

    return {
      data: documents,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        archivedCount: total,
        totalDocuments,
      },
    };
  }

  /*
     |--------------------------------------------------------------------------
     | Receive Document
     |--------------------------------------------------------------------------
     */
  async receiveDocument(documentId: string, currentUser: AuthenticatedUser) {
    /*
   |--------------------------------------------------------------------------
   | Find latest pending route
   |--------------------------------------------------------------------------
   */

    const route = await this.prisma.documentRoute.findFirst({
      where: {
        documentId,
        toOfficeId: {
          in: currentUser.officeIds,
        },
        receivedAt: null,
      },

      orderBy: {
        sentAt: 'desc',
      },
    });

    if (!route) {
      throw new NotFoundException('Pending route not found');
    }

    /*
   |--------------------------------------------------------------------------
   | Receive Route
   |--------------------------------------------------------------------------
   */

    const updatedRoute = await this.prisma.documentRoute.update({
      where: {
        id: route.id,
      },

      data: {
        receivedAt: new Date(),
        receivedByUserId: currentUser.userId,
        status: 'RECEIVED',
      },
    });

    /*
   |--------------------------------------------------------------------------
   | Update Document Status
   |--------------------------------------------------------------------------
   */

    const pendingStatus = await this.prisma.documentStatus.findUnique({
      where: {
        name: 'PENDING',
      },
    });

    if (pendingStatus) {
      await this.prisma.document.update({
        where: {
          id: documentId,
        },

        data: {
          currentStatusId: pendingStatus.id,
        },
      });
    }

    /*
   |--------------------------------------------------------------------------
   | Audit Log
   |--------------------------------------------------------------------------
   */

    await this.prisma.documentLog.create({
      data: {
        documentId,
        userId: currentUser.userId,
        action: 'DOCUMENT_RECEIVED',
        description: 'Document received',
      },
    });

    return updatedRoute;
  }

  /*
     |--------------------------------------------------------------------------
     | Return Document
     |--------------------------------------------------------------------------
     */
  async returnDocument(
    documentId: string,
    dto: ReturnDocumentDto,
    currentUser: AuthenticatedUser,
  ) {
    /*
   |--------------------------------------------------------------------------
   | Get latest route
   |--------------------------------------------------------------------------
   */

    const latestRoute = await this.prisma.documentRoute.findFirst({
      where: {
        documentId,
      },

      orderBy: {
        sentAt: 'desc',
      },
    });

    if (!latestRoute) {
      throw new NotFoundException('Route not found');
    }

    /*
   |--------------------------------------------------------------------------
   | Create reverse route
   |--------------------------------------------------------------------------
   */

    const returnRoute = await this.prisma.documentRoute.create({
      data: {
        documentId,
        fromOfficeId: latestRoute.toOfficeId,
        toOfficeId: latestRoute.fromOfficeId,
        sentByUserId: currentUser.userId,
        remarks: dto.remarks,
        status: 'RETURNED',
      },
    });

    /*
   |--------------------------------------------------------------------------
   | Update Current Office
   |--------------------------------------------------------------------------
   */

    await this.prisma.document.update({
      where: {
        id: documentId,
      },

      data: {
        currentOfficeId: latestRoute.fromOfficeId,
      },
    });

    /*
   |--------------------------------------------------------------------------
   | Audit Log
   |--------------------------------------------------------------------------
   */

    await this.prisma.documentLog.create({
      data: {
        documentId,
        userId: currentUser.userId,
        action: 'DOCUMENT_RETURNED',
        description: dto.remarks ?? 'Document returned',
      },
    });

    return returnRoute;
  }

  /*
     |--------------------------------------------------------------------------
     | Approve Document
     |--------------------------------------------------------------------------
     */
  async approveDocument(
    documentId: string,
    dto: DecisionDocumentDto,
    currentUser: AuthenticatedUser,
  ) {
    const approvedStatus = await this.prisma.documentStatus.findUnique({
      where: {
        name: 'APPROVED',
      },
    });

    if (!approvedStatus) {
      throw new Error('APPROVED status missing');
    }

    const document = await this.prisma.document.update({
      where: {
        id: documentId,
      },

      data: {
        currentStatusId: approvedStatus.id,
      },
    });

    await this.prisma.documentLog.create({
      data: {
        documentId,
        userId: currentUser.userId,
        action: 'DOCUMENT_APPROVED',
        description: dto.remarks,
      },
    });

    return document;
  }

  /*
     |--------------------------------------------------------------------------
     | Reject Document
     |--------------------------------------------------------------------------
     */
  async rejectDocument(
    documentId: string,
    dto: DecisionDocumentDto,
    currentUser: AuthenticatedUser,
  ) {
    const rejectedStatus = await this.prisma.documentStatus.findUnique({
      where: {
        name: 'REJECTED',
      },
    });

    if (!rejectedStatus) {
      throw new Error('REJECTED status missing');
    }

    const document = await this.prisma.document.update({
      where: {
        id: documentId,
      },

      data: {
        currentStatusId: rejectedStatus.id,
      },
    });

    await this.prisma.documentLog.create({
      data: {
        documentId,
        userId: currentUser.userId,
        action: 'DOCUMENT_REJECTED',
        description: dto.remarks,
      },
    });

    return document;
  }

  async getNextTrackingNumber() {
    return await this.generateTrackingNumber();
  }

  /*
 |--------------------------------------------------------------------------
 | TRACK DOCUMENT (PUBLIC)
 |--------------------------------------------------------------------------
 */

  async trackDocument(trackingNumber: string) {
    const document = await this.prisma.document.findUnique({
      where: {
        trackingNumber,
      },

      include: {
        documentType: true,
        currentStatus: true,
        currentOffice: {
          include: {
            organizationUnit: true,
          },
        },

        senderOffice: true,

        routes: {
          include: {
            fromOffice: {
              include: {
                organizationUnit: true,
              },
            },

            toOffice: {
              include: {
                organizationUnit: true,
              },
            },

            sentBy: {
              select: {
                firstName: true,
                lastName: true,
              },
            },

            receivedBy: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },

          orderBy: {
            sentAt: 'asc',
          },
        },
      },
    });

    if (!document || document.confidentialityLevel === 'CONFIDENTIAL') {
      throw new NotFoundException('Tracking number not found');
    }

    /*
   |--------------------------------------------------------------------------
   | RETURN SAFE PUBLIC DATA ONLY
   |--------------------------------------------------------------------------
   */

    return {
      trackingNumber: document.trackingNumber,
      title: document.title,
      description: document.description,
      referenceNumber: document.referenceNumber,
      priority: document.priority,
      classification: document.classification,
      createdAt: document.createdAt,
      deadline: document.deadline,
      documentType: document.documentType,
      currentStatus: document.currentStatus,
      currentOffice: document.currentOffice,
      routes: document.routes.map((route) => ({
        id: route.id,
        fromOffice: route.fromOffice,
        toOffice: route.toOffice,
        status: route.status,
        remarks: route.remarks,
        sentAt: route.sentAt,
        receivedAt: route.receivedAt,
        completedAt: route.completedAt,
        sentBy: route.sentBy,
        receivedBy: route.receivedBy,
      })),
    };
  }

  /*
|--------------------------------------------------------------------------
| DASHBOARD STATS
|--------------------------------------------------------------------------
*/

  async getDashboardStats(currentUser: AuthenticatedUser) {
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(now.getDate() - 14);

    const [
      incomingDocuments,
      outgoingDocuments,
      pendingDocuments,
      archivedDocuments,
    ] = await Promise.all([
      this.prisma.documentRoute.count({
        where: {
          toOfficeId: {
            in: currentUser.officeIds,
          },

          receivedAt: {
            not: null,
          },
        },
      }),

      this.prisma.documentRoute.count({
        where: {
          fromOfficeId: {
            in: currentUser.officeIds,
          },
        },
      }),

      this.prisma.document.count({
        where: {
          currentOfficeId: {
            in: currentUser.officeIds,
          },

          currentStatus: {
            name: {
              in: ['PENDING', 'FOR_REVIEW', 'FOR_APPROVAL', 'ON_PROCESS'],
            },
          },
        },
      }),

      this.prisma.document.count({
        where: {
          currentOfficeId: {
            in: currentUser.officeIds,
          },

          currentStatus: {
            name: 'COMPLETED',
          },
        },
      }),
    ]);

    const [currentIncomingWeek, previousIncomingWeek] = await Promise.all([
      this.prisma.documentRoute.count({
        where: {
          toOfficeId: {
            in: currentUser.officeIds,
          },

          receivedAt: {
            not: null,
            gte: sevenDaysAgo,
          },
        },
      }),

      this.prisma.documentRoute.count({
        where: {
          toOfficeId: {
            in: currentUser.officeIds,
          },

          receivedAt: {
            not: null,
            gte: fourteenDaysAgo,
            lt: sevenDaysAgo,
          },
        },
      }),
    ]);

    const incomingPercentage =
      previousIncomingWeek === 0
        ? currentIncomingWeek > 0
          ? 100
          : 0
        : Math.round(
            ((currentIncomingWeek - previousIncomingWeek) /
              previousIncomingWeek) *
              100,
          );

    const [currentOutgoingWeek, previousOutgoingWeek] = await Promise.all([
      this.prisma.documentRoute.count({
        where: {
          fromOfficeId: {
            in: currentUser.officeIds,
          },

          sentAt: {
            gte: sevenDaysAgo,
          },
        },
      }),

      this.prisma.documentRoute.count({
        where: {
          fromOfficeId: {
            in: currentUser.officeIds,
          },

          sentAt: {
            gte: fourteenDaysAgo,
            lt: sevenDaysAgo,
          },
        },
      }),
    ]);

    const outgoingPercentage =
      previousOutgoingWeek === 0
        ? 100
        : Math.round(
            ((currentOutgoingWeek - previousOutgoingWeek) /
              previousOutgoingWeek) *
              100,
          );

    const recentRoutes = await this.prisma.documentRoute.findMany({
      where: {
        OR: [
          { fromOfficeId: { in: currentUser.officeIds } },
          { toOfficeId: { in: currentUser.officeIds } },
        ],
      },
      include: {
        document: {
          include: {
            documentType: true,
            currentStatus: true,
          },
        },
        sentBy: true,
        receivedBy: true,
      },
    });

    const activities = [
      ...recentRoutes.map((r) => ({
        type: 'ROUTE',
        action: 'DOCUMENT_MOVED',
        documentId: r.document.id,
        title: r.document.title,
        trackingNumber: r.document.trackingNumber,
        status: r.document.currentStatus.name,
        from: r.fromOfficeId,
        to: r.toOfficeId,
        timestamp: r.sentAt,
      })),
    ];

    const recentActivities = activities
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, 3);

    const formattedRecentActivities = recentActivities.map((doc) => ({
      id: doc.documentId,
      title: doc.title,
      trackingNumber: doc.trackingNumber,
      status: doc.status,
    }));

    const totalDocuments = await this.prisma.document.count({
      where: {
        currentOfficeId: {
          in: currentUser.officeIds,
        },
      },
    });

    const completedRoutes = await this.prisma.documentRoute.findMany({
      where: {
        toOfficeId: {
          in: currentUser.officeIds,
        },

        status: 'COMPLETED',

        receivedAt: {
          not: null,
        },

        completedAt: {
          not: null,
        },
      },

      select: {
        receivedAt: true,
        completedAt: true,
      },
    });

    const totalReceivedRoutes = await this.prisma.documentRoute.count({
      where: {
        toOfficeId: {
          in: currentUser.officeIds,
        },
      },
    });

    const completedCount = completedRoutes.length;

    const completionRate =
      totalReceivedRoutes === 0
        ? 0
        : (completedCount / totalReceivedRoutes) * 100;

    const processingTimes = completedRoutes.map((route) => {
      const received = route.receivedAt!.getTime();
      const completed = route.completedAt!.getTime();

      return completed - received;
    });

    const averageProcessingTime =
      processingTimes.length === 0
        ? 0
        : processingTimes.reduce((sum, time) => sum + time, 0) /
          processingTimes.length;
    const averageProcessingDays = averageProcessingTime / (1000 * 60 * 60 * 24);

    const targetProcessingDays = 3;

    let timeEfficiency = 0;

    if (averageProcessingDays > 0) {
      timeEfficiency = (targetProcessingDays / averageProcessingDays) * 100;
    }

    // Maximum should only be 100%
    timeEfficiency = Math.min(timeEfficiency, 100);

    const processingEfficiency = Math.round(
      completionRate * 0.7 + timeEfficiency * 0.3,
    );

    const approvedDocuments = await this.prisma.document.count({
      where: {
        currentOfficeId: {
          in: currentUser.officeIds,
        },

        currentStatus: {
          name: 'APPROVED',
        },
      },
    });

    const approvalCompletion =
      totalDocuments === 0
        ? 0
        : Math.round((approvedDocuments / totalDocuments) * 100);

    const archivedRecords =
      totalDocuments === 0
        ? 0
        : Math.round((archivedDocuments / totalDocuments) * 100);

    return {
      incomingDocuments,
      outgoingDocuments,
      pendingDocuments,
      archivedDocuments,
      incomingPercentage,
      outgoingPercentage,
      recentActivities: formattedRecentActivities,

      performance: {
        processingEfficiency,
        approvalCompletion,
        archivedRecords,
      },
    };
  }

  /*
|--------------------------------------------------------------------------
| UPDATE DOCUMENT STATUS
|--------------------------------------------------------------------------
*/

  async updateDocumentStatus(
    documentId: string,
    statusName: string,
    currentUser: AuthenticatedUser,
  ) {
    /*
   |--------------------------------------------------------------------------
   | FIND STATUS
   |--------------------------------------------------------------------------
   */

    const status = await this.prisma.documentStatus.findUnique({
      where: {
        name: statusName,
      },
    });

    if (!status) {
      throw new NotFoundException('Status not found');
    }

    /*
   |--------------------------------------------------------------------------
   | UPDATE DOCUMENT
   |--------------------------------------------------------------------------
   */

    const updatedDocument = await this.prisma.document.update({
      where: {
        id: documentId,
      },

      data: {
        currentStatusId: status.id,
      },

      include: {
        currentStatus: true,
        currentOffice: true,
        documentType: true,
      },
    });

    /*
   |--------------------------------------------------------------------------
   | AUDIT LOG
   |--------------------------------------------------------------------------
   */

    await this.prisma.documentLog.create({
      data: {
        documentId,
        userId: currentUser.userId,
        action: 'STATUS_UPDATED',
        description: `Document marked as ${status.name}`,
      },
    });

    return updatedDocument;
  }

  /*
   |--------------------------------------------------------------------------
   | GET STATS
   |--------------------------------------------------------------------------
   */

  async getStats(currentUser: AuthenticatedUser) {
    const baseWhere = await this.buildDocumentWhere(currentUser);

    const [
      total,
      pending,
      urgent,
      archived,
      approved,
      outgoing,
      outgoingActiveRoute,
      activeRouting,
    ] = await Promise.all([
      // TOTAL
      this.prisma.document.count({
        where: baseWhere,
      }),

      // PENDING GROUP
      this.prisma.document.count({
        where: {
          ...baseWhere,
          currentStatus: {
            name: {
              in: ['PENDING', 'FOR_REVIEW', 'FOR_APPROVAL', 'ON_PROCESS'],
            },
          },
        },
      }),

      // URGENT
      this.prisma.document.count({
        where: {
          ...baseWhere,
          priority: {
            in: ['HIGH', 'URGENT'],
          },
        },
      }),

      // ARCHIVED
      this.prisma.document.count({
        where: {
          ...baseWhere,
          currentStatus: {
            name: 'COMPLETED',
          },
        },
      }),

      // APPROVED
      this.prisma.document.count({
        where: {
          ...baseWhere,
          currentStatus: {
            name: 'APPROVED',
          },
        },
      }),

      // OUTGOING
      this.prisma.documentRoute.count({
        where: {
          fromOfficeId: {
            in: currentUser.officeIds,
          },
        },
      }),

      this.prisma.documentRoute.count({
        where: {
          fromOfficeId: {
            in: currentUser.officeIds,
          },

          document: {
            currentStatus: {
              name: {
                in: [
                  'PENDING',
                  'FOR_REVIEW',
                  'FOR_APPROVAL',
                  'ON_PROCESS',
                  'IN_TRANSIT',
                ],
              },
            },
          },
        },
      }),

      // ACTIVE ROUTING
      this.prisma.document.count({
        where: {
          ...baseWhere,
          currentStatus: {
            name: {
              in: ['FOR_REVIEW', 'FOR_APPROVAL', 'ON_PROCESS'],
            },
          },
        },
      }),
    ]);

    return {
      total,
      pending,
      urgent,
      archived,
      approved,
      outgoing,
      outgoingActiveRoute,
      activeRouting,
    };
  }

  async searchDocuments(user: any, q: string) {
    if (!q || !q.trim()) {
      return [];
    }

    const query = q.trim();

    const documents = await this.prisma.document.findMany({
      where: {
        NOT: {
          confidentialityLevel: 'CONFIDENTIAL',
        },
        OR: [
          {
            trackingNumber: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            title: {
              contains: query,
              mode: 'insensitive',
            },
          },
        ],
        // OPTIONAL: if you want to restrict by office/user access
        // currentOfficeId: user.officeId,
      },
      select: {
        id: true,
        trackingNumber: true,
        title: true,
        currentStatusId: true,
        createdAt: true,
      },
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return documents;
  }
}
