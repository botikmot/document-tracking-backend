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

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

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

  async findAll(currentUser: AuthenticatedUser) {
    /*
   |------------------------------------------------------------
   | SUPER ADMIN
   |------------------------------------------------------------
   */

    if (currentUser.roles.includes('SUPER_ADMIN')) {
      return this.prisma.document.findMany({
        include: {
          documentType: true,
          currentStatus: true,
          currentOffice: true,
          createdBy: true,
          attachments: true,
        },

        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    /*
   |------------------------------------------------------------
   | GET USER OFFICES
   |------------------------------------------------------------
   */

    const officeUsers = await this.prisma.officeUser.findMany({
      where: {
        userId: currentUser.userId,
      },
    });

    const officeIds = officeUsers.map((office) => office.officeId);

    /*
   |------------------------------------------------------------
   | RETURN OFFICE DOCUMENTS ONLY
   |------------------------------------------------------------
   */

    return this.prisma.document.findMany({
      where: {
        currentOfficeId: {
          in: officeIds,
        },
      },

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
        attachments: true,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
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

    const updatedDocument = await this.prisma.document.update({
      where: {
        id,
      },

      data: dto,
    });

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

  async getIncomingDocuments(currentUser: AuthenticatedUser) {
    return this.prisma.documentRoute.findMany({
      where: {
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
      },

      include: {
        document: {
          include: {
            documentType: true,
            currentStatus: true,
            currentOffice: true,
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
    });
  }

  /*
     |--------------------------------------------------------------------------
     | Get Outgoing Documents
     |--------------------------------------------------------------------------
     */

  async getOutgoingDocuments(currentUser: AuthenticatedUser) {
    return this.prisma.documentRoute.findMany({
      where: {
        fromOfficeId: {
          in: currentUser.officeIds,
        },
      },

      include: {
        document: {
          include: {
            documentType: true,
            currentStatus: true,
            currentOffice: true,
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
    });
  }

  /*
     |--------------------------------------------------------------------------
     | Get Pending Documents
     |--------------------------------------------------------------------------
     */
  async getPendingDocuments(currentUser: AuthenticatedUser) {
    return this.prisma.document.findMany({
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

      include: {
        documentType: true,
        currentStatus: true,
        currentOffice: true,
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
    });
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

  async getArchivedDocuments(currentUser: AuthenticatedUser) {
    return this.prisma.document.findMany({
      where: {
        currentOfficeId: {
          in: currentUser.officeIds,
        },

        currentStatus: {
          name: 'COMPLETED',
        },
      },

      include: {
        documentType: true,
        currentStatus: true,
        currentOffice: true,
      },

      orderBy: {
        updatedAt: 'desc',
      },
    });
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

    if (!document) {
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
              in: ['PENDING', 'IN_REVIEW'],
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

    const recentActivities = await this.prisma.document.findMany({
      where: {
        currentOfficeId: {
          in: currentUser.officeIds,
        },
      },

      include: {
        currentStatus: true,
        documentType: true,
      },

      orderBy: {
        updatedAt: 'desc',
      },

      take: 5,
    });

    const formattedRecentActivities = recentActivities.map((doc) => ({
      id: doc.id,
      title: doc.title,
      trackingNumber: doc.trackingNumber,
      status: doc.currentStatus.name,
    }));

    const totalDocuments = await this.prisma.document.count({
      where: {
        currentOfficeId: {
          in: currentUser.officeIds,
        },
      },
    });

    const completedDocuments = await this.prisma.document.count({
      where: {
        currentOfficeId: {
          in: currentUser.officeIds,
        },

        currentStatus: {
          name: 'COMPLETED',
        },
      },
    });

    const processingEfficiency =
      totalDocuments === 0
        ? 0
        : Math.round((completedDocuments / totalDocuments) * 100);

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
}
