"use client";

import { useMemo, useState } from "react";
import type { CreditReport } from "@/lib/parser/types";
import {
  analyzeReport,
  DEFAULT_SETTINGS,
  type CalcSettings,
} from "@/lib/calc/scenarios";
import { checkCompliance } from "@/lib/calc/compliance";
import { fmtMoney, fmtMonths, fmtDate, fmtPercent, fmtLoans } from "@/lib/format";
import { ScenarioTable } from "./ScenarioTable";
import { PaidBreakdown } from "./PaidBreakdown";
import { LoansTable } from "./LoansTable";
import { ComplianceBlock } from "./ComplianceBlock";
import { SettingsPanel } from "./SettingsPanel";

interface DashboardProps {
  report: CreditReport;
  onReset: () => void;
}

interface StatCard {
  label: string;
  value: string;
  sub: string;
  tone: "neutral" | "bad" | "good";
}

export function Dashboard({ report, onReset }: DashboardProps) {
  const [settings, setSettings] = useState<CalcSettings>(DEFAULT_SETTINGS);
  const analysis = useMemo(
    () => analyzeReport(report, settings),
    [report, settings],
  );
  const flags = useMemo(() => checkCompliance(report), [report]);

  const { bank, bfl, paid } = analysis;

  const cards: StatCard[] = [
    {
      label: "Долг сейчас",
      value: fmtMoney(bank.totalDebtNow),
      sub: `действующих: ${report.summary.activeLoansCount ?? bank.perLoan.length} · с долгом: ${fmtLoans(bank.perLoan.length)}`,
      tone: "neutral",
    },
    {
      label: "Отдаст банкам, если не менять",
      value: fmtMoney(bank.totalToPay),
      sub: `переплата ${fmtMoney(bank.totalOverpay)} процентами`,
      tone: "bad",
    },
    {
      label: "Платить ещё",
      value: fmtMonths(bank.monthsLeft),
      sub: `по ${fmtMoney(bank.monthlyPayment)} в месяц`,
      tone: "neutral",
    },
    {
      label: "Экономия через БФЛ",
      value: bfl.saving > 0 ? fmtMoney(bfl.saving) : "—",
      sub:
        bfl.saving > 0
          ? `${fmtPercent(bfl.savingPercent)} от будущих выплат банкам`
          : "при текущем долге процедура дороже",
      tone: bfl.saving > 0 ? "good" : "neutral",
    },
  ];

  const talkingPoints: string[] = [
    paid.paidTotal > 0
      ? `«Вы уже отдали банкам ${fmtMoney(paid.paidTotal)}, а долг уменьшился только на ${fmtMoney(paid.paidPrincipal)} — ${fmtPercent(paid.burnedShare)} платежей сгорело на процентах»`
      : "",
    `«Если ничего не менять, вы отдадите банкам ещё ${fmtMoney(bank.totalToPay)} за ${fmtMonths(bank.monthsLeft)} — это ${(bank.totalToPay / Math.max(bank.totalDebtNow, 1)).toFixed(1).replace(".", ",")}× текущего долга»`,
    bfl.saving > 0
      ? `«Через БФЛ вопрос закрывается за ${fmtMonths(bfl.months)} и ${fmtMoney(bfl.cost)} — вы экономите ${fmtMoney(bfl.saving)}»`
      : "",
  ].filter((t) => t !== "");

  return (
    <div className="w-full">
      {/* Шапка клиента */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted">
            Кредитный отчёт от {fmtDate(report.client.reportDate)}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
            {report.client.name}
          </h1>
          <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
            {report.client.rating !== null && (
              <span>
                Рейтинг <b>{report.client.rating}</b>
              </span>
            )}
            {report.summary.historyAge !== null && (
              <span>
                КИ: <b>{report.summary.historyAge}</b>
              </span>
            )}
            {report.summary.inquiries12m !== null && (
              <span>
                Запросы за год: <b>{report.summary.inquiries12m}</b>
              </span>
            )}
            {report.summary.overdueDebt !== null && (
              <span>
                Просрочка:{" "}
                <b className={report.summary.overdueDebt > 0 ? "text-bad" : "text-good"}>
                  {report.summary.overdueDebt > 0
                    ? fmtMoney(report.summary.overdueDebt)
                    : "нет"}
                </b>
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold transition-colors hover:border-accent hover:text-accent"
        >
          ← Новый отчёт
        </button>
      </header>

      {/* Карточки-герои */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border p-5 shadow-[0_1px_3px_rgba(27,36,54,0.06)] ${
              card.tone === "good"
                ? "border-good/30 bg-good-soft"
                : card.tone === "bad"
                  ? "border-bad/20 bg-surface"
                  : "border-line bg-surface"
            }`}
          >
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              {card.label}
            </p>
            <p
              className={`mt-2 text-[28px] font-extrabold leading-none tracking-tight ${
                card.tone === "good" ? "text-good" : card.tone === "bad" ? "text-bad" : ""
              }`}
            >
              {card.value}
            </p>
            <p className="mt-2 text-sm text-muted">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Основная сетка: контент + настройки */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-6">
          <ScenarioTable analysis={analysis} />
          <PaidBreakdown paid={paid} />
          <LoansTable perLoan={bank.perLoan} closed={report.closedLoans} />
          <ComplianceBlock flags={flags} />
        </div>

        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <SettingsPanel settings={settings} onChange={setSettings} />

          {talkingPoints.length > 0 && (
            <aside className="rounded-2xl border border-accent/25 bg-accent-soft/60 p-5">
              <h2 className="text-base font-extrabold tracking-tight">
                Фразы для разговора
              </h2>
              <ul className="mt-3 space-y-3">
                {talkingPoints.map((point) => (
                  <li
                    key={point}
                    className="rounded-xl bg-white/80 px-3.5 py-3 text-sm leading-relaxed text-ink-soft"
                  >
                    {point}
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
