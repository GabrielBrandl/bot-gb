import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import type {
  AiCompletionRequest,
  AiCompletionResponse,
  AiEmbeddingRequest,
  AiEmbeddingResponse,
  AiProvider,
} from "./ai-provider.interface";

@Injectable()
export class OpenAiAdapter implements AiProvider {
  private readonly client: OpenAI | null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("OPENAI_API_KEY");
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    if (!this.client) {
      return {
        text: "Configure OPENAI_API_KEY para habilitar respostas de IA.",
      };
    }

    const response = await this.client.chat.completions.create({
      model: request.model ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userMessage },
      ],
    });

    return { text: response.choices[0]?.message?.content ?? "" };
  }

  async embed(request: AiEmbeddingRequest): Promise<AiEmbeddingResponse> {
    if (!this.client) {
      return { embedding: hashEmbedding(request.text, 32) };
    }

    const response = await this.client.embeddings.create({
      model: "text-embedding-3-small",
      input: request.text,
    });

    return { embedding: response.data[0]?.embedding ?? hashEmbedding(request.text, 32) };
  }
}

export function hashEmbedding(text: string, dims: number): number[] {
  const result = new Array<number>(dims).fill(0);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    result[i % dims] += code / 255;
  }
  const norm = Math.sqrt(result.reduce((sum, v) => sum + v * v, 0)) || 1;
  return result.map((v) => v / norm);
}
