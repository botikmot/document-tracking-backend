import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ReportFilterDto, ReportType } from './dto/report-filter.dto';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async generateReport(filter: ReportFilterDto) {
    const { startDate, endDate } = this.getDateRange(filter);
    const officeIds = filter.officeIds ?? [];

    const documentInclude = {
      currentStatus: true,

      documentType: true,

      currentOffice: true,

      responsibleOffice: true,

      /*
  |--------------------------------------------------------------------------
  | STATUS HISTORY
  |--------------------------------------------------------------------------
  */

      logs: {
        where: {
          action: 'STATUS_UPDATED',
        },

        select: {
          id: true,
          description: true,
          createdAt: true,
        },

        orderBy: {
          createdAt: 'asc',
        },
      },

      actions: {
        where: {
          ...(officeIds.length
            ? {
                officeId: {
                  in: officeIds,
                },
              }
            : {}),

          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },

        select: {
          id: true,
          officeId: true,
          createdAt: true,
        },

        orderBy: {
          createdAt: 'desc',
        },
      },
    } satisfies Prisma.DocumentInclude;

    type ReportDocument = Prisma.DocumentGetPayload<{
      include: typeof documentInclude;
    }>;

    const TERMINAL_DOCUMENT_STATUSES = new Set([
      'COMPLETED',
      'END_TRANSACTION',
    ]);

    type DocumentSummaryMeta = {
      receivedAt: Date | null;
      completedAt: Date | null;
      latestRemarks: string | null;
    };

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

    const mapDocument = (
      doc: ReportDocument,
      officeStatus: string | null = null,
      routeStatus: string | null = null,
      routedToOffice: string | null = null,
      timeInOfficeMs: number = 0,
      summaryMeta?: DocumentSummaryMeta,
    ) => {
      /*
  |--------------------------------------------------------------------------
  | DOCUMENT RECEIVED DATE
  |--------------------------------------------------------------------------
  |
  | This is the first official receipt/intake
  | by a RECORDS office.
  |
  | If unavailable, keep createdAt as internal
  | fallback for old documents.
  |
  */

      const receivedAt = summaryMeta?.receivedAt ?? null;

      const processingStartedAt = receivedAt ?? doc.createdAt;

      /*
  |--------------------------------------------------------------------------
  | TOTAL PROCESSING TIME
  |--------------------------------------------------------------------------
  |
  | START:
  | Records Received Date
  |
  | END:
  | Deadline
  |
  */

      const allottedTimeMs = doc.deadline
        ? Math.max(doc.deadline.getTime() - processingStartedAt.getTime(), 0)
        : null;

      const isCompleted =
        doc.currentStatus.name === 'COMPLETED' ||
        doc.currentStatus.name === 'END_TRANSACTION';

      /*
|--------------------------------------------------------------------------
| COMPLETION DATE
|--------------------------------------------------------------------------
|
| Priority:
|
| 1. COMPLETED status timestamp
| 2. END_TRANSACTION timestamp if document
|    went directly to END_TRANSACTION
|
| Important:
| If COMPLETED happened before END_TRANSACTION,
| use COMPLETED because that is when actual
| processing was completed.
|
*/

      let completedAt: Date | null = null;

      if (isCompleted) {
        const completedLog = [...doc.logs].reverse().find((log) => {
          return getStatusFromLog(log.description) === 'COMPLETED';
        });

        const endTransactionLog = [...doc.logs].reverse().find((log) => {
          return getStatusFromLog(log.description) === 'END_TRANSACTION';
        });

        completedAt =
          completedLog?.createdAt ?? endTransactionLog?.createdAt ?? null;
      }
      /*
  |--------------------------------------------------------------------------
  | TERMINAL STATUS
  |--------------------------------------------------------------------------
  */

      const isTerminal = TERMINAL_DOCUMENT_STATUSES.has(doc.currentStatus.name);

      const isOverdue =
        !!doc.deadline && !isTerminal && Date.now() > doc.deadline.getTime();

      const responsibleParty =
        doc.responsibleOffice?.officeName ??
        doc.responsiblePerson?.trim() ??
        null;

      const acted = doc.actions.length > 0;

      const actionCount = doc.actions.length;

      const lastActionAt = doc.actions[0]?.createdAt ?? null;

      return {
        id: doc.id,
        trackingNumber: doc.trackingNumber,

        title: doc.title,

        documentType: doc.documentType.name,

        status: doc.currentStatus.name,

        officeStatus,
        routeStatus,
        routedToOffice,

        office: doc.currentOffice.officeName,

        responsibleOffice: doc.responsibleOffice,

        responsiblePerson: doc.responsiblePerson,

        responsibleParty,

        classification: doc.classification,

        priority: doc.priority,

        createdAt: doc.createdAt,

        /*
  |--------------------------------------------------------------------------
  | RECEIVED DATE
  |--------------------------------------------------------------------------
  |
  | Business rule:
  | creation in eDATS = official receipt
  | of the document.
  |
  */

        receivedAt: doc.createdAt,

        deadline: doc.deadline,

        allottedTimeMs,
        timeInOfficeMs,
        isOverdue,
        completedAt,

        deadlineStatus: !doc.deadline
          ? 'NO_DEADLINE'
          : isOverdue
            ? 'OVERDUE'
            : officeStatus === 'PENDING'
              ? 'AWAITING_RECEIPT'
              : 'ON_TIME',

        acted,
        actionCount,
        lastActionAt,
      };
    };

    const uniqueDocuments = (documents: ReportDocument[]) =>
      Array.from(new Map(documents.map((doc) => [doc.id, doc])).values());

    const isWithinRange = (date: Date) =>
      date.getTime() >= startDate.getTime() &&
      date.getTime() <= endDate.getTime();

    /*
    |--------------------------------------------------------------------------
    | Common document filters
    |--------------------------------------------------------------------------
    |
    | IMPORTANT:
    | Do not put currentOfficeId or createdAt here. The canonical report scope
    | is determined from office route activity, not from the document's current
    | location.
    |
    */

    const documentAttributeWhere: Prisma.DocumentWhereInput = {};

    if (filter.documentTypeId) {
      documentAttributeWhere.documentTypeId = filter.documentTypeId;
    }

    if (filter.status) {
      documentAttributeWhere.currentStatus = {
        name: filter.status,
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Incoming route scope
    |--------------------------------------------------------------------------
    */

    const incomingWhere: Prisma.DocumentRouteWhereInput = {
      document: documentAttributeWhere,

      OR: [
        // Already received during the report period
        {
          receivedAt: {
            gte: startDate,
            lte: endDate,
          },
        },

        // Routed to the office but not yet received
        {
          status: 'PENDING',
          receivedAt: null,
          sentAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      ],
    };

    if (officeIds.length) {
      incomingWhere.toOfficeId = {
        in: officeIds,
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Outgoing route scope
    |--------------------------------------------------------------------------
    */

    const outgoingWhere: Prisma.DocumentRouteWhereInput = {
      sentAt: {
        gte: startDate,
        lte: endDate,
      },
      document: documentAttributeWhere,
    };

    if (officeIds.length) {
      outgoingWhere.fromOfficeId = {
        in: officeIds,
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Locally-created / still-unrouted documents
    |--------------------------------------------------------------------------
    |
    | This is a fallback for documents created during the report period that
    | may not have a DocumentRoute yet. Once a document is routed, the route
    | history becomes the authoritative office-history source.
    |
    */

    const localDocumentWhere: Prisma.DocumentWhereInput = {
      ...documentAttributeWhere,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (officeIds.length) {
      localDocumentWhere.currentOfficeId = {
        in: officeIds,
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Canonical report-scope queries
    |--------------------------------------------------------------------------
    */

    const [incomingRoutes, outgoingRoutes, localDocuments] = await Promise.all([
      this.prisma.documentRoute.findMany({
        where: incomingWhere,
        include: {
          document: {
            include: documentInclude,
          },
          toOffice: true,
        },
        orderBy: {
          receivedAt: 'desc',
        },
      }),

      this.prisma.documentRoute.findMany({
        where: outgoingWhere,
        include: {
          document: {
            include: documentInclude,
          },
          toOffice: true,
        },
        orderBy: {
          sentAt: 'desc',
        },
      }),

      this.prisma.document.findMany({
        where: localDocumentWhere,
        include: documentInclude,
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    /*
    |--------------------------------------------------------------------------
    | Incoming / Outgoing unique document lists
    |--------------------------------------------------------------------------
    |
    | A document can enter/leave the same office more than once. The report
    | summary counts unique documents while routeCount keeps the event count.
    |
    */

    const timeInOfficeByDocumentId = new Map<string, number>();

    const incomingDocumentsData = uniqueDocuments(
      incomingRoutes.map((route) => route.document),
    );

    const outgoingDocumentsData = uniqueDocuments(
      outgoingRoutes.map((route) => route.document),
    );

    // Because the route queries are ordered newest first, the first route
    // stored for each document is the latest matching route for that list.
    const latestIncomingRouteStatusByDocumentId = new Map<string, string>();

    for (const route of incomingRoutes) {
      if (!latestIncomingRouteStatusByDocumentId.has(route.documentId)) {
        latestIncomingRouteStatusByDocumentId.set(
          route.documentId,
          route.status,
        );
      }
    }

    const latestIncomingRouteOfficeByDocumentId = new Map<string, string>();

    for (const route of incomingRoutes) {
      if (!latestIncomingRouteOfficeByDocumentId.has(route.documentId)) {
        latestIncomingRouteOfficeByDocumentId.set(
          route.documentId,
          route.toOffice.officeName,
        );
      }
    }

    const latestOutgoingRouteStatusByDocumentId = new Map<string, string>();

    for (const route of outgoingRoutes) {
      if (!latestOutgoingRouteStatusByDocumentId.has(route.documentId)) {
        latestOutgoingRouteStatusByDocumentId.set(
          route.documentId,
          route.status,
        );
      }
    }

    const latestOutgoingRouteOfficeByDocumentId = new Map<string, string>();

    for (const route of outgoingRoutes) {
      if (!latestOutgoingRouteOfficeByDocumentId.has(route.documentId)) {
        latestOutgoingRouteOfficeByDocumentId.set(
          route.documentId,
          route.toOffice.officeName,
        );
      }
    }

    const getTimeInOffice = (documentId: string) =>
      timeInOfficeByDocumentId.get(documentId) ?? 0;

    const incomingDocumentsList = incomingDocumentsData.map((doc) => {
      const routeStatus =
        latestIncomingRouteStatusByDocumentId.get(doc.id) ?? null;

      const routedToOffice =
        latestIncomingRouteOfficeByDocumentId.get(doc.id) ?? null;

      return mapDocument(
        doc,
        // For an incoming document, the route status is also the selected
        // office's handling status until the office routes it onward.
        routeStatus,
        routeStatus,
        routedToOffice,
        getTimeInOffice(doc.id),
      );
    });

    const outgoingDocumentsList = outgoingDocumentsData.map((doc) => {
      const routeStatus =
        latestOutgoingRouteStatusByDocumentId.get(doc.id) ?? null;

      const routedToOffice =
        latestOutgoingRouteOfficeByDocumentId.get(doc.id) ?? null;

      return mapDocument(
        doc,
        // Once the selected office routes a document onward, that office has
        // completed its handling even though the NEW outbound route can still
        // be PENDING while the next office has not received it yet.
        'COMPLETED',
        routeStatus,
        routedToOffice,
        getTimeInOffice(doc.id),
      );
    });

    /*
    |--------------------------------------------------------------------------
    | Total handled documents
    |--------------------------------------------------------------------------
    |
    | Union of:
    | 1. documents received by the selected office(s) during the period;
    | 2. documents sent by the selected office(s) during the period; and
    | 3. documents created in the period and currently in the selected office,
    |    covering documents that have not been routed yet.
    |
    | The Set removes duplicates, so a document that has several matching route
    | events is counted only once in Total Documents.
    |
    */

    const scopedDocumentIds = new Set<string>([
      ...incomingDocumentsData.map((doc) => doc.id),
      ...outgoingDocumentsData.map((doc) => doc.id),
      ...localDocuments.map((doc) => doc.id),
    ]);

    const scopedDocumentWhere: Prisma.DocumentWhereInput = {
      ...documentAttributeWhere,
      id: {
        in: Array.from(scopedDocumentIds),
      },
    };

    const totalDocumentsData = await this.prisma.document.findMany({
      where: scopedDocumentWhere,
      include: documentInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    const reportDocumentIds = totalDocumentsData.map((doc) => doc.id);

    const [documentHistoryRoutes, documentStatusLogs, documentActionRemarks] =
      await Promise.all([
        /*
  |--------------------------------------------------------------------------
  | COMPLETE ROUTING HISTORY
  |--------------------------------------------------------------------------
  |
  | Needed to determine:
  | - first receipt by Records
  | - latest route remarks
  |
  */

        this.prisma.documentRoute.findMany({
          where: {
            documentId: {
              in: reportDocumentIds,
            },
          },

          select: {
            documentId: true,

            sentAt: true,
            receivedAt: true,
            completedAt: true,

            remarks: true,

            fromOffice: {
              select: {
                id: true,
                officeCode: true,
                officeName: true,
                category: true,
              },
            },

            toOffice: {
              select: {
                id: true,
                officeCode: true,
                officeName: true,
                category: true,
              },
            },
          },

          orderBy: {
            sentAt: 'asc',
          },
        }),

        /*
  |--------------------------------------------------------------------------
  | DOCUMENT STATUS HISTORY
  |--------------------------------------------------------------------------
  |
  | Needed to determine the exact date
  | the document became COMPLETED or
  | END_TRANSACTION.
  |
  */

        this.prisma.documentLog.findMany({
          where: {
            documentId: {
              in: reportDocumentIds,
            },

            action: 'STATUS_UPDATED',
          },

          select: {
            documentId: true,
            description: true,
            createdAt: true,
          },

          orderBy: {
            createdAt: 'asc',
          },
        }),

        /*
  |--------------------------------------------------------------------------
  | ALL DOCUMENT ACTION REMARKS
  |--------------------------------------------------------------------------
  |
  | Separate from report actions because
  | the report's current `actions` relation
  | is intentionally filtered by office/date.
  |
  */

        this.prisma.documentAction.findMany({
          where: {
            documentId: {
              in: reportDocumentIds,
            },
          },

          select: {
            documentId: true,
            comment: true,
            createdAt: true,
          },

          orderBy: {
            createdAt: 'asc',
          },
        }),
      ]);

    const documentSummaryMetaById = new Map<string, DocumentSummaryMeta>();

    for (const doc of totalDocumentsData) {
      const routes = documentHistoryRoutes.filter(
        (route) => route.documentId === doc.id,
      );

      /*
  |--------------------------------------------------------------------------
  | RECEIVED DATE
  |--------------------------------------------------------------------------
  |
  | Priority:
  |
  | 1. Actual route received by any Records office
  | 2. If Records was the originating office,
  |    createdAt represents Records intake
  | 3. Local/unrouted document currently in Records
  |
  */

      const receivedByRecordsRoute = routes.find(
        (route) => route.toOffice.category === 'RECORDS' && route.receivedAt,
      );

      let receivedAt = receivedByRecordsRoute?.receivedAt ?? null;

      /*
       * Most externally received documents
       * are encoded/created directly by Records.
       *
       * In this case there is no incoming route
       * TO Records. The first route instead
       * originates FROM Records.
       */
      if (!receivedAt) {
        const originatedFromRecords = routes.some(
          (route) => route.fromOffice.category === 'RECORDS',
        );

        if (originatedFromRecords) {
          receivedAt = doc.createdAt;
        }
      }

      /*
       * Document created in Records
       * but never routed yet.
       */
      if (
        !receivedAt &&
        routes.length === 0 &&
        doc.currentOffice.category === 'RECORDS'
      ) {
        receivedAt = doc.createdAt;
      }

      /*
  |--------------------------------------------------------------------------
  | COMPLETED DATE
  |--------------------------------------------------------------------------
  */

      const logs = documentStatusLogs.filter(
        (log) => log.documentId === doc.id,
      );

      let completedAt: Date | null = null;

      if (TERMINAL_DOCUMENT_STATUSES.has(doc.currentStatus.name)) {
        const terminalLogs = logs.filter((log) => {
          const status = getStatusFromLog(log.description);

          return status !== null && TERMINAL_DOCUMENT_STATUSES.has(status);
        });

        const latestTerminalLog = terminalLogs.at(-1);

        completedAt = latestTerminalLog?.createdAt ?? null;

        /*
         * Legacy fallback:
         *
         * If older completed documents
         * have no STATUS_UPDATED log,
         * updatedAt is the best available
         * timestamp.
         */
        if (!completedAt) {
          completedAt = doc.updatedAt;
        }
      }

      /*
  |--------------------------------------------------------------------------
  | LATEST REMARKS
  |--------------------------------------------------------------------------
  |
  | Candidate sources:
  |
  | - routing remarks
  | - document action comments
  |
  | Whichever was recorded latest wins.
  |
  */

      const remarkCandidates: {
        text: string;
        createdAt: Date;
      }[] = [];

      for (const route of routes) {
        const remarks = route.remarks?.trim();

        if (remarks) {
          remarkCandidates.push({
            text: remarks,
            createdAt: route.sentAt,
          });
        }
      }

      const actions = documentActionRemarks.filter(
        (action) => action.documentId === doc.id,
      );

      for (const action of actions) {
        const comment = action.comment?.trim();

        if (comment) {
          remarkCandidates.push({
            text: comment,
            createdAt: action.createdAt,
          });
        }
      }

      remarkCandidates.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );

      const latestRemarks = remarkCandidates[0]?.text ?? null;

      documentSummaryMetaById.set(doc.id, {
        receivedAt,
        completedAt,
        latestRemarks,
      });
    }

    const officeHandlingRoutes = await this.prisma.documentRoute.findMany({
      where: {
        documentId: {
          in: reportDocumentIds,
        },

        OR: [
          {
            toOfficeId: {
              in: officeIds,
            },
          },
          {
            fromOfficeId: {
              in: officeIds,
            },
          },
        ],
      },

      select: {
        documentId: true,
        fromOfficeId: true,
        toOfficeId: true,
        sentAt: true,
        receivedAt: true,
        completedAt: true,
        status: true,
      },

      orderBy: {
        sentAt: 'asc',
      },
    });

    const now1 = Date.now();

    const reportDocumentMap = new Map(
      totalDocumentsData.map((doc) => [doc.id, doc]),
    );

    for (const documentId of reportDocumentIds) {
      const doc = reportDocumentMap.get(documentId);

      if (!doc) {
        continue;
      }

      const documentRoutes = officeHandlingRoutes.filter(
        (route) => route.documentId === documentId,
      );

      let totalDuration = 0;

      /*
   |-------------------------------------------------------------
   | INITIAL OFFICE CUSTODY
   |
   | If the first route originates from the selected office,
   | the document started there.
   |
   | createdAt → first sentAt
   |-------------------------------------------------------------
   */

      const firstRoute = documentRoutes[0];

      if (firstRoute && officeIds.includes(firstRoute.fromOfficeId)) {
        const startedAt = doc.createdAt.getTime();

        const endedAt = firstRoute.sentAt.getTime();

        totalDuration += Math.max(endedAt - startedAt, 0);
      }

      /*
   |-------------------------------------------------------------
   | RECEIVED CUSTODY PERIODS
   |
   | receivedAt → completedAt
   |
   | If still in custody:
   | receivedAt → now
   |-------------------------------------------------------------
   */

      const receivedRoutes = documentRoutes.filter(
        (route) => officeIds.includes(route.toOfficeId) && route.receivedAt,
      );

      for (const route of receivedRoutes) {
        const startedAt = route.receivedAt!.getTime();

        const endedAt = route.completedAt ? route.completedAt.getTime() : now1;

        totalDuration += Math.max(endedAt - startedAt, 0);
      }

      /*
   |-------------------------------------------------------------
   | DOCUMENT CREATED HERE BUT NEVER ROUTED
   |-------------------------------------------------------------
   */

      if (
        documentRoutes.length === 0 &&
        officeIds.includes(doc.currentOfficeId)
      ) {
        totalDuration += Math.max(now1 - doc.createdAt.getTime(), 0);
      }

      timeInOfficeByDocumentId.set(documentId, totalDuration);
    }

    /*
    |--------------------------------------------------------------------------
    | Office handling status + actual route status
    |--------------------------------------------------------------------------
    |
    | `status`       = Document.currentStatus (overall document lifecycle)
    | `officeStatus` = status relative to the selected office(s)
    | `routeStatus`  = actual status of the relevant DocumentRoute
    |
    | Important rule:
    | Once the selected office routes a document onward, officeStatus becomes
    | COMPLETED even though the newly-created outbound route is still PENDING.
    |
    | If the same document later comes back to the selected office, the newer
    | incoming activity wins, so officeStatus can become RECEIVED again.
    */

    type OfficeRouteState = {
      officeStatus: string;
      routeStatus: string;
      routedToOffice: string;
      activityAt: Date;
    };

    const officeRouteStateByDocumentId = new Map<string, OfficeRouteState>();

    const rememberOfficeRouteState = (
      documentId: string,
      officeStatus: string,
      routeStatus: string,
      routedToOffice: string,
      activityAt: Date | null,
    ) => {
      if (!activityAt) {
        return;
      }

      const existing = officeRouteStateByDocumentId.get(documentId);

      if (!existing || activityAt.getTime() >= existing.activityAt.getTime()) {
        officeRouteStateByDocumentId.set(documentId, {
          officeStatus,
          routeStatus,
          routedToOffice,
          activityAt,
        });
      }
    };

    // Incoming activity: the route's current status represents the selected
    // destination office's current handling state.
    for (const route of incomingRoutes) {
      rememberOfficeRouteState(
        route.documentId,
        route.status,
        route.status,
        route.toOffice.officeName,
        route.receivedAt ?? route.sentAt,
      );
    }

    // Outgoing activity: the selected sender office is finished handling the
    // document. The outbound route itself may still be PENDING for the next
    // office, and we preserve that separately in routeStatus.
    for (const route of outgoingRoutes) {
      rememberOfficeRouteState(
        route.documentId,
        'COMPLETED',
        route.status,
        route.toOffice.officeName,
        route.sentAt,
      );
    }

    const getOfficeStatus = (documentId: string) =>
      officeRouteStateByDocumentId.get(documentId)?.officeStatus ?? null;

    const getRouteStatus = (documentId: string) =>
      officeRouteStateByDocumentId.get(documentId)?.routeStatus ?? null;

    const getRoutedToOffice = (documentId: string) =>
      officeRouteStateByDocumentId.get(documentId)?.routedToOffice ?? null;

    const getOfficeReportStatus = (doc: ReportDocument) => {
      const officeStatus = getOfficeStatus(doc.id);

      switch (officeStatus) {
        /*
    |--------------------------------------------------------------------------
    | Routed to reporting office but not yet received
    |--------------------------------------------------------------------------
    */

        case 'PENDING':
          return 'AWAITING_RECEIPT';

        /*
    |--------------------------------------------------------------------------
    | Currently received / under custody
    |--------------------------------------------------------------------------
    */

        case 'RECEIVED':
          /*
           * If the document itself has been completed
           * while still in the reporting office,
           * then this is genuinely Completed.
           */
          if (
            doc.currentStatus.name === 'COMPLETED' &&
            officeIds.includes(doc.currentOfficeId)
          ) {
            return 'COMPLETED';
          }

          return 'IN_CUSTODY';

        /*
    |--------------------------------------------------------------------------
    | Route handling completed
    |--------------------------------------------------------------------------
    |
    | A COMPLETED route normally means the reporting
    | office finished its part and routed onward.
    |
    | However, if the whole document was completed
    | while still in this office, show COMPLETED.
    |
    */

        case 'COMPLETED':
          if (
            doc.currentStatus.name === 'COMPLETED' &&
            officeIds.includes(doc.currentOfficeId)
          ) {
            return 'COMPLETED';
          }

          return 'FORWARDED';

        /*
    |--------------------------------------------------------------------------
    | Returned
    |--------------------------------------------------------------------------
    */

        case 'RETURNED':
          return 'RETURNED';

        /*
    |--------------------------------------------------------------------------
    | Locally Created / Unrouted
    |--------------------------------------------------------------------------
    */

        default:
          if (officeIds.includes(doc.currentOfficeId)) {
            if (doc.currentStatus.name === 'COMPLETED') {
              return 'COMPLETED';
            }

            return 'IN_CUSTODY';
          }

          return 'UNKNOWN';
      }
    };

    const totalDocumentsList = totalDocumentsData.map((doc) =>
      mapDocument(
        doc,
        getOfficeReportStatus(doc),
        getRouteStatus(doc.id),
        getRoutedToOffice(doc.id),
        getTimeInOffice(doc.id),

        documentSummaryMetaById.get(doc.id),
      ),
    );

    /*
    |--------------------------------------------------------------------------
    | Derived document lists
    |--------------------------------------------------------------------------
    |
    | These are now derived from the SAME canonical report scope. This keeps
    | Total, Pending, Completed, Overdue and all breakdowns consistent.
    |
    */

    const pendingStatuses = new Set([
      'PENDING',
      'FOR_REVIEW',
      'FOR_APPROVAL',
      'ON_PROCESS',
    ]);

    const pendingDocumentsData = totalDocumentsData.filter(
      (doc) =>
        officeIds.includes(doc.currentOfficeId) &&
        pendingStatuses.has(doc.currentStatus.name),
    );

    /*
|--------------------------------------------------------------------------
| ACTED DOCUMENTS
|--------------------------------------------------------------------------
|
| A document is considered ACTED only when the selected/reporting
| office has an actual DocumentAction.
|
*/

    const actedDocumentsData = totalDocumentsData.filter(
      (doc) => doc.actions.length > 0,
    );

    /*
|--------------------------------------------------------------------------
| COMPLETED DOCUMENTS
|--------------------------------------------------------------------------
|
| Completed means the entire document lifecycle is completed,
| not merely forwarded by the reporting office.
|
*/

    const completedDocumentsData = totalDocumentsData.filter(
      (doc) =>
        officeIds.includes(doc.currentOfficeId) &&
        doc.currentStatus.name === 'COMPLETED',
    );

    const now = new Date();

    const overdueDocumentsData = totalDocumentsData.filter(
      (doc) =>
        officeIds.includes(doc.currentOfficeId) &&
        doc.deadline !== null &&
        doc.deadline.getTime() < now.getTime() &&
        /*
         * Completed documents can
         * never be overdue anymore.
         */
        doc.currentStatus.name !== 'COMPLETED',
    );

    const pendingDocumentsList = pendingDocumentsData.map((doc) =>
      mapDocument(
        doc,
        getOfficeReportStatus(doc),
        getRouteStatus(doc.id),
        getRoutedToOffice(doc.id),
        getTimeInOffice(doc.id),
      ),
    );

    const actedDocumentsList = actedDocumentsData.map((doc) =>
      mapDocument(
        doc,
        getOfficeReportStatus(doc),
        getRouteStatus(doc.id),
        getRoutedToOffice(doc.id),
        getTimeInOffice(doc.id),
      ),
    );

    const completedDocumentsList = completedDocumentsData.map((doc) =>
      mapDocument(
        doc,
        getOfficeReportStatus(doc),
        getRouteStatus(doc.id),
        getRoutedToOffice(doc.id),
        getTimeInOffice(doc.id),
      ),
    );

    const overdueDocumentsList = overdueDocumentsData.map((doc) =>
      mapDocument(
        doc,
        getOfficeReportStatus(doc),
        getRouteStatus(doc.id),
        getRoutedToOffice(doc.id),
        getTimeInOffice(doc.id),
      ),
    );

    /*
    |--------------------------------------------------------------------------
    | Status breakdown
    |--------------------------------------------------------------------------
    */

    const statusBreakdownMap = new Map<
      string,
      {
        statusId: string;
        statusName: string;
        count: number;
      }
    >();

    for (const doc of totalDocumentsData) {
      const officeStatus = getOfficeReportStatus(doc);

      const statusNameMap: Record<string, string> = {
        AWAITING_RECEIPT: 'Awaiting Receipt',

        IN_CUSTODY: 'In Custody',

        COMPLETED: 'Completed',

        RETURNED: 'Returned',

        FORWARDED: 'Forwarded',

        UNKNOWN: 'Unknown',
      };

      const existing = statusBreakdownMap.get(officeStatus);

      if (existing) {
        existing.count += 1;
      } else {
        statusBreakdownMap.set(officeStatus, {
          statusId: officeStatus,

          statusName: statusNameMap[officeStatus] ?? officeStatus,

          count: 1,
        });
      }
    }

    const statusBreakdown = Array.from(statusBreakdownMap.values());

    /*
    |--------------------------------------------------------------------------
    | Document type breakdown
    |--------------------------------------------------------------------------
    */

    const documentTypeBreakdownMap = new Map<
      string,
      { documentTypeId: string; documentTypeName: string; count: number }
    >();

    for (const doc of totalDocumentsData) {
      const existing = documentTypeBreakdownMap.get(doc.documentType.id);

      if (existing) {
        existing.count += 1;
      } else {
        documentTypeBreakdownMap.set(doc.documentType.id, {
          documentTypeId: doc.documentType.id,
          documentTypeName: doc.documentType.name,
          count: 1,
        });
      }
    }

    const documentTypeBreakdown = Array.from(documentTypeBreakdownMap.values());

    /*
    |--------------------------------------------------------------------------
    | Priority breakdown
    |--------------------------------------------------------------------------
    |
    | Keep the previous groupBy-like response shape so the frontend does not
    | need to change immediately.
    |
    */

    const priorityBreakdownMap = new Map<ReportDocument['priority'], number>();

    for (const doc of totalDocumentsData) {
      priorityBreakdownMap.set(
        doc.priority,
        (priorityBreakdownMap.get(doc.priority) ?? 0) + 1,
      );
    }

    const byPriority = Array.from(priorityBreakdownMap.entries()).map(
      ([priority, count]) => ({
        priority,
        _count: {
          priority: count,
        },
      }),
    );

    /*
    |--------------------------------------------------------------------------
    | Monthly trend
    |--------------------------------------------------------------------------
    |
    | The trend is limited to events inside the requested date range even when
    | the document itself entered the report scope because of route activity.
    |
    | NOTE: COMPLETED still uses Document.updatedAt because the current schema/
    | service does not expose a dedicated document-level completedAt timestamp.
    |
    */

    const trendMap = new Map<
      string,
      {
        month: string;
        created: number;
        completed: number;
      }
    >();

    for (const doc of totalDocumentsData) {
      if (isWithinRange(doc.createdAt)) {
        const createdMonth = doc.createdAt.toISOString().slice(0, 7);

        const created = trendMap.get(createdMonth) ?? {
          month: createdMonth,
          created: 0,
          completed: 0,
        };

        created.created += 1;
        trendMap.set(createdMonth, created);
      }

      if (
        doc.currentStatus.name === 'COMPLETED' &&
        isWithinRange(doc.updatedAt)
      ) {
        const completedMonth = doc.updatedAt.toISOString().slice(0, 7);

        const completed = trendMap.get(completedMonth) ?? {
          month: completedMonth,
          created: 0,
          completed: 0,
        };

        completed.completed += 1;
        trendMap.set(completedMonth, completed);
      }
    }

    const monthlyTrend = Array.from(trendMap.values()).sort((a, b) =>
      a.month.localeCompare(b.month),
    );

    /*
|--------------------------------------------------------------------------
| Completion rate - document level
|--------------------------------------------------------------------------
|
| Global completion of documents.
| This is different from office action/performance.
|
*/

    const totalDocuments = totalDocumentsData.length;

    const completedDocuments = completedDocumentsData.length;

    const completionRate =
      totalDocuments === 0
        ? 0
        : Number(((completedDocuments / totalDocuments) * 100).toFixed(1));

    /*
|--------------------------------------------------------------------------
| Action rate - document level
|--------------------------------------------------------------------------
|
| A document is ACTED when the selected reporting office has
| an actual DocumentAction during the reporting period.
|
*/

    const actedDocuments = actedDocumentsData.length;

    const actionRate =
      totalDocuments === 0
        ? 0
        : Number(((actedDocuments / totalDocuments) * 100).toFixed(1));

    /*
|--------------------------------------------------------------------------
| Route completion rate - office handling level
|--------------------------------------------------------------------------
|
| Cohort = routes actually RECEIVED by the selected office(s).
|
| This measures whether the office finished its custody/handling
| of received documents.
|
*/

    const receivedRoutes = incomingRoutes.filter(
      (route) => route.receivedAt !== null,
    );

    const completedRoutes = receivedRoutes.filter(
      (route) => route.status === 'COMPLETED' && route.completedAt !== null,
    );

    const totalReceivedRoutes = receivedRoutes.length;

    const completedCount = completedRoutes.length;

    const routeCompletionRate =
      totalReceivedRoutes === 0
        ? 0
        : Number(((completedCount / totalReceivedRoutes) * 100).toFixed(1));

    /*
|--------------------------------------------------------------------------
| Average processing time
|--------------------------------------------------------------------------
*/

    const processingTimes = completedRoutes.map(
      (route) => route.completedAt!.getTime() - route.receivedAt!.getTime(),
    );

    const averageProcessingTime =
      processingTimes.length === 0
        ? 0
        : processingTimes.reduce((sum, time) => sum + time, 0) /
          processingTimes.length;

    const averageProcessingHours =
      averageProcessingTime === 0
        ? 0
        : Number((averageProcessingTime / (1000 * 60 * 60)).toFixed(1));

    const averageProcessingDays = averageProcessingTime / (1000 * 60 * 60 * 24);

    /*
|--------------------------------------------------------------------------
| Time efficiency
|--------------------------------------------------------------------------
|
| Current baseline target = 3 days.
|
| Maximum score = 100%.
|
*/

    const targetProcessingDays = 3;

    let timeEfficiency = 0;

    if (averageProcessingDays > 0) {
      timeEfficiency = (targetProcessingDays / averageProcessingDays) * 100;
    }

    timeEfficiency = Math.min(timeEfficiency, 100);

    /*
|--------------------------------------------------------------------------
| Overall processing efficiency
|--------------------------------------------------------------------------
|
| 50% = Actual office action
| 30% = Route completion
| 20% = Processing speed
|
*/

    const processingEfficiency = Math.round(
      actionRate * 0.5 + routeCompletionRate * 0.3 + timeEfficiency * 0.2,
    );

    /*
    |--------------------------------------------------------------------------
    | Response
    |--------------------------------------------------------------------------
    */

    return {
      reportPeriod: {
        type: filter.type,
        startDate,
        endDate,
      },

      summary: {
        totalDocuments: {
          count: totalDocuments,
          documents: totalDocumentsList,
        },

        incomingDocuments: {
          count: incomingDocumentsData.length,
          routeCount: incomingRoutes.length,
          documents: incomingDocumentsList,
        },

        outgoingDocuments: {
          count: outgoingDocumentsData.length,
          routeCount: outgoingRoutes.length,
          documents: outgoingDocumentsList,
        },

        pendingDocuments: {
          count: pendingDocumentsData.length,
          documents: pendingDocumentsList,
        },

        actedDocuments: {
          count: actedDocumentsData.length,
          documents: actedDocumentsList,
        },

        completedDocuments: {
          count: completedDocuments,
          documents: completedDocumentsList,
        },

        overdueDocuments: {
          count: overdueDocumentsData.length,
          documents: overdueDocumentsList,
        },

        completionRate,
        actionRate,
        processingEfficiency,
        efficiencyRate: routeCompletionRate,
        averageProcessingHours,
      },

      statusBreakdown,
      documentTypeBreakdown,
      byPriority,
      monthlyTrend,
      actionRate,
      timeEfficiency,
      processingEfficiency,

      analytics: {
        averageProcessingHours,
      },

      // Same canonical document scope used by summary.totalDocuments.
      documents: totalDocumentsList,

      generatedAt: new Date(),
    };
  }

  private getDateRange(filter: ReportFilterDto) {
    switch (filter.type) {
      case ReportType.MONTHLY:
        return {
          startDate: new Date(filter.year!, filter.month! - 1, 1),
          endDate: new Date(filter.year!, filter.month!, 0, 23, 59, 59, 999),
        };

      case ReportType.QUARTERLY: {
        const startMonth = (filter.quarter! - 1) * 3;

        return {
          startDate: new Date(filter.year!, startMonth, 1),
          endDate: new Date(filter.year!, startMonth + 3, 0, 23, 59, 59, 999),
        };
      }

      case ReportType.ANNUAL:
        return {
          startDate: new Date(filter.year!, 0, 1),
          endDate: new Date(filter.year!, 11, 31, 23, 59, 59, 999),
        };

      case ReportType.CUSTOM:
        return {
          startDate: new Date(filter.startDate!),
          endDate: new Date(filter.endDate!),
        };

      default:
        throw new Error('Invalid report type.');
    }
  }
}
