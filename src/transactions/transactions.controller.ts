import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';

import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { TransactionsService } from './transactions.service';

import { TransactionQueryDto } from './dto/transaction-query.dto';

import { Param } from '@nestjs/common';

import { OfficeTransactionDocumentsQueryDto } from './dto/office-transaction-documents-query.dto';

type AuthenticatedUser = {
  userId: string;

  username?: string;

  roles: string[];

  officeIds: string[];
};

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  /*
  |--------------------------------------------------------------------------
  | OFFICE SUMMARY
  |--------------------------------------------------------------------------
  |
  | GET /transactions/office-summary
  |
  */

  @Get('office-summary')
  getOfficeSummary(
    @Req()
    request: AuthenticatedRequest,

    @Query()
    query: TransactionQueryDto,
  ) {
    return this.transactionsService.getOfficeSummary(request.user, query);
  }

  /*
|--------------------------------------------------------------------------
| OFFICE DOCUMENTS
|--------------------------------------------------------------------------
|
| GET
| /transactions/offices/:officeId/documents
|
*/

  @Get('offices/:officeId/documents')
  getOfficeDocuments(
    @Req()
    request: AuthenticatedRequest,

    @Param('officeId')
    officeId: string,

    @Query()
    query: OfficeTransactionDocumentsQueryDto,
  ) {
    return this.transactionsService.getOfficeDocuments(
      request.user,
      officeId,
      query,
    );
  }

  /*
|--------------------------------------------------------------------------
| DOCUMENT TRANSACTION TIMELINE
|--------------------------------------------------------------------------
|
| GET
| /transactions/documents/:documentId/timeline
|
*/

  @Get('documents/:documentId/timeline')
  getDocumentTimeline(
    @Req()
    request: AuthenticatedRequest,

    @Param('documentId')
    documentId: string,
  ) {
    return this.transactionsService.getDocumentTimeline(
      request.user,
      documentId,
    );
  }
}
