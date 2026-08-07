import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { UserRole } from "@bot-wpp/database";
import { Server, Socket } from "socket.io";
import { PrismaService } from "../prisma/prisma.service";

interface JwtPayload {
  sub: string;
  tenantId: string;
  email?: string;
  role?: string;
  impersonating?: boolean;
  homeTenantId?: string;
}

@WebSocketGateway({ cors: { origin: true } })
@Injectable()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
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

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_SECRET || this.config.getOrThrow<string>("JWT_SECRET"),
      });

      if (payload.impersonating) {
        const owner = await this.prisma.user.findFirst({
          where: { id: payload.sub, role: UserRole.PLATFORM_OWNER, active: true },
        });
        if (!owner) {
          client.disconnect();
          return;
        }
        const target = await this.prisma.tenant.findUnique({ where: { id: payload.tenantId } });
        if (!target) {
          client.disconnect();
          return;
        }
      } else {
        const user = await this.prisma.user.findFirst({
          where: { id: payload.sub, tenantId: payload.tenantId, active: true },
          include: { tenant: true },
        });
        if (!user) {
          client.disconnect();
          return;
        }
        if (
          user.role !== UserRole.PLATFORM_OWNER &&
          user.tenant.billingStatus === "suspended"
        ) {
          client.disconnect();
          return;
        }
      }

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
