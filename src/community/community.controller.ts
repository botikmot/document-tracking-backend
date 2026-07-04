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
import { AddMembersDto } from './dto/add-members.dto';

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
