import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { topKSimilar } from "./cosine";
import { OpenAiAdapter } from "./providers/openai.adapter";

const CHUNK_SIZE = 500;

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenAiAdapter,
  ) {}

  listDocuments(tenantId: string, agentId?: string) {
    return this.prisma.knowledgeDocument.findMany({
      where: {
        tenantId,
        ...(agentId ? { agentId } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, agentId: true, createdAt: true },
    });
  }

  async createDocument(
    tenantId: string,
    data: { title: string; content: string; agentId?: string },
  ) {
    if (data.agentId) {
      const agent = await this.prisma.aIAgent.findFirst({
        where: { id: data.agentId, tenantId },
      });
      if (!agent) {
        throw new NotFoundException("Agente de IA não encontrado");
      }
    }

    const document = await this.prisma.knowledgeDocument.create({
      data: {
        tenantId,
        title: data.title,
        content: data.content,
        agentId: data.agentId,
      },
    });

    const chunks = splitIntoChunks(data.content, CHUNK_SIZE);
    for (const chunk of chunks) {
      const { embedding } = await this.openai.embed({ text: chunk });
      await this.prisma.knowledgeChunk.create({
        data: {
          tenantId,
          documentId: document.id,
          content: chunk,
          embedding,
        },
      });
    }

    return document;
  }

  async deleteDocument(tenantId: string, id: string) {
    const doc = await this.prisma.knowledgeDocument.findFirst({ where: { id, tenantId } });
    if (!doc) {
      throw new NotFoundException("Documento não encontrado");
    }
    await this.prisma.knowledgeDocument.delete({ where: { id } });
    return { ok: true };
  }

  async searchChunks(tenantId: string, query: string, agentId?: string, topK = 3) {
    const { embedding: queryEmbedding } = await this.openai.embed({ text: query });

    const chunks = await this.prisma.knowledgeChunk.findMany({
      where: {
        tenantId,
        ...(agentId
          ? { document: { agentId } }
          : {}),
      },
      select: { id: true, content: true, embedding: true },
    });

    return topKSimilar(
      queryEmbedding,
      chunks.map((c) => ({
        id: c.id,
        content: c.content,
        embedding: c.embedding as number[],
      })),
      topK,
    );
  }
}

function splitIntoChunks(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks.length > 0 ? chunks : [text];
}
