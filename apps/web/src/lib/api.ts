import type { FlowGraph } from "@bot-wpp/shared-types";
import type {
  AiAgent,
  AuditEntry,
  Campaign,
  Contact,
  Conversation,
  KanbanBoard,
  KanbanCard,
  Message,
  Payment,
  QuickReply,
  ReportsOverview,
  Tag,
  TeamUser,
  Tenant,
  WhatsappInstance,
  Flow,
} from "./types";

export { apiRequest, ApiClientError } from "./api-base";

import { apiRequest } from "./api-base";

// WhatsApp
export const whatsappApi = {
  listInstances: (token: string) =>
    apiRequest<WhatsappInstance[]>("/whatsapp/instances", {}, token),
  createInstance: (token: string, name: string) =>
    apiRequest<WhatsappInstance>("/whatsapp/instances", {
      method: "POST",
      body: JSON.stringify({ name }),
    }, token),
  getQr: (token: string, id: string) =>
    apiRequest<{ base64?: string; code?: string }>(`/whatsapp/instances/${id}/qr`, {}, token),
  refresh: (token: string, id: string) =>
    apiRequest<void>(`/whatsapp/instances/${id}/refresh`, { method: "POST" }, token),
  delete: (token: string, id: string) =>
    apiRequest<void>(`/whatsapp/instances/${id}`, { method: "DELETE" }, token),
  demoInbound: (token: string, data: { phone: string; name?: string; text: string; instanceId?: string }) =>
    apiRequest<{ conversationId?: string }>("/whatsapp/demo/inbound", {
      method: "POST",
      body: JSON.stringify(data),
    }, token),
};

// Conversations
export const conversationsApi = {
  list: (token: string, status?: string) => {
    const qs = status ? `?status=${status}` : "";
    return apiRequest<Conversation[]>(`/conversations${qs}`, {}, token);
  },
  get: (token: string, id: string) =>
    apiRequest<Conversation>(`/conversations/${id}`, {}, token),
  update: (token: string, id: string, data: { status?: string; assignedTo?: string | null }) =>
    apiRequest<Conversation>(`/conversations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }, token),
  addNote: (token: string, id: string, content: string) =>
    apiRequest<void>(`/conversations/${id}/notes`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }, token),
};

// Messages
export const messagesApi = {
  list: (token: string, conversationId: string) =>
    apiRequest<Message[]>(`/conversations/${conversationId}/messages`, {}, token),
  send: (token: string, conversationId: string, content: string, type?: string) =>
    apiRequest<Message>(`/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content, type }),
    }, token),
};

// Contacts
export const contactsApi = {
  list: (token: string) => apiRequest<Contact[]>("/contacts", {}, token),
  create: (token: string, data: { name: string; phone: string; email?: string; tagIds?: string[] }) =>
    apiRequest<Contact>("/contacts", { method: "POST", body: JSON.stringify(data) }, token),
  update: (token: string, id: string, data: Partial<{ name: string; phone: string; email: string; tagIds: string[] }>) =>
    apiRequest<Contact>(`/contacts/${id}`, { method: "PATCH", body: JSON.stringify(data) }, token),
};

// Tags
export const tagsApi = {
  list: (token: string) => apiRequest<Tag[]>("/tags", {}, token),
  create: (token: string, name: string, color?: string) =>
    apiRequest<Tag>("/tags", { method: "POST", body: JSON.stringify({ name, color }) }, token),
  delete: (token: string, id: string) =>
    apiRequest<void>(`/tags/${id}`, { method: "DELETE" }, token),
};

// Quick replies
export const quickRepliesApi = {
  list: (token: string) => apiRequest<QuickReply[]>("/quick-replies", {}, token),
  create: (token: string, title: string, content: string) =>
    apiRequest<QuickReply>("/quick-replies", {
      method: "POST",
      body: JSON.stringify({ title, content }),
    }, token),
  delete: (token: string, id: string) =>
    apiRequest<void>(`/quick-replies/${id}`, { method: "DELETE" }, token),
};

// Kanban
export const kanbanApi = {
  getBoard: (token: string) => apiRequest<KanbanBoard>("/kanban/board", {}, token),
  createCard: (token: string, data: { title: string; stageId: string; description?: string; contactId?: string }) =>
    apiRequest<KanbanCard>("/kanban/cards", { method: "POST", body: JSON.stringify(data) }, token),
  moveCard: (token: string, id: string, stageId: string, order: number) =>
    apiRequest<KanbanCard>(`/kanban/cards/${id}/move`, {
      method: "PATCH",
      body: JSON.stringify({ stageId, order }),
    }, token),
};

// Flows
export const flowsApi = {
  list: (token: string) => apiRequest<Flow[]>("/flows", {}, token),
  get: (token: string, id: string) => apiRequest<Flow>(`/flows/${id}`, {}, token),
  create: (token: string, data: { name: string; description?: string; graph?: FlowGraph }) =>
    apiRequest<Flow>("/flows", { method: "POST", body: JSON.stringify(data) }, token),
  update: (token: string, id: string, data: Partial<{ name: string; description: string; isActive: boolean; graph: FlowGraph }>) =>
    apiRequest<Flow>(`/flows/${id}`, { method: "PATCH", body: JSON.stringify(data) }, token),
};

// AI
export const aiApi = {
  listAgents: (token: string) => apiRequest<AiAgent[]>("/ai/agents", {}, token),
  createAgent: (token: string, data: { name: string; persona: string; provider: string; model?: string }) =>
    apiRequest<AiAgent>("/ai/agents", { method: "POST", body: JSON.stringify(data) }, token),
  addDocument: (token: string, agentId: string, title: string, content: string) =>
    apiRequest<AiDocument>(`/ai/agents/${agentId}/documents`, {
      method: "POST",
      body: JSON.stringify({ title, content }),
    }, token),
  ask: (token: string, agentId: string, question: string) =>
    apiRequest<{ answer: string }>(`/ai/agents/${agentId}/ask`, {
      method: "POST",
      body: JSON.stringify({ question }),
    }, token),
};

interface AiDocument {
  id: string;
  title: string;
  content: string;
}

// Campaigns
export const campaignsApi = {
  list: (token: string) => apiRequest<Campaign[]>("/campaigns", {}, token),
  create: (token: string, data: { name: string; message: string; tagId?: string }) =>
    apiRequest<Campaign>("/campaigns", { method: "POST", body: JSON.stringify(data) }, token),
  start: (token: string, id: string) =>
    apiRequest<Campaign>(`/campaigns/${id}/start`, { method: "POST" }, token),
};

// Payments
export const paymentsApi = {
  list: (token: string) => apiRequest<Payment[]>("/payments", {}, token),
  create: (
    token: string,
    data: {
      contactId?: string;
      phone?: string;
      amount: number;
      description?: string;
      billingType?: "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED";
      sendViaWhatsApp?: boolean;
      conversationId?: string;
    },
  ) => apiRequest<Payment>("/payments", { method: "POST", body: JSON.stringify(data) }, token),
};

// Reports
export const reportsApi = {
  overview: (token: string) => apiRequest<ReportsOverview>("/reports/overview", {}, token),
};

// Tenants
export const tenantsApi = {
  me: (token: string) => apiRequest<Tenant>("/tenants/me", {}, token),
  update: (
    token: string,
    data: Partial<{ name: string; logoUrl: string; primaryColor: string }>,
  ) => apiRequest<Tenant>("/tenants/me", { method: "PATCH", body: JSON.stringify(data) }, token),
};

// Users
export const usersApi = {
  list: (token: string) => apiRequest<TeamUser[]>("/users", {}, token),
};

// Audit
export const auditApi = {
  list: (token: string) => apiRequest<AuditEntry[]>("/audit", {}, token),
};

// Legacy export for backward compat
export { apiRequest as defaultApiRequest };
