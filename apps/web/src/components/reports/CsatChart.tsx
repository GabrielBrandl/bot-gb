type Score = { score: number; count: number };

const LABELS: Record<number, string> = {
  1: "Ruim",
  2: "Regular",
  3: "Bom",
  4: "Muito bom",
  5: "Excelente",
};

export function CsatChart({
  scores = [],
  average,
  total = 0,
}: {
  scores?: Score[];
  average?: number | null;
  total?: number;
}) {
  const max = Math.max(1, ...scores.map((item) => item.count));

  return (
    <section className="rounded-2xl border border-[var(--gb-border)] bg-[var(--gb-surface)] p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--gb-text)]">Avaliações do atendimento</h2>
          <p className="mt-1 text-sm text-[var(--gb-muted)]">Notas de 1 a 5 enviadas no fim da conversa.</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold text-[var(--gb-text)]">{average ?? "—"}</p>
          <p className="text-xs text-[var(--gb-muted)]">{total} avaliação(ões)</p>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {[5, 4, 3, 2, 1].map((score) => {
          const count = scores.find((item) => item.score === score)?.count ?? 0;
          const width = total === 0 ? 0 : Math.round((count / max) * 100);
          return (
            <div key={score} className="grid grid-cols-[88px_1fr_32px] items-center gap-3">
              <span className="text-xs text-[var(--gb-muted)]">
                {score} · {LABELS[score]}
              </span>
              <div className="h-3 overflow-hidden rounded-full bg-[var(--gb-surface-2)]">
                <div
                  className="h-full rounded-full bg-[#00a884]"
                  style={{ width: `${width}%` }}
                />
              </div>
              <span className="text-right text-sm font-medium text-[var(--gb-text)]">{count}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
