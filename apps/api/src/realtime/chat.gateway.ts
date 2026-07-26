import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { AuthUser } from "@bot-wpp/shared-types";
import { Server, Socket } from "socket.io";

@WebSocketGateway({ cors: { origin: "*" } })
@Injectable()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        client.handshake.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync<AuthUser>(token, {
        secret: this.config.getOrThrow<string>("JWT_SECRET"),
      });

      const room = `tenant:${payload.tenantId}`;
      await client.join(room);
      client.data.user = payload;
      this.logger.debug(`Client ${client.id} joined ${room}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  emitToTenant(tenantId: string, event: string, payload: unknown): void {
    if (!this.server) {
      return;
    }
    this.server.to(`tenant:${tenantId}`).emit(event, payload);
  }
}
