import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ReportFilterDto, ReportType } from './dto/report-filter.dto';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async generateReport(filter: ReportFilterDto) {
    const { startDate, endDate } = this.getDateRange(filter);

    /*
    |--------------------------------------------------------------------------
    | Dynamic Filters
    |--------------------------------------------------------------------------
    */

    const documentWhere: Prisma.DocumentWhereInput = {};

    if (filter.officeIds?.length) {
      documentWhere.currentOfficeId = {
        in: filter.officeIds,
      };
    }

    if (filter.documentTypeId) {
      documentWhere.documentTypeId = filter.documentTypeId;
    }

    if (filter.status) {
      documentWhere.currentStatus = {
        name: filter.status,
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Incoming
    |--------------------------------------------------------------------------
    */

    const incomingWhere: Prisma.DocumentRouteWhereInput = {
      receivedAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (filter.officeIds?.length) {
      incomingWhere.toOfficeId = {
        in: filter.officeIds,
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Outgoing
    |--------------------------------------------------------------------------
    */

    const outgoingWhere: Prisma.DocumentRouteWhereInput = {
      sentAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (filter.officeIds?.length) {
      outgoingWhere.fromOfficeId = {
        in: filter.officeIds,
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Queries
    |--------------------------------------------------------------------------
    */

    const [
      incomingDocuments,
      outgoingDocuments,
      pendingDocuments,
      completedDocuments,
      overdueDocuments,
      totalDocuments,
    ] = await Promise.all([
      this.prisma.documentRoute.count({
        where: incomingWhere,
      }),

      this.prisma.documentRoute.count({
        where: outgoingWhere,
      }),

      this.prisma.document.count({
        where: {
          ...documentWhere,

          currentStatus: {
            name: {
              in: ['PENDING', 'FOR_REVIEW', 'FOR_APPROVAL', 'ON_PROCESS'],
            },
          },
        },
      }),

      this.prisma.document.count({
        where: {
          ...documentWhere,

          currentStatus: {
            name: 'COMPLETED',
          },
        },
      }),

      this.prisma.document.count({
        where: {
          ...documentWhere,

          deadline: {
            not: null,
            lt: new Date(),
          },

          currentStatus: {
            name: {
              not: 'COMPLETED',
            },
          },
        },
      }),

      this.prisma.document.count({
        where: documentWhere,
      }),
    ]);

    /*
    |--------------------------------------------------------------------------
    | By Status
    |--------------------------------------------------------------------------
    */

    const statusBreakdownRaw = await this.prisma.document.groupBy({
      by: ['currentStatusId'],

      _count: {
        currentStatusId: true,
      },

      where: documentWhere,
    });

    const statuses = await this.prisma.documentStatus.findMany();

    const statusMap = new Map(statuses.map((s) => [s.id, s.name]));

    const statusBreakdown = statusBreakdownRaw.map((item) => ({
      statusId: item.currentStatusId,

      statusName: statusMap.get(item.currentStatusId) ?? 'Unknown',

      count: item._count.currentStatusId,
    }));

    /*
    |--------------------------------------------------------------------------
    | By Document Type
    |--------------------------------------------------------------------------
    */

    const documentTypeBreakdownRaw = await this.prisma.document.groupBy({
      by: ['documentTypeId'],

      _count: {
        documentTypeId: true,
      },

      where: documentWhere,
    });

    const documentTypes = await this.prisma.documentType.findMany();

    const typeMap = new Map(documentTypes.map((t) => [t.id, t.name]));

    const documentTypeBreakdown = documentTypeBreakdownRaw.map((item) => ({
      documentTypeId: item.documentTypeId,

      documentTypeName: typeMap.get(item.documentTypeId) ?? 'Unknown',

      count: item._count.documentTypeId,
    }));

    const byPriority = await this.prisma.document.groupBy({
      by: ['priority'],

      _count: {
        priority: true,
      },

      where: {
        ...documentWhere,

        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const documents = await this.prisma.document.findMany({
      where: documentWhere,

      include: {
        currentStatus: true,
        documentType: true,
        currentOffice: true,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

    const trendDocuments = await this.prisma.document.findMany({
      where: documentWhere,

      select: {
        createdAt: true,
        updatedAt: true,

        currentStatus: {
          select: {
            name: true,
          },
        },
      },
    });

    const trendMap = new Map<
      string,
      {
        month: string;
        created: number;
        completed: number;
      }
    >();

    for (const doc of trendDocuments) {
      const createdMonth = doc.createdAt.toISOString().slice(0, 7);

      const created = trendMap.get(createdMonth) ?? {
        month: createdMonth,
        created: 0,
        completed: 0,
      };

      created.created++;

      trendMap.set(createdMonth, created);

      if (doc.currentStatus.name === 'COMPLETED') {
        const completedMonth = doc.updatedAt.toISOString().slice(0, 7);

        const completed = trendMap.get(completedMonth) ?? {
          month: completedMonth,
          created: 0,
          completed: 0,
        };

        completed.completed++;

        trendMap.set(completedMonth, completed);
      }
    }

    const monthlyTrend = Array.from(trendMap.values()).sort((a, b) =>
      a.month.localeCompare(b.month),
    );

    const completedDocumentsRaw = await this.prisma.document.findMany({
      where: {
        ...documentWhere,

        currentStatus: {
          name: 'COMPLETED',
        },
      },

      select: {
        createdAt: true,
        updatedAt: true,
      },
    });

    const averageProcessingHours =
      completedDocumentsRaw.length === 0
        ? 0
        : Math.round(
            completedDocumentsRaw.reduce((sum, doc) => {
              const hours =
                (doc.updatedAt.getTime() - doc.createdAt.getTime()) /
                (1000 * 60 * 60);

              return sum + hours;
            }, 0) / completedDocumentsRaw.length,
          );

    const completionRate =
      totalDocuments === 0
        ? 0
        : Number(((completedDocuments / totalDocuments) * 100).toFixed(1));

    return {
      reportPeriod: {
        type: filter.type,
        startDate,
        endDate,
      },
      summary: {
        totalDocuments,
        incomingDocuments,
        outgoingDocuments,
        pendingDocuments,
        completedDocuments,
        overdueDocuments,
        completionRate,
        averageProcessingHours,
      },
      statusBreakdown,
      documentTypeBreakdown,
      byPriority,
      monthlyTrend, //: formattedMonthlyTrend,
      analytics: {
        averageProcessingHours,
      },
      documents: documents.map((doc) => ({
        id: doc.id,
        trackingNumber: doc.trackingNumber,
        title: doc.title,
        documentType: doc.documentType.name,
        status: doc.currentStatus.name,
        office: doc.currentOffice.officeName,
        classification: doc.classification,
        priority: doc.priority,
        createdAt: doc.createdAt,
        deadline: doc.deadline,
      })),
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
