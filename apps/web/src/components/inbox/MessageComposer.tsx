import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Smile, Send, Zap } from "lucide-react";
import type { QuickReply } from "../../lib/types";
import { btnPrimary } from "../ui/PageHeader";

const EMOJI_GROUPS: Array<{ label: string; emojis: string[] }> = [
  {
    label: "Frequentes",
    emojis: ["👍", "🙏", "✅", "❌", "😊", "🙂", "😉", "😮", "😢", "👏", "🔥", "⭐", "📌", "📎", "📷", "💬"],
  },
  {
    label: "Gestos",
    emojis: ["👋", "🤝", "✌️", "👌", "🤙", "💪", "🙌", "✋", "👉", "👈", "👆", "👇"],
  },
  {
    label: "Status",
    emojis: ["🟢", "🟡", "🔴", "⚠️", "ℹ️", "🆕", "✔️", "❎", "⏳", "🕒", "📬", "📭"],
  },
];

type Props = {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => Promise<void> | void;
  sending?: boolean;
  disabled?: boolean;
  quickReplies?: QuickReply[];
  placeholder?: string;
};

export function MessageComposer({
  draft,
  onDraftChange,
  onSend,
  sending = false,
  disabled = false,
  quickReplies = [],
  placeholder = "Digite sua mensagem… (Enter envia · Shift+Enter nova linha)",
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPanelRef = useRef<HTMLDivElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  useEffect(() => {
    if (!emojiOpen && !quickOpen) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (emojiPanelRef.current?.contains(target)) return;
      if ((e.target as HTMLElement).closest?.("[data-composer-toggle]")) return;
      setEmojiOpen(false);
      setQuickOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [emojiOpen, quickOpen]);

  function insertAtCursor(text: string) {
    const el = textareaRef.current;
    if (!el) {
      onDraftChange(draft + text);
      return;
    }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + text + draft.slice(end);
    onDraftChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    if (disabled || sending || !draft.trim()) return;
    await onSend();
    setEmojiOpen(false);
    setQuickOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  }

  /** Só preenche o rascunho — nunca envia. O atendente completa [email]/[status] etc. */
  function applyQuickReply(qr: QuickReply) {
    onDraftChange(qr.content);
    setQuickOpen(false);
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      // Posiciona no primeiro placeholder, se existir
      const match = /\[email\]|\[status\]|\[data\]|_\[anexar print\]_/.exec(qr.content);
      if (match && match.index != null) {
        el.setSelectionRange(match.index, match.index + match[0].length);
      } else {
        const end = qr.content.length;
        el.setSelectionRange(end, end);
      }
    });
  }

  return (
    <div className="border-t border-[var(--gb-border)] bg-[var(--gb-surface)]/80">
      <form onSubmit={(e) => void handleSubmit(e)} className="relative p-3 sm:p-4">
        {(emojiOpen || quickOpen) && (
          <div
            ref={emojiPanelRef}
            className="absolute bottom-[calc(100%-0.5rem)] left-3 right-3 z-20 max-h-72 overflow-y-auto rounded-xl border border-[var(--gb-border)] bg-[var(--gb-bg-elevated)] p-3 shadow-xl sm:left-4 sm:right-auto sm:w-[400px]"
          >
            {emojiOpen ? (
              <div className="space-y-3">
                {EMOJI_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--gb-muted)]">
                      {group.label}
                    </p>
                    <div className="grid grid-cols-8 gap-1">
                      {group.emojis.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className="rounded-lg p-1.5 text-xl transition hover:bg-[var(--gb-surface-2)]"
                          onClick={() => insertAtCursor(emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="mb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--gb-muted)]">
                    Mensagens rápidas
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--gb-muted)]">
                    Ao clicar, o texto vai para o campo — edite e depois envie.
                  </p>
                </div>
                {quickReplies.map((qr) => (
                  <button
                    key={qr.id}
                    type="button"
                    className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-[var(--gb-surface-2)]"
                    onClick={() => applyQuickReply(qr)}
                  >
                    <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--gb-cyan)]" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[var(--gb-text)]">{qr.title}</span>
                      <span className="block truncate text-xs text-[var(--gb-muted)]">
                        {qr.shortcut ? `${qr.shortcut} · ` : ""}
                        {qr.content.replace(/\s+/g, " ").slice(0, 72)}
                        {qr.content.length > 72 ? "…" : ""}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-[var(--gb-border)] bg-[var(--gb-input-bg)] focus-within:border-[var(--gb-cyan)] focus-within:ring-1 focus-within:ring-[var(--gb-cyan)]/40">
          <textarea
            ref={textareaRef}
            rows={1}
            value={draft}
            disabled={disabled || sending}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="max-h-40 min-h-[44px] w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm text-[var(--gb-text)] outline-none placeholder:text-[var(--gb-muted)]"
          />
          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                data-composer-toggle
                title="Emojis"
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--gb-muted)] transition hover:bg-[var(--gb-surface-2)] hover:text-[var(--gb-cyan)] ${
                  emojiOpen ? "bg-[var(--gb-surface-2)] text-[var(--gb-cyan)]" : ""
                }`}
                onClick={() => {
                  setEmojiOpen((v) => !v);
                  setQuickOpen(false);
                }}
              >
                <Smile className="h-4 w-4" />
                <span className="hidden sm:inline">Emoji</span>
              </button>
              {quickReplies.length > 0 ? (
                <button
                  type="button"
                  data-composer-toggle
                  title="Abrir mensagens rápidas"
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition hover:bg-[var(--gb-surface-2)] hover:text-[var(--gb-cyan)] ${
                    quickOpen
                      ? "bg-[var(--gb-surface-2)] text-[var(--gb-cyan)]"
                      : "text-[var(--gb-muted)]"
                  }`}
                  onClick={() => {
                    setQuickOpen((v) => !v);
                    setEmojiOpen(false);
                  }}
                >
                  <Zap className="h-4 w-4" />
                  Mensagens rápidas
                </button>
              ) : null}
              <span className="hidden text-[11px] text-[var(--gb-muted)] lg:inline">
                Enter envia · Shift+Enter quebra linha
              </span>
            </div>
            <button
              type="submit"
              className={`${btnPrimary} !rounded-xl !px-3 !py-2`}
              disabled={disabled || sending || !draft.trim()}
              title="Enviar"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
