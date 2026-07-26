import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { AuthModule } from "./auth/auth.module";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { TenantsModule } from "./tenants/tenants.module";
import { UsersModule } from "./users/users.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { WhatsappModule } from "./whatsapp/whatsapp.module";
import { ConversationsModule } from "./conversations/conversations.module";
import { MessagesModule } from "./messages/messages.module";
import { ContactsModule } from "./contacts/contacts.module";
import { TagsModule } from "./tags/tags.module";
import { QuickRepliesModule } from "./quick-replies/quick-replies.module";
import { KanbanModule } from "./kanban/kanban.module";
import { FlowsModule } from "./flows/flows.module";
import { AiModule } from "./ai/ai.module";
import { CampaignsModule } from "./campaigns/campaigns.module";
import { PaymentsModule } from "./payments/payments.module";
import { ReportsModule } from "./reports/reports.module";
import { AuditModule } from "./audit/audit.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env"],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>("REDIS_HOST", "localhost"),
          port: config.get<number>("REDIS_PORT", 6379),
        },
      }),
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    HealthModule,
    RealtimeModule,
    WhatsappModule,
    ConversationsModule,
    MessagesModule,
    ContactsModule,
    TagsModule,
    QuickRepliesModule,
    KanbanModule,
    FlowsModule,
    AiModule,
    CampaignsModule,
    PaymentsModule,
    ReportsModule,
  ],
})
export class AppModule {}
