import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";
import type {
  AiCompletionRequest,
  AiCompletionResponse,
  AiEmbeddingRequest,
  AiEmbeddingResponse,
  AiProvider,
} from "./ai-provider.interface";
import { hashEmbedding } from "./openai.adapter";

@Injectable()
export class AnthropicAdapter implements AiProvider {
  private readonly client: Anthropic | null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("ANTHROPIC_API_KEY");
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    if (!this.client) {
      return {
        text: "Configure ANTHROPIC_API_KEY para habilitar respostas de IA.",
      };
    }

    const response = await this.client.messages.create({
      model: request.model ?? "claude-3-5-haiku-latest",
      max_tokens: 1024,
      system: request.systemPrompt,
      messages: [{ role: "user", content: request.userMessage }],
    });

    const block = response.content[0];
    const text = block && block.type === "text" ? block.text : "";
    return { text };
  }

  async embed(request: AiEmbeddingRequest): Promise<AiEmbeddingResponse> {
    return { embedding: hashEmbedding(request.text, 32) };
  }
}
