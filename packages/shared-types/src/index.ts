export type UserRole = "PLATFORM_OWNER" | "ADMIN" | "SUPERVISOR" | "AGENT";
export type Channel = "WHATSAPP" | "INSTAGRAM";
export type PlanCode = "STARTER" | "PRO" | "ENTERPRISE";

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  tenantSlug?: string;
  tenantName?: string;
  impersonating?: boolean;
  homeTenantId?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  tenantSlug?: string;
}

export interface RegisterRequest {
  tenantName: string;
  name: string;
  email: string;
  password: string;
  planId?: PlanCode;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export type ConversationStatus = "open" | "pending" | "closed";
export type MessageDirection = "inbound" | "outbound";
export type CampaignStatus = "draft" | "scheduled" | "running" | "completed" | "cancelled";
export type CampaignRecipientStatus = "pending" | "sent" | "failed";
export type PaymentStatus = "pending" | "paid" | "cancelled" | "expired";
export type WhatsappInstanceStatus = "disconnected" | "connecting" | "connected";
export type InstagramAccountStatus = "disconnected" | "connecting" | "connected";
export type BillingStatus = "trialing" | "active" | "past_due" | "canceled" | "suspended";

export interface PlanPublic {
  id: string;
  code: PlanCode;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  maxAgents: number;
  maxWhatsapp: number;
  maxInstagram: number;
  maxContacts: number;
  maxFlows: number;
  maxCampaigns: number;
  aiEnabled: boolean;
  instagramEnabled: boolean;
  campaignsEnabled: boolean;
  paymentsEnabled: boolean;
  reportsEnabled: boolean;
  whiteLabel: boolean;
  prioritySupport: boolean;
  features: string[];
  highlight: boolean;
  sortOrder: number;
}

export interface CreateTenantRequest {
  companyName: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  planId: PlanCode;
  maxAgents?: number;
  maxWhatsapp?: number;
  maxInstagram?: number;
  maxContacts?: number;
  billingStatus?: BillingStatus;
}

export interface FlowNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface CampaignJobPayload {
  tenantId: string;
  campaignId: string;
  recipientId: string;
  contactId: string;
  phone: string;
  message: string;
  instanceId?: string;
  channel?: Channel;
}

export interface RealtimeEvents {
  "message:new": {
    conversationId: string;
    message: {
      id: string;
      direction: string;
      content: string;
      createdAt: string;
      isInternal?: boolean;
      channel?: Channel;
    };
  };
  "conversation:updated": {
    id: string;
    status?: string;
    assignedTo?: string | null;
    lastMessageAt?: string;
    channel?: Channel;
  };
  "instance:status": {
    instanceId: string;
    status: string;
    channel?: Channel;
  };
}
