"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/lib/leads";
import type { HistoryEntry } from "@/lib/history";
import { fmtMoney } from "@/lib/format";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface LeadsBoardProps {
  refreshKey: number;
  localHistory: HistoryEntry[];
  onOpenReport: (entry: HistoryEntry) => void;
}

const STATUS_TONE: Record<LeadStatus, string> = {
  new: "bg-accent-soft text-accent",
  in_progress: "bg-warn-soft text-warn",
  to_lawyer: "bg-warn-soft text-warn",
  won: "bg-good-soft text-good",
  lost: "bg-bad-soft text-bad",
};

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }) +
    " " +
    d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
  );
}

/** Заявки отдела: кто обрабатывает, статусы, статистика по менеджерам */
export function LeadsBoard({ refreshKey, localHistory, onOpenReport }: LeadsBoardProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/leads");
      const body = (await res.json()) as ApiResponse<Lead[]>;
      if (body.success && body.data) setLeads(body.data);
    } catch {
      // сервер недоступен — доска просто не обновится
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  const setStatus = useCallback(
    async (id: string, status: LeadStatus) => {
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
      try {
        await fetch("/api/leads", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status }),
        });
      } finally {
        void refresh();
      }
    },
    [refresh],
  );

  const stats = useMemo(() => {
    const active = leads.filter((l) => l.status === "new" || l.status === "in_progress");
    const won = leads.filter((l) => l.status === "won");
    const totalSaving = leads.reduce((s, l) => s + Math.max(0, l.saving), 0);
    return [
      { label: "Заявок всего", value: String(leads.length), hint: "Все заявки в системе" },
      { label: "В работе", value: String(active.length), hint: "Статусы «Новая» и «В работе»" },
      { label: "Продано", value: String(won.length), hint: "Заявки со статусом «Продана»" },
      {
        label: "Потенциальная экономия клиентов",
        value: fmtMoney(totalSaving),
        hint: "Сумма экономии через БФЛ по всем заявкам — главный аргумент отдела продаж",
      },
    ];
  }, [leads]);

  const managerStats = useMemo(() => {
    const byManager = new Map<string, { total: number; won: number }>();
    for (const l of leads) {
      const entry = byManager.get(l.manager) ?? { total: 0, won: 0 };
      byManager.set(l.manager, {
        total: entry.total + 1,
        won: entry.won + (l.status === "won" ? 1 : 0),
      });
    }
    return [...byManager.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [leads]);

  if (!loaded || leads.length === 0) return null;

  return (
    <section className="mt-2 border-t border-line pt-6">
      <h2 className="text-lg font-extrabold tracking-tight">Статистика отдела</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            title={s.hint}
            className="cursor-help rounded-xl border border-line bg-surface p-4"
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
              {s.label}
            </p>
            <p className="mt-1 text-xl font-extrabold tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      {managerStats.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {managerStats.map(([name, m]) => (
            <span
              key={name}
              title={`${name}: заявок ${m.total}, продано ${m.won}`}
              className="cursor-help rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold"
            >
              {name} · {m.total} заяв. ·{" "}
              <span className="text-good">{m.won} продано</span>
            </span>
          ))}
        </div>
      )}

      <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-muted">
        Заявки
      </h3>
      <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-170 text-left text-sm">
          <thead>
            <tr className="border-b border-line text-[11px] font-bold uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Клиент</th>
              <th className="px-4 py-3">Менеджер</th>
              <th className="px-4 py-3">Создана</th>
              <th className="px-4 py-3">Долг</th>
              <th className="px-4 py-3">Экономия</th>
              <th className="px-4 py-3">Риски</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const local = localHistory.find((h) => h.name === lead.client);
              return (
                <tr key={lead.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3 font-bold">{lead.client}</td>
                  <td className="px-4 py-3">{lead.manager}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted">
                    {fmtWhen(lead.createdAt)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-semibold">
                    {fmtMoney(lead.debt)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-good font-semibold">
                    {lead.saving > 0 ? fmtMoney(lead.saving) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {lead.flagsCount > 0 ? (
                      <span
                        title="Число compliance-флагов — проверить с юристом"
                        className="cursor-help rounded bg-warn-soft px-2 py-0.5 text-xs font-bold text-warn"
                      >
                        {lead.flagsCount}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={lead.status}
                      onChange={(e) => void setStatus(lead.id, e.target.value as LeadStatus)}
                      className={`rounded-lg border border-line px-2 py-1 text-xs font-bold outline-none ${STATUS_TONE[lead.status]}`}
                    >
                      {LEAD_STATUSES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {local && (
                      <button
                        type="button"
                        onClick={() => onOpenReport(local)}
                        title="Отчёт этого клиента сохранён в вашем браузере — открыть без повторной загрузки PDF"
                        className="rounded-lg border border-line px-2.5 py-1 text-xs font-bold text-accent transition-colors hover:border-accent"
                      >
                        открыть разбор
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">
        На сервере хранится только сводка заявки (ФИО, суммы, статус). Полный
        разбор отчёта — в браузере менеджера, который его загружал.
      </p>
    </section>
  );
}
