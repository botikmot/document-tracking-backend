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

type TrackingDocument = Prisma.DocumentGetPayload<{
  include: {
    documentType: true;
    currentStatus: true;
    currentOffice: {
      include: {
        organizationUnit: true;
      };
    };
    senderOffice: true;
    routes: {
      include: {
        fromOffice: {
          include: {
            organizationUnit: true;
          };
        };
        toOffice: {
          include: {
            organizationUnit: true;
          };
        };
        sentBy: {
          select: {
            firstName: true;
            lastName: true;
          };
        };
        receivedBy: {
          select: {
            firstName: true;
            lastName: true;
          };
        };
      };
    };
  };
}>;

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

  private mapTrackingResponse(document: TrackingDocument) {
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

  private async getRecordsOrganizationUnitIds(
    officeIds: string[],
  ): Promise<string[]> {
    const offices = await this.prisma.office.findMany({
      where: {
        id: {
          in: officeIds,
        },
        category: 'RECORDS',
      },
      select: {
        organizationUnitId: true,
      },
    });

    return offices.map((office) => office.organizationUnitId);
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
      include: { attachments: true, currentOffice: true },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    /*
|--------------------------------------------------------------------------
| Update Permission
|--------------------------------------------------------------------------
|
| Allowed:
| 1. Original creator
| 2. User belonging to ORD, while document is currently in ORD
|
*/

    const isCreator = document.createdById === currentUser.userId;

    const isDocumentInOrd = document.currentOffice?.officeCode === 'ORD';

    const ordOffice = await this.prisma.office.findFirst({
      where: {
        id: {
          in: currentUser.officeIds,
        },
        officeCode: 'ORD',
      },
      select: {
        id: true,
      },
    });

    const isOrdUser = Boolean(ordOffice);

    const canUpdate = isCreator || (isOrdUser && isDocumentInOrd);

    if (!canUpdate) {
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
  | FIND DOCUMENT
  |--------------------------------------------------------------------------
  */

    const document = await this.prisma.document.findUnique({
      where: {
        id: documentId,
      },

      include: {
        currentOffice: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    /*
  |--------------------------------------------------------------------------
  | VERIFY OFFICE ACCESS
  |--------------------------------------------------------------------------
  |
  | The user can only update the document status while the document
  | is currently assigned to one of the user's offices.
  |
  */

    const belongsToCurrentOffice = currentUser.officeIds.includes(
      document.currentOfficeId,
    );

    if (!belongsToCurrentOffice) {
      throw new ForbiddenException(
        'You cannot update the status of a document outside your office',
      );
    }

    /*
  |--------------------------------------------------------------------------
  | TIMESTAMP
  |--------------------------------------------------------------------------
  */

    const now = new Date();

    /*
  |--------------------------------------------------------------------------
  | TRANSACTION
  |--------------------------------------------------------------------------
  */

    const updatedDocument = await this.prisma.$transaction(async (tx) => {
      /*
        |--------------------------------------------------------------------------
        | COMPLETE CURRENT OFFICE ROUTE
        |--------------------------------------------------------------------------
        |
        | Example:
        |
        | Records -> ORD
        |
        | Once ORD receives the document:
        |
        | route.status = RECEIVED
        |
        | If ORD changes the document status to COMPLETED without routing
        | it onward, this incoming route must also become COMPLETED.
        |
        */

      if (status.name === 'COMPLETED') {
        const activeIncomingRoute = await tx.documentRoute.findFirst({
          where: {
            documentId,

            toOfficeId: document.currentOfficeId,

            status: 'RECEIVED',

            completedAt: null,
          },

          orderBy: {
            sentAt: 'desc',
          },

          select: {
            id: true,
          },
        });

        if (activeIncomingRoute) {
          await tx.documentRoute.update({
            where: {
              id: activeIncomingRoute.id,
            },

            data: {
              status: 'COMPLETED',

              completedAt: now,
            },
          });
        }
      }

      /*
        |--------------------------------------------------------------------------
        | UPDATE GLOBAL DOCUMENT STATUS
        |--------------------------------------------------------------------------
        */

      const updated = await tx.document.update({
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

      await tx.documentLog.create({
        data: {
          documentId,

          userId: currentUser.userId,

          action: 'STATUS_UPDATED',

          description: `Document marked as ${status.name}`,
        },
      });

      return updated;
    });

    /*
  |--------------------------------------------------------------------------
  | RETURN
  |--------------------------------------------------------------------------
  */

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

  async searchDocuments(user: AuthenticatedUser, q: string) {
    if (!q?.trim()) {
      return [];
    }

    const query = q.trim();

    // Organization Units where the user belongs to a RECORDS office
    const recordsOrganizationUnitIds = await this.getRecordsOrganizationUnitIds(
      user.officeIds,
    );

    const where: Prisma.DocumentWhereInput = {
      AND: [
        {
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
        },

        {
          OR: [
            /**
             * Non-confidential documents
             */
            {
              confidentialityLevel: null,
            },
            {
              confidentialityLevel: {
                not: 'CONFIDENTIAL',
              },
            },

            /**
             * Creator can always search their own confidential documents
             */
            {
              confidentialityLevel: 'CONFIDENTIAL',
              createdById: user.userId,
            },

            /**
             * RECORDS office within the SAME Organization Unit
             */
            {
              confidentialityLevel: 'CONFIDENTIAL',

              currentOffice: {
                organizationUnitId: {
                  in: recordsOrganizationUnitIds,
                },
              },
            },
          ],
        },
      ],
    };

    return this.prisma.document.findMany({
      where,

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
  }

  async getRecordsMonitoring(
    currentUser: AuthenticatedUser,
    query: {
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    /*
  |--------------------------------------------------------------------------
  | Pagination
  |--------------------------------------------------------------------------
  */

    const page = Math.max(Number(query.page ?? 1), 1);

    const limit = Math.min(Math.max(Number(query.limit ?? 10), 1), 100);

    const skip = (page - 1) * limit;

    const search = query.search?.trim() ?? '';

    const now = new Date();

    /*
  |--------------------------------------------------------------------------
  | Verify ORD Membership
  |--------------------------------------------------------------------------
  |
  | Records Monitoring is only available to users who belong to ORD.
  |
  */

    const ordMembership = await this.prisma.officeUser.findFirst({
      where: {
        userId: currentUser.userId,

        office: {
          officeCode: 'ORD',
        },
      },

      select: {
        officeId: true,

        office: {
          select: {
            id: true,
            officeCode: true,
            officeName: true,
            organizationUnitId: true,
          },
        },
      },
    });

    if (!ordMembership) {
      throw new ForbiddenException(
        'Only the Office of the Regional Director can access Records Monitoring',
      );
    }

    /*
  |--------------------------------------------------------------------------
  | Resolve Regional Records Office
  |--------------------------------------------------------------------------
  |
  | We find the Records Office that belongs to the same organization unit
  | as ORD. This avoids accidentally monitoring PENRO/CENRO Records offices.
  |
  */

    const recordsOffice = await this.prisma.office.findFirst({
      where: {
        category: 'RECORDS',
        organizationUnitId: ordMembership.office.organizationUnitId,
      },

      select: {
        id: true,
        officeCode: true,
        officeName: true,
        organizationUnitId: true,
      },
    });

    if (!recordsOffice) {
      throw new NotFoundException('Regional Records Office not found');
    }

    const recordsOfficeId = recordsOffice.id;

    /*
  |--------------------------------------------------------------------------
  | Records Monitoring Scope
  |--------------------------------------------------------------------------
  |
  | Include a document when:
  |
  | 1. It is currently in Records
  | 2. It has been routed TO Records
  | 3. It has been routed FROM Records
  |
  | This preserves historical Records visibility even after the document
  | has already moved to ORD, PMD, ICT, or another office.
  |
  */

    const recordsScopeWhere: Prisma.DocumentWhereInput = {
      OR: [
        {
          currentOfficeId: recordsOfficeId,
        },

        {
          routes: {
            some: {
              OR: [
                {
                  toOfficeId: recordsOfficeId,
                },

                {
                  fromOfficeId: recordsOfficeId,
                },
              ],
            },
          },
        },
      ],
    };

    /*
  |--------------------------------------------------------------------------
  | Search
  |--------------------------------------------------------------------------
  */

    const searchWhere: Prisma.DocumentWhereInput | undefined = search
      ? {
          OR: [
            {
              trackingNumber: {
                contains: search,
                mode: 'insensitive',
              },
            },

            {
              title: {
                contains: search,
                mode: 'insensitive',
              },
            },

            {
              referenceNumber: {
                contains: search,
                mode: 'insensitive',
              },
            },

            {
              senderName: {
                contains: search,
                mode: 'insensitive',
              },
            },

            {
              senderOrganization: {
                contains: search,
                mode: 'insensitive',
              },
            },

            {
              addressee: {
                contains: search,
                mode: 'insensitive',
              },
            },
          ],
        }
      : undefined;

    const where: Prisma.DocumentWhereInput = {
      AND: [recordsScopeWhere, ...(searchWhere ? [searchWhere] : [])],
    };

    /*
  |--------------------------------------------------------------------------
  | Query Documents
  |--------------------------------------------------------------------------
  */

    const [documents, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,

        skip,
        take: limit,

        orderBy: {
          createdAt: 'desc',
        },

        include: {
          documentType: true,

          currentStatus: true,

          currentOffice: true,

          senderOffice: true,

          createdBy: true,

          routes: {
            orderBy: {
              sentAt: 'asc',
            },

            include: {
              fromOffice: true,

              toOffice: true,

              sentBy: {
                select: {
                  id: true,
                  username: true,
                },
              },

              receivedBy: {
                select: {
                  id: true,
                  username: true,
                },
              },
            },
          },
        },
      }),

      this.prisma.document.count({
        where,
      }),
    ]);

    /*
  |--------------------------------------------------------------------------
  | Transform Documents
  |--------------------------------------------------------------------------
  */

    const data = documents.map((document) => {
      /*
      |--------------------------------------------------------------------------
      | Records-related Routes
      |--------------------------------------------------------------------------
      */

      const recordsRoutes = document.routes.filter(
        (route) =>
          route.toOfficeId === recordsOfficeId ||
          route.fromOfficeId === recordsOfficeId,
      );

      const incomingToRecords = document.routes.filter(
        (route) => route.toOfficeId === recordsOfficeId,
      );

      const outgoingFromRecords = document.routes.filter(
        (route) => route.fromOfficeId === recordsOfficeId,
      );

      const latestIncoming =
        incomingToRecords.length > 0
          ? incomingToRecords[incomingToRecords.length - 1]
          : null;

      const latestOutgoing =
        outgoingFromRecords.length > 0
          ? outgoingFromRecords[outgoingFromRecords.length - 1]
          : null;

      /*
      |--------------------------------------------------------------------------
      | Records Status
      |--------------------------------------------------------------------------
      */

      let recordsStatus:
        | 'AWAITING_RECEIPT'
        | 'IN_CUSTODY'
        | 'COMPLETED'
        | 'RETURNED'
        | 'UNKNOWN' = 'UNKNOWN';

      /*
       * Document is currently with Records.
       */
      if (document.currentOfficeId === recordsOfficeId) {
        /*
         * Routed to Records but Records
         * has not received it yet.
         */
        if (latestIncoming && !latestIncoming.receivedAt) {
          recordsStatus = 'AWAITING_RECEIPT';
        } else {
          /*
           * Received by Records or
           * originally created there.
           */
          recordsStatus = 'IN_CUSTODY';
        }
      } else {
        /*
         * Determine the latest Records
         * routing activity.
         */

        const latestIncomingTime = latestIncoming
          ? latestIncoming.sentAt.getTime()
          : 0;

        const latestOutgoingTime = latestOutgoing
          ? latestOutgoing.sentAt.getTime()
          : 0;

        /*
         * Returned route is the latest
         * Records activity.
         */
        if (
          latestIncoming &&
          latestIncoming.status === 'RETURNED' &&
          latestIncomingTime >= latestOutgoingTime
        ) {
          recordsStatus = 'RETURNED';
        } else if (latestOutgoing) {
          /*
           * Records routed the document
           * onward, therefore Records'
           * handling is complete.
           */
          recordsStatus = 'COMPLETED';
        } else if (latestIncoming) {
          /*
           * Historical incoming route but
           * document is no longer currently
           * assigned to Records.
           */
          recordsStatus = latestIncoming.completedAt ? 'COMPLETED' : 'UNKNOWN';
        }
      }

      /*
      |--------------------------------------------------------------------------
      | Time in Records
      |--------------------------------------------------------------------------
      |
      | Receiving Records:
      | receivedAt -> completedAt
      |
      | Currently held:
      | receivedAt -> now
      |
      | Originating Records document:
      | document.createdAt -> first outgoing sentAt
      |
      | If a document enters Records more than once, custody periods are added.
      |
      */

      let timeInRecordsMs = 0;

      let hasRecordsCustodyPeriod = false;

      /*
       * Check whether the document originated
       * in Records.
       *
       * If the very first route in the entire
       * document history starts FROM Records,
       * Records was effectively the origin office.
       */
      const firstRoute = document.routes.length > 0 ? document.routes[0] : null;

      const originatedInRecords = firstRoute?.fromOfficeId === recordsOfficeId;

      if (originatedInRecords && firstRoute) {
        timeInRecordsMs += Math.max(
          firstRoute.sentAt.getTime() - document.createdAt.getTime(),
          0,
        );

        hasRecordsCustodyPeriod = true;
      }

      /*
       * Incoming custody periods.
       */
      for (const route of incomingToRecords) {
        if (!route.receivedAt) {
          continue;
        }

        const start = route.receivedAt.getTime();

        let end: number;

        if (route.completedAt) {
          end = route.completedAt.getTime();
        } else if (document.currentOfficeId === recordsOfficeId) {
          end = now.getTime();
        } else {
          /*
           * No completedAt and document is
           * no longer in Records.
           *
           * Try to find the next outgoing
           * route from Records occurring
           * after this receipt.
           */
          const nextOutgoing = outgoingFromRecords.find(
            (outgoing) => outgoing.sentAt.getTime() >= start,
          );

          end = nextOutgoing ? nextOutgoing.sentAt.getTime() : start;
        }

        timeInRecordsMs += Math.max(end - start, 0);

        hasRecordsCustodyPeriod = true;
      }

      /*
       * Local Records document that has
       * never been routed.
       */
      if (
        document.currentOfficeId === recordsOfficeId &&
        document.routes.length === 0
      ) {
        timeInRecordsMs = Math.max(
          now.getTime() - document.createdAt.getTime(),
          0,
        );

        hasRecordsCustodyPeriod = true;
      }

      /*
      |--------------------------------------------------------------------------
      | Records Received At
      |--------------------------------------------------------------------------
      */

      const recordsReceivedAt =
        latestIncoming?.receivedAt ??
        (originatedInRecords ? document.createdAt : null);

      /*
      |--------------------------------------------------------------------------
      | Records Completed At
      |--------------------------------------------------------------------------
      */

      let recordsCompletedAt: Date | null = null;

      if (latestOutgoing && document.currentOfficeId !== recordsOfficeId) {
        recordsCompletedAt = latestOutgoing.sentAt;
      } else if (latestIncoming?.completedAt) {
        recordsCompletedAt = latestIncoming.completedAt;
      }

      /*
      |--------------------------------------------------------------------------
      | Deadline
      |--------------------------------------------------------------------------
      */

      const isOverdue = Boolean(
        document.deadline &&
        document.currentOfficeId === recordsOfficeId &&
        document.deadline.getTime() < now.getTime() &&
        document.currentStatus?.name !== 'COMPLETED',
      );

      const allottedTimeMs = document.deadline
        ? Math.max(
            document.deadline.getTime() - document.createdAt.getTime(),
            0,
          )
        : null;

      /*
      |--------------------------------------------------------------------------
      | Last Records Route
      |--------------------------------------------------------------------------
      */

      const lastRecordsRoute =
        recordsRoutes.length > 0
          ? recordsRoutes[recordsRoutes.length - 1]
          : null;

      /*
      |--------------------------------------------------------------------------
      | Return
      |--------------------------------------------------------------------------
      */

      return {
        /*
         * Existing document data.
         */
        id: document.id,

        trackingNumber: document.trackingNumber,

        title: document.title,

        description: document.description,

        referenceNumber: document.referenceNumber,

        addressee: document.addressee,

        senderType: document.senderType,

        senderName: document.senderName,

        senderOrganization: document.senderOrganization,

        senderContact: document.senderContact,

        priority: document.priority,

        classification: document.classification,

        confidentialityLevel: document.confidentialityLevel,

        deadline: document.deadline,

        createdAt: document.createdAt,

        createdBy: document.createdBy,

        updatedAt: document.updatedAt,

        documentType: document.documentType,

        currentStatus: document.currentStatus,

        currentOffice: document.currentOffice,

        senderOffice: document.senderOffice,

        /*
         * Full routing history is useful
         * for the ORD timeline drawer.
         *
         * User passwordHash is NOT exposed
         * because sentBy/receivedBy use select.
         */
        routes: document.routes,

        /*
         |--------------------------------------------------------------------------
         | Records Monitoring Metadata
         |--------------------------------------------------------------------------
         */

        recordsMonitoring: {
          recordsOffice: {
            id: recordsOffice.id,

            officeCode: recordsOffice.officeCode,

            officeName: recordsOffice.officeName,
          },

          status: recordsStatus,

          currentlyInRecords: document.currentOfficeId === recordsOfficeId,

          isOverdue,

          allottedTimeMs,

          timeInRecordsMs: hasRecordsCustodyPeriod ? timeInRecordsMs : null,

          receivedAt: recordsReceivedAt,

          completedAt: recordsCompletedAt,

          lastRoutedFrom: latestIncoming?.fromOffice?.officeName ?? null,

          lastRoutedTo: latestOutgoing?.toOffice?.officeName ?? null,

          routedFromRecordsAt: latestOutgoing?.sentAt ?? null,

          transactionCount: recordsRoutes.length,

          lastTransactionAt: lastRecordsRoute
            ? (lastRecordsRoute.completedAt ??
              lastRecordsRoute.receivedAt ??
              lastRecordsRoute.sentAt)
            : document.createdAt,
        },
      };
    });

    /*
  |--------------------------------------------------------------------------
  | Return
  |--------------------------------------------------------------------------
  */

    return {
      recordsOffice: {
        id: recordsOffice.id,

        officeCode: recordsOffice.officeCode,

        officeName: recordsOffice.officeName,
      },

      data,

      meta: {
        page,
        limit,
        total,

        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getDocumentByTrackingNumber(
    user: AuthenticatedUser,
    trackingNumber: string,
  ) {
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

    if (!document) {
      throw new NotFoundException('Tracking number not found');
    }

    // ------------------------------
    // Confidential Access
    // ------------------------------

    if (document.confidentialityLevel === 'CONFIDENTIAL') {
      const recordsOrganizationUnitIds =
        await this.getRecordsOrganizationUnitIds(user.officeIds);

      const isCreator = document.createdById === user.userId;

      const isRecords = recordsOrganizationUnitIds.includes(
        document.currentOffice.organizationUnitId,
      );

      if (!isCreator && !isRecords) {
        throw new ForbiddenException(
          'You are not allowed to access this confidential document.',
        );
      }
    }

    return this.mapTrackingResponse(document);
  }
}
