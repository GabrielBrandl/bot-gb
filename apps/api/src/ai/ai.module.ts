import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { KnowledgeService } from "./knowledge.service";
import { OpenAiAdapter } from "./providers/openai.adapter";
import { AnthropicAdapter } from "./providers/anthropic.adapter";

@Module({
  controllers: [AiController],
  providers: [AiService, KnowledgeService, OpenAiAdapter, AnthropicAdapter],
  exports: [AiService, KnowledgeService],
})
export class AiModule {}
