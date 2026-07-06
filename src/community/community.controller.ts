import {
  Controller,
  Body,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CommunityService } from './community.service';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { CreateDirectDto } from './dto/create-direct.dto';
import { AddMembersDto } from './dto/add-members.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { CommunityGateway } from './community.gateway';
import { ToggleReactionDto } from './dto/toggle-reaction.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('communities')
@UseGuards(JwtAuthGuard)
export class CommunityController {
  constructor(
    private readonly communityService: CommunityService,
    private readonly communityGateway: CommunityGateway,
  ) {}

  // ============================
  // COMMUNITY
  // ============================

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.communityService.findAll(req.user.userId);
  }

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateCommunityDto) {
    return this.communityService.create(req.user.userId, dto);
  }

  @Post('direct')
  createDirect(@Req() req: AuthenticatedRequest, @Body() dto: CreateDirectDto) {
    return this.communityService.createDirectConversation(
      req.user.userId,
      dto.targetUserId,
    );
  }

  @Get('users')
  getUsers(@Req() req: AuthenticatedRequest) {
    return this.communityService.findAllUsers(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.communityService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateCommunityDto,
  ) {
    return this.communityService.update(id, req.user.userId, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.communityService.remove(id, req.user.userId);
  }

  // ============================
  // MESSAGES
  // ============================

  @Post('messages/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/community',

        filename: (req, file, callback) => {
          const filename = `${Date.now()}-${file.originalname}`;

          callback(null, filename);
        },
      }),
    }),
  )
  uploadFile(
    @UploadedFile()
    file: Express.Multer.File,
  ) {
    return {
      filename: file.filename,

      originalName: file.originalname,

      path: `/uploads/community/${file.filename}`,

      mimeType: file.mimetype,

      size: file.size,
    };
  }

  @Patch('messages/:messageId')
  async updateMessage(
    @Req() req: AuthenticatedRequest,

    @Param('messageId')
    messageId: string,

    @Body()
    dto: UpdateMessageDto,
  ) {
    const updated = await this.communityService.updateMessage(
      req.user.userId,
      messageId,
      dto,
    );

    this.communityGateway.broadcastMessageUpdated(updated.communityId, updated);

    return updated;
  }

  @Delete('messages/:messageId')
  async deleteMessage(
    @Req() req: AuthenticatedRequest,

    @Param('messageId')
    messageId: string,
  ) {
    const deleted = await this.communityService.deleteMessage(
      req.user.userId,
      messageId,
    );

    this.communityGateway.broadcastMessageDeleted(deleted.communityId, deleted);

    return deleted;
  }

  @Post('messages/:messageId/reactions')
  async toggleReaction(
    @Req() req: AuthenticatedRequest,

    @Param('messageId')
    messageId: string,

    @Body()
    dto: ToggleReactionDto,
  ) {
    const updated = await this.communityService.toggleReaction(
      req.user.userId,
      messageId,
      dto,
    );

    this.communityGateway.broadcastReactionUpdated(
      updated.communityId,
      updated,
    );

    return updated;
  }

  @Get(':id/messages')
  getMessages(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = '20',
  ) {
    return this.communityService.getMessages(
      id,
      req.user.userId,
      Number(page),
      Number(limit),
    );
  }

  @Post(':id/messages')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/community',

        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}${extname(file.originalname)}`;

          cb(null, uniqueName);
        },
      }),
    }),
  )
  async sendMessage(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const message = await this.communityService.sendMessage(
      req.user.userId,
      id,
      dto,
      file,
    );

    this.communityGateway.broadcastNewMessage(id, message);

    return message;
  }

  @Post(':id/read')
  markAsRead(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.communityService.markAsRead(req.user.userId, id);
  }

  // ============================
  // MEMBERS
  // ============================

  @Post(':id/join')
  join(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.communityService.join(req.user.userId, id);
  }

  @Post(':id/leave')
  leave(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.communityService.leave(req.user.userId, id);
  }

  @Post(':id/invite')
  invite(@Param('id') id: string, @Body() dto: InviteMemberDto) {
    return this.communityService.invite(id, dto.userId);
  }

  @Delete(':id/member/:memberId')
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.communityService.removeMember(id, req.user.userId, memberId);
  }

  @Post(':id/members')
  addMembers(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: AddMembersDto,
  ) {
    return this.communityService.addMembers(id, req.user.userId, dto.memberIds);
  }
}
