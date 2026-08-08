export interface AiCompletionRequest {
  systemPrompt: string;
  userMessage: string;
  model?: string;
}

export interface AiCompletionResponse {
  text: string;
}

export interface AiEmbeddingRequest {
  text: string;
}

export interface AiEmbeddingResponse {
  embedding: number[];
}

export interface AiProvider {
  isAvailable(): boolean;
  complete(request: AiCompletionRequest): Promise<AiCompletionResponse>;
  embed(request: AiEmbeddingRequest): Promise<AiEmbeddingResponse>;
}
