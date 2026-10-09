import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MessageCircle, RefreshCw, Trash2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import { contactsApi, kanbanApi } from "../lib/api";
import type { Contact, KanbanBoard, KanbanCard, KanbanStage } from "../lib/types";
import {
  btnPrimary,
  btnSecondary,
  btnDanger,
  Card,
  EmptyState,
  ErrorState,
  inputClass,
  LoadingState,
  PageHeader,
  selectClass,
} from "../components/ui/PageHeader";

const STATUS_LABEL: Record<string, string> = {
  open: "Aberta",
  pending: "Pendente",
  closed: "Fechada",
};

function cardTitle(card: KanbanCard): string {
  return card.title?.trim() || card.contact?.name?.trim() || card.contact?.phone || "Sem título";
}

function SortableCard({
  card,
  onOpen,
}: {
  card: KanbanCard;
  onOpen: (card: KanbanCard) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { card, stageId: card.stageId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab rounded-xl border border-[var(--gb-border)] bg-[var(--gb-bg-elevated)] p-3 shadow-sm active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-[var(--gb-text)]">{cardTitle(card)}</p>
        <button
          type="button"
          className="shrink-0 text-[11px] font-medium text-[var(--gb-cyan)]"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onOpen(card);
          }}
        >
          Abrir
        </button>
      </div>
      {card.contact?.phone ? (
        <p className="mt-1 text-xs text-[var(--gb-muted)]">{card.contact.phone}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {card.conversation ? (
          <span className="rounded-full bg-[var(--gb-cyan)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--gb-cyan)]">
            {STATUS_LABEL[card.conversation.status] ?? card.conversation.status}
          </span>
        ) : null}
        {card.conversation?.assignee?.name ? (
          <span className="truncate text-[10px] text-[var(--gb-muted)]">
            {card.conversation.assignee.name}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function KanbanColumn({
  stage,
  onAddCard,
  onOpenCard,
}: {
  stage: KanbanStage;
  onAddCard: (stageId: string) => void;
  onOpenCard: (card: KanbanCard) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `stage:${stage.id}`,
    data: { stageId: stage.id },
  });

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-2xl border border-[var(--gb-border)] bg-[var(--gb-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--gb-border)] px-4 py-3">
        <h3 className="text-sm font-medium text-[var(--gb-text)]">
          {stage.name}
          <span className="ml-2 text-[var(--gb-muted)]">({stage.cards.length})</span>
        </h3>
        <button
          type="button"
          className="text-xs font-medium text-[var(--gb-cyan)] hover:underline"
          onClick={() => onAddCard(stage.id)}
        >
          + Card
        </button>
      </div>
      <SortableContext items={stage.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex flex-1 flex-col gap-2 overflow-y-auto p-3 ${isOver ? "bg-[var(--gb-cyan)]/10" : ""}`}
          style={{ minHeight: 220 }}
        >
          {stage.cards.length === 0 ? (
            <p className="py-8 text-center text-xs text-[var(--gb-muted)]">Arraste um card para cá</p>
          ) : (
            stage.cards.map((card) => <SortableCard key={card.id} card={card} onOpen={onOpenCard} />)
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function KanbanPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [board, setBoard] = useState<KanbanBoard | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeCard, setActiveCard] = useState<KanbanCard | null>(null);
  const [selected, setSelected] = useState<KanbanCard | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [newCardTitle, setNewCardTitle] = useState("");
  const [newContactId, setNewContactId] = useState("");
  const [addingToStage, setAddingToStage] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const loadBoard = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await kanbanApi.getBoard(token);
      setBoard(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar kanban");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    if (!token) return;
    contactsApi.list(token).then(setContacts).catch(() => setContacts([]));
  }, [token]);

  const visibleBoard = useMemo(() => {
    if (!board) return null;
    const q = query.trim().toLowerCase();
    if (!q) return board;
    return {
      ...board,
      stages: board.stages.map((stage) => ({
        ...stage,
        cards: stage.cards.filter((card) => {
          const hay = [card.title, card.contact?.name, card.contact?.phone, card.conversation?.assignee?.name]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        }),
      })),
    };
  }, [board, query]);

  function findStageByCardId(cardId: string): KanbanStage | undefined {
    return board?.stages.find((s) => s.cards.some((c) => c.id === cardId));
  }

  function handleDragStart(event: DragStartEvent) {
    const card = board?.stages.flatMap((s) => s.cards).find((c) => c.id === event.active.id);
    if (card) setActiveCard(card);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    if (!token || !board) return;

    const { active, over } = event;
    if (!over) return;

    const cardId = String(active.id);
    const sourceStage = findStageByCardId(cardId);
    if (!sourceStage) return;

    let targetStageId: string | undefined;
    let targetOrder = 0;
    const overId = String(over.id);
    const overData = over.data.current;

    if (overId.startsWith("stage:")) {
      targetStageId = overId.slice("stage:".length);
      targetOrder = board.stages.find((s) => s.id === targetStageId)?.cards.length ?? 0;
    } else if (overData?.card) {
      targetStageId = overData.stageId as string;
      const targetStage = board.stages.find((s) => s.id === targetStageId);
      targetOrder = targetStage?.cards.findIndex((c) => c.id === (overData.card as KanbanCard).id) ?? 0;
    } else {
      const targetStage = board.stages.find((s) => s.id === overId);
      if (!targetStage) return;
      targetStageId = targetStage.id;
      targetOrder = targetStage.cards.length;
    }

    if (!targetStageId) return;
    if (sourceStage.id === targetStageId && active.id === over.id) return;

    try {
      await kanbanApi.moveCard(token, cardId, targetStageId, targetOrder);
      await loadBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao mover card");
    }
  }

  async function handleCreateCard(stageId: string) {
    if (!token || !newCardTitle.trim()) return;
    try {
      await kanbanApi.createCard(token, {
        title: newCardTitle.trim(),
        stageId,
        ...(newContactId ? { contactId: newContactId } : {}),
      });
      setNewCardTitle("");
      setNewContactId("");
      setAddingToStage(null);
      await loadBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar card");
    }
  }

  async function handleSync() {
    if (!token) return;
    setSyncing(true);
    setNotice(null);
    try {
      const result = await kanbanApi.syncInbox(token);
      setNotice(
        result.created === 0
          ? "Nenhuma conversa nova para trazer."
          : `${result.created} conversa(s) adicionada(s) ao quadro.`,
      );
      await loadBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao sincronizar o Inbox");
    } finally {
      setSyncing(false);
    }
  }

  async function handleSaveTitle() {
    if (!token || !selected || !editTitle.trim()) return;
    try {
      await kanbanApi.updateCard(token, selected.id, { title: editTitle.trim() });
      setSelected(null);
      await loadBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar card");
    }
  }

  async function handleDelete(card: KanbanCard) {
    if (!token) return;
    try {
      await kanbanApi.deleteCard(token, card.id);
      setSelected(null);
      await loadBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir card");
    }
  }

  if (loading && !board) return <LoadingState />;
  if (!visibleBoard) return <ErrorState message={error ?? "Board não encontrado"} />;

  return (
    <div>
      <PageHeader
        title="Kanban"
        description="Fila de atendimento. Arraste o card para mudar o estágio — a conversa no Inbox acompanha."
        actions={
          <button type="button" className={btnPrimary} disabled={syncing} onClick={() => void handleSync()}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Trazer conversas
          </button>
        }
      />

      {error ? (
        <div className="mb-4">
          <ErrorState message={error} />
        </div>
      ) : null}
      {notice ? <p className="mb-4 text-sm text-[var(--gb-muted)]">{notice}</p> : null}

      <div className="mb-4 max-w-sm">
        <input
          className={inputClass}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar nome, telefone ou atendente"
        />
      </div>

      {addingToStage ? (
        <Card className="mb-4 flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1 space-y-1">
            <span className="text-sm text-[var(--gb-muted)]">Título</span>
            <input
              className={inputClass}
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              placeholder="Ex.: Portal — senha"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreateCard(addingToStage);
              }}
            />
          </label>
          <label className="min-w-[220px] flex-1 space-y-1">
            <span className="text-sm text-[var(--gb-muted)]">Contato (opcional)</span>
            <select className={selectClass} value={newContactId} onChange={(e) => setNewContactId(e.target.value)}>
              <option value="">Sem vínculo</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name || contact.phone || contact.username || contact.id}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={btnPrimary} onClick={() => void handleCreateCard(addingToStage)}>
            Criar
          </button>
          <button type="button" className={btnSecondary} onClick={() => setAddingToStage(null)}>
            Cancelar
          </button>
        </Card>
      ) : null}

      {visibleBoard.stages.length === 0 ? (
        <EmptyState message="Nenhum estágio configurado." />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={(event) => void handleDragEnd(event)}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {visibleBoard.stages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                onAddCard={(id) => {
                  setAddingToStage(id);
                  setNewCardTitle("");
                  setNewContactId("");
                }}
                onOpenCard={(card) => {
                  setSelected(card);
                  setEditTitle(cardTitle(card));
                }}
              />
            ))}
          </div>
          <DragOverlay>
            {activeCard ? (
              <div className="rounded-xl border border-[var(--gb-cyan)] bg-[var(--gb-bg-elevated)] p-3 shadow-xl">
                <p className="text-sm font-medium text-[var(--gb-text)]">{cardTitle(activeCard)}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {selected ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-[var(--gb-overlay)] p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-[var(--gb-border)] bg-[var(--gb-bg-elevated)] p-5 shadow-2xl">
            <h2 className="text-lg font-semibold text-[var(--gb-text)]">Card</h2>
            <label className="mt-4 block space-y-1">
              <span className="text-sm text-[var(--gb-muted)]">Título</span>
              <input className={inputClass} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </label>
            <p className="mt-3 text-sm text-[var(--gb-muted)]">
              {selected.contact?.name || "Sem nome"}
              {selected.contact?.phone ? ` · ${selected.contact.phone}` : ""}
            </p>
            {selected.conversation ? (
              <p className="mt-1 text-xs text-[var(--gb-muted)]">
                Conversa {STATUS_LABEL[selected.conversation.status] ?? selected.conversation.status}
                {selected.conversation.assignee?.name ? ` · ${selected.conversation.assignee.name}` : ""}
              </p>
            ) : (
              <p className="mt-1 text-xs text-[var(--gb-muted)]">Este card ainda não está ligado a uma conversa.</p>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" className={btnPrimary} onClick={() => void handleSaveTitle()}>
                Salvar
              </button>
              {selected.conversationId ? (
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => navigate(`../inbox?c=${selected.conversationId}`)}
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Abrir conversa
                </button>
              ) : null}
              <button type="button" className={btnDanger} onClick={() => void handleDelete(selected)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </button>
              <button type="button" className={btnSecondary} onClick={() => setSelected(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
