import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Smile, Send, Zap } from "lucide-react";
import type { QuickReply } from "../../lib/types";

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

type SlashMatch = { start: number; end: number; query: string };

function findSlashMatch(text: string, cursor: number): SlashMatch | null {
  const before = text.slice(0, cursor);
  const m = /(?:^|[\s\n])(\/([^\s\n]*))$/.exec(before);
  if (!m || m.index == null) return null;
  const token = m[1];
  const start = before.length - token.length;
  return { start, end: cursor, query: (m[2] ?? "").toLowerCase() };
}

function normalizeShortcut(shortcut?: string | null): string {
  if (!shortcut) return "";
  return shortcut.trim().replace(/^\//, "").toLowerCase();
}

function filterQuickReplies(list: QuickReply[], query: string): QuickReply[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((qr) => {
    const shortcut = normalizeShortcut(qr.shortcut);
    const title = qr.title.toLowerCase();
    return shortcut.includes(q) || title.includes(q) || `/${shortcut}`.includes(q);
  });
}

export function MessageComposer({
  draft,
  onDraftChange,
  onSend,
  sending = false,
  disabled = false,
  quickReplies = [],
  placeholder = "Mensagem",
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerFilter, setPickerFilter] = useState("");
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashRange, setSlashRange] = useState<{ start: number; end: number } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const slashResults = useMemo(
    () => (slashOpen ? filterQuickReplies(quickReplies, slashQuery) : []),
    [slashOpen, slashQuery, quickReplies],
  );

  const pickerResults = useMemo(
    () => filterQuickReplies(quickReplies, pickerFilter),
    [quickReplies, pickerFilter],
  );

  const menuItems = slashOpen ? slashResults : pickerOpen ? pickerResults : [];
  const menuVisible = (slashOpen || pickerOpen) && !emojiOpen && quickReplies.length > 0;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 44), 180)}px`;
  }, [draft]);

  useEffect(() => {
    setActiveIndex(0);
  }, [slashQuery, pickerFilter, slashOpen, pickerOpen]);

  useEffect(() => {
    if (!emojiOpen && !pickerOpen && !slashOpen) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if ((e.target as HTMLElement).closest?.("[data-composer-toggle]")) return;
      setEmojiOpen(false);
      setPickerOpen(false);
      setSlashOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [emojiOpen, pickerOpen, slashOpen]);

  function syncSlashFromDraft(nextDraft: string, nextCursor: number) {
    if (pickerOpen || emojiOpen) {
      setSlashOpen(false);
      return;
    }
    const match = findSlashMatch(nextDraft, nextCursor);
    if (!match || quickReplies.length === 0) {
      setSlashOpen(false);
      setSlashRange(null);
      return;
    }
    setSlashOpen(true);
    setSlashQuery(match.query);
    setSlashRange({ start: match.start, end: match.end });
  }

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
    const pos = start + text.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function applyQuickReply(qr: QuickReply, replaceSlash = false) {
    const el = textareaRef.current;
    let next = qr.content;
    let selectStart = qr.content.length;
    let selectEnd = qr.content.length;

    if (replaceSlash && slashRange && el) {
      next = draft.slice(0, slashRange.start) + qr.content + draft.slice(slashRange.end);
      selectStart = slashRange.start + qr.content.length;
      selectEnd = selectStart;
    }

    const placeholderMatch = /\[email\]|\[status\]|\[data\]|_\[anexar print\]_/.exec(qr.content);
    if (placeholderMatch && placeholderMatch.index != null) {
      const base = replaceSlash && slashRange ? slashRange.start : 0;
      selectStart = base + placeholderMatch.index;
      selectEnd = selectStart + placeholderMatch[0].length;
    }

    onDraftChange(next);
    setSlashOpen(false);
    setPickerOpen(false);
    setEmojiOpen(false);
    setPickerFilter("");
    setSlashRange(null);

    requestAnimationFrame(() => {
      const box = textareaRef.current;
      if (!box) return;
      box.focus();
      box.setSelectionRange(selectStart, selectEnd);
    });
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    if (disabled || sending || !draft.trim()) return;
    await onSend();
    setEmojiOpen(false);
    setPickerOpen(false);
    setSlashOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (menuVisible && menuItems.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % menuItems.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + menuItems.length) % menuItems.length);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashOpen(false);
        setPickerOpen(false);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        const item = menuItems[activeIndex] ?? menuItems[0];
        if (item) applyQuickReply(item, slashOpen);
        return;
      }
    }

    // WhatsApp: Enter envia · Shift+Enter quebra linha
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  }

  function onChange(value: string) {
    onDraftChange(value);
    const el = textareaRef.current;
    const nextCursor = el?.selectionStart ?? value.length;
    syncSlashFromDraft(value, nextCursor);
  }

  return (
    <div className="border-t border-[var(--gb-border)] bg-[var(--wa-composer-bg,#0b141a)]/95 px-2 py-2 sm:px-3">
      <form onSubmit={(e) => void handleSubmit(e)} className="relative">
        {(emojiOpen || menuVisible) && (
          <div
            ref={panelRef}
            className="absolute bottom-[calc(100%+0.4rem)] left-0 right-0 z-30 max-h-72 overflow-hidden rounded-xl border border-[var(--gb-border)] bg-[var(--gb-bg-elevated)] shadow-2xl sm:left-0 sm:right-auto sm:w-[min(100%,420px)]"
          >
            {emojiOpen ? (
              <div className="max-h-72 space-y-3 overflow-y-auto p-3">
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
              <div className="flex max-h-72 flex-col">
                <div className="border-b border-[var(--gb-border)] px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--gb-muted)]">
                    {slashOpen ? "Atalhos /" : "Mensagens rápidas"}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--gb-muted)]">
                    {slashOpen
                      ? "Digite para filtrar · Enter seleciona · Esc fecha"
                      : "Clique para colar no campo · edite e envie"}
                  </p>
                  {pickerOpen && !slashOpen ? (
                    <input
                      autoFocus
                      value={pickerFilter}
                      onChange={(e) => setPickerFilter(e.target.value)}
                      placeholder="Buscar ou digite /atalho"
                      className="mt-2 w-full rounded-lg border border-[var(--gb-border)] bg-[var(--gb-input-bg)] px-2.5 py-1.5 text-sm text-[var(--gb-text)] outline-none placeholder:text-[var(--gb-muted)] focus:border-[var(--gb-cyan)]"
                    />
                  ) : null}
                </div>
                <div className="overflow-y-auto p-1.5">
                  {menuItems.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-[var(--gb-muted)]">Nenhuma mensagem encontrada.</p>
                  ) : (
                    menuItems.map((qr, idx) => (
                      <button
                        key={qr.id}
                        type="button"
                        className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition ${
                          idx === activeIndex
                            ? "bg-[var(--gb-surface-2)]"
                            : "hover:bg-[var(--gb-surface-2)]/70"
                        }`}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => applyQuickReply(qr, slashOpen)}
                      >
                        <span className="mt-0.5 rounded bg-[var(--gb-cyan)]/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--gb-cyan)]">
                          {qr.shortcut?.startsWith("/") ? qr.shortcut : `/${normalizeShortcut(qr.shortcut) || "msg"}`}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-[var(--gb-text)]">{qr.title}</span>
                          <span className="mt-0.5 block line-clamp-2 whitespace-pre-wrap text-xs text-[var(--gb-muted)]">
                            {qr.content}
                          </span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Barra estilo WhatsApp */}
        <div className="flex items-end gap-2">
          <button
            type="button"
            data-composer-toggle
            title="Emojis"
            disabled={disabled || sending}
            className={`mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--gb-muted)] transition hover:bg-[var(--gb-surface-2)] hover:text-[var(--gb-cyan)] ${
              emojiOpen ? "bg-[var(--gb-surface-2)] text-[var(--gb-cyan)]" : ""
            }`}
            onClick={() => {
              setEmojiOpen((v) => !v);
              setPickerOpen(false);
              setSlashOpen(false);
            }}
          >
            <Smile className="h-5 w-5" />
          </button>

          <div className="flex min-w-0 flex-1 items-end rounded-[1.5rem] border border-[var(--gb-border)] bg-[var(--gb-input-bg)] px-2 py-1 focus-within:border-[var(--gb-cyan)]/60">
            {quickReplies.length > 0 ? (
              <button
                type="button"
                data-composer-toggle
                title="Mensagens rápidas (ou digite /)"
                disabled={disabled || sending}
                className={`mb-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:bg-[var(--gb-surface-2)] hover:text-[var(--gb-cyan)] ${
                  pickerOpen
                    ? "bg-[var(--gb-surface-2)] text-[var(--gb-cyan)]"
                    : "text-[var(--gb-muted)]"
                }`}
                onClick={() => {
                  setPickerOpen((v) => !v);
                  setEmojiOpen(false);
                  setSlashOpen(false);
                  setPickerFilter("");
                }}
              >
                <Zap className="h-4 w-4" />
              </button>
            ) : null}

            <textarea
              ref={textareaRef}
              rows={1}
              value={draft}
              disabled={disabled || sending}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              onClick={() => {
                const el = textareaRef.current;
                if (!el) return;
                const pos = el.selectionStart ?? 0;
                syncSlashFromDraft(draft, pos);
              }}
              onKeyUp={() => {
                const el = textareaRef.current;
                if (!el) return;
                const pos = el.selectionStart ?? 0;
                if (!pickerOpen && !emojiOpen) syncSlashFromDraft(draft, pos);
              }}
              placeholder={
                quickReplies.length > 0
                  ? "Mensagem · / atalho · Shift+Enter nova linha"
                  : placeholder
              }
              className="max-h-[180px] min-h-[40px] w-full resize-none bg-transparent px-2 py-2 text-[15px] leading-5 text-[var(--gb-text)] outline-none placeholder:text-[var(--gb-muted)]"
            />
          </div>

          <button
            type="submit"
            title="Enviar (Enter)"
            disabled={disabled || sending || !draft.trim()}
            className="mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white shadow transition hover:bg-[#06cf9c] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-4 w-4 translate-x-px" />
          </button>
        </div>

        <p className="mt-1.5 px-1 text-[10px] text-[var(--gb-muted)] sm:text-[11px]">
          Enter envia · Shift+Enter quebra linha
          {quickReplies.length > 0 ? " · digite / para atalhos" : ""}
          {slashOpen ? ` · ${slashResults.length} resultado(s)` : ""}
        </p>
      </form>
    </div>
  );
}
