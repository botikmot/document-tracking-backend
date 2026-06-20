export interface ReportPeriod {
  reportType: string;
  year?: number;
  month?: number;
  quarter?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface ReportOffice {
  id: string;
  officeCode: string;
  officeName: string;
}

export interface ReportSummary {
  totalDocuments: number;
  incomingDocuments: number;
  outgoingDocuments: number;
  pendingDocuments: number;
  completedDocuments: number;
  overdueDocuments: number;
  completionRate: number;
  pendingRate: number;
}

export interface BreakdownItem {
  label: string;
  total: number;
}

export interface TrendItem {
  label: string;
  total: number;
}

export interface ProcessingAnalytics {
  averageProcessingHours: number;
  fastestProcessingHours: number;
  slowestProcessingHours: number;
  completedBeforeDeadline: number;
  completedAfterDeadline: number;
}

export interface RecentDocument {
  id: string;
  trackingNumber: string;
  title: string;
  status: string;
  office: string;
  createdAt: Date;
}

export interface ReportResponse {
  office: ReportOffice;
  period: ReportPeriod;
  summary: ReportSummary;
  processing: ProcessingAnalytics;
  statusBreakdown: BreakdownItem[];
  documentTypeBreakdown: BreakdownItem[];
  priorityBreakdown: BreakdownItem[];
  trends: TrendItem[];
  recentDocuments: RecentDocument[];
  documents: unknown[];
}
