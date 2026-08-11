import type { ReactNode } from "react";

/**
 * Renderiza formatação estilo WhatsApp:
 * *negrito* _itálico_ ~riscado~ ```mono``` e quebras de linha.
 */
export function WhatsAppText({ text, className = "" }: { text: string; className?: string }) {
  return <span className={`whitespace-pre-wrap break-words ${className}`}>{parseWhatsApp(text)}</span>;
}

function parseWhatsApp(input: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Ordem: code → bold → italic → strike
  const re = /```([\s\S]+?)```|\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = re.exec(input)) !== null) {
    if (match.index > last) {
      nodes.push(<span key={`t${key++}`}>{input.slice(last, match.index)}</span>);
    }
    if (match[1] != null) {
      nodes.push(
        <code
          key={`c${key++}`}
          className="rounded bg-black/20 px-1 py-0.5 font-mono text-[0.85em]"
        >
          {match[1]}
        </code>,
      );
    } else if (match[2] != null) {
      nodes.push(
        <strong key={`b${key++}`} className="font-semibold">
          {match[2]}
        </strong>,
      );
    } else if (match[3] != null) {
      nodes.push(
        <em key={`i${key++}`} className="italic">
          {match[3]}
        </em>,
      );
    } else if (match[4] != null) {
      nodes.push(
        <span key={`s${key++}`} className="line-through opacity-90">
          {match[4]}
        </span>,
      );
    }
    last = match.index + match[0].length;
  }

  if (last < input.length) {
    nodes.push(<span key={`t${key++}`}>{input.slice(last)}</span>);
  }

  return nodes.length > 0 ? nodes : [input];
}
