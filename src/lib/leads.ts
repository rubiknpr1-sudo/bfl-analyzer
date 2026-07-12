export type LeadStatus = "new" | "in_progress" | "to_lawyer" | "won" | "lost";

export const LEAD_STATUSES: { id: LeadStatus; label: string }[] = [
  { id: "new", label: "Новая" },
  { id: "in_progress", label: "В работе" },
  { id: "to_lawyer", label: "У юриста" },
  { id: "won", label: "Продана" },
  { id: "lost", label: "Отказ" },
];

/**
 * Заявка — сводка разбора, БЕЗ полного отчёта:
 * на сервере только ФИО, суммы и счётчик рисков.
 */
export interface Lead {
  id: string;
  manager: string;
  client: string;
  debt: number;
  toPay: number;
  saving: number;
  flagsCount: number;
  status: LeadStatus;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface NewLeadInput {
  manager: string;
  client: string;
  debt: number;
  toPay: number;
  saving: number;
  flagsCount: number;
}

export function statusLabel(status: LeadStatus): string {
  return LEAD_STATUSES.find((s) => s.id === status)?.label ?? status;
}
