import { Module, forwardRef } from "@nestjs/common";
import { MessagesModule } from "../messages/messages.module";
import { AsaasClient } from "./asaas.client";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [forwardRef(() => MessagesModule)],
  controllers: [PaymentsController],
  providers: [PaymentsService, AsaasClient],
  exports: [PaymentsService],
})
export class PaymentsModule {}
