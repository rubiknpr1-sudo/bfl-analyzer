"use client";

import type { PaidAnalysis } from "@/lib/calc/scenarios";
import { fmtMoney, fmtPercent } from "@/lib/format";

interface PaidBreakdownProps {
  paid: PaidAnalysis;
}

/** «Проценты против тела долга» — маркетинговый блок про сгоревшие деньги */
export function PaidBreakdown({ paid }: PaidBreakdownProps) {
  const burned = paid.paidInterest + paid.paidOther;
  const principalPct = paid.paidTotal > 0 ? (paid.paidPrincipal / paid.paidTotal) * 100 : 0;
  const interestPct = paid.paidTotal > 0 ? (paid.paidInterest / paid.paidTotal) * 100 : 0;
  const otherPct = paid.paidTotal > 0 ? (paid.paidOther / paid.paidTotal) * 100 : 0;

  return (
    <section className="rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_3px_rgba(27,36,54,0.06)]">
      <h2 className="text-xl font-extrabold tracking-tight">Куда ушли деньги клиента</h2>

      {paid.paidTotal <= 0 ? (
        <p className="mt-4 text-sm text-muted">
          В отчёте нет данных о внесённых платежах по действующим кредитам.
        </p>
      ) : (
        <>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            Клиент уже внёс{" "}
            <b className="text-foreground">{fmtMoney(paid.paidTotal)}</b>, но
            основной долг уменьшился только на{" "}
            <b className="text-foreground">{fmtMoney(paid.paidPrincipal)}</b>.
            Остальные{" "}
            <b className="text-bad">{fmtMoney(burned)}</b> ушли банкам на
            проценты и прочие начисления —{" "}
            <b className="text-bad">{fmtPercent(paid.burnedShare)}</b> всех
            платежей сгорело.
          </p>

          <div className="mt-5 flex h-9 w-full overflow-hidden rounded-lg text-[11px] font-bold text-white">
            {principalPct > 0 && (
              <div
                className="flex items-center justify-center bg-good transition-all duration-500"
                style={{ width: `${Math.max(principalPct, 4)}%` }}
                title={`Тело долга: ${fmtMoney(paid.paidPrincipal)}`}
              >
                {principalPct > 12 ? "ТЕЛО ДОЛГА" : ""}
              </div>
            )}
            {interestPct > 0 && (
              <div
                className="flex items-center justify-center bg-bad transition-all duration-500"
                style={{ width: `${Math.max(interestPct, 4)}%` }}
                title={`Проценты: ${fmtMoney(paid.paidInterest)}`}
              >
                {interestPct > 12 ? "ПРОЦЕНТЫ" : ""}
              </div>
            )}
            {otherPct > 0 && (
              <div
                className="flex items-center justify-center bg-ink-soft transition-all duration-500"
                style={{ width: `${Math.max(otherPct, 3)}%` }}
                title={`Иное: ${fmtMoney(paid.paidOther)}`}
              >
                {otherPct > 12 ? "ИНОЕ" : ""}
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span className="flex items-center gap-2">
              <i className="h-2.5 w-2.5 rounded-sm bg-good" />
              Тело долга: <b>{fmtMoney(paid.paidPrincipal)}</b>
            </span>
            <span className="flex items-center gap-2">
              <i className="h-2.5 w-2.5 rounded-sm bg-bad" />
              Проценты: <b>{fmtMoney(paid.paidInterest)}</b>
            </span>
            {paid.paidOther > 0 && (
              <span className="flex items-center gap-2">
                <i className="h-2.5 w-2.5 rounded-sm bg-ink-soft" />
                Пени и иное: <b>{fmtMoney(paid.paidOther)}</b>
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
