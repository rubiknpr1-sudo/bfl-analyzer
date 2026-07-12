import type { CreditReport } from "./parser/types";
import type { Analysis } from "./calc/scenarios";

/**
 * История разборов живёт ТОЛЬКО в localStorage браузера менеджера.
 * Сервер по-прежнему ничего не хранит — PII не покидает рабочее место.
 */
export interface HistoryEntry {
  id: string;
  name: string;
  date: string; // ISO
  debt: number;
  toPay: number;
  saving: number;
  flagsCount: number;
  report: CreditReport;
}

const STORAGE_KEY = "bfl-history";
const MAX_ENTRIES = 20;

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as HistoryEntry[];
  } catch {
    return [];
  }
}

export function saveToHistory(
  report: CreditReport,
  analysis: Analysis,
  flagsCount: number,
): HistoryEntry[] {
  const entry: HistoryEntry = {
    id: crypto.randomUUID(),
    name: report.client.name,
    date: new Date().toISOString(),
    debt: analysis.bank.totalDebtNow,
    toPay: analysis.bank.totalToPay,
    saving: analysis.bfl.saving,
    flagsCount,
    report,
  };
  // Один клиент — одна запись: старый разбор того же ФИО заменяем
  const rest = loadHistory().filter((e) => e.name !== entry.name);
  const next = [entry, ...rest].slice(0, MAX_ENTRIES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage переполнен — работаем без истории
  }
  return next;
}

export function clearHistory(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
