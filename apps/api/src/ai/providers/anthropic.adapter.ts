import { Injectable, Logger } from "@nestjs/common";
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
  private readonly logger = new Logger(AnthropicAdapter.name);
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

    try {
      const response = await this.client.messages.create({
        model: request.model ?? "claude-haiku-4-5",
        max_tokens: 1024,
        system: request.systemPrompt,
        messages: [{ role: "user", content: request.userMessage }],
      });

      const block = response.content[0];
      const text = block && block.type === "text" ? block.text : "";
      return { text };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/credit balance is too low/i.test(message)) {
        this.logger.warn(
          "Anthropic: saldo insuficiente. Adicione créditos em Plans & Billing.",
        );
      } else {
        this.logger.warn(`Anthropic complete failed: ${message}`);
      }
      // Evita 500 e spam no WhatsApp; o serviço trata resposta vazia como unavailable.
      return { text: "" };
    }
  }

  async embed(request: AiEmbeddingRequest): Promise<AiEmbeddingResponse> {
    return { embedding: hashEmbedding(request.text, 32) };
  }
}
