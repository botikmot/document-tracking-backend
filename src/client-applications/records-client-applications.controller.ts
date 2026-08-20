import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import type { Response } from 'express';

import { ClientApplicationsService } from './client-applications.service';

import { AcceptClientApplicationDto } from './dto/accept-client-application.dto';
import { RejectClientApplicationDto } from './dto/reject-client-application.dto';
import { RequestAdditionalRequirementsDto } from './dto/request-additional-requirements.dto';

/*
 * Use your existing INTERNAL eDATS auth guard here.
 */
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { AuthenticatedUser } from '../auth/authenticated-user.interface';

@Controller('records/client-applications')
@UseGuards(JwtAuthGuard)
export class RecordsClientApplicationsController {
  constructor(
    private readonly clientApplicationsService: ClientApplicationsService,
  ) {}

  /*
   * ------------------------------------------------------------
   * RECORDS INBOX
   * ------------------------------------------------------------
   */
  @Get()
  findAll(
    @Req()
    req: {
      user: AuthenticatedUser;
    },
  ) {
    return this.clientApplicationsService.findRecordsInbox(req.user);
  }

  /*
   * ------------------------------------------------------------
   * APPLICATION DETAILS
   * ------------------------------------------------------------
   */
  @Get(':id')
  findOne(
    @Req()
    req: {
      user: AuthenticatedUser;
    },

    @Param('id')
    applicationId: string,
  ) {
    return this.clientApplicationsService.findOneForRecords(
      req.user,
      applicationId,
    );
  }

  /*
   * ------------------------------------------------------------
   * START REVIEW
   * ------------------------------------------------------------
   */
  @Post(':id/start-review')
  startReview(
    @Req()
    req: {
      user: AuthenticatedUser;
    },

    @Param('id')
    applicationId: string,
  ) {
    return this.clientApplicationsService.startReview(req.user, applicationId);
  }

  /*
   * ------------------------------------------------------------
   * REQUEST ADDITIONAL REQUIREMENTS
   * ------------------------------------------------------------
   */
  @Post(':id/request-additional-requirements')
  requestAdditionalRequirements(
    @Req()
    req: {
      user: AuthenticatedUser;
    },

    @Param('id')
    applicationId: string,

    @Body()
    dto: RequestAdditionalRequirementsDto,
  ) {
    return this.clientApplicationsService.requestAdditionalRequirements(
      req.user,
      applicationId,
      dto.remarks,
    );
  }

  /*
   * ------------------------------------------------------------
   * REJECT
   * ------------------------------------------------------------
   */
  @Post(':id/reject')
  reject(
    @Req()
    req: {
      user: AuthenticatedUser;
    },

    @Param('id')
    applicationId: string,

    @Body()
    dto: RejectClientApplicationDto,
  ) {
    return this.clientApplicationsService.rejectForRecords(
      req.user,
      applicationId,
      dto.reason,
    );
  }

  /*
   * ------------------------------------------------------------
   * ACCEPT
   * ------------------------------------------------------------
   */
  @Post(':id/accept')
  accept(
    @Req()
    req: {
      user: AuthenticatedUser;
    },

    @Param('id')
    applicationId: string,

    @Body()
    dto: AcceptClientApplicationDto,
  ) {
    return this.clientApplicationsService.acceptForRecords(
      req.user,
      applicationId,
      dto,
    );
  }

  /*
   * ------------------------------------------------------------
   * SECURE ATTACHMENT DOWNLOAD
   * ------------------------------------------------------------
   */
  @Get(':id/attachments/:attachmentId/download')
  async downloadAttachment(
    @Req()
    req: {
      user: AuthenticatedUser;
    },

    @Param('id')
    applicationId: string,

    @Param('attachmentId')
    attachmentId: string,

    @Res()
    res: Response,
  ) {
    const { attachment, absolutePath } =
      await this.clientApplicationsService.getAttachmentForRecordsDownload(
        req.user,
        applicationId,
        attachmentId,
      );

    res.setHeader('Content-Type', attachment.mimeType);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(
        attachment.originalName,
      )}`,
    );

    return res.sendFile(absolutePath);
  }
}
