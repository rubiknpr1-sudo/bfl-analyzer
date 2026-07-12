"use client";

import type { LoanProjection } from "@/lib/calc/scenarios";
import type { ClosedLoanBrief } from "@/lib/parser/types";
import { fmtDate, fmtMoney, fmtMonths } from "@/lib/format";

interface LoansTableProps {
  perLoan: LoanProjection[];
  closed: ClosedLoanBrief[];
}

interface Metric {
  label: string;
  value: string;
  hint: string;
  tone?: "bad" | "warn";
  badge?: string;
}

function loanMetrics(p: LoanProjection): Metric[] {
  return [
    {
      label: "Долг сейчас",
      value: fmtMoney(p.loan.debtTotal),
      hint: `Из отчёта: тело ${fmtMoney(p.loan.debtPrincipal)} + начисленные проценты ${fmtMoney(p.loan.debtInterest)}`,
    },
    {
      label: "Ставка (ПСК)",
      value:
        p.loan.pskPercent !== null
          ? `${p.loan.pskPercent.toFixed(1).replace(".", ",")} %`
          : "—",
      hint: "Полная стоимость кредита из отчёта — реальная цена денег с учётом всех платежей банку",
    },
    {
      label: "Платёж / мес",
      value: fmtMoney(p.monthlyPayment),
      hint: p.paymentEstimated
        ? "В отчёте нет регулярного платежа — оценка по сроку договора или минимальному платежу из настроек"
        : "Среднемесячный платёж из отчёта",
      badge: p.paymentEstimated ? "оценка" : undefined,
    },
    {
      label: "Ещё платить",
      value: fmtMonths(p.monthsLeft),
      hint: "Сколько месяцев уйдёт на полное погашение при этом платеже и ставке (аннуитетная формула)",
    },
    {
      label: "Всего отдаст",
      value: fmtMoney(p.totalToPay),
      hint: "Платёж × количество месяцев до полного погашения",
    },
    {
      label: "Переплата",
      value: `+${fmtMoney(p.overpay)}`,
      hint: "Сколько клиент отдаст банку сверх текущего долга — деньги, которые сгорят на процентах",
      tone: "bad",
    },
  ];
}

/** Разбор по кредитам: карточки с прогрессом погашения и наводками */
export function LoansTable({ perLoan, closed }: LoansTableProps) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_3px_rgba(27,36,54,0.06)]">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <h2 className="text-xl font-extrabold tracking-tight">Разбор по кредитам</h2>
        <p className="text-sm text-muted">наведите на цифру — подсказка, как она посчитана</p>
      </div>

      <div className="mt-5 space-y-4">
        {perLoan.map((p) => {
          const paidPrincipal = p.loan.paidPrincipal;
          const totalPrincipal = paidPrincipal + p.loan.debtPrincipal;
          const progress =
            totalPrincipal > 0 ? Math.min(1, paidPrincipal / totalPrincipal) : 0;
          const hasOverdue = p.loan.status.toLowerCase().includes("просроч");

          return (
            <article
              key={p.loan.index}
              className="rounded-xl border border-line bg-background/40 p-5 transition-colors hover:border-accent/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-lg font-extrabold tracking-tight">{p.loan.bank}</h3>
                  <span
                    title={hasOverdue ? "Статус платежей из отчёта — были просрочки" : "По отчёту просрочек не было"}
                    className={`cursor-help rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      hasOverdue ? "bg-bad-soft text-bad" : "bg-good-soft text-good"
                    }`}
                  >
                    {p.loan.status}
                  </span>
                </div>
                <p className="text-xs text-muted">
                  открыт {fmtDate(p.loan.openDate)}
                  {p.loan.obligationAmount !== null &&
                    ` · лимит ${fmtMoney(p.loan.obligationAmount)}`}
                </p>
              </div>

              <div
                className="mt-4 cursor-help"
                title={`Выплачено тела долга ${fmtMoney(paidPrincipal)} из ${fmtMoney(totalPrincipal)}. Прогресс показывает, какая часть основного долга уже закрыта — проценты сюда не входят`}
              >
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-semibold text-muted">
                    Погашено тела долга
                  </span>
                  <span className="font-extrabold">
                    {Math.round(progress * 100)} %
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-line/60">
                  <div
                    className="h-full rounded-full bg-good transition-all duration-500"
                    style={{ width: `${Math.max(progress * 100, 1.5)}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                {loanMetrics(p).map((m) => (
                  <div
                    key={m.label}
                    title={m.hint}
                    className="cursor-help rounded-lg border border-line/70 bg-surface px-3 py-2.5"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                      {m.label}
                    </p>
                    <p
                      className={`mt-0.5 text-[15px] font-extrabold whitespace-nowrap ${
                        m.tone === "bad" ? "text-bad" : ""
                      }`}
                    >
                      {m.value}
                      {m.badge && (
                        <span className="ml-1.5 rounded bg-warn-soft px-1.5 py-0.5 align-middle text-[9px] font-bold text-warn">
                          {m.badge}
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
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
