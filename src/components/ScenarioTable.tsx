"use client";

import type { Analysis } from "@/lib/calc/scenarios";
import { fmtMoney, fmtMonths } from "@/lib/format";

interface ScenarioTableProps {
  analysis: Analysis;
}

interface Row {
  name: string;
  note: string;
  monthly: number;
  months: number;
  total: number;
  saving: number | null;
  highlight: boolean;
}

/** Главный продажный блок: «что выгоднее — платить банкам или процедура» */
export function ScenarioTable({ analysis }: ScenarioTableProps) {
  const { bank, bfl, rdg } = analysis;

  const rows: Row[] = [
    {
      name: "Платить банкам дальше",
      note: "если ничего не менять",
      monthly: bank.monthlyPayment,
      months: bank.monthsLeft,
      total: bank.totalToPay,
      saving: null,
      highlight: false,
    },
    {
      name: "БФЛ — банкротство",
      note: "долги списываются полностью",
      monthly: bfl.monthlyPayment,
      months: bfl.months,
      total: bfl.totalOut,
      saving: bfl.saving,
      highlight: bfl.saving > 0,
    },
    {
      name: "РДГ — реструктуризация",
      note: "гасится тело долга без будущих процентов + услуга",
      monthly: rdg.monthlyPayment,
      months: rdg.months,
      total: rdg.totalOut,
      saving: rdg.saving,
      highlight: false,
    },
  ];

  return (
    <section className="rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_3px_rgba(27,36,54,0.06)]">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-extrabold tracking-tight">Что выгоднее клиенту?</h2>
        <p className="text-sm text-muted">
          все цифры — из отчёта и настроек справа
        </p>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-130 border-separate border-spacing-0 text-left">
          <thead>
            <tr className="text-xs font-semibold uppercase tracking-wide text-muted">
              <th className="pb-3 pr-4">Вариант</th>
              <th className="pb-3 pr-4">Платёж в месяц</th>
              <th className="pb-3 pr-4">Срок</th>
              <th className="pb-3 pr-4">Всего клиент отдаст</th>
              <th className="pb-3">Экономия</th>
            </tr>
          </thead>
          <tbody className="text-[15px]">
            {rows.map((row) => (
              <tr
                key={row.name}
                className={
                  row.highlight
                    ? "bg-good-soft/70 [&>td]:border-y [&>td]:border-good/25 [&>td:first-child]:border-l [&>td:first-child]:rounded-l-xl [&>td:last-child]:border-r [&>td:last-child]:rounded-r-xl"
                    : ""
                }
              >
                <td className="py-4 pr-4 pl-3">
                  <span className="font-bold">{row.name}</span>
                  <span className="block text-xs text-muted">{row.note}</span>
                </td>
                <td className="py-4 pr-4 font-semibold whitespace-nowrap">
                  {fmtMoney(row.monthly)}
                </td>
                <td className="py-4 pr-4 whitespace-nowrap">{fmtMonths(row.months)}</td>
                <td className="py-4 pr-4 font-semibold whitespace-nowrap">
                  {fmtMoney(row.total)}
                </td>
                <td className="py-4 pr-3 whitespace-nowrap">
                  {row.saving === null ? (
                    <span className="text-muted">—</span>
                  ) : row.saving > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-good px-3 py-1 text-sm font-bold text-white">
                      −{fmtMoney(row.saving)}
                    </span>
                  ) : (
                    <span className="font-semibold text-bad">
                      дороже на {fmtMoney(-row.saving)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {bfl.paymentDelta > 0 && (
        <p className="mt-4 rounded-xl bg-accent-soft px-4 py-3 text-sm font-medium text-foreground">
          Платёж по процедуре БФЛ на{" "}
          <b>{fmtMoney(bfl.paymentDelta)}</b> в месяц ниже, чем клиент платит
          банкам сейчас — и через {fmtMonths(bfl.months)} вопрос закрыт, а не
          тянется ещё {fmtMonths(bank.monthsLeft)}.
        </p>
      )}
    </section>
  );
}
