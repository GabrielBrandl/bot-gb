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
    apiRequest<{
      base64?: string | null;
      code?: string | null;
      pairingCode?: string | null;
      message?: string;
    }>(`/whatsapp/instances/${id}/qr`, {}, token),
  refresh: (token: string, id: string) =>
    apiRequest<WhatsappInstance>(`/whatsapp/instances/${id}/refresh`, { method: "POST" }, token),
  delete: (token: string, id: string) =>
    apiRequest<{ ok: boolean }>(`/whatsapp/instances/${id}`, { method: "DELETE" }, token),
  demoInbound: (token: string, data: { phone: string; name?: string; text: string; instanceId?: string }) =>
    apiRequest<{ conversationId?: string }>("/whatsapp/demo/inbound", {
      method: "POST",
      body: JSON.stringify(data),
    }, token),
};

export const instagramApi = {
  listAccounts: (token: string) =>
    apiRequest<Array<{
      id: string;
      name: string;
      igUsername?: string | null;
      status: string;
    }>>("/instagram/accounts", {}, token),
  createAccount: (token: string, name: string) =>
    apiRequest<{ id: string; name: string; status: string }>("/instagram/accounts", {
      method: "POST",
      body: JSON.stringify({ name }),
    }, token),
  connect: (token: string, id: string) =>
    apiRequest(`/instagram/accounts/${id}/connect`, { method: "POST" }, token),
  remove: (token: string, id: string) =>
    apiRequest(`/instagram/accounts/${id}`, { method: "DELETE" }, token),
  demoInbound: (token: string, data: { username?: string; text: string; accountId?: string }) =>
    apiRequest("/instagram/demo/inbound", {
      method: "POST",
      body: JSON.stringify(data),
    }, token),
};

export const plansApi = {
  list: () => apiRequest("/plans"),
  subscribe: (token: string, planId: string) =>
    apiRequest("/plans/subscribe", {
      method: "POST",
      body: JSON.stringify({ planId }),
    }, token),
};

// Conversations
export const conversationsApi = {
  list: (token: string, status?: string, channel?: string) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (channel) params.set("channel", channel);
    const qs = params.toString() ? `?${params}` : "";
    return apiRequest<Conversation[]>(`/conversations${qs}`, {}, token);
  },
  get: (token: string, id: string) =>
    apiRequest<Conversation>(`/conversations/${id}`, {}, token),
  update: async (token: string, id: string, data: { status?: string; assignedTo?: string | null }) => {
    if (data.status) {
      return apiRequest<Conversation>(`/conversations/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: data.status }),
      }, token);
    }
    if (data.assignedTo !== undefined) {
      return apiRequest<Conversation>(`/conversations/${id}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ assignedTo: data.assignedTo }),
      }, token);
    }
    return apiRequest<Conversation>(`/conversations/${id}`, {}, token);
  },
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
  config: (token: string) =>
    apiRequest<{ demoMode: boolean; billingTypes: string[]; message: string }>(
      "/payments/config",
      {},
      token,
    ),
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
  ) => apiRequest<Payment & { demoMode?: boolean }>("/payments", { method: "POST", body: JSON.stringify(data) }, token),
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
  create: (
    token: string,
    data: { name: string; email: string; password: string; role: "ADMIN" | "SUPERVISOR" | "AGENT" },
  ) => apiRequest<TeamUser>("/users", { method: "POST", body: JSON.stringify(data) }, token),
  update: (
    token: string,
    id: string,
    data: Partial<{ name: string; role: "ADMIN" | "SUPERVISOR" | "AGENT"; active: boolean; password: string }>,
  ) => apiRequest<TeamUser>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }, token),
};

export const platformApi = {
  overview: (token: string) => apiRequest("/platform/overview", {}, token),
  listTenants: (token: string) => apiRequest("/platform/tenants", {}, token),
  getTenant: (token: string, id: string) => apiRequest(`/platform/tenants/${id}`, {}, token),
  createTenant: (token: string, data: Record<string, unknown>) =>
    apiRequest("/platform/tenants", { method: "POST", body: JSON.stringify(data) }, token),
  updateTenant: (token: string, id: string, data: Record<string, unknown>) =>
    apiRequest(`/platform/tenants/${id}`, { method: "PATCH", body: JSON.stringify(data) }, token),
  createUser: (token: string, tenantId: string, data: Record<string, unknown>) =>
    apiRequest(`/platform/tenants/${tenantId}/users`, { method: "POST", body: JSON.stringify(data) }, token),
  updateUser: (token: string, tenantId: string, userId: string, data: Record<string, unknown>) =>
    apiRequest(`/platform/tenants/${tenantId}/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }, token),
  impersonate: (token: string, tenantId: string) =>
    apiRequest<import("@bot-wpp/shared-types").AuthResponse>(
      `/platform/tenants/${tenantId}/impersonate`,
      { method: "POST" },
      token,
    ),
  accessLink: (token: string, tenantId: string) =>
    apiRequest<{ code: string; slug: string; path: string; expiresInSeconds: number }>(
      `/platform/tenants/${tenantId}/access-link`,
      { method: "POST" },
      token,
    ),
  stopImpersonation: (token: string) =>
    apiRequest<import("@bot-wpp/shared-types").AuthResponse>(
      "/platform/stop-impersonation",
      { method: "POST" },
      token,
    ),
};

export function tenantBySlug(slug: string) {
  return apiRequest<{
    found: boolean;
    tenant?: {
      name: string;
      slug: string;
      logoUrl?: string | null;
      primaryColor?: string | null;
      suspended?: boolean;
    };
  }>(`/tenants/by-slug/${slug}`);
}

// Audit
export const auditApi = {
  list: (token: string) => apiRequest<AuditEntry[]>("/audit", {}, token),
};

// Legacy export for backward compat
export { apiRequest as defaultApiRequest };
