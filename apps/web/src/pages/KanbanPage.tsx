import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuth } from "../lib/auth";
import { kanbanApi } from "../lib/api";
import type { KanbanBoard, KanbanCard, KanbanStage } from "../lib/types";
import {
  btnPrimary,
  btnSecondary,
  Card,
  EmptyState,
  ErrorState,
  inputClass,
  LoadingState,
  PageHeader,
} from "../components/ui/PageHeader";

function SortableCard({ card }: { card: KanbanCard }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { card, stageId: card.stageId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab rounded-lg border border-[var(--abs-gray)] bg-white p-3 active:cursor-grabbing"
    >
      <p className="text-sm font-medium text-[var(--abs-blue-dark)]">{card.title}</p>
      {card.description ? (
        <p className="mt-1 text-xs text-[var(--abs-muted)]">{card.description}</p>
      ) : null}
      {card.contact?.name ? (
        <p className="mt-2 text-xs text-[var(--abs-blue)]">{card.contact.name}</p>
      ) : null}
    </div>
  );
}

function KanbanColumn({ stage, onAddCard }: { stage: KanbanStage; onAddCard: (stageId: string) => void }) {
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl border border-[var(--abs-gray)] bg-white">
      <div className="flex items-center justify-between border-b border-[var(--abs-gray)] px-4 py-3">
        <h3 className="text-sm font-medium text-[var(--abs-blue-dark)]">
          {stage.name}
          <span className="ml-2 text-[var(--abs-muted)]">({stage.cards.length})</span>
        </h3>
        <button
          type="button"
          className="text-xs text-[var(--abs-blue)] hover:underline"
          onClick={() => onAddCard(stage.id)}
        >
          + Card
        </button>
      </div>
      <SortableContext items={stage.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3" style={{ minHeight: 200 }}>
          {stage.cards.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-600">Arraste cards aqui</p>
          ) : (
            stage.cards.map((card) => <SortableCard key={card.id} card={card} />)
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function KanbanPage() {
  const { token } = useAuth();
  const [board, setBoard] = useState<KanbanBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<KanbanCard | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
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
    loadBoard();
  }, [loadBoard]);

  function findStageByCardId(cardId: string): KanbanStage | undefined {
    return board?.stages.find((s) => s.cards.some((c) => c.id === cardId));
  }

  function handleDragStart(event: DragStartEvent) {
    const card = board?.stages
      .flatMap((s) => s.cards)
      .find((c) => c.id === event.active.id);
    if (card) setActiveCard(card);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    if (!token || !board) return;

    const { active, over } = event;
    if (!over) return;

    const cardId = active.id as string;
    const sourceStage = findStageByCardId(cardId);
    if (!sourceStage) return;

    let targetStageId: string;
    let targetOrder: number;

    const overData = over.data.current;
    if (overData?.card) {
      targetStageId = overData.stageId as string;
      const targetStage = board.stages.find((s) => s.id === targetStageId);
      const overCard = overData.card as KanbanCard;
      targetOrder = targetStage?.cards.findIndex((c) => c.id === overCard.id) ?? 0;
    } else if (overData?.stageId) {
      targetStageId = overData.stageId as string;
      const targetStage = board.stages.find((s) => s.id === targetStageId);
      targetOrder = targetStage?.cards.length ?? 0;
    } else {
      const targetStage = board.stages.find((s) => s.id === over.id);
      if (!targetStage) return;
      targetStageId = targetStage.id;
      targetOrder = targetStage.cards.length;
    }

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
      await kanbanApi.createCard(token, { title: newCardTitle.trim(), stageId });
      setNewCardTitle("");
      setAddingToStage(null);
      await loadBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar card");
    }
  }

  if (loading) return <LoadingState />;
  if (!board) return <ErrorState message={error ?? "Board não encontrado"} />;

  return (
    <div>
      <PageHeader title="Kanban" description="Gerencie leads e oportunidades por estágio." />

      {error ? <div className="mb-4"><ErrorState message={error} /></div> : null}

      {addingToStage ? (
        <Card className="mb-4 flex flex-wrap items-end gap-3">
          <label className="flex-1 space-y-1">
            <span className="text-sm text-[var(--abs-muted)]">Título do card</span>
            <input
              className={inputClass}
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              placeholder="Novo lead..."
              autoFocus
            />
          </label>
          <button type="button" className={btnPrimary} onClick={() => handleCreateCard(addingToStage)}>
            Criar
          </button>
          <button type="button" className={btnSecondary} onClick={() => setAddingToStage(null)}>
            Cancelar
          </button>
        </Card>
      ) : null}

      {board.stages.length === 0 ? (
        <EmptyState message="Nenhum estágio configurado." />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {board.stages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                onAddCard={(id) => {
                  setAddingToStage(id);
                  setNewCardTitle("");
                }}
              />
            ))}
          </div>
          <DragOverlay>
            {activeCard ? (
              <div className="rounded-lg border border-[var(--abs-yellow)] bg-white p-3 shadow-xl">
                <p className="text-sm font-medium text-[var(--abs-blue-dark)]">{activeCard.title}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
