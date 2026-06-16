import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },

  transports: ['websocket', 'polling'],
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    console.log('CLIENT CONNECTED:', client.id);
  }

  handleDisconnect(client: Socket) {
    console.log('CLIENT DISCONNECTED:', client.id);
  }

  @SubscribeMessage('join')
  handleJoin(@MessageBody() userId: string, @ConnectedSocket() client: Socket) {
    client.join(userId);

    console.log(`User joined room: ${userId}`);
  }

  sendNotification(
    userId: string,
    payload: {
      title: string;
      message: string;
      type?: string;
    },
  ) {
    console.log('SENDING REALTIME NOTIFICATION');

    this.server.to(userId).emit('notification', payload);
  }
}
