"use client";

import type { LoanProjection } from "@/lib/calc/scenarios";
import type { ClosedLoanBrief } from "@/lib/parser/types";
import { fmtDate, fmtMoney, fmtMonths, fmtPercent } from "@/lib/format";

interface LoansTableProps {
  perLoan: LoanProjection[];
  closed: ClosedLoanBrief[];
}

/**
 * Разбор по кредитам: горизонтальные полосы на общей шкале.
 * Длина полосы = сколько клиент всего отдаст; сегменты — долг сейчас
 * (нейтральный) и переплата процентами (красный). Кредиты сравниваются глазом.
 */
export function LoansTable({ perLoan, closed }: LoansTableProps) {
  const maxToPay = Math.max(...perLoan.map((p) => p.totalToPay), 1);

  return (
    <section className="rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_3px_rgba(27,36,54,0.06)]">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-extrabold tracking-tight">Разбор по кредитам</h2>
        <div className="flex items-center gap-4 text-xs font-semibold text-muted">
          <span className="flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-sm bg-ink-soft" /> долг сейчас
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-sm bg-bad" /> переплата процентами
          </span>
        </div>
      </div>

      <div className="mt-6 space-y-7">
        {perLoan.map((p) => {
          const hasOverdue = /была просрочка/i.test(p.loan.status);
          const debtShare = (p.loan.debtTotal / maxToPay) * 100;
          const overpayShare = (p.overpay / maxToPay) * 100;
          const paidPrincipal = p.loan.paidPrincipal;
          const totalPrincipal = paidPrincipal + p.loan.debtPrincipal;
          const progress = totalPrincipal > 0 ? paidPrincipal / totalPrincipal : 0;

          return (
            <article key={p.loan.index}>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="text-[15px] font-extrabold tracking-tight">
                    {p.loan.bank}
                  </h3>
                  <span
                    title={
                      hasOverdue
                        ? "Из отчёта: по кредиту были просрочки"
                        : "По отчёту просрочек не было"
                    }
                    className={`cursor-help rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      hasOverdue ? "bg-bad-soft text-bad" : "bg-good-soft text-good"
                    }`}
                  >
                    {p.loan.status}
                  </span>
                </div>
                <p className="text-xs font-semibold text-muted">
                  <span title="Полная стоимость кредита из отчёта" className="cursor-help">
                    {p.loan.pskPercent !== null
                      ? `${p.loan.pskPercent.toFixed(1).replace(".", ",")} %`
                      : "ставка не указана"}
                  </span>
                  {" · "}
                  <span
                    title={
                      p.paymentEstimated
                        ? "В отчёте нет регулярного платежа — оценка по сроку договора или минимальному платежу из настроек"
                        : "Среднемесячный платёж из отчёта"
                    }
                    className="cursor-help"
                  >
                    {fmtMoney(p.monthlyPayment)}/мес
                    {p.paymentEstimated ? " (оценка)" : ""}
                  </span>
                  {" · "}
                  <span
                    title="Срок полного погашения при этом платеже и ставке"
                    className="cursor-help"
                  >
                    ещё {fmtMonths(p.monthsLeft)}
                  </span>
                </p>
              </div>

              <div className="mt-2.5 flex items-center gap-3">
                <div className="flex h-8 flex-1 items-stretch gap-0.5">
                  <div
                    title={`Долг сейчас: ${fmtMoney(p.loan.debtTotal)} — тело ${fmtMoney(p.loan.debtPrincipal)} + начисленные проценты ${fmtMoney(p.loan.debtInterest)}`}
                    style={{ width: `${Math.max(debtShare, 2)}%` }}
                    className="flex cursor-help items-center overflow-hidden rounded-l-md rounded-r-sm bg-ink-soft px-2"
                  >
                    {debtShare > 14 && (
                      <span className="truncate text-[11px] font-bold text-background">
                        {fmtMoney(p.loan.debtTotal)}
                      </span>
                    )}
                  </div>
                  {p.overpay > 0 && (
                    <div
                      title={`Переплата процентами: ${fmtMoney(p.overpay)} — деньги сверх долга, которые сгорят, если платить дальше`}
                      style={{ width: `${Math.max(overpayShare, 1.5)}%` }}
                      className="flex cursor-help items-center overflow-hidden rounded-l-sm rounded-r-md bg-bad px-2"
                    >
                      {overpayShare > 14 && (
                        <span className="truncate text-[11px] font-bold text-white">
                          +{fmtMoney(p.overpay)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <p
                  title="Всего клиент отдаст по этому кредиту: платёж × месяцы до погашения"
                  className="w-28 shrink-0 cursor-help text-right"
                >
                  <span className="block text-[15px] font-extrabold leading-tight">
                    {fmtMoney(p.totalToPay)}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    всего отдаст
                  </span>
                </p>
              </div>

              <p className="mt-1.5 text-xs text-muted">
                <span
                  title={`Выплачено тела долга ${fmtMoney(paidPrincipal)} из ${fmtMoney(totalPrincipal)}; проценты сюда не входят`}
                  className="cursor-help"
                >
                  погашено тела {fmtPercent(progress)}
                </span>
                {" · открыт "}
                {fmtDate(p.loan.openDate)}
                {p.loan.obligationAmount !== null &&
                  ` · лимит ${fmtMoney(p.loan.obligationAmount)}`}
              </p>
            </article>
          );
        })}
      </div>

      {closed.length > 0 && (
        <p className="mt-6 border-t border-line pt-3 text-xs text-muted">
          Закрытые договоры (в расчёты не входят):{" "}
          {closed.map((c) => `${c.bank} — ${c.status}`).join(" · ")}
        </p>
      )}
    </section>
  );
}
