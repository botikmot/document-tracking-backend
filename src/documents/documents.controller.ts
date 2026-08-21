import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  Query,
  UploadedFile,
  UseInterceptors,
  Delete,
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
import { CreateDocumentActionDto } from './dto/create-document-action.dto';
import { UpdateDocumentActionDto } from './dto/update-document-action.dto';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { unlink } from 'fs/promises';

import * as path from 'path';
import * as fs from 'fs/promises';

import { existsSync, mkdirSync } from 'fs';
import { extname } from 'path';
import { randomUUID } from 'crypto';

const documentActionStorage = diskStorage({
  destination: (req, file, callback) => {
    const uploadPath = './uploads/document-actions';

    if (!existsSync(uploadPath)) {
      mkdirSync(uploadPath, {
        recursive: true,
      });
    }

    callback(null, uploadPath);
  },

  filename: (req, file, callback) => {
    const extension = extname(file.originalname).toLowerCase();

    const filename = `${randomUUID()}${extension}`;

    callback(null, filename);
  },
});

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

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/documents',

        filename: (req, file, callback) => {
          const extension = path.extname(file.originalname);

          const baseName = path
            .basename(file.originalname, extension)
            .replace(/[^a-zA-Z0-9-_]/g, '-');

          const filename = `${Date.now()}-${baseName}${extension}`;

          callback(null, filename);
        },
      }),

      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  uploadDocumentFile(
    @UploadedFile()
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return {
      fileName: file.originalname,

      filePath: `/uploads/documents/${file.filename}`,

      mimeType: file.mimetype,

      fileSize: file.size,

      /*
       * Keep this for compatibility with
       * your existing Attachment model/UI.
       *
       * For local storage, publicId will
       * simply represent the stored filename.
       */
      publicId: file.filename,
    };
  }

  @Delete('upload/:filename')
  async deleteDocumentFile(
    @Param('filename')
    filename: string,
  ) {
    /*
     * Prevent path traversal such as:
     *
     * ../../something
     */
    const safeFilename = path.basename(filename);

    const filePath = path.join(
      process.cwd(),
      'uploads',
      'documents',
      safeFilename,
    );

    try {
      await fs.unlink(filePath);

      return {
        success: true,
      };
    } catch (error) {
      /*
       * If file is already missing,
       * don't necessarily break the UI.
       */
      console.error('Delete document attachment error:', error);

      return {
        success: false,
      };
    }
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
    @Req() req: AuthenticatedRequest,
    @Param('trackingNumber')
    trackingNumber: string,
  ) {
    return this.documentsService.getDocumentByTrackingNumber(
      req.user,
      trackingNumber,
    );
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

  @Get('records-monitoring')
  getRecordsMonitoring(
    @Req()
    req: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.documentsService.getRecordsMonitoring(req.user, {
      search,
      page: Number(page),
      limit: Number(limit),
    });
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
| ADD DOCUMENT ACTION
|--------------------------------------------------------------------------
*/

  @Post(':id/actions')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: documentActionStorage,

      limits: {
        fileSize: 10 * 1024 * 1024,
      },

      fileFilter: (req, file, callback) => {
        const allowedMimeTypes = [
          'application/pdf',

          'application/msword',

          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

          'application/vnd.ms-excel',

          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

          'image/jpeg',
          'image/png',
        ];

        if (!allowedMimeTypes.includes(file.mimetype)) {
          return callback(
            new BadRequestException('Unsupported file type'),
            false,
          );
        }

        callback(null, true);
      },
    }),
  )
  async addAction(
    @Param('id')
    documentId: string,

    @Body()
    dto: CreateDocumentActionDto,

    @UploadedFile()
    file: Express.Multer.File | undefined,

    @Req()
    req: AuthenticatedRequest,
  ) {
    try {
      return await this.documentsService.addAction(
        documentId,
        dto,
        file,
        req.user,
      );
    } catch (error) {
      /*
    |--------------------------------------------------------------------------
    | Delete File If DB / Permission Validation Fails
    |--------------------------------------------------------------------------
    */

      if (file?.path) {
        await unlink(file.path).catch(() => undefined);
      }

      throw error;
    }
  }

  @Patch(':id/actions/:actionId')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/document-actions',

        filename: (req, file, callback) => {
          const filename = `${Date.now()}-${file.originalname}`;

          callback(null, filename);
        },
      }),
    }),
  )
  async updateAction(
    @Param('documentId')
    documentId: string,

    @Param('actionId')
    actionId: string,

    @Body()
    dto: UpdateDocumentActionDto,

    @UploadedFile()
    file: Express.Multer.File | undefined,

    @Req()
    req: AuthenticatedRequest,
  ) {
    try {
      return await this.documentsService.updateAction(
        documentId,
        actionId,
        dto,
        file,
        req.user,
      );
    } catch (error) {
      /*
    |--------------------------------------------------------------------------
    | Remove newly-uploaded file if update fails
    |--------------------------------------------------------------------------
    */

      if (file?.path) {
        await unlink(file.path).catch(() => undefined);
      }

      throw error;
    }
  }

  @Delete(':id/actions/:actionId')
  async deleteAction(
    @Param('documentId')
    documentId: string,

    @Param('actionId')
    actionId: string,

    @Req()
    req: AuthenticatedRequest,
  ) {
    return this.documentsService.deleteAction(documentId, actionId, req.user);
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

  @Get(':id/routing-slip-history')
  getRoutingSlipHistory(
    @Param('id')
    documentId: string,

    @Req()
    req: AuthenticatedRequest,
  ) {
    return this.documentsService.getRoutingSlipHistory(documentId, req.user);
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
