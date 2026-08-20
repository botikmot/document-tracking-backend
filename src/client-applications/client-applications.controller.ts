import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';

import type { Response } from 'express';

import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';

import { ClientApplicationAttachmentType } from '@prisma/client';

import { ClientJwtAuthGuard } from '../client-auth/guards/client-jwt-auth.guard';

import { ClientApplicationsService } from './client-applications.service';
import { CreateClientApplicationDto } from './dto/create-client-application.dto';
import { clientApplicationUploadOptions } from './client-application-upload.config';
import { UploadClientRequirementDto } from './dto/upload-client-requirement.dto';

@Controller('client-applications')
@UseGuards(ClientJwtAuthGuard)
export class ClientApplicationsController {
  constructor(
    private readonly clientApplicationsService: ClientApplicationsService,
  ) {}

  @Post()
  create(
    @Req()
    req: {
      user: {
        clientId: string;
      };
    },

    @Body()
    dto: CreateClientApplicationDto,
  ) {
    return this.clientApplicationsService.create(req.user.clientId, dto);
  }

  @Get()
  findAll(
    @Req()
    req: {
      user: {
        clientId: string;
      };
    },
  ) {
    return this.clientApplicationsService.findAll(req.user.clientId);
  }

  @Get(':id')
  findOne(
    @Req()
    req: {
      user: {
        clientId: string;
      };
    },

    @Param('id')
    id: string,
  ) {
    return this.clientApplicationsService.findOne(req.user.clientId, id);
  }

  @Post(':id/letter-request')
  @UseInterceptors(FileInterceptor('file', clientApplicationUploadOptions))
  uploadLetterRequest(
    @Req()
    req: {
      user: {
        clientId: string;
      };
    },

    @Param('id')
    applicationId: string,

    @UploadedFile()
    file: Express.Multer.File,
  ) {
    return this.clientApplicationsService.uploadAttachments(
      req.user.clientId,
      applicationId,
      file ? [file] : [],
      ClientApplicationAttachmentType.LETTER_REQUEST,
    );
  }

  @Post(':id/attachments')
  @UseInterceptors(
    FilesInterceptor('files', 10, clientApplicationUploadOptions),
  )
  uploadSupportingDocuments(
    @Req()
    req: {
      user: {
        clientId: string;
      };
    },

    @Param('id')
    applicationId: string,

    @Body()
    dto: UploadClientRequirementDto,

    @UploadedFiles()
    files: Express.Multer.File[],
  ) {
    return this.clientApplicationsService.uploadAttachments(
      req.user.clientId,
      applicationId,
      files,
      ClientApplicationAttachmentType.SUPPORTING_DOCUMENT,
      dto.requirementId,
    );
  }

  @Post(':id/submit')
  submit(
    @Req()
    req: {
      user: {
        clientId: string;
      };
    },

    @Param('id')
    applicationId: string,
  ) {
    return this.clientApplicationsService.submit(
      req.user.clientId,
      applicationId,
    );
  }

  @Post(':id/resubmit')
  resubmit(
    @Req()
    req: {
      user: {
        clientId: string;
      };
    },

    @Param('id')
    applicationId: string,
  ) {
    return this.clientApplicationsService.resubmit(
      req.user.clientId,
      applicationId,
    );
  }

  @Get(':id/attachments/:attachmentId/download')
  async downloadAttachment(
    @Req()
    req: {
      user: {
        clientId: string;
      };
    },

    @Param('id')
    applicationId: string,

    @Param('attachmentId')
    attachmentId: string,

    @Res()
    res: Response,
  ) {
    const { attachment, absolutePath } =
      await this.clientApplicationsService.getAttachmentForDownload(
        req.user.clientId,
        applicationId,
        attachmentId,
      );

    res.setHeader('Content-Type', attachment.mimeType);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(attachment.originalName)}"`,
    );

    return res.sendFile(absolutePath);
  }
}
