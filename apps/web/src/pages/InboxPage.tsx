import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FlaskConical, Instagram, MessageCircle, Pencil, Send } from "lucide-react";
import { useAuth } from "../lib/auth";
import {
  contactsApi,
  conversationsApi,
  instagramApi,
  messagesApi,
  quickRepliesApi,
  whatsappApi,
} from "../lib/api";
import { getSocket, disconnectSocket } from "../lib/socket";
import type { Conversation, Message, QuickReply } from "../lib/types";
import { Badge, statusBadgeVariant, statusLabel } from "../components/ui/Badge";
import {
  btnPrimary,
  btnSecondary,
  EmptyState,
  ErrorState,
  inputClass,
  LoadingState,
  selectClass,
} from "../components/ui/PageHeader";

export function InboxPage() {
  const { token, user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [editingContactName, setEditingContactName] = useState(false);
  const [contactNameDraft, setContactNameDraft] = useState("");
  const [savingContactName, setSavingContactName] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  const loadConversations = useCallback(async () => {
    if (!token) return;
    try {
      const data = await conversationsApi.list(
        token,
        statusFilter || undefined,
        channelFilter || undefined,
      );
      setConversations(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar conversas");
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, channelFilter]);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      if (!token) return;
      setLoadingMessages(true);
      try {
        const data = await messagesApi.list(token, conversationId);
        setMessages(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar mensagens");
      } finally {
        setLoadingMessages(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!token) return;
    quickRepliesApi.list(token).then(setQuickReplies).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (selectedId) void loadMessages(selectedId);
    else setMessages([]);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!token) return;
    let socket: ReturnType<typeof getSocket>;
    try {
      socket = getSocket(token);
    } catch {
      return;
    }

    const onNewMessage = (payload: { conversationId: string }) => {
      if (payload.conversationId === selectedId) void loadMessages(payload.conversationId);
      void loadConversations();
    };

    socket.on("message:new", onNewMessage);
    socket.on("conversation:updated", () => void loadConversations());

    return () => {
      socket.off("message:new", onNewMessage);
      disconnectSocket();
    };
  }, [token, selectedId, loadMessages, loadConversations]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!token || !selectedId || !draft.trim()) return;
    setSending(true);
    try {
      await messagesApi.send(token, selectedId, draft.trim());
      setDraft("");
      await loadMessages(selectedId);
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  }

  async function handleStatusChange(status: string) {
    if (!token || !selectedId) return;
    try {
      await conversationsApi.update(token, selectedId, { status });
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar status");
    }
  }

  async function handleAssignSelf() {
    if (!token || !selectedId || !user) return;
    try {
      await conversationsApi.update(token, selectedId, { assignedTo: user.id });
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atribuir conversa");
    }
  }

  useEffect(() => {
    setEditingContactName(false);
    setContactNameDraft(selected?.contact?.name ?? "");
  }, [selectedId, selected?.contact?.id, selected?.contact?.name]);

  async function handleSaveContactName() {
    if (!token || !selected?.contact?.id) return;
    const next = contactNameDraft.trim();
    if (!next) {
      setError("Informe um nome para o contato.");
      return;
    }
    setSavingContactName(true);
    try {
      const updated = await contactsApi.update(token, selected.contact.id, { name: next });
      setConversations((prev) =>
        prev.map((c) =>
          c.contactId === updated.id || c.contact?.id === updated.id
            ? { ...c, contact: { ...c.contact, ...updated } }
            : c,
        ),
      );
      setEditingContactName(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar nome do contato");
    } finally {
      setSavingContactName(false);
    }
  }

  async function handleSimulate(channel: "WHATSAPP" | "INSTAGRAM") {
    if (!token) return;
    setSimulating(true);
    try {
      if (channel === "INSTAGRAM") {
        await instagramApi.demoInbound(token, {
          username: "lead.instagram",
          text: "Oi! Vi o perfil da GB Systems e quero saber dos planos 💜",
        });
      } else {
        await whatsappApi.demoInbound(token, {
          phone: "5511999990001",
          name: "Cliente WhatsApp",
          text: "Olá! Quero atendimento pelo WhatsApp.",
        });
      }
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao simular mensagem");
    } finally {
      setSimulating(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col lg:h-[calc(100vh-3rem)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="gb-display text-2xl font-semibold text-white">Inbox Omnichannel</h1>
          <p className="text-sm text-[var(--gb-muted)]">WhatsApp + Instagram em tempo real</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className={selectClass} value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
            <option value="">Todos os canais</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="INSTAGRAM">Instagram</option>
          </select>
          <select className={selectClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="open">Abertas</option>
            <option value="pending">Pendentes</option>
            <option value="closed">Fechadas</option>
          </select>
          <button type="button" className={btnSecondary} disabled={simulating} onClick={() => void handleSimulate("WHATSAPP")}>
            <MessageCircle className="mr-1.5 inline h-4 w-4" />
            Simular WA
          </button>
          <button type="button" className={btnSecondary} disabled={simulating} onClick={() => void handleSimulate("INSTAGRAM")}>
            <Instagram className="mr-1.5 inline h-4 w-4" />
            Simular IG
          </button>
        </div>
      </div>

      {error ? <div className="mb-3"><ErrorState message={error} /></div> : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <div className={`flex w-full flex-col gb-card lg:w-80 ${selectedId ? "hidden lg:flex" : "flex"}`}>
          <div className="border-b border-[var(--gb-border)] px-4 py-3">
            <p className="text-sm font-medium text-[var(--gb-muted)]">Conversas ({conversations.length})</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <LoadingState />
            ) : conversations.length === 0 ? (
              <EmptyState message="Nenhuma conversa encontrada." />
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => setSelectedId(conv.id)}
                  className={`w-full border-b border-[var(--gb-border)] px-4 py-3 text-left transition hover:bg-white/5 ${
                    selectedId === conv.id ? "bg-white/10" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-medium text-white">
                      {conv.contact?.name ?? conv.contact?.username ?? "Contato"}
                    </p>
                    <Badge variant={statusBadgeVariant(conv.status)}>{statusLabel(conv.status)}</Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={conv.channel === "INSTAGRAM" ? "gb-badge gb-badge-instagram" : "gb-badge gb-badge-whatsapp"}>
                      {conv.channel === "INSTAGRAM" ? "Instagram" : "WhatsApp"}
                    </span>
                    <p className="truncate text-xs text-[var(--gb-muted)]">
                      {conv.contact?.phone ?? (conv.contact?.username ? `@${conv.contact.username}` : "")}
                    </p>
                  </div>
                  {conv.assignee?.name ? (
                    <p className="mt-1 truncate text-xs text-[var(--gb-cyan)]">Atendendo: {conv.assignee.name}</p>
                  ) : (
                    <p className="mt-1 truncate text-xs text-[var(--gb-cyan)]">Atendendo: Assistente virtual</p>
                  )}
                  {conv.lastMessageAt ? (
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true, locale: ptBR })}
                    </p>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>

        <div className={`flex min-h-0 flex-1 flex-col gb-card ${!selectedId ? "hidden lg:flex" : "flex"}`}>
          {selected ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--gb-border)] px-4 py-3">
                <div>
                  <button type="button" className="mb-1 text-xs text-[var(--gb-cyan)] lg:hidden" onClick={() => setSelectedId(null)}>
                    ← Voltar
                  </button>
                  {editingContactName && selected.contact?.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        className={`${inputClass} max-w-xs`}
                        value={contactNameDraft}
                        onChange={(e) => setContactNameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleSaveContactName();
                          }
                          if (e.key === "Escape") setEditingContactName(false);
                        }}
                        autoFocus
                        disabled={savingContactName}
                      />
                      <button
                        type="button"
                        className={btnPrimary}
                        disabled={savingContactName}
                        onClick={() => void handleSaveContactName()}
                      >
                        Salvar
                      </button>
                      <button type="button" className={btnSecondary} onClick={() => setEditingContactName(false)}>
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white">
                        {selected.contact?.name ?? selected.contact?.username ?? "Contato"}
                      </p>
                      {selected.contact?.id ? (
                        <button
                          type="button"
                          className="rounded-lg p-1 text-[var(--gb-muted)] hover:bg-white/10 hover:text-[var(--gb-cyan)]"
                          title="Editar nome do contato"
                          onClick={() => {
                            setContactNameDraft(selected.contact?.name ?? "");
                            setEditingContactName(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  )}
                  <p className="text-xs text-[var(--gb-muted)]">
                    {selected.channel === "INSTAGRAM"
                      ? `@${selected.contact?.username ?? selected.contact?.instagramId ?? "instagram"}`
                      : selected.contact?.phone}
                  </p>
                  <p className="mt-1 text-xs text-[var(--gb-cyan)]">
                    {selected.assignee?.name
                      ? `Atendendo: ${selected.assignee.name}`
                      : "Atendendo: Assistente virtual"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select className={selectClass} value={selected.status} onChange={(e) => void handleStatusChange(e.target.value)}>
                    <option value="open">Aberta</option>
                    <option value="pending">Pendente</option>
                    <option value="closed">Fechada</option>
                  </select>
                  <button type="button" className={btnSecondary} onClick={() => void handleAssignSelf()}>
                    {selected.assignedTo === user?.id ? "Atribuída a mim" : "Atribuir a mim"}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4">
                {loadingMessages ? (
                  <LoadingState message="Carregando mensagens..." />
                ) : messages.length === 0 ? (
                  <EmptyState message="Nenhuma mensagem ainda." />
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                            msg.direction === "outbound"
                              ? "gb-gradient text-white"
                              : "bg-white/10 text-slate-100"
                          }`}
                        >
                          {msg.direction === "outbound" ? (
                            <p className="mb-1 text-[11px] font-semibold opacity-80">
                              {msg.sentBy?.name ?? "Assistente virtual"}
                            </p>
                          ) : null}
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          <p className="mt-1 text-xs opacity-60">
                            {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {quickReplies.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto border-t border-[var(--gb-border)] px-4 py-2">
                  {quickReplies.map((qr) => (
                    <button key={qr.id} type="button" className={btnSecondary} onClick={() => setDraft(qr.content)}>
                      {qr.title}
                    </button>
                  ))}
                </div>
              ) : null}

              <form onSubmit={handleSend} className="flex gap-2 border-t border-[var(--gb-border)] p-4">
                <input
                  className={`${inputClass} flex-1`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Digite sua mensagem..."
                />
                <button type="submit" className={btnPrimary} disabled={sending || !draft.trim()}>
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          ) : (
            <EmptyState message="Selecione uma conversa para começar." />
          )}
        </div>
      </div>
    </div>
  );
}
