import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import type { AuthenticatedUser } from '../common/types/authenticated-request.type';

import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { RouteDocumentDto } from './dto/route-document.dto';
import { ReturnDocumentDto } from './dto/return-document.dto';
import { DecisionDocumentDto } from './dto/decision-document.dto';
import { PublicUpdateDocumentStatusDto } from './dto/public-update-document-status.dto';
import { CreateDocumentActionDto } from './dto/create-document-action.dto';
import { UpdateDocumentActionDto } from './dto/update-document-action.dto';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import {
  Prisma,
  DocumentMonitoringCategory,
  DocumentRoutingProfile,
  DocumentSourceClass,
  InternalSourceScope,
} from '@prisma/client';

import * as path from 'node:path';
import { unlink } from 'node:fs/promises';

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

  private normalizeDocumentClassification(input: {
    sourceClass?: DocumentSourceClass | null;
    internalSourceScope?: InternalSourceScope | null;
    monitoringCategory?: DocumentMonitoringCategory | null;
  }) {
    const monitoringCategory =
      input.monitoringCategory ?? DocumentMonitoringCategory.GENERAL;

    const isSpecialExternalDocument =
      monitoringCategory === DocumentMonitoringCategory.PERMIT ||
      monitoringCategory === DocumentMonitoringCategory.SURVEY_RETURN;

    /*
     * PERMIT / SURVEY RETURN
     *
     * Always EXTERNAL
     * No internal source scope
     * Does not use the normal RED → ARD flow
     */
    if (isSpecialExternalDocument) {
      if (
        input.sourceClass &&
        input.sourceClass !== DocumentSourceClass.EXTERNAL
      ) {
        throw new BadRequestException(
          'Permits and Survey Returns must be classified as EXTERNAL',
        );
      }

      return {
        sourceClass: DocumentSourceClass.EXTERNAL,
        internalSourceScope: null,
        monitoringCategory,
        routingProfile: DocumentRoutingProfile.DIRECT_TO_ACTION_OFFICE,
      };
    }

    /*
     * INTERNAL
     */
    if (input.sourceClass === DocumentSourceClass.INTERNAL) {
      if (!input.internalSourceScope) {
        throw new BadRequestException(
          'Internal source scope is required for INTERNAL documents',
        );
      }

      if (monitoringCategory !== DocumentMonitoringCategory.GENERAL) {
        throw new BadRequestException(
          'INTERNAL documents must use GENERAL monitoring category',
        );
      }

      return {
        sourceClass: DocumentSourceClass.INTERNAL,
        internalSourceScope: input.internalSourceScope,
        monitoringCategory: DocumentMonitoringCategory.GENERAL,
        routingProfile: DocumentRoutingProfile.STANDARD,
      };
    }

    /*
     * EXTERNAL GENERAL
     */
    if (input.sourceClass === DocumentSourceClass.EXTERNAL) {
      return {
        sourceClass: DocumentSourceClass.EXTERNAL,
        internalSourceScope: null,
        monitoringCategory,
        routingProfile: DocumentRoutingProfile.STANDARD,
      };
    }

    /*
     * Transitional support for existing documents.
     *
     * sourceClass is still nullable while old records
     * have not yet been classified.
     */
    if (input.internalSourceScope) {
      throw new BadRequestException(
        'Internal source scope requires INTERNAL source classification',
      );
    }

    return {
      sourceClass: null,
      internalSourceScope: null,
      monitoringCategory,
      routingProfile: DocumentRoutingProfile.STANDARD,
    };
  }

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

  private async generateTrackingNumber(
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const year = new Date().getFullYear();

    const counter = await db.documentTrackingCounter.upsert({
      where: {
        year,
      },

      create: {
        year,
        lastNumber: 1,
      },

      update: {
        lastNumber: {
          increment: 1,
        },
      },

      select: {
        lastNumber: true,
      },
    });

    const sequence = String(counter.lastNumber).padStart(6, '0');

    return `DOC-${year}-${sequence}`;
  }

  private getStatusFromLog(description?: string | null) {
    if (!description) {
      return null;
    }

    const prefix = 'Document marked as ';

    if (!description.startsWith(prefix)) {
      return null;
    }

    return description.replace(prefix, '').trim();
  }

  /*
   |--------------------------------------------------------------------------
   | CREATE DOCUMENT
   |--------------------------------------------------------------------------
   */

  async create(
    dto: CreateDocumentDto,

    currentUser: AuthenticatedUser,
    tx?: Prisma.TransactionClient,
  ) {
    /*
     |--------------------------------------------------------------------------
     | Verify user belongs to office
     |--------------------------------------------------------------------------
     */
    const db = tx ?? this.prisma;

    const officeUser = await db.officeUser.findFirst({
      where: {
        userId: currentUser.userId,

        ...(dto.currentOfficeId
          ? {
              officeId: dto.currentOfficeId,
            }
          : {}),
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

    const trackingNumber = await this.generateTrackingNumber(db);

    /*
     |--------------------------------------------------------------------------
     | Get Default Status
     |--------------------------------------------------------------------------
     */

    const draftStatus = await db.documentStatus.findUnique({
      where: {
        name: 'DRAFT',
      },
    });

    if (!draftStatus) {
      throw new Error('DRAFT status not found');
    }

    /*
|--------------------------------------------------------------------------
| Validate Responsible Office
|--------------------------------------------------------------------------
*/

    if (dto.responsibleOfficeId) {
      const responsibleOffice = await db.office.findUnique({
        where: {
          id: dto.responsibleOfficeId,
        },
      });

      if (!responsibleOffice) {
        throw new BadRequestException('Responsible office not found');
      }
    }

    const classificationData = this.normalizeDocumentClassification({
      sourceClass: dto.sourceClass,
      internalSourceScope: dto.internalSourceScope,
      monitoringCategory: dto.monitoringCategory,
    });

    if (dto.senderOfficeId) {
      const senderOffice = await db.office.findUnique({
        where: {
          id: dto.senderOfficeId,
        },

        select: {
          id: true,
        },
      });

      if (!senderOffice) {
        throw new BadRequestException('Sender office not found');
      }
    }

    /*
     |--------------------------------------------------------------------------
     | Create Document
     |--------------------------------------------------------------------------
     */

    const document = await db.document.create({
      data: {
        trackingNumber,
        documentTypeId: dto.documentTypeId,
        currentStatusId: draftStatus.id,
        currentOfficeId: officeUser.officeId,
        sourceClass: classificationData.sourceClass,
        internalSourceScope: classificationData.internalSourceScope,
        monitoringCategory: classificationData.monitoringCategory,
        routingProfile: classificationData.routingProfile,
        title: dto.title,
        description: dto.description,
        referenceNumber: dto.referenceNumber,
        priority: dto.priority,
        confidentialityLevel: dto.confidentialityLevel,
        classification: dto.classification,
        deadline: dto.deadline,
        addressee: dto.addressee,
        responsibleOfficeId: dto.responsibleOfficeId || null,
        responsiblePerson: dto.responsiblePerson?.trim() || null,
        createdById: currentUser.userId,
        senderType: dto.senderType,
        senderOfficeId:
          dto.senderType === 'OFFICE' ? dto.senderOfficeId || null : null,
        senderName: dto.senderType === 'CLIENT' ? dto.senderName : null,
        senderOrganization:
          dto.senderType === 'COMPANY' || dto.senderType === 'AGENCY'
            ? dto.senderOrganization
            : null,
        senderContact:
          dto.senderType === 'AGENCY' ||
          dto.senderType === 'CLIENT' ||
          dto.senderType === 'COMPANY'
            ? dto.senderContact
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

    await db.documentLog.create({
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
    /*
  |--------------------------------------------------------------------------
  | Find Document
  |--------------------------------------------------------------------------
  */

    const document = await this.prisma.document.findUnique({
      where: {
        id,
      },

      include: {
        attachments: true,
        currentOffice: true,
      },
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

    /*
  |--------------------------------------------------------------------------
  | Validate Responsible Office
  |--------------------------------------------------------------------------
  |
  | Responsible office is optional.
  | Responsible person is also optional and is only a plain string.
  |
  */

    if (dto.responsibleOfficeId) {
      const responsibleOffice = await this.prisma.office.findUnique({
        where: {
          id: dto.responsibleOfficeId,
        },

        select: {
          id: true,
        },
      });

      if (!responsibleOffice) {
        throw new BadRequestException('Responsible office not found');
      }
    }

    /*
  |--------------------------------------------------------------------------
  | Separate Attachments and Responsibility Fields
  |--------------------------------------------------------------------------
  */

    const {
      attachments,

      responsibleOfficeId,
      responsiblePerson,

      sourceClass,
      internalSourceScope,
      monitoringCategory,

      senderOfficeId,
      senderType,
      senderName,
      senderOrganization,
      senderContact,

      ...documentData
    } = dto;

    const effectiveMonitoringCategory =
      monitoringCategory ?? document.monitoringCategory;

    const isSpecialExternalDocument =
      effectiveMonitoringCategory === DocumentMonitoringCategory.PERMIT ||
      effectiveMonitoringCategory === DocumentMonitoringCategory.SURVEY_RETURN;

    const effectiveSourceClass =
      sourceClass ??
      (isSpecialExternalDocument
        ? DocumentSourceClass.EXTERNAL
        : document.sourceClass);

    const effectiveInternalSourceScope =
      effectiveSourceClass === DocumentSourceClass.EXTERNAL
        ? null
        : internalSourceScope !== undefined
          ? internalSourceScope
          : document.internalSourceScope;

    const classificationData = this.normalizeDocumentClassification({
      sourceClass: effectiveSourceClass,
      internalSourceScope: effectiveInternalSourceScope,
      monitoringCategory: effectiveMonitoringCategory,
    });

    const isInternal =
      classificationData.sourceClass === DocumentSourceClass.INTERNAL;

    const isLocalCaraga =
      isInternal &&
      classificationData.internalSourceScope ===
        InternalSourceScope.LOCAL_CARAGA;

    const finalSenderType = isInternal
      ? 'OFFICE'
      : (senderType ?? document.senderType);

    let finalSenderOfficeId: string | null = null;

    if (isLocalCaraga) {
      finalSenderOfficeId = senderOfficeId ?? document.senderOfficeId;

      if (!finalSenderOfficeId) {
        throw new BadRequestException(
          'Originating DENR office is required for Local Caraga documents',
        );
      }

      const senderOffice = await this.prisma.office.findUnique({
        where: {
          id: finalSenderOfficeId,
        },

        select: {
          id: true,
        },
      });

      if (!senderOffice) {
        throw new BadRequestException('Originating DENR office not found');
      }
    }

    /*
  |--------------------------------------------------------------------------
  | Update Document Transaction
  |--------------------------------------------------------------------------
  */

    const updatedDocument = await this.prisma.$transaction(async (tx) => {
      /*
        |--------------------------------------------------------------------------
        | Update Document Information
        |--------------------------------------------------------------------------
        */

      await tx.document.update({
        where: {
          id,
        },

        data: {
          ...documentData,
          sourceClass: classificationData.sourceClass,

          internalSourceScope: classificationData.internalSourceScope,

          monitoringCategory: classificationData.monitoringCategory,

          routingProfile: classificationData.routingProfile,

          // ==========================================
          // SENDER
          // ==========================================

          senderType: finalSenderType,

          senderOfficeId: finalSenderOfficeId,

          ...(senderName !== undefined && {
            senderName: senderName?.trim() || null,
          }),

          ...(senderOrganization !== undefined && {
            senderOrganization: senderOrganization?.trim() || null,
          }),

          ...(senderContact !== undefined && {
            senderContact: senderContact?.trim() || null,
          }),

          /*
            |--------------------------------------------------------------------------
            | Responsible Office
            |--------------------------------------------------------------------------
            |
            | undefined = do not modify existing value
            | empty/null = remove responsible office
            | ID = assign responsible office
            |
            */

          ...(responsibleOfficeId !== undefined && {
            responsibleOfficeId: responsibleOfficeId || null,
          }),

          /*
            |--------------------------------------------------------------------------
            | Responsible Person
            |--------------------------------------------------------------------------
            |
            | This is intentionally a plain string.
            |
            | undefined = do not modify existing value
            | empty string = clear responsible person
            | string = save responsible person's name
            |
            */

          ...(responsiblePerson !== undefined && {
            responsiblePerson: responsiblePerson?.trim() || null,
          }),
        },
      });

      /*
        |--------------------------------------------------------------------------
        | Update Attachments
        |--------------------------------------------------------------------------
        |
        | attachments === undefined
        |   → Leave existing attachments unchanged
        |
        | attachments === []
        |   → Remove all attachments
        |
        | attachments contains files
        |   → Replace existing attachments
        |
        */

      if (attachments !== undefined) {
        /*
          |--------------------------------------------------------------------------
          | Remove Existing Attachment Records
          |--------------------------------------------------------------------------
          */

        await tx.documentAttachment.deleteMany({
          where: {
            documentId: id,
          },
        });

        /*
          |--------------------------------------------------------------------------
          | Create New Attachments
          |--------------------------------------------------------------------------
          */

        if (attachments.length > 0) {
          await tx.documentAttachment.createMany({
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
      }

      /*
        |--------------------------------------------------------------------------
        | Audit Log
        |--------------------------------------------------------------------------
        */

      await tx.documentLog.create({
        data: {
          documentId: id,

          userId: currentUser.userId,

          action: 'DOCUMENT_UPDATED',

          description: 'Document updated',
        },
      });

      /*
        |--------------------------------------------------------------------------
        | Return Updated Document
        |--------------------------------------------------------------------------
        */

      return tx.document.findUnique({
        where: {
          id,
        },

        include: {
          documentType: true,

          currentStatus: true,

          currentOffice: true,

          senderOffice: true,

          responsibleOffice: true,

          createdBy: true,

          attachments: true,
        },
      });
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
          in: [
            'PENDING',
            'FOR_REVIEW',
            'FOR_APPROVAL',
            'FOR_RELEASE',
            'ON_PROCESS',
            'APPROVED',
          ],
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
          responsibleOffice: true,
          attachments: true,
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
          logs: {
            where: {
              action: 'STATUS_UPDATED',
            },

            orderBy: {
              createdAt: 'asc',
            },

            select: {
              id: true,
              action: true,
              description: true,
              createdAt: true,
            },
          },
          actions: {
            orderBy: {
              createdAt: 'desc',
            },

            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  username: true,
                },
              },

              office: {
                select: {
                  id: true,
                  officeCode: true,
                  officeName: true,
                },
              },
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

    const formattedDocuments = documents.map((document) => {
      /*
    |--------------------------------------------------------------------------
    | DEFAULT STATUS
    |--------------------------------------------------------------------------
    |
    | Only used when there is no known
    | historical status yet.
    |
    */

      let lastKnownStatus = 'ON_PROCESS';

      const routes = document.routes.map((route, index) => {
        /*
          |--------------------------------------------------------------------------
          | WHEN DID THIS "FROM OFFICE" START HANDLING?
          |--------------------------------------------------------------------------
          */

        const previousRoute = index > 0 ? document.routes[index - 1] : null;

        const officeStartedAt =
          previousRoute?.receivedAt ??
          previousRoute?.sentAt ??
          document.createdAt;

        /*
          |--------------------------------------------------------------------------
          | FIND STATUS CHANGES MADE WHILE THIS OFFICE HAD THE DOCUMENT
          |--------------------------------------------------------------------------
          */

        const officeStatusLogs = document.logs.filter((log) => {
          const status = this.getStatusFromLog(log.description);

          if (!status) {
            return false;
          }

          const logTime = log.createdAt.getTime();

          return (
            logTime >= officeStartedAt.getTime() &&
            logTime <= route.sentAt.getTime()
          );
        });

        /*
          |--------------------------------------------------------------------------
          | EXPLICIT STATUS FROM THIS OFFICE
          |--------------------------------------------------------------------------
          */

        const latestOfficeStatusLog = officeStatusLogs.at(-1);

        const explicitStatus = this.getStatusFromLog(
          latestOfficeStatusLog?.description,
        );

        /*
         * Only change lastKnownStatus
         * when this office explicitly
         * changed the status.
         *
         * If undefined/null:
         * carry forward previous status.
         */
        if (explicitStatus) {
          lastKnownStatus = explicitStatus;
        }

        let documentStatus = lastKnownStatus;

        /*
          |--------------------------------------------------------------------------
          | CURRENT / LATEST DESTINATION
          |--------------------------------------------------------------------------
          |
          | Last route may already have been
          | received by the destination office,
          | but that office has not routed it yet.
          |
          | We therefore look for status updates
          | after the destination received it.
          |
          */

        const isLatestRoute = index === document.routes.length - 1;

        const isCurrentDestination =
          document.currentOfficeId === route.toOfficeId;

        if (isLatestRoute && isCurrentDestination) {
          const destinationStartedAt = route.receivedAt ?? route.sentAt;

          const destinationStatusLogs = document.logs.filter((log) => {
            const status = this.getStatusFromLog(log.description);

            if (!status) {
              return false;
            }

            return log.createdAt.getTime() >= destinationStartedAt.getTime();
          });

          const latestDestinationLog = destinationStatusLogs.at(-1);

          const destinationStatus = this.getStatusFromLog(
            latestDestinationLog?.description,
          );

          /*
           * Again, only replace if
           * there is an explicit status.
           */
          if (destinationStatus) {
            documentStatus = destinationStatus;

            lastKnownStatus = destinationStatus;
          }
        }

        return {
          ...route,

          /*
           * Keep route.status untouched.
           *
           * This new field represents
           * document workflow status.
           */
          documentStatus,
        };
      });

      return {
        ...document,

        routes,

        /*
         * Optional:
         * don't expose raw status logs
         * if frontend doesn't need them.
         */
        logs: undefined,
      };
    });

    /*
   |------------------------------------------------------------
   | RETURN
   |------------------------------------------------------------
   */

    return {
      data: formattedDocuments,

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
        name: {
          in: ['COMPLETED', 'END_TRANSACTION'],
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
        /*
         * Historical status changes
         */
        logs: {
          where: {
            action: 'STATUS_UPDATED',
          },

          orderBy: {
            createdAt: 'asc',
          },

          select: {
            id: true,
            action: true,
            description: true,
            createdAt: true,
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

    const getStatusFromLog = (description?: string | null) => {
      if (!description) {
        return null;
      }

      const prefix = 'Document marked as ';

      if (!description.startsWith(prefix)) {
        return null;
      }

      return description.replace(prefix, '').trim();
    };

    let lastKnownStatus = 'ON_PROCESS';

    const routes = document.routes.map((route, index) => {
      /*
    |--------------------------------------------------------------------------
    | OFFICE HANDLING START
    |--------------------------------------------------------------------------
    |
    | First office:
    | document.createdAt
    |
    | Following offices:
    | when the previous route was received
    |
    */

      const previousRoute = index > 0 ? document.routes[index - 1] : null;

      const officeStartedAt =
        previousRoute?.receivedAt ??
        previousRoute?.sentAt ??
        document.createdAt;

      /*
    |--------------------------------------------------------------------------
    | STATUS CHANGES MADE WHILE THIS OFFICE HAD THE DOCUMENT
    |--------------------------------------------------------------------------
    */

      const statusLogsInThisOffice = document.logs.filter((log) => {
        const status = getStatusFromLog(log.description);

        if (!status) {
          return false;
        }

        const logTime = log.createdAt.getTime();

        return (
          logTime >= officeStartedAt.getTime() &&
          logTime <= route.sentAt.getTime()
        );
      });

      /*
    |--------------------------------------------------------------------------
    | EXPLICIT STATUS
    |--------------------------------------------------------------------------
    |
    | If there is a status update during
    | this office's handling period,
    | use it — even if it is PENDING.
    |
    */

      const latestStatusLog = statusLogsInThisOffice.at(-1);

      const explicitStatus = getStatusFromLog(latestStatusLog?.description);

      if (explicitStatus) {
        lastKnownStatus = explicitStatus;
      }

      /*
    |--------------------------------------------------------------------------
    | NO STATUS UPDATE
    |--------------------------------------------------------------------------
    |
    | If explicitStatus is undefined/null,
    | lastKnownStatus stays unchanged.
    |
    */

      let documentStatus = lastKnownStatus;

      /*
    |--------------------------------------------------------------------------
    | CURRENT DESTINATION / LAST ROUTE
    |--------------------------------------------------------------------------
    |
    | The final destination may have changed
    | status after receiving the document,
    | but has not routed it again yet.
    |
    */

      const isLatestRoute = index === document.routes.length - 1;

      const isCurrentDestination =
        document.currentOfficeId === route.toOfficeId;

      if (isLatestRoute && isCurrentDestination) {
        const destinationStartedAt = route.receivedAt ?? route.sentAt;

        const destinationStatusLogs = document.logs.filter((log) => {
          const status = getStatusFromLog(log.description);

          if (!status) {
            return false;
          }

          return log.createdAt.getTime() >= destinationStartedAt.getTime();
        });

        const latestDestinationLog = destinationStatusLogs.at(-1);

        const destinationStatus = getStatusFromLog(
          latestDestinationLog?.description,
        );

        /*
         * Again:
         * only replace when there was
         * an explicit status update.
         */
        if (destinationStatus) {
          documentStatus = destinationStatus;

          lastKnownStatus = destinationStatus;
        }
      }

      return {
        id: route.id,

        fromOffice: route.fromOffice,

        toOffice: route.toOffice,

        routeStatus: route.status,

        documentStatus,

        remarks: route.remarks,

        sentAt: route.sentAt,

        receivedAt: route.receivedAt,

        completedAt: route.completedAt,

        sentBy: route.sentBy,

        receivedBy: route.receivedBy,
      };
    });

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
      routes,
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
          {
            fromOfficeId: {
              in: currentUser.officeIds,
            },
          },
          {
            toOfficeId: {
              in: currentUser.officeIds,
            },
          },
        ],
      },

      orderBy: {
        sentAt: 'desc',
      },

      take: 10,

      include: {
        document: {
          include: {
            documentType: true,
            currentStatus: true,
          },
        },

        fromOffice: {
          select: {
            id: true,
            officeCode: true,
            officeName: true,
          },
        },

        toOffice: {
          select: {
            id: true,
            officeCode: true,
            officeName: true,
          },
        },

        sentBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },

        receivedBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const recentActivities = recentRoutes
      .map((route) => {
        const isOutgoing = currentUser.officeIds.includes(route.fromOfficeId);

        const isIncoming = currentUser.officeIds.includes(route.toOfficeId);

        const direction = isOutgoing
          ? 'OUTGOING'
          : isIncoming
            ? 'INCOMING'
            : 'ROUTE';

        const actorName =
          [route.sentBy?.firstName, route.sentBy?.lastName]
            .filter(Boolean)
            .join(' ') ||
          route.sentBy?.username ||
          'Unknown user';

        return {
          /*
           * IMPORTANT:
           * Use route ID, not document ID.
           * One document may have many activity events.
           */
          id: route.id,

          documentId: route.document.id,

          type: 'ROUTE',

          action: 'DOCUMENT_ROUTED',

          direction,

          title: route.document.title,

          trackingNumber: route.document.trackingNumber,

          documentType: route.document.documentType?.name ?? 'N/A',

          /*
           * Route status is more meaningful
           * for this particular activity than
           * the document's global status.
           */
          status: route.status,

          globalStatus: route.document.currentStatus?.name ?? 'N/A',

          fromOffice: {
            id: route.fromOffice.id,

            officeCode: route.fromOffice.officeCode,

            officeName: route.fromOffice.officeName,
          },

          toOffice: {
            id: route.toOffice.id,

            officeCode: route.toOffice.officeCode,

            officeName: route.toOffice.officeName,
          },

          actor: {
            id: route.sentBy.id,

            name: actorName,
          },

          sentAt: route.sentAt,

          receivedAt: route.receivedAt,

          completedAt: route.completedAt,

          timestamp: route.sentAt,
        };
      })
      .slice(0, 3);

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
      recentActivities,

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

  async publicUpdateDocumentStatus(dto: PublicUpdateDocumentStatusDto) {
    const allowedStatuses = [
      'PENDING',
      'FOR_REVIEW',
      'FOR_APPROVAL',
      'ON_PROCESS',
      'FOR_RELEASE',
      'APPROVED',
      'REJECTED',
      'COMPLETED',
    ];

    const requestedStatus = dto.status.trim().toUpperCase();

    /*
  |--------------------------------------------------------------------------
  | RESTRICT STATUS VALUES
  |--------------------------------------------------------------------------
  */

    if (!allowedStatuses.includes(requestedStatus)) {
      throw new BadRequestException(
        `Status "${requestedStatus}" is not allowed.`,
      );
    }

    /*
  |--------------------------------------------------------------------------
  | FIND DOCUMENT
  |--------------------------------------------------------------------------
  */

    const document = await this.prisma.document.findUnique({
      where: {
        trackingNumber: dto.trackingNumber,
      },

      include: {
        currentStatus: true,

        currentOffice: true,
      },
    });

    if (!document) {
      throw new NotFoundException(
        `Document with tracking number ${dto.trackingNumber} was not found.`,
      );
    }

    /*
  |--------------------------------------------------------------------------
  | FIND STATUS
  |--------------------------------------------------------------------------
  */

    const status = await this.prisma.documentStatus.findUnique({
      where: {
        name: requestedStatus,
      },
    });

    if (!status) {
      throw new NotFoundException(
        `Document status "${requestedStatus}" does not exist.`,
      );
    }

    /*
  |--------------------------------------------------------------------------
  | NORMALIZE REMARKS
  |--------------------------------------------------------------------------
  */

    const remarks =
      dto.remarks !== undefined ? dto.remarks.trim() || null : undefined;

    /*
  |--------------------------------------------------------------------------
  | UPDATE
  |--------------------------------------------------------------------------
  */

    const result = await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      /*
        |--------------------------------------------------------------------------
        | FIND CURRENT ACTIVE ROUTE
        |--------------------------------------------------------------------------
        |
        | The external system's remarks belong to the route currently
        | being handled by the document's current office.
        |
        */

      const activeRoute = await tx.documentRoute.findFirst({
        where: {
          documentId: document.id,

          toOfficeId: document.currentOfficeId,

          status: {
            in: ['PENDING', 'RECEIVED'],
          },

          completedAt: null,
        },

        orderBy: {
          sentAt: 'desc',
        },
      });

      /*
        |--------------------------------------------------------------------------
        | UPDATE ROUTE REMARKS
        |--------------------------------------------------------------------------
        |
        | Only update remarks when remarks was actually included
        | in the request.
        |
        */

      if (activeRoute && remarks !== undefined) {
        await tx.documentRoute.update({
          where: {
            id: activeRoute.id,
          },

          data: {
            remarks,
          },
        });
      }

      /*
        |--------------------------------------------------------------------------
        | COMPLETE ACTIVE ROUTE
        |--------------------------------------------------------------------------
        */

      if (requestedStatus === 'COMPLETED' && activeRoute) {
        await tx.documentRoute.update({
          where: {
            id: activeRoute.id,
          },

          data: {
            status: 'COMPLETED',

            completedAt: now,

            /*
             * If remarks was passed,
             * save it at the same time.
             */
            ...(remarks !== undefined
              ? {
                  remarks,
                }
              : {}),
          },
        });
      }

      /*
        |--------------------------------------------------------------------------
        | UPDATE GLOBAL DOCUMENT STATUS
        |--------------------------------------------------------------------------
        */

      const updatedDocument = await tx.document.update({
        where: {
          id: document.id,
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
        | RETURN RESULT + ROUTE
        |--------------------------------------------------------------------------
        */

      return {
        document: updatedDocument,

        route: activeRoute
          ? await tx.documentRoute.findUnique({
              where: {
                id: activeRoute.id,
              },
            })
          : null,
      };
    });

    /*
  |--------------------------------------------------------------------------
  | RESPONSE
  |--------------------------------------------------------------------------
  */

    return {
      success: true,

      changed: document.currentStatusId !== status.id || remarks !== undefined,

      message: 'Document status updated successfully.',

      document: {
        id: result.document.id,

        trackingNumber: result.document.trackingNumber,

        title: result.document.title,

        status: result.document.currentStatus.name,

        currentOffice: result.document.currentOffice?.officeName ?? null,

        /*
         * Return what was actually
         * saved in the database.
         */
        remarks: result.route?.remarks ?? null,
      },
    };
  }

  /*
|--------------------------------------------------------------------------
| ADD DOCUMENT ACTION
|--------------------------------------------------------------------------
*/

  async addAction(
    documentId: string,
    dto: CreateDocumentActionDto,
    file: Express.Multer.File | undefined,
    currentUser: AuthenticatedUser,
  ) {
    /*
  |--------------------------------------------------------------------------
  | Find Document
  |--------------------------------------------------------------------------
  */

    const document = await this.prisma.document.findUnique({
      where: {
        id: documentId,
      },

      include: {
        currentStatus: true,
        currentOffice: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    /*
  |--------------------------------------------------------------------------
  | Check Current Office Access
  |--------------------------------------------------------------------------
  */

    const isSuperAdmin = currentUser.roles.includes('SUPER_ADMIN');

    const belongsToCurrentOffice = currentUser.officeIds.includes(
      document.currentOfficeId,
    );

    if (!isSuperAdmin && !belongsToCurrentOffice) {
      throw new ForbiddenException('You cannot add an action to this document');
    }

    /*
  |--------------------------------------------------------------------------
  | Document Must Be Received First
  |--------------------------------------------------------------------------
  */

    if (document.currentStatus?.name === 'IN_TRANSIT') {
      throw new BadRequestException(
        'Document must be received before an action can be added',
      );
    }

    /*
  |--------------------------------------------------------------------------
  | Completed Documents Cannot Be Modified
  |--------------------------------------------------------------------------
  */

    if (document.currentStatus?.name === 'COMPLETED') {
      throw new BadRequestException(
        'Cannot add an action to a completed document',
      );
    }

    /*
  |--------------------------------------------------------------------------
  | Validate Content
  |--------------------------------------------------------------------------
  */

    const comment = dto.comment?.trim() || null;

    if (!comment && !file) {
      throw new BadRequestException('Please provide a comment or attachment');
    }

    /*
  |--------------------------------------------------------------------------
  | Create Action
  |--------------------------------------------------------------------------
  */

    const action = await this.prisma.documentAction.create({
      data: {
        documentId,

        userId: currentUser.userId,

        officeId: document.currentOfficeId,

        comment,

        fileName: file?.originalname ?? null,

        filePath: file ? `/uploads/document-actions/${file.filename}` : null,

        fileType: file?.mimetype ?? null,
      },

      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },

        office: {
          select: {
            id: true,
            officeCode: true,
            officeName: true,
          },
        },
      },
    });

    return action;
  }

  async updateAction(
    documentId: string,
    actionId: string,
    dto: UpdateDocumentActionDto,
    file: Express.Multer.File | undefined,
    currentUser: AuthenticatedUser,
  ) {
    /*
  |--------------------------------------------------------------------------
  | Find Action
  |--------------------------------------------------------------------------
  */

    const action = await this.prisma.documentAction.findFirst({
      where: {
        id: actionId,
        documentId,
      },

      include: {
        document: {
          include: {
            currentStatus: true,
          },
        },
      },
    });

    if (!action) {
      throw new NotFoundException('Document action not found');
    }

    /*
  |--------------------------------------------------------------------------
  | Permission
  |--------------------------------------------------------------------------
  */

    const isSuperAdmin = currentUser.roles.includes('SUPER_ADMIN');

    const isOwner = action.userId === currentUser.userId;

    if (!isSuperAdmin && !isOwner) {
      throw new ForbiddenException('You cannot update this action');
    }

    /*
  |--------------------------------------------------------------------------
  | Completed Document
  |--------------------------------------------------------------------------
  */

    if (action.document.currentStatus?.name === 'COMPLETED') {
      throw new BadRequestException(
        'Cannot modify an action of a completed document',
      );
    }

    /*
  |--------------------------------------------------------------------------
  | Validate New Content
  |--------------------------------------------------------------------------
  */

    const comment = dto.comment?.trim() || null;

    /*
     * Existing attachment counts as content.
     */
    const hasExistingFile = Boolean(action.filePath);

    if (!comment && !file && !hasExistingFile) {
      throw new BadRequestException('Please provide a comment or attachment');
    }

    /*
  |--------------------------------------------------------------------------
  | Keep old file path before updating
  |--------------------------------------------------------------------------
  */

    const oldFilePath = action.filePath;

    /*
  |--------------------------------------------------------------------------
  | Update Action
  |--------------------------------------------------------------------------
  */

    const updatedAction = await this.prisma.documentAction.update({
      where: {
        id: action.id,
      },

      data: {
        comment,

        ...(file
          ? {
              fileName: file.originalname,

              filePath: `/uploads/document-actions/${file.filename}`,

              fileType: file.mimetype,
            }
          : {}),
      },

      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },

        office: {
          select: {
            id: true,
            officeCode: true,
            officeName: true,
          },
        },
      },
    });

    /*
  |--------------------------------------------------------------------------
  | Delete Previous Attachment
  |--------------------------------------------------------------------------
  |
  | Only after DB update succeeds.
  |
  */

    if (file && oldFilePath) {
      const oldFilename = path.basename(oldFilePath);

      const absolutePath = path.join(
        process.cwd(),
        'uploads',
        'document-actions',
        oldFilename,
      );

      await unlink(absolutePath).catch(() => undefined);
    }

    return updatedAction;
  }

  async deleteAction(
    documentId: string,
    actionId: string,
    currentUser: AuthenticatedUser,
  ) {
    /*
  |--------------------------------------------------------------------------
  | Find Action
  |--------------------------------------------------------------------------
  */

    const action = await this.prisma.documentAction.findFirst({
      where: {
        id: actionId,
        documentId,
      },

      include: {
        document: {
          include: {
            currentStatus: true,
          },
        },
      },
    });

    if (!action) {
      throw new NotFoundException('Document action not found');
    }

    /*
  |--------------------------------------------------------------------------
  | Permission
  |--------------------------------------------------------------------------
  */

    const isSuperAdmin = currentUser.roles.includes('SUPER_ADMIN');

    const isOwner = action.userId === currentUser.userId;

    if (!isSuperAdmin && !isOwner) {
      throw new ForbiddenException('You cannot delete this action');
    }

    /*
  |--------------------------------------------------------------------------
  | Completed Document
  |--------------------------------------------------------------------------
  */

    if (action.document.currentStatus?.name === 'COMPLETED') {
      throw new BadRequestException(
        'Cannot delete an action from a completed document',
      );
    }

    /*
  |--------------------------------------------------------------------------
  | Delete DB Record First
  |--------------------------------------------------------------------------
  */

    await this.prisma.documentAction.delete({
      where: {
        id: action.id,
      },
    });

    /*
  |--------------------------------------------------------------------------
  | Delete Physical File
  |--------------------------------------------------------------------------
  */

    if (action.filePath) {
      const filename = path.basename(action.filePath);

      const absolutePath = path.join(
        process.cwd(),
        'uploads',
        'document-actions',
        filename,
      );

      await unlink(absolutePath).catch(() => undefined);
    }

    return {
      success: true,

      message: 'Document action deleted successfully',

      actionId: action.id,
    };
  }

  async getRoutingSlipHistory(
    documentId: string,
    currentUser: AuthenticatedUser,
  ) {
    const document = await this.prisma.document.findUnique({
      where: {
        id: documentId,
      },

      include: {
        routes: {
          orderBy: {
            sentAt: 'asc',
          },

          include: {
            fromOffice: {
              select: {
                id: true,
                officeCode: true,
                officeName: true,
              },
            },

            toOffice: {
              select: {
                id: true,
                officeCode: true,
                officeName: true,
              },
            },
          },
        },

        actions: {
          orderBy: {
            createdAt: 'asc',
          },

          select: {
            id: true,
            officeId: true,
            comment: true,
            fileName: true,
            createdAt: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const isSuperAdmin = currentUser.roles.includes('SUPER_ADMIN');

    const hasOfficeAccess = currentUser.officeIds.some((officeId) =>
      document.routes.some(
        (route) =>
          route.fromOfficeId === officeId || route.toOfficeId === officeId,
      ),
    );

    if (
      !isSuperAdmin &&
      !hasOfficeAccess &&
      !currentUser.officeIds.includes(document.currentOfficeId)
    ) {
      throw new ForbiddenException('You cannot access this routing slip');
    }

    const routingHistory = document.routes.map((route, routeIndex) => {
      /*
        |--------------------------------------------------------------------------
        | FIND WHEN THE "FROM OFFICE" RECEIVED THE DOCUMENT
        |--------------------------------------------------------------------------
        |
        | For example:
        |
        | Records -> ORD
        |
        | We need Records' received date here,
        | NOT ORD's received date.
        |
        */

      const previousRoutes = document.routes.slice(0, routeIndex);

      const previousIncoming = [...previousRoutes]
        .reverse()
        .find(
          (previousRoute) =>
            previousRoute.toOfficeId === route.fromOfficeId &&
            previousRoute.receivedAt,
        );

      /*
       * First/origin office has no
       * previous incoming route.
       *
       * document.createdAt acts as
       * its initial received/recorded time.
       */
      const dateReceived =
        previousIncoming?.receivedAt ??
        (routeIndex === 0 ? document.createdAt : null);

      /*
        |--------------------------------------------------------------------------
        | ACTIONS TAKEN WHILE DOCUMENT WAS IN FROM OFFICE
        |--------------------------------------------------------------------------
        */

      const officeActions = document.actions.filter((action) => {
        if (action.officeId !== route.fromOfficeId) {
          return false;
        }

        /*
         * Action must happen before
         * this office released/routed
         * the document.
         */
        if (action.createdAt > route.sentAt) {
          return false;
        }

        /*
         * If we know when the office
         * received it, exclude actions
         * from an earlier visit.
         */
        if (dateReceived && action.createdAt < dateReceived) {
          return false;
        }

        return true;
      });

      return {
        id: route.id,

        fromOffice: {
          id: route.fromOffice.id,

          officeCode: route.fromOffice.officeCode,

          officeName: route.fromOffice.officeName,
        },

        dateReceived,

        toOffice: {
          id: route.toOffice.id,

          officeCode: route.toOffice.officeCode,

          officeName: route.toOffice.officeName,
        },

        /*
         * sentAt = when From Office
         * released/routed the document.
         */
        dateReleased: route.sentAt,

        routeRemarks: route.remarks ?? null,

        status: route.status,

        actions: officeActions.map((action) => ({
          id: action.id,

          comment: action.comment,

          fileName: action.fileName,

          createdAt: action.createdAt,
        })),
      };
    });

    return {
      documentId: document.id,

      trackingNumber: document.trackingNumber,

      routingHistory,
    };
  }
}
