"use client";

import type { LoanProjection } from "@/lib/calc/scenarios";
import type { ClosedLoanBrief } from "@/lib/parser/types";
import { fmtDate, fmtMoney, fmtMonths } from "@/lib/format";

interface LoansTableProps {
  perLoan: LoanProjection[];
  closed: ClosedLoanBrief[];
}

/** Разбор по каждому действующему кредиту: прогноз «если платить дальше» */
export function LoansTable({ perLoan, closed }: LoansTableProps) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_3px_rgba(27,36,54,0.06)]">
      <h2 className="text-xl font-extrabold tracking-tight">
        Кредиты клиента — если платить дальше
      </h2>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-160 text-left">
          <thead>
            <tr className="text-xs font-semibold uppercase tracking-wide text-muted border-b border-line">
              <th className="pb-3 pr-4">Кредитор</th>
              <th className="pb-3 pr-4">Открыт</th>
              <th className="pb-3 pr-4">Долг сейчас</th>
              <th className="pb-3 pr-4">Ставка (ПСК)</th>
              <th className="pb-3 pr-4">Платёж/мес</th>
              <th className="pb-3 pr-4">Ещё платить</th>
              <th className="pb-3 pr-4">Всего отдаст</th>
              <th className="pb-3">Переплата</th>
            </tr>
          </thead>
          <tbody className="text-[15px]">
            {perLoan.map((p) => (
              <tr key={p.loan.index} className="border-b border-line/60 last:border-0">
                <td className="py-3.5 pr-4">
                  <span className="font-bold">{p.loan.bank}</span>
                  <span className="block text-xs text-muted">{p.loan.status}</span>
                </td>
                <td className="py-3.5 pr-4 whitespace-nowrap text-ink-soft">
                  {fmtDate(p.loan.openDate)}
                </td>
                <td className="py-3.5 pr-4 font-semibold whitespace-nowrap">
                  {fmtMoney(p.loan.debtTotal)}
                </td>
                <td className="py-3.5 pr-4 whitespace-nowrap">
                  {p.loan.pskPercent !== null ? `${p.loan.pskPercent.toFixed(1).replace(".", ",")} %` : "—"}
                </td>
                <td className="py-3.5 pr-4 whitespace-nowrap">
                  {fmtMoney(p.monthlyPayment)}
                  {p.paymentEstimated && (
                    <span
                      className="ml-1.5 cursor-help rounded bg-warn-soft px-1.5 py-0.5 text-[10px] font-bold text-warn align-middle"
                      title="В отчёте нет регулярного платежа — оценка по сроку договора или минимальному платежу из настроек"
                    >
                      оценка
                    </span>
                  )}
                </td>
                <td className="py-3.5 pr-4 whitespace-nowrap">{fmtMonths(p.monthsLeft)}</td>
                <td className="py-3.5 pr-4 font-semibold whitespace-nowrap">
                  {fmtMoney(p.totalToPay)}
                </td>
                <td className="py-3.5 whitespace-nowrap font-semibold text-bad">
                  +{fmtMoney(p.overpay)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {closed.length > 0 && (
        <p className="mt-4 text-xs text-muted">
          Закрытые договоры (в расчёты не входят):{" "}
          {closed.map((c) => `${c.bank} — ${c.status}`).join(" · ")}
        </p>
      )}
    </section>
  );
}
