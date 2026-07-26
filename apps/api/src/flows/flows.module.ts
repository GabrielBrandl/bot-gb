import { Module, forwardRef } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { MessagesModule } from "../messages/messages.module";
import { PaymentsModule } from "../payments/payments.module";
import { FlowExecutorService } from "./flow-executor.service";
import { FlowsController } from "./flows.controller";
import { FlowsService } from "./flows.service";

@Module({
  imports: [
    forwardRef(() => MessagesModule),
    ConversationsModule,
    forwardRef(() => AiModule),
    forwardRef(() => PaymentsModule),
  ],
  controllers: [FlowsController],
  providers: [FlowsService, FlowExecutorService],
  exports: [FlowsService, FlowExecutorService],
})
export class FlowsModule {}
