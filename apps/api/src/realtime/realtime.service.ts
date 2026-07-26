import { Injectable } from "@nestjs/common";
import { ChatGateway } from "./chat.gateway";

@Injectable()
export class RealtimeService {
  constructor(private readonly chatGateway: ChatGateway) {}

  emitToTenant(tenantId: string, event: string, payload: unknown): void {
    this.chatGateway.emitToTenant(tenantId, event, payload);
  }
}
