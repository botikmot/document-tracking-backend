import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';

import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type';

import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { RouteDocumentDto } from './dto/route-document.dto';
import { ReturnDocumentDto } from './dto/return-document.dto';
import { DecisionDocumentDto } from './dto/decision-document.dto';

@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  /*
   |--------------------------------------------------------------------------
   | CREATE DOCUMENT
   |--------------------------------------------------------------------------
   */

  @Post()
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN', 'SECRETARY', 'ENCODER')
  create(
    @Body()
    dto: CreateDocumentDto,

    @Req()
    req: AuthenticatedRequest,
  ) {
    return this.documentsService.create(dto, req.user);
  }

  /*
   |--------------------------------------------------------------------------
   | LIST DOCUMENTS
   |--------------------------------------------------------------------------
   */

  @Get()
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN', 'SECRETARY', 'ENCODER', 'VIEWER')
  findAll(
    @Req()
    req: AuthenticatedRequest,

    @Query('page')
    page = '1',

    @Query('limit')
    limit = '5',

    @Query('status')
    status?: string,

    @Query('search')
    search?: string,
  ) {
    return this.documentsService.findAll(
      req.user,
      Number(page),
      Number(limit),
      status,
      search,
    );
  }

  /*
   |--------------------------------------------------------------------------
   | INCOMING DOCUMENTS
   |--------------------------------------------------------------------------
   */

  @Get('incoming')
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN', 'SECRETARY', 'ENCODER', 'VIEWER')
  getIncoming(
    @Req()
    req: AuthenticatedRequest,
    @Query('page')
    page?: string,

    @Query('limit')
    limit?: string,

    @Query('search')
    search?: string,
  ) {
    return this.documentsService.getIncomingDocuments(
      req.user,
      Number(page) || 1,
      Number(limit) || 5,
      search,
    );
  }

  /*
   |--------------------------------------------------------------------------
   | OUTGOING DOCUMENTS
   |--------------------------------------------------------------------------
   */

  @Get('outgoing')
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN', 'SECRETARY', 'ENCODER', 'VIEWER')
  getOutgoing(
    @Req()
    req: AuthenticatedRequest,
    @Query('page')
    page = '1',

    @Query('limit')
    limit = '5',

    @Query('search')
    search?: string,
  ) {
    return this.documentsService.getOutgoingDocuments(
      req.user,
      Number(page),
      Number(limit),
      search,
    );
  }

  /*
   |--------------------------------------------------------------------------
   | PENDING DOCUMENTS
   |--------------------------------------------------------------------------
   */

  @Get('pending')
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN', 'SECRETARY', 'ENCODER')
  getPending(
    @Req()
    req: AuthenticatedRequest,
    @Query('page')
    page = '1',

    @Query('limit')
    limit = '5',

    @Query('search')
    search?: string,
  ) {
    return this.documentsService.getPendingDocuments(
      req.user,
      Number(page),
      Number(limit),
      search,
    );
  }

  /*
|--------------------------------------------------------------------------
| DASHBOARD STATS
|--------------------------------------------------------------------------
*/

  @Get('dashboard/stats')
  getDashboardStats(
    @Req()
    req: AuthenticatedRequest,
  ) {
    return this.documentsService.getDashboardStats(req.user);
  }

  @Get('stats')
  getStats(
    @Req()
    req: AuthenticatedRequest,
  ) {
    return this.documentsService.getStats(req.user);
  }

  /*
   |--------------------------------------------------------------------------
   | RECEIVED DOCUMENTS
   |--------------------------------------------------------------------------
   */

  @Get('received')
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN', 'SECRETARY', 'ENCODER', 'VIEWER')
  getReceived(
    @Req()
    req: AuthenticatedRequest,
  ) {
    return this.documentsService.getReceivedDocuments(req.user);
  }

  @Get('next-tracking-number')
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN', 'SECRETARY', 'ENCODER')
  async getNextTrackingNumber() {
    const trackingNumber = await this.documentsService.getNextTrackingNumber();

    return {
      trackingNumber,
    };
  }

  /*
 |--------------------------------------------------------------------------
 | TRACK DOCUMENT
 |--------------------------------------------------------------------------
 */

  @Get('track/:trackingNumber')
  trackDocument(
    @Param('trackingNumber')
    trackingNumber: string,
  ) {
    return this.documentsService.trackDocument(trackingNumber);
  }

  /*
   |--------------------------------------------------------------------------
   | ARCHIVED DOCUMENTS
   |--------------------------------------------------------------------------
   */

  @Get('archived')
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN', 'SECRETARY', 'ENCODER', 'VIEWER')
  getArchived(
    @Req()
    req: AuthenticatedRequest,
    @Query('page')
    page = '1',

    @Query('limit')
    limit = '5',

    @Query('search')
    search?: string,
  ) {
    return this.documentsService.getArchivedDocuments(
      req.user,
      Number(page) || 1,
      Number(limit) || 5,
      search,
    );
  }

  /*
|--------------------------------------------------------------------------
| SEARCH DOCUMENTS (GLOBAL SEARCH)
|--------------------------------------------------------------------------
*/

  @Get('search')
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN', 'SECRETARY', 'ENCODER', 'VIEWER')
  searchDocuments(
    @Req() req: AuthenticatedRequest,
    @Query('q')
    q: string,
  ) {
    return this.documentsService.searchDocuments(req.user, q);
  }

  /*
   |--------------------------------------------------------------------------
   | FIND ONE DOCUMENT
   |--------------------------------------------------------------------------
   */

  @Get(':id')
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN', 'SECRETARY', 'ENCODER', 'VIEWER')
  findOne(
    @Param('id')
    id: string,
  ) {
    return this.documentsService.findOne(id);
  }

  /*
   |--------------------------------------------------------------------------
   | UPDATE DOCUMENT
   |--------------------------------------------------------------------------
   */

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN', 'SECRETARY', 'ENCODER')
  update(
    @Param('id')
    id: string,

    @Body()
    dto: UpdateDocumentDto,

    @Req()
    req: AuthenticatedRequest,
  ) {
    return this.documentsService.update(id, dto, req.user);
  }

  /*
   |--------------------------------------------------------------------------
   | ROUTE DOCUMENT
   |--------------------------------------------------------------------------
   */

  @Post(':id/route')
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN', 'SECRETARY')
  routeDocument(
    @Param('id')
    id: string,

    @Body()
    dto: RouteDocumentDto,

    @Req()
    req: AuthenticatedRequest,
  ) {
    return this.documentsService.routeDocument(id, dto, req.user);
  }

  /*
|--------------------------------------------------------------------------
| UPDATE DOCUMENT STATUS
|--------------------------------------------------------------------------
*/

  @Patch(':id/status')
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN', 'SECRETARY', 'ENCODER')
  updateStatus(
    @Param('id') id: string,

    @Body()
    body: {
      status: string;
    },

    @Req()
    req: AuthenticatedRequest,
  ) {
    return this.documentsService.updateDocumentStatus(
      id,
      body.status,
      req.user,
    );
  }

  /*
   |--------------------------------------------------------------------------
   | RECEIVE DOCUMENT
   |--------------------------------------------------------------------------
   */

  @Post(':id/receive')
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN', 'SECRETARY', 'ENCODER')
  receiveDocument(
    @Param('id')
    id: string,

    @Req()
    req: AuthenticatedRequest,
  ) {
    return this.documentsService.receiveDocument(id, req.user);
  }

  /*
   |--------------------------------------------------------------------------
   | RETURN DOCUMENT
   |--------------------------------------------------------------------------
   */

  @Post(':id/return')
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN', 'SECRETARY')
  returnDocument(
    @Param('id')
    id: string,

    @Body()
    dto: ReturnDocumentDto,

    @Req()
    req: AuthenticatedRequest,
  ) {
    return this.documentsService.returnDocument(id, dto, req.user);
  }

  /*
   |--------------------------------------------------------------------------
   | APPROVE DOCUMENT
   |--------------------------------------------------------------------------
   */

  @Post(':id/approve')
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN', 'SECRETARY')
  approveDocument(
    @Param('id')
    id: string,

    @Body()
    dto: DecisionDocumentDto,

    @Req()
    req: AuthenticatedRequest,
  ) {
    return this.documentsService.approveDocument(id, dto, req.user);
  }

  /*
   |--------------------------------------------------------------------------
   | REJECT DOCUMENT
   |--------------------------------------------------------------------------
   */

  @Post(':id/reject')
  @Roles('SUPER_ADMIN', 'OFFICE_ADMIN', 'SECRETARY')
  rejectDocument(
    @Param('id')
    id: string,

    @Body()
    dto: DecisionDocumentDto,

    @Req()
    req: AuthenticatedRequest,
  ) {
    return this.documentsService.rejectDocument(id, dto, req.user);
  }
}
