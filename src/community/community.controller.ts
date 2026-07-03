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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CommunityService } from './community.service';
import type { AuthenticatedRequest } from '../common/types/authenticated-request.type';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { CreateDirectDto } from './dto/create-direct.dto';

@Controller('communities')
@UseGuards(JwtAuthGuard)
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

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

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCommunityDto) {
    return this.communityService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.communityService.remove(id);
  }

  // ============================
  // MESSAGES
  // ============================

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
  sendMessage(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.communityService.sendMessage(req.user.userId, id, dto);
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

  @Delete(':id/member/:userId')
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.communityService.removeMember(id, userId);
  }
}
