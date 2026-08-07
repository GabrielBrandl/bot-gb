import type {
  CampaignStatus,
  ConversationStatus,
  FlowGraph,
  MessageDirection,
  PaymentStatus,
  UserRole,
  WhatsappInstanceStatus,
} from "@bot-wpp/shared-types";

export interface Tag {
  id: string;
  name: string;
  color?: string | null;
}

export interface Contact {
  id: string;
  name?: string | null;
  phone?: string | null;
  instagramId?: string | null;
  username?: string | null;
  email?: string | null;
  tags?: Tag[];
  createdAt?: string;
}

export interface Conversation {
  id: string;
  contactId: string;
  contact?: Contact;
  channel?: "WHATSAPP" | "INSTAGRAM";
  status: ConversationStatus;
  assignedTo?: string | null;
  assignee?: { id: string; name: string; email?: string } | null;
  lastMessageAt?: string;
  lastMessage?: string;
  unreadCount?: number;
  instagramAccount?: { id: string; name: string; igUsername?: string | null; status: string } | null;
  instance?: { id: string; name: string; status: string } | null;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  content: string;
  type?: string;
  createdAt: string;
  isInternal?: boolean;
  sentByUserId?: string | null;
  sentBy?: { id: string; name: string } | null;
}

export interface QuickReply {
  id: string;
  title: string;
  content: string;
}

export interface KanbanStage {
  id: string;
  name: string;
  order: number;
  cards: KanbanCard[];
}

export interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  contactId?: string;
  contact?: Contact;
  stageId: string;
  order: number;
}

export interface KanbanBoard {
  id: string;
  stages: KanbanStage[];
}

export interface Flow {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  graph: FlowGraph;
  createdAt?: string;
  updatedAt?: string;
}

export interface AiAgent {
  id: string;
  name: string;
  persona: string;
  provider: string;
  model?: string;
  isActive: boolean;
  documents?: AiDocument[];
}

export interface AiDocument {
  id: string;
  title: string;
  content: string;
}

export interface Campaign {
  id: string;
  name: string;
  message: string;
  status: CampaignStatus;
  tagId?: string | null;
  tag?: Tag;
  sentCount?: number;
  totalCount?: number;
  createdAt?: string;
}

export interface Payment {
  id: string;
  contactId?: string;
  contact?: Contact;
  phone: string;
  amount: number;
  description?: string;
  status: PaymentStatus;
  billingType?: "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED";
  link?: string;
  bankSlipUrl?: string;
  invoiceUrl?: string;
  createdAt?: string;
}

export interface ReportsOverview {
  conversationsOpen: number;
  conversationsPending: number;
  conversationsClosed: number;
  messagesToday: number;
  messagesInbound: number;
  messagesOutbound: number;
  contactsTotal: number;
  campaignsActive: number;
  paymentsPending: number;
  paymentsPaid: number;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  brandColor?: string | null;
  plan?: string;
  maxAgents?: number;
  maxInstances?: number;
  maxInstagram?: number;
  billingStatus?: string;
  planLimits?: Record<string, number>;
  createdAt?: string;
}

export interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active?: boolean;
  createdAt?: string;
}

export interface WhatsappInstance {
  id: string;
  name: string;
  status: WhatsappInstanceStatus;
  phone?: string | null;
  evolutionInstanceId?: string;
  createdAt?: string;
  qr?: {
    base64?: string | null;
    code?: string | null;
    pairingCode?: string | null;
    message?: string;
  } | null;
}

export interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId?: string;
  userId?: string;
  userName?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}
