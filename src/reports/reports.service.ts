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
    } satisfies Prisma.DocumentInclude;

    type ReportDocument = Prisma.DocumentGetPayload<{
      include: typeof documentInclude;
    }>;

    const mapDocument = (
      doc: ReportDocument,
      officeStatus: string | null = null,
      routeStatus: string | null = null,
      routedToOffice: string | null = null,
      timeInOfficeMs: number = 0,
    ) => {
      const allottedTimeMs = doc.deadline
        ? doc.deadline.getTime() - doc.createdAt.getTime()
        : null;

      const isOverdue =
        !!doc.deadline &&
        doc.currentStatus.name !== 'COMPLETED' &&
        new Date().getTime() > doc.deadline.getTime();

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

        classification: doc.classification,
        priority: doc.priority,

        createdAt: doc.createdAt,
        deadline: doc.deadline,

        // NEW
        allottedTimeMs,
        timeInOfficeMs,
        isOverdue,
        deadlineStatus: !doc.deadline
          ? 'NO_DEADLINE'
          : isOverdue
            ? 'OVERDUE'
            : officeStatus === 'PENDING'
              ? 'AWAITING_RECEIPT'
              : 'ON_TIME',
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
      if (!latestIncomingRouteStatusByDocumentId.has(route.documentId)) {
        latestIncomingRouteStatusByDocumentId.set(
          route.documentId,
          route.status,
        );

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
      if (!latestOutgoingRouteStatusByDocumentId.has(route.documentId)) {
        latestOutgoingRouteStatusByDocumentId.set(
          route.documentId,
          route.status,
        );

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
        case 'PENDING':
          return 'AWAITING_RECEIPT';

        case 'RECEIVED':
          return 'IN_CUSTODY';

        case 'COMPLETED':
          return 'COMPLETED';

        case 'RETURNED':
          return 'RETURNED';

        default:
          /*
           * Locally-created document nga wala pay route
           * pero currently naa sa selected office.
           */
          if (officeIds.includes(doc.currentOfficeId)) {
            return 'IN_CUSTODY';
          }

          return 'UNKNOWN';
      }
    };

    const totalDocumentsList = totalDocumentsData.map((doc) =>
      mapDocument(
        doc,
        getOfficeStatus(doc.id),
        getRouteStatus(doc.id),
        getRoutedToOffice(doc.id),
        getTimeInOffice(doc.id),
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

    const completedDocumentsData = totalDocumentsData.filter(
      (doc) => getOfficeStatus(doc.id) === 'COMPLETED',
    );

    const now = new Date();

    const overdueDocumentsData = totalDocumentsData.filter(
      (doc) =>
        officeIds.includes(doc.currentOfficeId) &&
        doc.deadline !== null &&
        doc.deadline.getTime() < now.getTime() &&
        getOfficeStatus(doc.id) !== 'COMPLETED',
    );

    const pendingDocumentsList = pendingDocumentsData.map((doc) =>
      mapDocument(
        doc,
        getOfficeStatus(doc.id),
        getRouteStatus(doc.id),
        getRoutedToOffice(doc.id),
        getTimeInOffice(doc.id),
      ),
    );

    const completedDocumentsList = completedDocumentsData.map((doc) =>
      mapDocument(
        doc,
        getOfficeStatus(doc.id),
        getRouteStatus(doc.id),
        getRoutedToOffice(doc.id),
        getTimeInOffice(doc.id),
      ),
    );

    const overdueDocumentsList = overdueDocumentsData.map((doc) =>
      mapDocument(
        doc,
        getOfficeStatus(doc.id),
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
    */

    const totalDocuments = totalDocumentsData.length;
    const completedDocuments = completedDocumentsData.length;

    const completionRate =
      totalDocuments === 0
        ? 0
        : Number(((completedDocuments / totalDocuments) * 100).toFixed(1));

    /*
    |--------------------------------------------------------------------------
    | Office processing efficiency - route level
    |--------------------------------------------------------------------------
    |
    | Cohort = routes RECEIVED by the selected office(s) during the report
    | period. This is a better office-performance basis than document.createdAt.
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

    const efficiencyRate =
      totalReceivedRoutes === 0
        ? 0
        : Number(((completedCount / totalReceivedRoutes) * 100).toFixed(1));

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

    const targetProcessingDays = 3;

    let timeEfficiency = 0;

    if (averageProcessingDays > 0) {
      timeEfficiency = (targetProcessingDays / averageProcessingDays) * 100;
    }

    timeEfficiency = Math.min(timeEfficiency, 100);

    const processingEfficiency = Math.round(
      efficiencyRate * 0.7 + timeEfficiency * 0.3,
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

        completedDocuments: {
          count: completedDocuments,
          documents: completedDocumentsList,
        },

        overdueDocuments: {
          count: overdueDocumentsData.length,
          documents: overdueDocumentsList,
        },

        completionRate,
        processingEfficiency,
        efficiencyRate,
        averageProcessingHours,
      },

      statusBreakdown,
      documentTypeBreakdown,
      byPriority,
      monthlyTrend,

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
