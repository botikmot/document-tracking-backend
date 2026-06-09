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

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

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
        deadline: dto.deadline,
        createdById: currentUser.userId,
      },

      include: {
        documentType: true,
        currentStatus: true,
        currentOffice: true,
        createdBy: true,
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

    await this.prisma.document.update({
      where: {
        id: documentId,
      },

      data: {
        currentOfficeId: dto.toOfficeId,
        currentStatusId: inTransitStatus.id,
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
            in: ['PENDING', 'IN_REVIEW'],
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
}
