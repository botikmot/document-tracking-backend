import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  DocumentMonitoringCategory,
  DocumentSourceClass,
  OrganizationType,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { TransactionQueryDto } from './dto/transaction-query.dto';
import {
  OfficeTransactionDocumentsQueryDto,
  type OfficeTransactionBucket,
} from './dto/office-transaction-documents-query.dto';

/*
|--------------------------------------------------------------------------
| AUTHENTICATED USER
|--------------------------------------------------------------------------
|
| Match this with your existing auth user type
| if naa na kay centralized interface.
|
*/

type AuthenticatedUser = {
  userId: string;

  username?: string;

  roles: string[];

  officeIds: string[];
};

/*
|--------------------------------------------------------------------------
| TERMINAL DOCUMENT STATUSES
|--------------------------------------------------------------------------
*/

const TERMINAL_DOCUMENT_STATUSES = new Set(['COMPLETED', 'END_TRANSACTION']);

/*
|--------------------------------------------------------------------------
| TRANSACTION ACCESS
|--------------------------------------------------------------------------
|
| ORED is explicitly allowed.
|
| Assistant Regional Director offices
| are also detected by office name.
|
| Additional office codes can later
| be placed in .env:
|
| TRANSACTIONS_ALLOWED_OFFICE_CODES=
| ORED,ARD-MS,ARD-TS
|
*/

const DEFAULT_ALLOWED_OFFICE_CODES = new Set([
  'ORD',
  'RO-ARD-ADMIN',
  'RO-ARD-TECH',
]);

/*
|--------------------------------------------------------------------------
| DOCUMENT INCLUDE
|--------------------------------------------------------------------------
*/

const transactionDocumentInclude = {
  currentStatus: true,

  currentOffice: {
    include: {
      organizationUnit: true,
    },
  },

  documentType: true,

  responsibleOffice: true,

  createdBy: {
    include: {
      offices: {
        include: {
          office: {
            include: {
              organizationUnit: true,
            },
          },
        },
      },
    },
  },

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
    },

    orderBy: {
      sentAt: 'asc',
    },
  },

  actions: {
    select: {
      id: true,
      officeId: true,
      comment: true,
      createdAt: true,
    },

    orderBy: {
      createdAt: 'asc',
    },
  },
} satisfies Prisma.DocumentInclude;

type TransactionDocument = Prisma.DocumentGetPayload<{
  include: typeof transactionDocumentInclude;
}>;

/*
|--------------------------------------------------------------------------
| TRANSACTION TIMELINE INCLUDE
|--------------------------------------------------------------------------
|
| Richer include used only when opening
| one document's complete transaction history.
|
*/

const transactionTimelineInclude = {
  ...transactionDocumentInclude,

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
          id: true,
          firstName: true,
          lastName: true,
          username: true,
        },
      },

      receivedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
        },
      },
    },

    orderBy: {
      sentAt: 'asc',
    },
  },

  actions: {
    include: {
      office: {
        include: {
          organizationUnit: true,
        },
      },

      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
        },
      },
    },

    orderBy: {
      createdAt: 'asc',
    },
  },

  logs: {
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
        },
      },
    },

    orderBy: {
      createdAt: 'asc',
    },
  },
} satisfies Prisma.DocumentInclude;

/* type TransactionTimelineDocument = Prisma.DocumentGetPayload<{
  include: typeof transactionTimelineInclude;
}>; */

/*
|--------------------------------------------------------------------------
| SERVICE
|--------------------------------------------------------------------------
*/

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  /*
|--------------------------------------------------------------------------
| MATCH OFFICE BUCKET
|--------------------------------------------------------------------------
*/

  private matchesOfficeBucket(
    doc: TransactionDocument,
    officeId: string,
    bucket: OfficeTransactionBucket,
    referenceTime: number,
  ) {
    /*
     * Whole office row.
     */

    if (bucket === 'ALL') {
      return true;
    }

    /*
  |--------------------------------------------------------------------------
  | SOURCE
  |--------------------------------------------------------------------------
  */

    if (bucket === 'INTERNAL') {
      return doc.sourceClass === DocumentSourceClass.INTERNAL;
    }

    if (bucket === 'EXTERNAL') {
      return doc.sourceClass === DocumentSourceClass.EXTERNAL;
    }

    /*
  |--------------------------------------------------------------------------
  | MONITORING CATEGORY
  |--------------------------------------------------------------------------
  */

    if (bucket === 'PERMIT') {
      return doc.monitoringCategory === DocumentMonitoringCategory.PERMIT;
    }

    if (bucket === 'SURVEY_RETURN') {
      return (
        doc.monitoringCategory === DocumentMonitoringCategory.SURVEY_RETURN
      );
    }

    /*
  |--------------------------------------------------------------------------
  | ACTED
  |--------------------------------------------------------------------------
  */

    if (bucket === 'ACTED') {
      return this.wasActedByOffice(doc, officeId);
    }

    /*
  |--------------------------------------------------------------------------
  | CURRENT OFFICE-BASED BUCKETS
  |--------------------------------------------------------------------------
  |
  | Pending / Process / Review /
  | Approval / Overdue represent
  | CURRENT responsibility.
  |
  */

    if (doc.currentOfficeId !== officeId) {
      return false;
    }

    if (bucket === 'OVERDUE') {
      return this.isDocumentOverdue(doc, referenceTime);
    }

    return doc.currentStatus.name === bucket;
  }

  /*
|--------------------------------------------------------------------------
| LATEST DOCUMENT MOVEMENT
|--------------------------------------------------------------------------
*/

  private getLatestMovement(doc: TransactionDocument) {
    if (!doc.routes.length) {
      return null;
    }

    /*
     * routes are ordered by sentAt ASC,
     * so last item is latest.
     */

    const route = doc.routes[doc.routes.length - 1];

    return {
      routeId: route.id,

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

      /*
       * Convenient display field:
       *
       * ORED → PMD
       */

      label: `${route.fromOffice.officeCode} → ${route.toOffice.officeCode}`,

      routeStatus: route.status,

      sentAt: route.sentAt,

      receivedAt: route.receivedAt,

      completedAt: route.completedAt,

      remarks: route.remarks,
    };
  }

  /*
|--------------------------------------------------------------------------
| LATEST REMARKS / ACTION
|--------------------------------------------------------------------------
|
| Compare:
|
| - DocumentRoute.remarks
| - DocumentAction.comment
|
| Latest timestamp wins.
|
*/

  private getLatestRemarks(doc: TransactionDocument) {
    const candidates: {
      text: string;
      createdAt: Date;
      source: 'ROUTE' | 'ACTION';
    }[] = [];

    /*
  |--------------------------------------------------------------------------
  | ROUTE REMARKS
  |--------------------------------------------------------------------------
  */

    for (const route of doc.routes) {
      const remarks = route.remarks?.trim();

      if (!remarks) {
        continue;
      }

      candidates.push({
        text: remarks,

        createdAt: route.sentAt,

        source: 'ROUTE',
      });
    }

    /*
  |--------------------------------------------------------------------------
  | DOCUMENT ACTION COMMENTS
  |--------------------------------------------------------------------------
  */

    for (const action of doc.actions) {
      const comment = action.comment?.trim();

      if (!comment) {
        continue;
      }

      candidates.push({
        text: comment,

        createdAt: action.createdAt,

        source: 'ACTION',
      });
    }

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const latest = candidates[0];

    return {
      text: latest.text,

      source: latest.source,

      createdAt: latest.createdAt,
    };
  }

  /*
|--------------------------------------------------------------------------
| PERSON NAME
|--------------------------------------------------------------------------
*/

  private getPersonName(
    user?: {
      firstName: string;
      lastName: string;
      username?: string;
    } | null,
  ) {
    if (!user) {
      return null;
    }

    const fullName = `${user.firstName} ${user.lastName}`.trim();

    return fullName || user.username || null;
  }

  /*
|--------------------------------------------------------------------------
| STATUS FROM LOG
|--------------------------------------------------------------------------
*/

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
| DEADLINE INFORMATION
|--------------------------------------------------------------------------
*/

  private getDeadlineInfo(
    doc: TransactionDocument,
    referenceTime = Date.now(),
  ) {
    /*
     * No deadline.
     */

    if (!doc.deadline) {
      return {
        status: 'NO_DUE_DATE',

        isOverdue: false,

        overdueByMs: null,

        remainingMs: null,
      };
    }

    /*
     * Completed / End Transaction
     * are no longer ACTIVE overdue.
     */

    if (TERMINAL_DOCUMENT_STATUSES.has(doc.currentStatus.name)) {
      return {
        status: 'COMPLETED',

        isOverdue: false,

        overdueByMs: null,

        remainingMs: null,
      };
    }

    const difference = doc.deadline.getTime() - referenceTime;

    /*
     * Still within deadline.
     */

    if (difference >= 0) {
      return {
        status: 'ON_TIME',

        isOverdue: false,

        overdueByMs: null,

        remainingMs: difference,
      };
    }

    /*
     * Active + deadline passed.
     */

    return {
      status: 'OVERDUE',

      isOverdue: true,

      overdueByMs: Math.abs(difference),

      remainingMs: null,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | OFFICE SUMMARY
  |--------------------------------------------------------------------------
  */

  async getOfficeSummary(user: AuthenticatedUser, query: TransactionQueryDto) {
    /*
    |--------------------------------------------------------------------------
    | AUTHORIZATION
    |--------------------------------------------------------------------------
    */

    await this.assertCanViewTransactions(user);

    /*
    |--------------------------------------------------------------------------
    | REPORT PERIOD
    |--------------------------------------------------------------------------
    */

    const { from, to } = this.resolveDateRange(query);

    /*
    |--------------------------------------------------------------------------
    | REGIONAL OFFICES
    |--------------------------------------------------------------------------
    */

    const regionalOffices = await this.prisma.office.findMany({
      where: {
        organizationUnit: {
          type: OrganizationType.REGIONAL,
        },

        ...(query.officeId
          ? {
              id: query.officeId,
            }
          : {}),
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

      orderBy: {
        officeName: 'asc',
      },
    });

    /* const regionalOfficeIds = new Set(
      regionalOffices.map((office) => office.id),
    ); */

    /*
    |--------------------------------------------------------------------------
    | DOCUMENT QUERY
    |--------------------------------------------------------------------------
    |
    | Reporting period currently means:
    |
    | documents officially received / created
    | during the selected period.
    |
    */

    const where: Prisma.DocumentWhereInput = {
      ...(from || to
        ? {
            createdAt: {
              ...(from
                ? {
                    gte: from,
                  }
                : {}),

              ...(to
                ? {
                    lte: to,
                  }
                : {}),
            },
          }
        : {}),

      ...(query.sourceClass
        ? {
            sourceClass: query.sourceClass,
          }
        : {}),

      ...(query.monitoringCategory
        ? {
            monitoringCategory: query.monitoringCategory,
          }
        : {}),

      ...(query.status
        ? {
            currentStatus: {
              name: query.status,
            },
          }
        : {}),

      ...(query.search
        ? {
            OR: [
              {
                trackingNumber: {
                  contains: query.search,

                  mode: 'insensitive',
                },
              },

              {
                title: {
                  contains: query.search,

                  mode: 'insensitive',
                },
              },

              {
                referenceNumber: {
                  contains: query.search,

                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const candidateDocuments = await this.prisma.document.findMany({
      where,

      include: transactionDocumentInclude,

      orderBy: {
        createdAt: 'desc',
      },
    });

    /*
    |--------------------------------------------------------------------------
    | RECORDS-ORIGINATED TRANSACTIONS
    |--------------------------------------------------------------------------
    |
    | Director requirement:
    |
    | Transactions start from Regional Records.
    |
    | A document qualifies when:
    |
    | 1. It was created by a user assigned
    |    to a Regional Records office
    |
    | OR
    |
    | 2. Its first route originated
    |    from a Regional Records office.
    |
    */

    const documents = candidateDocuments.filter((doc) =>
      this.isRegionalRecordsTransaction(doc),
    );

    const now = Date.now();

    /*
    |--------------------------------------------------------------------------
    | OFFICE SUMMARIES
    |--------------------------------------------------------------------------
    */

    const offices = regionalOffices.map((office) => {
      /*
          |--------------------------------------------------------------------------
          | DOCUMENTS HANDLED BY THIS OFFICE
          |--------------------------------------------------------------------------
          */

      const handledDocuments = documents.filter((doc) =>
        this.wasHandledByOffice(doc, office.id),
      );

      /*
          |--------------------------------------------------------------------------
          | CURRENT DOCUMENTS
          |--------------------------------------------------------------------------
          |
          | Status buckets represent the
          | office's CURRENT workload.
          |
          */

      const currentDocuments = handledDocuments.filter(
        (doc) => doc.currentOfficeId === office.id,
      );

      /*
          |--------------------------------------------------------------------------
          | SOURCE COUNTS
          |--------------------------------------------------------------------------
          */

      const internal = handledDocuments.filter(
        (doc) => doc.sourceClass === DocumentSourceClass.INTERNAL,
      ).length;

      const external = handledDocuments.filter(
        (doc) => doc.sourceClass === DocumentSourceClass.EXTERNAL,
      ).length;

      const uncategorizedSource = handledDocuments.filter(
        (doc) => !doc.sourceClass,
      ).length;

      /*
          |--------------------------------------------------------------------------
          | MONITORING CATEGORY COUNTS
          |--------------------------------------------------------------------------
          */

      const permits = handledDocuments.filter(
        (doc) => doc.monitoringCategory === DocumentMonitoringCategory.PERMIT,
      ).length;

      const surveyReturns = handledDocuments.filter(
        (doc) =>
          doc.monitoringCategory === DocumentMonitoringCategory.SURVEY_RETURN,
      ).length;

      /*
          |--------------------------------------------------------------------------
          | CURRENT WORKFLOW STATUS
          |--------------------------------------------------------------------------
          */

      const pending = currentDocuments.filter(
        (doc) => doc.currentStatus.name === 'PENDING',
      ).length;

      const onProcess = currentDocuments.filter(
        (doc) => doc.currentStatus.name === 'ON_PROCESS',
      ).length;

      const forReview = currentDocuments.filter(
        (doc) => doc.currentStatus.name === 'FOR_REVIEW',
      ).length;

      const forApproval = currentDocuments.filter(
        (doc) => doc.currentStatus.name === 'FOR_APPROVAL',
      ).length;

      /*
          |--------------------------------------------------------------------------
          | OVERDUE
          |--------------------------------------------------------------------------
          */

      const overdue = currentDocuments.filter((doc) =>
        this.isDocumentOverdue(doc, now),
      ).length;

      /*
          |--------------------------------------------------------------------------
          | ACTED
          |--------------------------------------------------------------------------
          |
          | A document counts as acted
          | for an office if that office:
          |
          | - created an action/comment
          | - routed the document onward
          | - completed an incoming route
          |
          */

      const acted = handledDocuments.filter((doc) =>
        this.wasActedByOffice(doc, office.id),
      ).length;

      /*
          |--------------------------------------------------------------------------
          | ACTIVE
          |--------------------------------------------------------------------------
          */

      const active = currentDocuments.filter(
        (doc) => !TERMINAL_DOCUMENT_STATUSES.has(doc.currentStatus.name),
      ).length;

      return {
        officeId: office.id,

        officeCode: office.officeCode,

        officeName: office.officeName,

        total: handledDocuments.length,

        /*
         * Source
         */

        internal,

        external,

        uncategorizedSource,

        /*
         * Categories
         */

        permits,

        surveyReturns,

        /*
         * Current workload
         */

        active,

        pending,

        onProcess,

        forReview,

        forApproval,

        overdue,

        /*
         * Historical handling
         */

        acted,
      };
    });

    /*
    |--------------------------------------------------------------------------
    | REGIONAL SUMMARY
    |--------------------------------------------------------------------------
    |
    | IMPORTANT:
    |
    | Global totals use UNIQUE documents.
    |
    | Do not sum office totals because
    | one document may pass multiple offices.
    |
    */

    const summaryInternal = documents.filter(
      (doc) => doc.sourceClass === DocumentSourceClass.INTERNAL,
    ).length;

    const summaryExternal = documents.filter(
      (doc) => doc.sourceClass === DocumentSourceClass.EXTERNAL,
    ).length;

    const summaryUncategorizedSource = documents.filter(
      (doc) => !doc.sourceClass,
    ).length;

    const summaryPermits = documents.filter(
      (doc) => doc.monitoringCategory === DocumentMonitoringCategory.PERMIT,
    ).length;

    const summarySurveyReturns = documents.filter(
      (doc) =>
        doc.monitoringCategory === DocumentMonitoringCategory.SURVEY_RETURN,
    ).length;

    const summaryActive = documents.filter(
      (doc) => !TERMINAL_DOCUMENT_STATUSES.has(doc.currentStatus.name),
    ).length;

    const summaryOverdue = documents.filter((doc) =>
      this.isDocumentOverdue(doc, now),
    ).length;

    const summaryCompleted = documents.filter((doc) =>
      TERMINAL_DOCUMENT_STATUSES.has(doc.currentStatus.name),
    ).length;

    /*
    |--------------------------------------------------------------------------
    | RESPONSE
    |--------------------------------------------------------------------------
    */

    return {
      period: {
        from: from?.toISOString() ?? null,

        to: to?.toISOString() ?? null,
      },

      summary: {
        totalDocuments: documents.length,

        internal: summaryInternal,

        external: summaryExternal,

        uncategorizedSource: summaryUncategorizedSource,

        permits: summaryPermits,

        surveyReturns: summarySurveyReturns,

        active: summaryActive,

        overdue: summaryOverdue,

        completed: summaryCompleted,
      },

      offices,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | ACCESS CONTROL
  |--------------------------------------------------------------------------
  */

  private async assertCanViewTransactions(user: AuthenticatedUser) {
    /*
     * SUPER ADMIN always allowed.
     */

    if (user.roles?.includes('SUPER_ADMIN')) {
      return;
    }

    if (!user.officeIds?.length) {
      throw new ForbiddenException(
        'You are not authorized to view Transactions.',
      );
    }

    const offices = await this.prisma.office.findMany({
      where: {
        id: {
          in: user.officeIds,
        },

        organizationUnit: {
          type: OrganizationType.REGIONAL,
        },
      },

      select: {
        officeCode: true,
        officeName: true,
      },
    });

    /*
    |--------------------------------------------------------------------------
    | OPTIONAL ENV OFFICE CODES
    |--------------------------------------------------------------------------
    */

    const configuredCodes = (
      process.env.TRANSACTIONS_ALLOWED_OFFICE_CODES ?? ''
    )
      .split(',')
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean);

    const allowedCodes = new Set([
      ...DEFAULT_ALLOWED_OFFICE_CODES,
      ...configuredCodes,
    ]);

    const authorized = offices.some((office) => {
      const officeCode = office.officeCode.trim().toUpperCase();

      const officeName = office.officeName.trim().toUpperCase();

      /*
       * ORED / configured offices
       */

      if (allowedCodes.has(officeCode)) {
        return true;
      }

      /*
       * Assistant Regional Director
       * office-name fallback.
       *
       * Example:
       *
       * Office of the Assistant
       * Regional Director...
       */

      if (officeName.includes('ASSISTANT REGIONAL DIRECTOR')) {
        return true;
      }

      return false;
    });

    if (!authorized) {
      throw new ForbiddenException(
        'Transactions are available only to ORED and Assistant Regional Director offices.',
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | REGIONAL RECORDS TRANSACTION
  |--------------------------------------------------------------------------
  */

  private isRegionalRecordsTransaction(doc: TransactionDocument) {
    /*
    |--------------------------------------------------------------------------
    | CREATED BY REGIONAL RECORDS
    |--------------------------------------------------------------------------
    */

    const createdByRegionalRecords = doc.createdBy.offices.some(
      (membership) =>
        membership.office.category === 'RECORDS' &&
        membership.office.organizationUnit.type === OrganizationType.REGIONAL,
    );

    if (createdByRegionalRecords) {
      return true;
    }

    /*
    |--------------------------------------------------------------------------
    | FIRST ROUTE FROM REGIONAL RECORDS
    |--------------------------------------------------------------------------
    */

    const firstRoute = doc.routes[0];

    if (!firstRoute) {
      return false;
    }

    return (
      firstRoute.fromOffice.category === 'RECORDS' &&
      firstRoute.fromOffice.organizationUnit.type === OrganizationType.REGIONAL
    );
  }

  /*
  |--------------------------------------------------------------------------
  | OFFICE HANDLED DOCUMENT
  |--------------------------------------------------------------------------
  */

  private wasHandledByOffice(doc: TransactionDocument, officeId: string) {
    /*
     * Current custody.
     */

    if (doc.currentOfficeId === officeId) {
      return true;
    }

    /*
     * Route touched office.
     */

    const touchedByRoute = doc.routes.some(
      (route) =>
        route.fromOfficeId === officeId || route.toOfficeId === officeId,
    );

    if (touchedByRoute) {
      return true;
    }

    /*
     * Office performed an action.
     */

    const touchedByAction = doc.actions.some(
      (action) => action.officeId === officeId,
    );

    if (touchedByAction) {
      return true;
    }

    /*
     * Initial Records ownership.
     *
     * Useful for newly-created documents
     * that have not been routed yet.
     */

    const createdInOffice = doc.createdBy.offices.some(
      (membership) => membership.office.id === officeId,
    );

    return createdInOffice;
  }

  /*
  |--------------------------------------------------------------------------
  | OFFICE ACTED ON DOCUMENT
  |--------------------------------------------------------------------------
  */

  private wasActedByOffice(doc: TransactionDocument, officeId: string) {
    /*
     * Explicit DocumentAction.
     */

    const hasAction = doc.actions.some(
      (action) => action.officeId === officeId,
    );

    if (hasAction) {
      return true;
    }

    /*
     * Office routed document onward.
     *
     * This means it completed at least
     * one handling cycle.
     */

    const routedOnward = doc.routes.some(
      (route) => route.fromOfficeId === officeId,
    );

    if (routedOnward) {
      return true;
    }

    /*
     * Incoming handling marked completed.
     */

    const completedIncomingRoute = doc.routes.some(
      (route) => route.toOfficeId === officeId && route.status === 'COMPLETED',
    );

    return completedIncomingRoute;
  }

  /*
  |--------------------------------------------------------------------------
  | DOCUMENT OVERDUE
  |--------------------------------------------------------------------------
  */

  private isDocumentOverdue(
    doc: TransactionDocument,
    referenceTime = Date.now(),
  ) {
    if (!doc.deadline) {
      return false;
    }

    if (TERMINAL_DOCUMENT_STATUSES.has(doc.currentStatus.name)) {
      return false;
    }

    return referenceTime > doc.deadline.getTime();
  }

  /*
  |--------------------------------------------------------------------------
  | REPORT PERIOD
  |--------------------------------------------------------------------------
  */

  private resolveDateRange(query: TransactionQueryDto) {
    let from: Date | undefined;

    let to: Date | undefined;

    /*
     * Beginning of selected
     * start date.
     */

    if (query.from) {
      from = new Date(query.from);

      from.setHours(0, 0, 0, 0);
    }

    /*
     * End of selected end date.
     */

    if (query.to) {
      to = new Date(query.to);

      to.setHours(23, 59, 59, 999);
    }

    return {
      from,
      to,
    };
  }

  /*
|--------------------------------------------------------------------------
| OFFICE DOCUMENTS
|--------------------------------------------------------------------------
|
| Used by the expandable Office Summary row.
|
*/

  async getOfficeDocuments(
    user: AuthenticatedUser,
    officeId: string,
    query: OfficeTransactionDocumentsQueryDto,
  ) {
    /*
  |--------------------------------------------------------------------------
  | AUTHORIZATION
  |--------------------------------------------------------------------------
  */

    await this.assertCanViewTransactions(user);

    /*
  |--------------------------------------------------------------------------
  | VALIDATE OFFICE
  |--------------------------------------------------------------------------
  |
  | Transactions page is Regional Office only.
  |
  */

    const office = await this.prisma.office.findFirst({
      where: {
        id: officeId,

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
    });

    if (!office) {
      throw new ForbiddenException(
        'The selected office is not available in the Regional Transactions report.',
      );
    }

    /*
  |--------------------------------------------------------------------------
  | PERIOD
  |--------------------------------------------------------------------------
  */

    const { from, to } = this.resolveDateRange(query);

    /*
  |--------------------------------------------------------------------------
  | BASE WHERE
  |--------------------------------------------------------------------------
  */

    const where: Prisma.DocumentWhereInput = {
      /*
       * Same reporting period
       * as Office Summary.
       */

      ...(from || to
        ? {
            createdAt: {
              ...(from
                ? {
                    gte: from,
                  }
                : {}),

              ...(to
                ? {
                    lte: to,
                  }
                : {}),
            },
          }
        : {}),

      /*
       * Source filter.
       */

      ...(query.sourceClass
        ? {
            sourceClass: query.sourceClass,
          }
        : {}),

      /*
       * Monitoring category.
       */

      ...(query.monitoringCategory
        ? {
            monitoringCategory: query.monitoringCategory,
          }
        : {}),

      /*
       * Current workflow status.
       */

      ...(query.status
        ? {
            currentStatus: {
              name: query.status,
            },
          }
        : {}),

      /*
       * Search.
       */

      ...(query.search
        ? {
            OR: [
              {
                trackingNumber: {
                  contains: query.search,

                  mode: 'insensitive',
                },
              },

              {
                title: {
                  contains: query.search,

                  mode: 'insensitive',
                },
              },

              {
                referenceNumber: {
                  contains: query.search,

                  mode: 'insensitive',
                },
              },

              {
                responsiblePerson: {
                  contains: query.search,

                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    /*
  |--------------------------------------------------------------------------
  | QUERY DOCUMENTS
  |--------------------------------------------------------------------------
  */

    const candidateDocuments = await this.prisma.document.findMany({
      where,

      include: transactionDocumentInclude,

      orderBy: {
        createdAt: 'desc',
      },
    });

    const now = Date.now();

    /*
  |--------------------------------------------------------------------------
  | TRANSACTIONS FROM REGIONAL RECORDS
  |--------------------------------------------------------------------------
  */

    let documents = candidateDocuments.filter(
      (doc) =>
        this.isRegionalRecordsTransaction(doc) &&
        this.wasHandledByOffice(doc, officeId),
    );

    /*
  |--------------------------------------------------------------------------
  | BUCKET FILTER
  |--------------------------------------------------------------------------
  */

    documents = documents.filter((doc) =>
      this.matchesOfficeBucket(doc, officeId, query.bucket ?? 'ALL', now),
    );

    /*
  |--------------------------------------------------------------------------
  | PAGINATION
  |--------------------------------------------------------------------------
  */

    const page = Math.max(query.page ?? 1, 1);

    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);

    const total = documents.length;

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    const offset = (page - 1) * limit;

    const paginatedDocuments = documents.slice(offset, offset + limit);

    /*
  |--------------------------------------------------------------------------
  | MAP DOCUMENTS
  |--------------------------------------------------------------------------
  */

    const rows = paginatedDocuments.map((doc) => {
      const deadlineInfo = this.getDeadlineInfo(doc, now);

      const lastMovement = this.getLatestMovement(doc);

      const latestRemarks = this.getLatestRemarks(doc);

      return {
        id: doc.id,

        /*
         * Main identification
         */

        trackingNumber: doc.trackingNumber,

        subject: doc.title,

        documentType: doc.documentType.name,

        referenceNumber: doc.referenceNumber,

        /*
         * Classification
         */

        sourceClass: doc.sourceClass ?? null,

        monitoringCategory: doc.monitoringCategory,

        classification: doc.classification,

        /*
         * Business rule:
         *
         * Document creation =
         * official received date.
         */

        receivedAt: doc.createdAt,

        /*
         * Current workflow
         */

        status: doc.currentStatus.name,

        currentOffice: {
          id: doc.currentOffice.id,

          officeCode: doc.currentOffice.officeCode,

          officeName: doc.currentOffice.officeName,

          isSelectedOffice: doc.currentOfficeId === officeId,
        },

        /*
         * Responsibility
         */

        responsibleOffice: doc.responsibleOffice
          ? {
              id: doc.responsibleOffice.id,

              officeCode: doc.responsibleOffice.officeCode,

              officeName: doc.responsibleOffice.officeName,
            }
          : null,

        responsiblePerson: doc.responsiblePerson,

        /*
         * Deadline
         */

        deadline: doc.deadline,

        deadlineStatus: deadlineInfo.status,

        isOverdue: deadlineInfo.isOverdue,

        overdueByMs: deadlineInfo.overdueByMs,

        remainingMs: deadlineInfo.remainingMs,

        /*
         * Latest route movement
         */

        lastMovement,

        /*
         * Latest route remark
         * or DocumentAction comment.
         */

        latestRemarks,

        /*
         * Useful UI flags
         */

        actedByOffice: this.wasActedByOffice(doc, officeId),

        isCurrentlyAtOffice: doc.currentOfficeId === officeId,
      };
    });

    /*
  |--------------------------------------------------------------------------
  | RESPONSE
  |--------------------------------------------------------------------------
  */

    return {
      office,

      filter: {
        bucket: query.bucket ?? 'ALL',

        search: query.search ?? null,

        sourceClass: query.sourceClass ?? null,

        monitoringCategory: query.monitoringCategory ?? null,

        status: query.status ?? null,

        from: from?.toISOString() ?? null,

        to: to?.toISOString() ?? null,
      },

      pagination: {
        page,
        limit,
        total,
        totalPages,

        hasNextPage: page < totalPages,

        hasPreviousPage: page > 1,
      },

      documents: rows,
    };
  }

  /*
|--------------------------------------------------------------------------
| DOCUMENT TRANSACTION TIMELINE
|--------------------------------------------------------------------------
|
| GET /transactions/documents/:documentId/timeline
|
*/

  async getDocumentTimeline(user: AuthenticatedUser, documentId: string) {
    /*
  |--------------------------------------------------------------------------
  | AUTHORIZATION
  |--------------------------------------------------------------------------
  */

    await this.assertCanViewTransactions(user);

    /*
  |--------------------------------------------------------------------------
  | DOCUMENT
  |--------------------------------------------------------------------------
  */

    const doc = await this.prisma.document.findUnique({
      where: {
        id: documentId,
      },

      include: transactionTimelineInclude,
    });

    if (!doc) {
      throw new NotFoundException('Document transaction not found.');
    }

    /*
  |--------------------------------------------------------------------------
  | TRANSACTION SCOPE
  |--------------------------------------------------------------------------
  |
  | Transactions page is intended for
  | documents originating from Regional Records.
  |
  */

    if (!this.isRegionalRecordsTransaction(doc)) {
      throw new NotFoundException(
        'Document is not part of the Regional Records transaction scope.',
      );
    }

    const now = Date.now();

    /*
  |--------------------------------------------------------------------------
  | INITIAL RECORDS OFFICE
  |--------------------------------------------------------------------------
  */

    const regionalRecordsMembership = doc.createdBy.offices.find(
      (membership) =>
        membership.office.category === 'RECORDS' &&
        membership.office.organizationUnit.type === OrganizationType.REGIONAL,
    );

    const firstRoute = doc.routes[0];

    const initialOffice =
      regionalRecordsMembership?.office ??
      (firstRoute &&
      firstRoute.fromOffice.organizationUnit.type === OrganizationType.REGIONAL
        ? firstRoute.fromOffice
        : null);

    /*
  |--------------------------------------------------------------------------
  | TIMELINE EVENTS
  |--------------------------------------------------------------------------
  */

    const timeline: {
      id: string;

      type:
        | 'REGISTERED'
        | 'ROUTED'
        | 'RECEIVED'
        | 'ROUTE_COMPLETED'
        | 'ACTION'
        | 'STATUS_UPDATED';

      occurredAt: Date;

      title: string;

      description: string | null;

      actor: {
        id: string;
        name: string | null;
      } | null;

      office: {
        id: string;
        officeCode: string;
        officeName: string;
      } | null;

      fromOffice?: {
        id: string;
        officeCode: string;
        officeName: string;
      } | null;

      toOffice?: {
        id: string;
        officeCode: string;
        officeName: string;
      } | null;

      routeStatus?: string | null;

      documentStatus?: string | null;

      remarks?: string | null;

      timeHeldMs?: number | null;

      attachment?: {
        fileName: string | null;

        filePath: string | null;

        fileType: string | null;
      } | null;
    }[] = [];

    /*
  |--------------------------------------------------------------------------
  | REGISTERED / RECEIVED BY RECORDS
  |--------------------------------------------------------------------------
  */

    timeline.push({
      id: `registered-${doc.id}`,

      type: 'REGISTERED',

      occurredAt: doc.createdAt,

      title: 'Document Received / Registered',

      description: 'Document officially received and registered in eDATS.',

      actor: {
        id: doc.createdBy.id,

        name: this.getPersonName(doc.createdBy),
      },

      office: initialOffice
        ? {
            id: initialOffice.id,

            officeCode: initialOffice.officeCode,

            officeName: initialOffice.officeName,
          }
        : null,

      remarks: null,
    });

    /*
  |--------------------------------------------------------------------------
  | ROUTES
  |--------------------------------------------------------------------------
  */

    for (const route of doc.routes) {
      /*
       * We care about Regional Office
       * movements.
       *
       * If one endpoint is Regional,
       * retain the movement so boundary
       * routing is still visible.
       */

      const involvesRegionalOffice =
        route.fromOffice.organizationUnit.type === OrganizationType.REGIONAL ||
        route.toOffice.organizationUnit.type === OrganizationType.REGIONAL;

      if (!involvesRegionalOffice) {
        continue;
      }

      const fromOffice = {
        id: route.fromOffice.id,

        officeCode: route.fromOffice.officeCode,

        officeName: route.fromOffice.officeName,
      };

      const toOffice = {
        id: route.toOffice.id,

        officeCode: route.toOffice.officeCode,

        officeName: route.toOffice.officeName,
      };

      /*
    |--------------------------------------------------------------------------
    | ROUTED
    |--------------------------------------------------------------------------
    */

      timeline.push({
        id: `route-sent-${route.id}`,

        type: 'ROUTED',

        occurredAt: route.sentAt,

        title: `${route.fromOffice.officeCode} → ${route.toOffice.officeCode}`,

        description: `Document routed from ${route.fromOffice.officeName} to ${route.toOffice.officeName}.`,

        actor: {
          id: route.sentBy.id,

          name: this.getPersonName(route.sentBy),
        },

        office: fromOffice,

        fromOffice,

        toOffice,

        routeStatus: route.status,

        remarks: route.remarks ?? null,
      });

      /*
    |--------------------------------------------------------------------------
    | RECEIVED
    |--------------------------------------------------------------------------
    */

      if (route.receivedAt) {
        timeline.push({
          id: `route-received-${route.id}`,

          type: 'RECEIVED',

          occurredAt: route.receivedAt,

          title: `Received by ${route.toOffice.officeCode}`,

          description: `Document received by ${route.toOffice.officeName}.`,

          actor: route.receivedBy
            ? {
                id: route.receivedBy.id,

                name: this.getPersonName(route.receivedBy),
              }
            : null,

          office: toOffice,

          fromOffice,

          toOffice,

          routeStatus: route.status,

          remarks: route.remarks ?? null,

          /*
           * Time held begins once
           * destination office receives it.
           *
           * If not completed yet and this
           * is still active, use current time.
           */

          timeHeldMs: Math.max(
            (route.completedAt?.getTime() ?? now) - route.receivedAt.getTime(),
            0,
          ),
        });
      }

      /*
    |--------------------------------------------------------------------------
    | ROUTE COMPLETED
    |--------------------------------------------------------------------------
    */

      if (route.completedAt) {
        timeline.push({
          id: `route-completed-${route.id}`,

          type: 'ROUTE_COMPLETED',

          occurredAt: route.completedAt,

          title: `${route.toOffice.officeCode} Handling Completed`,

          description: `${route.toOffice.officeName} completed its handling of the document.`,

          actor: null,

          office: toOffice,

          fromOffice,

          toOffice,

          routeStatus: route.status,

          remarks: route.remarks ?? null,

          timeHeldMs: route.receivedAt
            ? Math.max(
                route.completedAt.getTime() - route.receivedAt.getTime(),
                0,
              )
            : null,
        });
      }
    }

    /*
  |--------------------------------------------------------------------------
  | DOCUMENT ACTIONS
  |--------------------------------------------------------------------------
  */

    for (const action of doc.actions) {
      /*
       * Transactions feature is
       * Regional Office only.
       */

      if (action.office.organizationUnit.type !== OrganizationType.REGIONAL) {
        continue;
      }

      const comment = action.comment?.trim() || null;

      timeline.push({
        id: `action-${action.id}`,

        type: 'ACTION',

        occurredAt: action.createdAt,

        title: 'Document Action',

        description: comment,

        actor: {
          id: action.user.id,

          name: this.getPersonName(action.user),
        },

        office: {
          id: action.office.id,

          officeCode: action.office.officeCode,

          officeName: action.office.officeName,
        },

        remarks: comment,

        attachment:
          action.fileName || action.filePath
            ? {
                fileName: action.fileName,

                filePath: action.filePath,

                fileType: action.fileType,
              }
            : null,
      });
    }

    /*
  |--------------------------------------------------------------------------
  | STATUS HISTORY
  |--------------------------------------------------------------------------
  */

    for (const log of doc.logs) {
      if (log.action !== 'STATUS_UPDATED') {
        continue;
      }

      const status = this.getStatusFromLog(log.description);

      timeline.push({
        id: `status-${log.id}`,

        type: 'STATUS_UPDATED',

        occurredAt: log.createdAt,

        title: status ? `Status: ${status}` : 'Document Status Updated',

        description: log.description ?? null,

        actor: {
          id: log.user.id,

          name: this.getPersonName(log.user),
        },

        /*
         * DocumentLog currently
         * does not store officeId.
         *
         * Do not guess historical
         * office here.
         */

        office: null,

        documentStatus: status,

        remarks: null,
      });
    }

    /*
  |--------------------------------------------------------------------------
  | SORT CHRONOLOGICALLY
  |--------------------------------------------------------------------------
  */

    timeline.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

    /*
  |--------------------------------------------------------------------------
  | DEADLINE
  |--------------------------------------------------------------------------
  */

    const deadlineInfo = this.getDeadlineInfo(doc, now);

    /*
  |--------------------------------------------------------------------------
  | LATEST REMARKS
  |--------------------------------------------------------------------------
  */

    const latestRemarks = this.getLatestRemarks(doc);

    /*
  |--------------------------------------------------------------------------
  | RESPONSE
  |--------------------------------------------------------------------------
  */

    return {
      document: {
        id: doc.id,

        trackingNumber: doc.trackingNumber,

        subject: doc.title,

        description: doc.description,

        referenceNumber: doc.referenceNumber,

        documentType: doc.documentType.name,

        sourceClass: doc.sourceClass,

        internalSourceScope: doc.internalSourceScope,

        monitoringCategory: doc.monitoringCategory,

        routingProfile: doc.routingProfile,

        classification: doc.classification,

        priority: doc.priority,

        confidentialityLevel: doc.confidentialityLevel,

        /*
         * Official received date.
         */

        receivedAt: doc.createdAt,

        /*
         * Current state.
         */

        status: doc.currentStatus.name,

        currentOffice: {
          id: doc.currentOffice.id,

          officeCode: doc.currentOffice.officeCode,

          officeName: doc.currentOffice.officeName,
        },

        responsibleOffice: doc.responsibleOffice
          ? {
              id: doc.responsibleOffice.id,

              officeCode: doc.responsibleOffice.officeCode,

              officeName: doc.responsibleOffice.officeName,
            }
          : null,

        responsiblePerson: doc.responsiblePerson,

        deadline: doc.deadline,

        deadlineStatus: deadlineInfo.status,

        isOverdue: deadlineInfo.isOverdue,

        overdueByMs: deadlineInfo.overdueByMs,

        remainingMs: deadlineInfo.remainingMs,

        latestRemarks,
      },

      /*
       * Useful statistics
       * for timeline header.
       */

      summary: {
        routeCount: doc.routes.length,

        actionCount: doc.actions.length,

        timelineEventCount: timeline.length,
      },

      timeline,
    };
  }
}
