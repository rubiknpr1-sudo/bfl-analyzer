"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CreditReport } from "@/lib/parser/types";
import { analyzeReport, DEFAULT_SETTINGS } from "@/lib/calc/scenarios";
import { checkCompliance } from "@/lib/calc/compliance";
import {
  clearHistory,
  loadHistory,
  saveToHistory,
  type HistoryEntry,
} from "@/lib/history";
import { UploadZone } from "@/components/UploadZone";
import { Dashboard } from "@/components/Dashboard";
import { LeadsBoard } from "@/components/LeadsBoard";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

const MANAGER_KEY = "bfl-manager";

export default function Home() {
  const [report, setReport] = useState<CreditReport | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [manager, setManager] = useState("");
  const [leadsVersion, setLeadsVersion] = useState(0);
  // Имя читаем через ref в момент отправки заявки: PDF парсится секунды,
  // и имя, введённое во время разбора, не должно теряться в старом замыкании
  const managerRef = useRef("");

  useEffect(() => {
    setHistory(loadHistory());
    const saved = window.localStorage.getItem(MANAGER_KEY) ?? "";
    setManager(saved);
    managerRef.current = saved;
  }, []);

  const handleManager = useCallback((value: string) => {
    setManager(value);
    managerRef.current = value;
    window.localStorage.setItem(MANAGER_KEY, value);
  }, []);

  const handleParsed = useCallback(
    (parsed: CreditReport) => {
      const analysis = analyzeReport(parsed, DEFAULT_SETTINGS);
      const flags = checkCompliance(parsed);
      setHistory(saveToHistory(parsed, analysis, flags.length));
      setReport(parsed);
      void fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manager: managerRef.current.trim() || "Не указан",
          client: parsed.client.name,
          debt: analysis.bank.totalDebtNow,
          toPay: analysis.bank.totalToPay,
          saving: analysis.bfl.saving,
          flagsCount: flags.length,
        }),
      }).finally(() => setLeadsVersion((v) => v + 1));
    },
    [],
  );

  const handleClear = useCallback(() => {
    clearHistory();
    setHistory([]);
  }, []);

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-8">
      {report === null ? (
        <div className="flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <p className="text-sm font-extrabold uppercase tracking-widest text-accent">
              БФЛ Аналитик
            </p>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <label
                className="flex items-center gap-2 text-xs font-semibold text-muted"
                title="Имя подставится в заявку — по нему считается статистика менеджеров"
              >
                Менеджер:
                <input
                  type="text"
                  value={manager}
                  onChange={(e) => handleManager(e.target.value)}
                  placeholder="ваше имя"
                  className="w-36 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-bold text-foreground outline-none transition-colors focus:border-accent"
                />
              </label>
              <ThemeSwitcher />
            </div>
          </div>

          <div className="grid items-center gap-8 py-8 lg:grid-cols-2 lg:gap-16 xl:gap-24">
            <div>
              <h1 className="text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl xl:text-[2.7rem]">
                Разбор кредитного отчёта
                <br />
                <span className="text-muted">за 10 секунд — вместо часа</span>
              </h1>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-soft">
                Загрузите PDF-отчёт клиента — система покажет, сколько сгорело
                на процентах, сколько он ещё отдаст банкам и сколько сэкономит
                через БФЛ или РДГ. Compliance-риски — отдельно для юриста.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-ink-soft">
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-good font-bold">✓</span>
                  Проценты против тела долга — из отчёта, не из головы
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-good font-bold">✓</span>
                  Сравнение сценариев: банки vs БФЛ vs РДГ — с настройками
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-good font-bold">✓</span>
                  Рисковые кредиты — 0–2 платежа, серии займов
                </li>
              </ul>
            </div>

            <UploadZone onParsed={handleParsed} />
          </div>

          <LeadsBoard
            refreshKey={leadsVersion}
            localHistory={history}
            onOpenReport={(entry) => setReport(entry.report)}
          />
          {history.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="mt-4 self-start text-xs font-semibold text-muted transition-colors hover:text-bad"
              title="Удаляет сохранённые разборы из этого браузера; заявки на сервере остаются"
            >
              Очистить локальные разборы ({history.length})
            </button>
          )}
        </div>
      ) : (
        <Dashboard report={report} onReset={() => setReport(null)} />
      )}
    </main>
  );
}
