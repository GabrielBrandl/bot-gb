import type {
  CampaignStatus,
  ConversationStatus,
  FlowGraph,
  MessageDirection,
  PaymentStatus,
  UserRole,
  WhatsappInstanceStatus,
} from "@bot-wpp/shared-types";

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  tags?: Tag[];
  createdAt?: string;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
}

export interface Conversation {
  id: string;
  contactId: string;
  contact?: Contact;
  status: ConversationStatus;
  assignedTo?: string | null;
  lastMessageAt?: string;
  lastMessage?: string;
  unreadCount?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  content: string;
  type?: string;
  createdAt: string;
  isInternal?: boolean;
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
  planLimits?: Record<string, number>;
  createdAt?: string;
}

export interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: string;
}

export interface WhatsappInstance {
  id: string;
  name: string;
  status: WhatsappInstanceStatus;
  phone?: string | null;
  createdAt?: string;
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
