"use client";

import type { CalcSettings } from "@/lib/calc/scenarios";

interface SettingsPanelProps {
  settings: CalcSettings;
  onChange: (next: CalcSettings) => void;
}

interface FieldDef {
  key: keyof CalcSettings;
  label: string;
  suffix: string;
  step?: number;
  toDisplay?: (v: number) => number;
  fromDisplay?: (v: number) => number;
}

const FIELDS: FieldDef[] = [
  { key: "bflCost", label: "Стоимость БФЛ", suffix: "₽", step: 10_000 },
  { key: "bflMonths", label: "Срок процедуры БФЛ", suffix: "мес" },
  { key: "rdgCost", label: "Стоимость РДГ", suffix: "₽", step: 10_000 },
  { key: "rdgMonths", label: "Срок процедуры РДГ", suffix: "мес" },
  {
    key: "minPaymentShare",
    label: "Мин. платёж по картам",
    suffix: "% долга",
    toDisplay: (v) => Math.round(v * 100),
    fromDisplay: (v) => v / 100,
  },
  {
    key: "fallbackAnnualRate",
    label: "Ставка, если ПСК не найдена",
    suffix: "% год",
  },
];

/** Панель настроек менеджера — каждое изменение мгновенно пересчитывает сценарии */
export function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  return (
    <aside className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_3px_rgba(27,36,54,0.06)]">
      <h2 className="text-base font-extrabold tracking-tight">Настройки расчёта</h2>
      <p className="mt-1 text-xs text-muted">
        Меняются под клиента — все блоки пересчитываются сразу
      </p>

      <div className="mt-4 space-y-3">
        {FIELDS.map((field) => {
          const raw = settings[field.key];
          const display = field.toDisplay ? field.toDisplay(raw) : raw;
          return (
            <label key={field.key} className="block">
              <span className="text-xs font-semibold text-ink-soft">
                {field.label}
              </span>
              <span className="mt-1 flex items-center gap-2 rounded-lg border border-line bg-background/60 px-3 py-2 transition-colors focus-within:border-accent focus-within:bg-white focus-within:ring-2 focus-within:ring-accent/15">
                <input
                  type="number"
                  value={display}
                  min={0}
                  step={field.step ?? 1}
                  onChange={(e) => {
                    const parsed = Number(e.target.value);
                    if (!Number.isFinite(parsed) || parsed < 0) return;
                    const value = field.fromDisplay
                      ? field.fromDisplay(parsed)
                      : parsed;
                    onChange({ ...settings, [field.key]: value });
                  }}
                  className="w-full bg-transparent text-[15px] font-bold outline-none"
                />
                <span className="shrink-0 text-xs font-semibold text-muted">
                  {field.suffix}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </aside>
  );
}
