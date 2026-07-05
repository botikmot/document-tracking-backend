import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';

import { CommunityService } from './community.service';
import { CreateMessageDto } from './dto/create-message.dto';

interface OnlineUser {
  socketId: string;
  userId: string;
  firstName: string;
  lastName: string;
  office?: string;
  profileImage?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },

  transports: ['websocket', 'polling'],
})
export class CommunityGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(private readonly communityService: CommunityService) {}

  @WebSocketServer()
  server!: Server;

  /**
   * userId -> socketId
   */
  private onlineUsers = new Map<string, OnlineUser>();

  private async emitUnreadUpdates(communityId: string, senderId: string) {
    const members =
      await this.communityService.getCommunityMembers(communityId);

    for (const member of members) {
      if (member.userId === senderId) {
        continue;
      }

      const unread = await this.communityService.getUnreadCount(
        member.userId,
        communityId,
      );

      this.sendToUser(member.userId, 'community-unread', {
        communityId,
        unreadCount: unread,
      });
    }
  }

  // =====================================================
  // CONNECTION
  // =====================================================

  handleConnection(client: Socket) {
    console.log(`Community Connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Community Disconnected: ${client.id}`);

    for (const [userId, onlineUser] of this.onlineUsers.entries()) {
      if (onlineUser.socketId === client.id) {
        this.onlineUsers.delete(userId);
        break;
      }
    }

    this.broadcastOnlineUsers();
  }

  // =====================================================
  // REGISTER USER
  // =====================================================

  @SubscribeMessage('register')
  async handleRegister(
    @MessageBody() userId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const user = await this.communityService.getUser(userId);

    if (!user) return;

    this.onlineUsers.set(user.id, {
      socketId: client.id,
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      office: user.offices[0]?.office.officeName,
      profileImage: user.profileImageUrl ?? undefined,
    });

    this.broadcastOnlineUsers();
  }

  // =====================================================
  // JOIN COMMUNITY
  // =====================================================

  @SubscribeMessage('join-community')
  handleJoinCommunity(
    @MessageBody() communityId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(communityId);

    console.log(`${client.id} joined ${communityId}`);
  }

  // =====================================================
  // LEAVE COMMUNITY
  // =====================================================

  @SubscribeMessage('leave-community')
  handleLeaveCommunity(
    @MessageBody() communityId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(communityId);

    console.log(`${client.id} left ${communityId}`);
  }

  // =====================================================
  // SEND MESSAGE
  // =====================================================

  @SubscribeMessage('send-message')
  async handleSendMessage(
    @MessageBody()
    payload: {
      userId: string;
      communityId: string;
      message: string;
    },
  ) {
    const dto: CreateMessageDto = {
      message: payload.message,
    };

    const newMessage = await this.communityService.sendMessage(
      payload.userId,
      payload.communityId,
      dto,
    );

    this.server.to(payload.communityId).emit('new-message', newMessage);

    //await this.emitUnreadUpdates(payload.communityId, payload.userId);
    const members = await this.communityService.getCommunityMembers(
      payload.communityId,
    );

    for (const member of members) {
      if (member.userId === payload.userId) {
        continue;
      }

      const unread = await this.communityService.getUnreadCount(
        member.userId,
        payload.communityId,
      );

      this.sendToUser(member.userId, 'community-unread', {
        communityId: payload.communityId,
        unreadCount: unread,
      });
    }

    return newMessage;
  }

  // =====================================================
  // ONLINE USERS
  // =====================================================

  private broadcastOnlineUsers() {
    this.server.emit('online-users', Array.from(this.onlineUsers.values()));
  }

  // =====================================================
  // OPTIONAL HELPERS
  // =====================================================

  /**
   * Send a system message to a community.
   */
  sendSystemMessage(communityId: string, payload: unknown) {
    this.server.to(communityId).emit('system-message', payload);
  }

  /**
   * Broadcast to everyone in a community.
   */
  broadcastCommunity(communityId: string, event: string, payload: unknown) {
    this.server.to(communityId).emit(event, payload);
  }

  /**
   * Send to one specific user.
   */
  sendToUser(userId: string, event: string, payload: unknown) {
    const onlineUser = this.onlineUsers.get(userId);

    if (!onlineUser) return;

    this.server.to(onlineUser.socketId).emit(event, payload);
  }

  getOnlineUsers() {
    return Array.from(this.onlineUsers.values());
  }

  // =====================================================
  // MESSAGE EVENTS
  // =====================================================

  broadcastMessageUpdated(communityId: string, message: unknown) {
    this.server.to(communityId).emit('message-updated', message);
  }

  broadcastMessageDeleted(communityId: string, message: unknown) {
    this.server.to(communityId).emit('message-deleted', message);
  }
}
