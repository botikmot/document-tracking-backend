import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ClientsService } from '../clients/clients.service';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

import { extname, join } from 'path';

import { randomUUID } from 'crypto';

import { CreateClientApplicationDto } from './dto/create-client-application.dto';
import { ClientApplicationAttachmentType, Prisma } from '@prisma/client';

import { ClientServiceTypesService } from '../client-service-types/client-service-types.service';
import { OfficeCategory, OrganizationType } from '@prisma/client';
import { DocumentsService } from '../documents/documents.service';
import { AcceptClientApplicationDto } from './dto/accept-client-application.dto';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { MailService } from '../mail/mail.service';

@Injectable()
export class ClientApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientsService: ClientsService,
    private readonly clientServiceTypesService: ClientServiceTypesService,
    private readonly documentsService: DocumentsService,
    private readonly mailService: MailService,
  ) {}

  private async getDefaultClientPortalReceivingOffice() {
    const recordsOffices = await this.prisma.office.findMany({
      where: {
        category: OfficeCategory.RECORDS,

        organizationUnit: {
          type: OrganizationType.REGIONAL,
        },
      },

      select: {
        id: true,
        officeCode: true,
        officeName: true,
        category: true,

        organizationUnit: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
          },
        },
      },

      take: 2,
    });

    if (recordsOffices.length === 0) {
      throw new InternalServerErrorException(
        'No Regional Records Office is configured.',
      );
    }

    if (recordsOffices.length > 1) {
      throw new InternalServerErrorException(
        'Multiple Regional Records Offices are configured. Only one Regional Records Office is expected.',
      );
    }

    return recordsOffices[0];
  }

  private async getAccessibleRecordsOfficeIds(
    user: AuthenticatedUser,
  ): Promise<string[] | null> {
    const isSuperAdmin = user.roles.includes('SUPER_ADMIN');

    /*
     * null means unrestricted access for SUPER_ADMIN.
     */
    if (isSuperAdmin) {
      return null;
    }

    if (!user.officeIds?.length) {
      throw new ForbiddenException('You are not assigned to an office.');
    }

    const recordsOffices = await this.prisma.office.findMany({
      where: {
        id: {
          in: user.officeIds,
        },

        category: 'RECORDS',
      },

      select: {
        id: true,
      },
    });

    if (!recordsOffices.length) {
      throw new ForbiddenException('Records Office access is required.');
    }

    return recordsOffices.map((office) => office.id);
  }

  private ensureRecordsWritePermission(user: AuthenticatedUser) {
    const allowedRoles = [
      'SUPER_ADMIN',
      'OFFICE_ADMIN',
      'SUPERVISOR',
      'ENCODER',
      'SECRETARY',
    ];

    const allowed = user.roles.some((role) => allowedRoles.includes(role));

    if (!allowed) {
      throw new ForbiddenException(
        'You do not have permission to process client applications.',
      );
    }
  }

  async create(clientId: string, dto: CreateClientApplicationDto) {
    /*
     * ------------------------------------------------------------
     * VERIFY CLIENT
     * ------------------------------------------------------------
     */
    await this.ensureClientCanUsePortal(clientId);

    /*
     * ------------------------------------------------------------
     * GET SELECTED SERVICE
     * ------------------------------------------------------------
     */
    const serviceType = await this.clientServiceTypesService.findActiveById(
      dto.serviceTypeId,
    );

    /*
     * ------------------------------------------------------------
     * GET DEFAULT RECEIVING OFFICE
     * ------------------------------------------------------------
     *
     * All Client Portal applications initially go to:
     *
     * REGIONAL + RECORDS
     */
    const receivingOffice = await this.getDefaultClientPortalReceivingOffice();

    /*
     * ------------------------------------------------------------
     * RELATED TRACKING NUMBER
     * ------------------------------------------------------------
     */
    const relatedTrackingNumber = dto.relatedTrackingNumber?.trim() || null;

    if (serviceType.requiresTrackingNumber && !relatedTrackingNumber) {
      throw new BadRequestException(
        'Tracking number is required for this service.',
      );
    }

    /*
     * ------------------------------------------------------------
     * VALIDATE EXISTING DOCUMENT
     * ------------------------------------------------------------
     */
    if (relatedTrackingNumber) {
      const document = await this.prisma.document.findUnique({
        where: {
          trackingNumber: relatedTrackingNumber,
        },

        select: {
          id: true,
          confidentialityLevel: true,
        },
      });

      if (!document || document.confidentialityLevel === 'CONFIDENTIAL') {
        throw new NotFoundException(
          'No document was found with the provided tracking number.',
        );
      }
    }

    /*
     * ------------------------------------------------------------
     * GENERATE CLIENT APPLICATION REFERENCE
     * ------------------------------------------------------------
     */
    const referenceNumber = await this.generateReferenceNumber();

    /*
     * ------------------------------------------------------------
     * CREATE DRAFT APPLICATION
     * ------------------------------------------------------------
     */
    return this.prisma.clientApplication.create({
      data: {
        clientId,

        serviceTypeId: serviceType.id,

        /*
         * Every new Client Portal transaction
         * initially goes to Regional Records.
         */
        receivingOfficeId: receivingOffice.id,

        referenceNumber,

        /*
         * Snapshot service information.
         *
         * Even if the service configuration changes
         * later, this application keeps its original
         * transaction information.
         */
        kind: serviceType.kind,

        transactionType: serviceType.name,

        title: dto.title.trim(),

        description: dto.description?.trim() || null,

        relatedTrackingNumber,

        status: 'DRAFT',

        submittedAt: null,
      },

      select: {
        id: true,

        referenceNumber: true,

        serviceTypeId: true,

        receivingOfficeId: true,

        kind: true,
        transactionType: true,

        title: true,
        description: true,

        relatedTrackingNumber: true,

        status: true,

        submittedAt: true,
        createdAt: true,

        receivingOffice: {
          select: {
            id: true,
            officeCode: true,
            officeName: true,

            category: true,

            organizationUnit: {
              select: {
                id: true,
                code: true,
                name: true,
                type: true,
              },
            },
          },
        },
      },
    });
  }

  async findAll(clientId: string) {
    await this.ensureClientCanUsePortal(clientId);

    return this.prisma.clientApplication.findMany({
      where: {
        clientId,
      },

      orderBy: {
        createdAt: 'desc',
      },

      include: {
        _count: {
          select: {
            attachments: true,
          },
        },
      },
    });
  }

  async findOne(clientId: string, applicationId: string) {
    await this.ensureClientCanUsePortal(clientId);

    const application = await this.prisma.clientApplication.findFirst({
      where: {
        id: applicationId,
        clientId,
      },

      include: {
        attachments: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found.');
    }

    return application;
  }

  private async ensureClientCanUsePortal(clientId: string) {
    const client = await this.clientsService.findById(clientId);

    if (!client) {
      throw new ForbiddenException('Client account not found.');
    }

    if (!client.emailVerifiedAt) {
      throw new ForbiddenException(
        'Please verify your email address before using the Client Portal.',
      );
    }

    if (client.status !== 'ACTIVE') {
      throw new ForbiddenException('Your account is currently inactive.');
    }

    return client;
  }

  private async generateReferenceNumber() {
    const year = new Date().getFullYear();

    const prefix = `EDATS-CL-${year}-`;

    const latest = await this.prisma.clientApplication.findFirst({
      where: {
        referenceNumber: {
          startsWith: prefix,
        },
      },

      orderBy: {
        referenceNumber: 'desc',
      },

      select: {
        referenceNumber: true,
      },
    });

    let nextNumber = 1;

    if (latest) {
      const currentNumber = Number.parseInt(
        latest.referenceNumber.replace(prefix, ''),
        10,
      );

      if (!Number.isNaN(currentNumber)) {
        nextNumber = currentNumber + 1;
      }
    }

    return `${prefix}${String(nextNumber).padStart(6, '0')}`;
  }

  async uploadAttachments(
    clientId: string,
    applicationId: string,
    files: Express.Multer.File[],
    type: ClientApplicationAttachmentType,
    requirementId?: string,
  ) {
    /*
     * ------------------------------------------------------------
     * 1. VERIFY CLIENT
     * ------------------------------------------------------------
     */
    await this.ensureClientCanUsePortal(clientId);

    /*
     * ------------------------------------------------------------
     * 2. GET APPLICATION + SERVICE CONFIG
     * ------------------------------------------------------------
     */
    const application = await this.prisma.clientApplication.findFirst({
      where: {
        id: applicationId,
        clientId,
      },

      include: {
        serviceType: {
          select: {
            id: true,
            name: true,

            allowsAttachments: true,
            requiresLetterRequest: true,

            isActive: true,
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found.');
    }

    /*
     * ------------------------------------------------------------
     * 3. SERVICE TYPE MUST EXIST
     * ------------------------------------------------------------
     */
    if (!application.serviceType) {
      throw new BadRequestException(
        'The service configuration for this application is no longer available.',
      );
    }

    /*
     * ------------------------------------------------------------
     * 4. CHECK IF SERVICE ALLOWS ATTACHMENTS
     * ------------------------------------------------------------
     */
    if (!application.serviceType.allowsAttachments) {
      throw new BadRequestException(
        'Attachments are not allowed for this service.',
      );
    }

    let requirement: {
      id: string;
      name: string;
      allowsMultiple: boolean;
    } | null = null;

    if (requirementId) {
      requirement = await this.prisma.clientServiceRequirement.findFirst({
        where: {
          id: requirementId,

          serviceTypeId: application.serviceType.id,

          isActive: true,
        },

        select: {
          id: true,
          name: true,
          allowsMultiple: true,
        },
      });

      if (!requirement) {
        throw new BadRequestException(
          'The selected document requirement is invalid for this service.',
        );
      }
    }

    /*
     * ------------------------------------------------------------
     * 5. CHECK APPLICATION STATUS
     * ------------------------------------------------------------
     *
     * Client may upload:
     *
     * DRAFT
     * → before initial submission
     *
     * ADDITIONAL_REQUIREMENTS
     * → when DENR asks for more documents
     */
    const allowedStatuses = ['DRAFT', 'ADDITIONAL_REQUIREMENTS'];

    if (!allowedStatuses.includes(application.status)) {
      throw new ConflictException(
        'Files cannot be uploaded to this application at its current status.',
      );
    }

    /*
     * ------------------------------------------------------------
     * 6. FILE MUST EXIST
     * ------------------------------------------------------------
     */
    if (!files?.length) {
      throw new BadRequestException('Please select at least one file.');
    }

    if (
      type === ClientApplicationAttachmentType.SUPPORTING_DOCUMENT &&
      requirement
    ) {
      if (!requirement.allowsMultiple && files.length > 1) {
        throw new BadRequestException(
          `Only one file may be uploaded for "${requirement.name}".`,
        );
      }

      if (!requirement.allowsMultiple) {
        const existingAttachment =
          await this.prisma.clientApplicationAttachment.findFirst({
            where: {
              applicationId,

              requirementId: requirement.id,
            },
          });

        if (existingAttachment) {
          throw new ConflictException(
            `A file has already been uploaded for "${requirement.name}".`,
          );
        }
      }
    }

    /*
     * ------------------------------------------------------------
     * 7. ONLY ONE LETTER REQUEST
     * ------------------------------------------------------------
     */
    if (type === ClientApplicationAttachmentType.LETTER_REQUEST) {
      const existingLetter =
        await this.prisma.clientApplicationAttachment.findFirst({
          where: {
            applicationId,

            type: ClientApplicationAttachmentType.LETTER_REQUEST,
          },
        });

      if (existingLetter) {
        throw new ConflictException(
          'A letter request has already been attached to this application.',
        );
      }

      if (files.length > 1) {
        throw new BadRequestException(
          'Only one letter request may be uploaded.',
        );
      }
    }

    /*
     * ------------------------------------------------------------
     * 8. CREATE APPLICATION UPLOAD DIRECTORY
     * ------------------------------------------------------------
     */
    const uploadDirectory = join(
      process.cwd(),
      'uploads',
      'client-applications',
      applicationId,
    );

    await mkdir(uploadDirectory, {
      recursive: true,
    });

    /*
     * Keep track of physical files in case database creation fails.
     */
    const writtenFiles: string[] = [];

    try {
      const attachmentData: Prisma.ClientApplicationAttachmentUncheckedCreateInput[] =
        [];

      /*
       * ------------------------------------------------------------
       * 9. SAVE FILES TO DISK
       * ------------------------------------------------------------
       */
      for (const file of files) {
        const extension = extname(file.originalname).toLowerCase();

        const fileName = `${randomUUID()}${extension}`;

        const absolutePath = join(uploadDirectory, fileName);

        await writeFile(absolutePath, file.buffer);

        writtenFiles.push(absolutePath);

        /*
         * Store relative path only.
         *
         * Better than saving:
         * F:\Projects\...
         *
         * because production server path can be different.
         */
        const relativePath = [
          'client-applications',
          applicationId,
          fileName,
        ].join('/');

        attachmentData.push({
          applicationId,

          requirementId: requirement?.id ?? null,

          type,

          fileName,

          originalName: file.originalname,

          filePath: relativePath,

          mimeType: file.mimetype,

          fileSize: file.size,
        });
      }

      /*
       * ------------------------------------------------------------
       * 10. SAVE ATTACHMENT RECORDS
       * ------------------------------------------------------------
       */
      const attachments = await this.prisma.$transaction(
        attachmentData.map((data) =>
          this.prisma.clientApplicationAttachment.create({
            data,
          }),
        ),
      );

      return {
        message:
          attachments.length === 1
            ? 'File uploaded successfully.'
            : 'Files uploaded successfully.',

        attachments,
      };
    } catch (error) {
      /*
       * ------------------------------------------------------------
       * 11. CLEANUP IF DATABASE SAVE FAILS
       * ------------------------------------------------------------
       */
      for (const filePath of writtenFiles) {
        if (existsSync(filePath)) {
          await unlink(filePath).catch(() => undefined);
        }
      }

      throw error;
    }
  }

  async submit(clientId: string, applicationId: string) {
    await this.ensureClientCanUsePortal(clientId);

    const application = await this.prisma.clientApplication.findFirst({
      where: {
        id: applicationId,
        clientId,
      },

      include: {
        serviceType: {
          select: {
            id: true,
            code: true,
            name: true,

            requiresLetterRequest: true,
            requiresTrackingNumber: true,
            allowsAttachments: true,

            isActive: true,

            requirements: {
              where: {
                isActive: true,
                isRequired: true,
              },

              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },

        attachments: {
          select: {
            id: true,
            type: true,
            requirementId: true,
            originalName: true,
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found.');
    }

    if (application.status !== 'DRAFT') {
      throw new ConflictException('Only draft applications can be submitted.');
    }

    if (!application.serviceType) {
      throw new BadRequestException(
        'The service configuration for this application is no longer available.',
      );
    }

    if (!application.serviceType.isActive) {
      throw new BadRequestException(
        'The selected service is currently unavailable.',
      );
    }

    /*
     * ------------------------------------------------------------
     * TRACKING NUMBER VALIDATION
     * ------------------------------------------------------------
     */
    if (
      application.serviceType.requiresTrackingNumber &&
      !application.relatedTrackingNumber?.trim()
    ) {
      throw new BadRequestException(
        'Tracking number is required for this service.',
      );
    }

    if (application.relatedTrackingNumber) {
      const relatedDocument = await this.prisma.document.findUnique({
        where: {
          trackingNumber: application.relatedTrackingNumber,
        },

        select: {
          id: true,
          confidentialityLevel: true,
        },
      });

      if (
        !relatedDocument ||
        relatedDocument.confidentialityLevel === 'CONFIDENTIAL'
      ) {
        throw new NotFoundException(
          'No document was found with the provided tracking number.',
        );
      }
    }

    /*
     * ------------------------------------------------------------
     * LETTER REQUEST VALIDATION
     * ------------------------------------------------------------
     */
    const hasLetterRequest = application.attachments.some(
      (attachment) =>
        attachment.type === ClientApplicationAttachmentType.LETTER_REQUEST,
    );

    if (application.serviceType.requiresLetterRequest && !hasLetterRequest) {
      throw new BadRequestException(
        'Please attach the required letter request before submitting.',
      );
    }

    /*
     * ------------------------------------------------------------
     * DYNAMIC REQUIRED DOCUMENT VALIDATION
     * ------------------------------------------------------------
     */

    const missingRequirements = application.serviceType.requirements.filter(
      (requirement) =>
        !application.attachments.some(
          (attachment) => attachment.requirementId === requirement.id,
        ),
    );

    if (missingRequirements.length > 0) {
      throw new BadRequestException({
        message: 'Please upload all required documents before submitting.',

        missingRequirements: missingRequirements.map((requirement) => ({
          id: requirement.id,
          code: requirement.code,
          name: requirement.name,
        })),
      });
    }

    /*
     * ------------------------------------------------------------
     * FINAL SUBMISSION
     * ------------------------------------------------------------
     */

    const submittedApplication = await this.prisma.clientApplication.update({
      where: {
        id: application.id,
      },

      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },

      include: {
        serviceType: {
          include: {
            requirements: {
              where: {
                isActive: true,
              },
            },
          },
        },

        attachments: {
          include: {
            requirement: true,
          },

          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    return {
      message: 'Application submitted successfully.',

      application: submittedApplication,
    };
  }

  async getAttachmentForDownload(
    clientId: string,
    applicationId: string,
    attachmentId: string,
  ) {
    await this.ensureClientCanUsePortal(clientId);

    const attachment = await this.prisma.clientApplicationAttachment.findFirst({
      where: {
        id: attachmentId,

        applicationId,

        application: {
          clientId,
        },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found.');
    }

    const absolutePath = join(process.cwd(), 'uploads', attachment.filePath);

    if (!existsSync(absolutePath)) {
      throw new NotFoundException('Attachment file not found.');
    }

    return {
      attachment,
      absolutePath,
    };
  }

  async findRecordsInbox(user: AuthenticatedUser) {
    const recordsOfficeIds = await this.getAccessibleRecordsOfficeIds(user);

    return this.prisma.clientApplication.findMany({
      where: {
        status: {
          in: [
            'SUBMITTED',
            'UNDER_REVIEW',
            'ADDITIONAL_REQUIREMENTS',
            'RESUBMITTED',
          ],
        },

        ...(recordsOfficeIds
          ? {
              receivingOfficeId: {
                in: recordsOfficeIds,
              },
            }
          : {}),
      },

      orderBy: [
        {
          submittedAt: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],

      select: {
        id: true,

        referenceNumber: true,

        kind: true,
        transactionType: true,

        title: true,

        status: true,

        submittedAt: true,
        resubmittedAt: true,

        receivingOfficeId: true,

        receivingOffice: {
          select: {
            id: true,
            officeCode: true,
            officeName: true,
            category: true,

            organizationUnit: {
              select: {
                id: true,
                code: true,
                name: true,
                type: true,
              },
            },
          },
        },

        client: {
          select: {
            id: true,

            firstName: true,
            middleName: true,
            lastName: true,
            suffix: true,

            email: true,
            mobileNumber: true,

            organizationName: true,
          },
        },

        serviceType: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },

        _count: {
          select: {
            attachments: true,
          },
        },
      },
    });
  }

  async findOneForRecords(user: AuthenticatedUser, applicationId: string) {
    const recordsOfficeIds = await this.getAccessibleRecordsOfficeIds(user);

    const application = await this.prisma.clientApplication.findFirst({
      where: {
        id: applicationId,

        ...(recordsOfficeIds
          ? {
              receivingOfficeId: {
                in: recordsOfficeIds,
              },
            }
          : {}),
      },

      include: {
        client: {
          select: {
            id: true,

            firstName: true,
            middleName: true,
            lastName: true,
            suffix: true,

            email: true,
            mobileNumber: true,
            address: true,

            organizationName: true,

            emailVerifiedAt: true,
          },
        },

        receivingOffice: {
          select: {
            id: true,
            officeCode: true,
            officeName: true,
            category: true,

            organizationUnit: {
              select: {
                id: true,
                code: true,
                name: true,
                type: true,
              },
            },
          },
        },

        serviceType: {
          include: {
            requirements: {
              where: {
                isActive: true,
              },

              orderBy: {
                name: 'asc',
              },
            },
          },
        },

        attachments: {
          orderBy: {
            createdAt: 'asc',
          },

          include: {
            requirement: {
              select: {
                id: true,
                code: true,
                name: true,
                description: true,

                isRequired: true,
                allowsMultiple: true,
              },
            },
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Client application not found.');
    }

    return application;
  }

  async startReview(user: AuthenticatedUser, applicationId: string) {
    this.ensureRecordsWritePermission(user);

    await this.findOneForRecords(user, applicationId);

    const application = await this.prisma.clientApplication.findUnique({
      where: {
        id: applicationId,
      },

      select: {
        id: true,
        status: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Client application not found.');
    }

    const allowedStatuses = ['SUBMITTED', 'RESUBMITTED'];

    if (!allowedStatuses.includes(application.status)) {
      throw new ConflictException(
        'This application cannot be moved to review from its current status.',
      );
    }

    return this.prisma.clientApplication.update({
      where: {
        id: applicationId,
      },

      data: {
        status: 'UNDER_REVIEW',

        reviewedAt: new Date(),
        reviewedByUserId: user.userId,
      },
    });
  }

  async requestAdditionalRequirements(
    user: AuthenticatedUser,
    applicationId: string,
    remarks: string,
  ) {
    this.ensureRecordsWritePermission(user);

    const application = await this.findOneForRecords(user, applicationId);

    if (application.status !== 'UNDER_REVIEW') {
      throw new ConflictException(
        'Additional requirements can only be requested while the application is under review.',
      );
    }

    const updatedApplication = await this.prisma.clientApplication.update({
      where: {
        id: applicationId,
      },

      data: {
        status: 'ADDITIONAL_REQUIREMENTS',

        additionalRequirementsRemarks: remarks.trim(),

        reviewedAt: new Date(),

        reviewedByUserId: user.userId,
      },
    });

    /*
     * Send email AFTER successful database update.
     */
    const emailSent =
      await this.mailService.sendClientAdditionalRequirementsEmail(
        application.client.email,
        application.client.firstName,
        application.transactionType,
        application.referenceNumber,
        remarks.trim(),
      );

    return {
      message: 'Additional requirements requested successfully.',

      emailSent,

      application: updatedApplication,
    };
  }

  async rejectForRecords(
    user: AuthenticatedUser,
    applicationId: string,
    reason: string,
  ) {
    this.ensureRecordsWritePermission(user);

    const application = await this.findOneForRecords(user, applicationId);

    const allowedStatuses = ['SUBMITTED', 'UNDER_REVIEW', 'RESUBMITTED'];

    if (!allowedStatuses.includes(application.status)) {
      throw new ConflictException(
        'This application cannot be rejected from its current status.',
      );
    }

    const rejectedApplication = await this.prisma.clientApplication.update({
      where: {
        id: applicationId,
      },

      data: {
        status: 'REJECTED',

        rejectionReason: reason.trim(),

        rejectedAt: new Date(),

        reviewedAt: new Date(),

        reviewedByUserId: user.userId,
      },
    });

    /*
     * Notify client after DB success.
     */
    const emailSent = await this.mailService.sendClientApplicationRejectedEmail(
      application.client.email,
      application.client.firstName,
      application.transactionType,
      application.referenceNumber,
      reason.trim(),
    );

    return {
      message: 'Client application rejected successfully.',
      emailSent,
      application: rejectedApplication,
    };
  }

  async acceptForRecords(
    user: AuthenticatedUser,
    applicationId: string,
    dto: AcceptClientApplicationDto,
  ) {
    /*
     * ------------------------------------------------------------
     * 1. CHECK RECORDS WRITE PERMISSION
     * ------------------------------------------------------------
     */
    this.ensureRecordsWritePermission(user);

    /*
     * ------------------------------------------------------------
     * 2. GET RECORDS OFFICES ACCESSIBLE TO USER
     * ------------------------------------------------------------
     *
     * null = unrestricted, e.g. SUPER_ADMIN
     */
    const recordsOfficeIds = await this.getAccessibleRecordsOfficeIds(user);

    /*
     * ------------------------------------------------------------
     * 3. DATABASE TRANSACTION
     * ------------------------------------------------------------
     *
     * Everything important happens together:
     *
     * - claim application
     * - create official Document
     * - create Document log
     * - link ClientApplication → Document
     *
     * If anything fails, everything rolls back.
     */
    const result = await this.prisma.$transaction(async (tx) => {
      /*
       * ------------------------------------------------------------
       * 4. CLAIM APPLICATION
       * ------------------------------------------------------------
       *
       * This prevents:
       *
       * - double-click Accept
       * - two Records users accepting at the same time
       * - duplicate official Documents
       */
      const claimed = await tx.clientApplication.updateMany({
        where: {
          id: applicationId,

          documentId: null,

          status: {
            in: ['UNDER_REVIEW', 'RESUBMITTED'],
          },

          ...(recordsOfficeIds
            ? {
                receivingOfficeId: {
                  in: recordsOfficeIds,
                },
              }
            : {}),
        },

        data: {
          status: 'ACCEPTED',

          acceptedAt: new Date(),

          reviewedAt: new Date(),

          reviewedByUserId: user.userId,

          reviewRemarks: dto.remarks?.trim() || null,
        },
      });

      if (claimed.count !== 1) {
        throw new ConflictException(
          'This application cannot be accepted or has already been processed.',
        );
      }

      /*
       * ------------------------------------------------------------
       * 5. GET COMPLETE CLIENT APPLICATION
       * ------------------------------------------------------------
       */
      const application = await tx.clientApplication.findUnique({
        where: {
          id: applicationId,
        },

        include: {
          client: {
            select: {
              id: true,

              firstName: true,
              middleName: true,
              lastName: true,
              suffix: true,

              email: true,
              mobileNumber: true,

              address: true,
              organizationName: true,
            },
          },

          receivingOffice: {
            select: {
              id: true,
              officeCode: true,
              officeName: true,
              category: true,
            },
          },

          serviceType: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },

          attachments: {
            orderBy: {
              createdAt: 'asc',
            },

            select: {
              id: true,

              fileName: true,
              originalName: true,

              filePath: true,
              mimeType: true,
              fileSize: true,

              type: true,
              requirementId: true,
            },
          },
        },
      });

      if (!application) {
        throw new NotFoundException('Client application not found.');
      }

      /*
       * ------------------------------------------------------------
       * 6. APPLICATION MUST HAVE RECEIVING OFFICE
       * ------------------------------------------------------------
       *
       * Client Portal applications should have already been
       * assigned automatically to Regional Records.
       */
      if (!application.receivingOfficeId) {
        throw new BadRequestException(
          'Receiving office is not configured for this application.',
        );
      }

      /*
       * ------------------------------------------------------------
       * 7. BUILD CLIENT FULL NAME
       * ------------------------------------------------------------
       */
      const clientFullName = [
        application.client.firstName,
        application.client.middleName,
        application.client.lastName,
        application.client.suffix,
      ]
        .filter(Boolean)
        .join(' ');

      /*
       * ------------------------------------------------------------
       * 8. BUILD CLIENT CONTACT
       * ------------------------------------------------------------
       */
      const senderContact = [
        application.client.mobileNumber,
        application.client.email,
      ]
        .filter(Boolean)
        .join(' / ');

      /*
       * ------------------------------------------------------------
       * 9. MAP CLIENT ATTACHMENTS TO DOCUMENT ATTACHMENTS
       * ------------------------------------------------------------
       *
       * Physical files are reused.
       *
       * ClientApplicationAttachment keeps its own records,
       * while DocumentAttachment gets separate database records.
       */
      const attachments = application.attachments.map((attachment) => ({
        fileName: attachment.originalName,

        filePath: attachment.filePath,

        mimeType: attachment.mimeType,

        fileSize: attachment.fileSize ?? undefined,
      }));

      /*
       * ------------------------------------------------------------
       * 10. CREATE OFFICIAL EDATS DOCUMENT
       * ------------------------------------------------------------
       *
       * Reuse DocumentsService.create() so:
       *
       * - same tracking number generator
       * - same DRAFT status
       * - same audit logging
       * - same attachment logic
       * - same existing eDATS workflow
       */
      const document = await this.documentsService.create(
        {
          documentTypeId: dto.documentTypeId,

          /*
           * Official Document starts at the
           * Records Office that received
           * the Client Portal application.
           */
          currentOfficeId: application.receivingOfficeId,

          title: application.title,

          description: application.description ?? undefined,

          /*
           * Keep original Client Portal
           * reference for traceability.
           *
           * Example:
           * EDATS-CL-2026-000025
           */
          referenceNumber: application.referenceNumber,

          priority: dto.priority,

          confidentialityLevel: dto.confidentialityLevel ?? 'INTERNAL',

          classification: dto.classification,

          deadline: undefined,

          addressee: dto.addressee,

          /*
           * Records does not determine the
           * final responsible office.
           *
           * ORD will determine it after routing.
           */
          responsibleOfficeId: undefined,

          responsiblePerson: undefined,

          /*
           * External sender
           */
          senderType: 'CLIENT',

          senderOfficeId: undefined,

          senderName: clientFullName,

          senderOrganization: application.client.organizationName ?? undefined,

          senderContact: senderContact || undefined,

          attachments,
        },

        user,

        /*
         * Pass same Prisma transaction.
         */
        tx,
      );

      /*
       * ------------------------------------------------------------
       * 11. LINK CLIENT APPLICATION → OFFICIAL DOCUMENT
       * ------------------------------------------------------------
       */
      const acceptedApplication = await tx.clientApplication.update({
        where: {
          id: application.id,
        },

        data: {
          documentId: document.id,
        },

        include: {
          client: {
            select: {
              id: true,

              firstName: true,
              lastName: true,

              email: true,
              mobileNumber: true,
            },
          },

          receivingOffice: {
            select: {
              id: true,
              officeCode: true,
              officeName: true,
            },
          },

          serviceType: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },

          document: {
            select: {
              id: true,
              trackingNumber: true,
              title: true,

              currentStatus: {
                select: {
                  id: true,
                  name: true,
                },
              },

              currentOffice: {
                select: {
                  id: true,
                  officeCode: true,
                  officeName: true,
                },
              },
            },
          },
        },
      });

      /*
       * ------------------------------------------------------------
       * 12. RETURN TRANSACTION RESULT
       * ------------------------------------------------------------
       */
      return {
        application: acceptedApplication,

        document,
      };
    });

    /*
     * ------------------------------------------------------------
     * 13. SEND ACCEPTANCE EMAIL
     * ------------------------------------------------------------
     *
     * IMPORTANT:
     *
     * Email is sent AFTER DB transaction commits.
     *
     * Therefore if Mailgun fails:
     *
     * - Document remains valid
     * - Application remains ACCEPTED
     * - DOC tracking number remains valid
     *
     * Client can still see it in the portal.
     */
    const emailSent = await this.mailService.sendClientApplicationAcceptedEmail(
      result.application.client.email,

      result.application.client.firstName,

      /*
       * Example:
       * Tree Cutting Permit
       */
      result.application.transactionType,

      /*
       * Client Portal reference
       */
      result.application.referenceNumber,

      /*
       * Official tracking number
       */
      result.document.trackingNumber,
    );

    /*
     * ------------------------------------------------------------
     * 14. FINAL RESPONSE
     * ------------------------------------------------------------
     */
    return {
      message:
        'Client application accepted and official document created successfully.',

      emailSent,

      application: {
        id: result.application.id,

        referenceNumber: result.application.referenceNumber,

        transactionType: result.application.transactionType,

        status: result.application.status,

        documentId: result.application.documentId,

        acceptedAt: result.application.acceptedAt,

        client: result.application.client,

        receivingOffice: result.application.receivingOffice,
      },

      document: {
        id: result.document.id,

        trackingNumber: result.document.trackingNumber,

        title: result.document.title,

        currentStatus: result.document.currentStatus,

        currentOffice: result.document.currentOffice,
      },
    };
  }

  async getAttachmentForRecordsDownload(
    user: AuthenticatedUser,
    applicationId: string,
    attachmentId: string,
  ) {
    const recordsOfficeIds = await this.getAccessibleRecordsOfficeIds(user);

    const attachment = await this.prisma.clientApplicationAttachment.findFirst({
      where: {
        id: attachmentId,

        applicationId,

        application: {
          ...(recordsOfficeIds
            ? {
                receivingOfficeId: {
                  in: recordsOfficeIds,
                },
              }
            : {}),
        },
      },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found.');
    }

    const absolutePath = join(process.cwd(), 'uploads', attachment.filePath);

    if (!existsSync(absolutePath)) {
      throw new NotFoundException('Attachment file not found.');
    }

    return {
      attachment,
      absolutePath,
    };
  }

  async resubmit(clientId: string, applicationId: string) {
    await this.ensureClientCanUsePortal(clientId);

    const application = await this.prisma.clientApplication.findFirst({
      where: {
        id: applicationId,
        clientId,
      },

      select: {
        id: true,
        status: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found.');
    }

    if (application.status !== 'ADDITIONAL_REQUIREMENTS') {
      throw new ConflictException(
        'Only applications requiring additional documents can be resubmitted.',
      );
    }

    return this.prisma.clientApplication.update({
      where: {
        id: applicationId,
      },

      data: {
        status: 'RESUBMITTED',
        resubmittedAt: new Date(),
      },
    });
  }
}
