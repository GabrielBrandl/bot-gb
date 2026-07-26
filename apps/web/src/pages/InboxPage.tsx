import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FlaskConical, Send } from "lucide-react";
import { useAuth } from "../lib/auth";
import {
  conversationsApi,
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
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  const loadConversations = useCallback(async () => {
    if (!token) return;
    try {
      const data = await conversationsApi.list(token, statusFilter || undefined);
      setConversations(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar conversas");
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter]);

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
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!token) return;
    quickRepliesApi.list(token).then(setQuickReplies).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (selectedId) {
      loadMessages(selectedId);
    } else {
      setMessages([]);
    }
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
      if (payload.conversationId === selectedId) {
        loadMessages(payload.conversationId);
      }
      loadConversations();
    };

    const onConversationUpdated = () => {
      loadConversations();
    };

    socket.on("message:new", onNewMessage);
    socket.on("conversation:updated", onConversationUpdated);

    return () => {
      socket.off("message:new", onNewMessage);
      socket.off("conversation:updated", onConversationUpdated);
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

  async function handleSimulate() {
    if (!token) return;
    setSimulating(true);
    try {
      await whatsappApi.demoInbound(token, {
        phone: "5511999990001",
        name: "Cliente Demo",
        text: "Olá, gostaria de mais informações!",
      });
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao simular mensagem");
    } finally {
      setSimulating(false);
    }
  }

  function applyQuickReply(content: string) {
    setDraft(content);
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col lg:h-[calc(100vh-3rem)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--abs-blue-dark)]">Inbox</h1>
          <p className="text-sm text-[var(--abs-muted)]">Atendimento em tempo real</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className={selectClass}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="open">Abertas</option>
            <option value="pending">Pendentes</option>
            <option value="closed">Fechadas</option>
          </select>
          <button type="button" className={btnSecondary} onClick={handleSimulate} disabled={simulating}>
            <FlaskConical className="mr-1.5 inline h-4 w-4" />
            {simulating ? "Simulando..." : "Simular mensagem"}
          </button>
        </div>
      </div>

      {error ? <div className="mb-3"><ErrorState message={error} /></div> : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        {/* Conversation list */}
        <div
          className={`flex w-full flex-col rounded-xl border border-[var(--abs-gray)] bg-white lg:w-80 ${
            selectedId ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="border-b border-[var(--abs-gray)] px-4 py-3">
            <p className="text-sm font-medium text-slate-600">
              Conversas ({conversations.length})
            </p>
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
                  className={`w-full border-b border-[var(--abs-gray)]/50 px-4 py-3 text-left transition hover:bg-[var(--abs-bg)]/50 ${
                    selectedId === conv.id ? "bg-[var(--abs-yellow)]/20" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-medium text-[var(--abs-blue-dark)]">
                      {conv.contact?.name ?? conv.contactId}
                    </p>
                    <Badge variant={statusBadgeVariant(conv.status)}>
                      {statusLabel(conv.status)}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[var(--abs-muted)]">
                    {conv.contact?.phone}
                  </p>
                  {conv.lastMessage ? (
                    <p className="mt-1 truncate text-sm text-[var(--abs-muted)]">{conv.lastMessage}</p>
                  ) : null}
                  {conv.lastMessageAt ? (
                    <p className="mt-1 text-xs text-slate-600">
                      {formatDistanceToNow(new Date(conv.lastMessageAt), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat thread */}
        <div
          className={`flex min-h-0 flex-1 flex-col rounded-xl border border-[var(--abs-gray)] bg-white ${
            !selectedId ? "hidden lg:flex" : "flex"
          }`}
        >
          {selected ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--abs-gray)] px-4 py-3">
                <div>
                  <button
                    type="button"
                    className="mb-1 text-xs text-[var(--abs-blue)] lg:hidden"
                    onClick={() => setSelectedId(null)}
                  >
                    ← Voltar
                  </button>
                  <p className="font-medium text-[var(--abs-blue-dark)]">{selected.contact?.name ?? "Contato"}</p>
                  <p className="text-xs text-[var(--abs-muted)]">{selected.contact?.phone}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className={selectClass}
                    value={selected.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                  >
                    <option value="open">Aberta</option>
                    <option value="pending">Pendente</option>
                    <option value="closed">Fechada</option>
                  </select>
                  <button type="button" className={btnSecondary} onClick={handleAssignSelf}>
                    Atribuir a mim
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
                      <div
                        key={msg.id}
                        className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                            msg.direction === "outbound"
                              ? "bg-emerald-600 text-[var(--abs-blue-dark)]"
                              : "bg-[var(--abs-bg)] text-[var(--abs-blue-dark)]"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          <p className="mt-1 text-xs opacity-60">
                            {formatDistanceToNow(new Date(msg.createdAt), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <form onSubmit={handleSend} className="border-t border-[var(--abs-gray)] p-4">
                <div className="mb-2 flex items-center gap-2">
                  {quickReplies.length > 0 ? (
                    <select
                      className={selectClass}
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) applyQuickReply(e.target.value);
                        e.target.value = "";
                      }}
                    >
                      <option value="">Respostas rápidas</option>
                      {quickReplies.map((qr) => (
                        <option key={qr.id} value={qr.content}>
                          {qr.title}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    placeholder="Digite sua mensagem..."
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <button type="submit" className={btnPrimary} disabled={sending || !draft.trim()}>
                    <Send className="h-4 w-4" />
                  </button>
                </div>
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
