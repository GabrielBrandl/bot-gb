import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OpenAiAdapter } from "./providers/openai.adapter";
import { AnthropicAdapter } from "./providers/anthropic.adapter";
import { KnowledgeService } from "./knowledge.service";
import type { AiProvider } from "./providers/ai-provider.interface";

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenAiAdapter,
    private readonly anthropic: AnthropicAdapter,
    private readonly knowledge: KnowledgeService,
  ) {}

  listAgents(tenantId: string) {
    return this.prisma.aIAgent.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getAgent(tenantId: string, id: string) {
    const agent = await this.prisma.aIAgent.findFirst({ where: { id, tenantId } });
    if (!agent) {
      throw new NotFoundException("Agente de IA não encontrado");
    }
    return agent;
  }

  async createAgent(
    tenantId: string,
    data: {
      name: string;
      persona: string;
      modelProvider: string;
      systemPrompt?: string;
      active?: boolean;
    },
  ) {
    const count = await this.prisma.aIAgent.count({ where: { tenantId } });
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (tenant && count >= tenant.maxAgents) {
      throw new BadRequestException("Limite de agentes de IA atingido para o plano atual");
    }

    return this.prisma.aIAgent.create({
      data: {
        tenantId,
        name: data.name,
        persona: data.persona,
        modelProvider: data.modelProvider,
        systemPrompt: data.systemPrompt,
        active: data.active ?? true,
      },
    });
  }

  async updateAgent(
    tenantId: string,
    id: string,
    data: Partial<{
      name: string;
      persona: string;
      modelProvider: string;
      systemPrompt: string;
      active: boolean;
    }>,
  ) {
    await this.getAgent(tenantId, id);
    return this.prisma.aIAgent.update({ where: { id }, data });
  }

  async removeAgent(tenantId: string, id: string) {
    await this.getAgent(tenantId, id);
    await this.prisma.aIAgent.delete({ where: { id } });
    return { ok: true };
  }

  async askAgent(
    tenantId: string,
    agentId: string,
    input: { question: string; conversationId?: string },
  ) {
    const agent = await this.getAgent(tenantId, agentId);
    const provider = this.getProvider(agent.modelProvider);

    const chunks = await this.knowledge.searchChunks(tenantId, input.question, agentId, 3);
    const context = chunks.map((c) => c.content).join("\n---\n");

    let conversationContext = "";
    if (input.conversationId) {
      const messages = await this.prisma.message.findMany({
        where: { tenantId, conversationId: input.conversationId, isInternal: false },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      conversationContext = messages
        .reverse()
        .map((m) => `${m.direction}: ${m.content}`)
        .join("\n");
    }

    const systemPrompt = [
      agent.systemPrompt ?? agent.persona,
      context ? `Contexto da base de conhecimento:\n${context}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const userMessage = conversationContext
      ? `Histórico recente:\n${conversationContext}\n\nPergunta: ${input.question}`
      : input.question;

    const response = await provider.complete({ systemPrompt, userMessage });
    return { answer: response.text, sources: chunks };
  }

  async suggestReply(tenantId: string, conversationId: string, agentId?: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: { contact: true },
    });
    if (!conversation) {
      throw new NotFoundException("Conversa não encontrada");
    }

    const agent =
      agentId != null
        ? await this.getAgent(tenantId, agentId)
        : await this.prisma.aIAgent.findFirst({ where: { tenantId, active: true } });

    if (!agent) {
      return {
        suggestion:
          "Nenhum agente de IA ativo configurado. Crie um agente em Configurações > IA.",
      };
    }

    const lastInbound = await this.prisma.message.findFirst({
      where: { conversationId, direction: "inbound", isInternal: false },
      orderBy: { createdAt: "desc" },
    });

    const question = lastInbound?.content ?? "Cliente aguardando atendimento";
    const result = await this.askAgent(tenantId, agent.id, { question, conversationId });
    return { suggestion: result.answer, agentId: agent.id };
  }

  private getProvider(modelProvider: string): AiProvider {
    if (modelProvider.toLowerCase().includes("anthropic") || modelProvider.toLowerCase().includes("claude")) {
      return this.anthropic;
    }
    return this.openai;
  }
}
