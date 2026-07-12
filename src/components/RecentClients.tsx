"use client";

import type { HistoryEntry } from "@/lib/history";
import { fmtMoney } from "@/lib/format";

interface RecentClientsProps {
  entries: HistoryEntry[];
  onOpen: (entry: HistoryEntry) => void;
  onClear: () => void;
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }) +
    " " +
    d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Статистика менеджера + последние клиенты.
 * Данные только из localStorage этого браузера — сервер историю не видит.
 */
export function RecentClients({ entries, onOpen, onClear }: RecentClientsProps) {
  if (entries.length === 0) return null;

  const totalDebt = entries.reduce((s, e) => s + e.debt, 0);
  const totalSaving = entries.reduce((s, e) => s + Math.max(0, e.saving), 0);
  const withFlags = entries.filter((e) => e.flagsCount > 0).length;

  const stats = [
    { label: "Разобрано отчётов", value: String(entries.length) },
    { label: "Долгов на анализе", value: fmtMoney(totalDebt) },
    { label: "Потенциальная экономия клиентов", value: fmtMoney(totalSaving) },
    { label: "С compliance-рисками", value: String(withFlags) },
  ];

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-extrabold tracking-tight">Моя статистика</h2>
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-semibold text-muted transition-colors hover:text-bad"
          title="История хранится только в этом браузере"
        >
          Очистить историю
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-line bg-surface p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
              {s.label}
            </p>
            <p className="mt-1 text-xl font-extrabold tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-muted">
        Последние клиенты
      </h3>
      <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface">
        {entries.slice(0, 6).map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onOpen(e)}
              className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-accent-soft/50"
            >
              <span className="min-w-0">
                <span className="block truncate font-bold">{e.name}</span>
                <span className="text-xs text-muted">{fmtWhen(e.date)}</span>
              </span>
              <span className="flex items-center gap-5 text-sm whitespace-nowrap">
                <span>
                  долг <b>{fmtMoney(e.debt)}</b>
                </span>
                {e.saving > 0 && (
                  <span className="text-good">
                    экономия <b>{fmtMoney(e.saving)}</b>
                  </span>
                )}
                {e.flagsCount > 0 && (
                  <span className="rounded bg-warn-soft px-2 py-0.5 text-xs font-bold text-warn">
                    риски: {e.flagsCount}
                  </span>
                )}
                <span className="text-accent" aria-hidden>
                  →
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">
        История хранится только в этом браузере (localStorage), на сервер не передаётся.
      </p>
    </section>
  );
}
