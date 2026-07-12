"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { ThemeSwitcher } from "./ThemeSwitcher";

interface DashboardProps {
  report: CreditReport;
  onReset: () => void;
}

function copyToClipboard(text: string): boolean {
  // navigator.clipboard отсутствует вне secure context (например, http по IP)
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(text).catch(() => undefined);
    return true;
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const okResult = document.execCommand("copy");
    area.remove();
    return okResult;
  } catch {
    return false;
  }
}

function CopyButton({ text, wide }: { text: string; wide?: boolean }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <button
      type="button"
      onClick={() => {
        if (!copyToClipboard(text)) return;
        setCopied(true);
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), 1600);
      }}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
        copied
          ? "border-good/40 bg-good-soft text-good"
          : "border-line bg-surface text-accent hover:border-accent"
      } ${wide ? "w-full py-2" : ""}`}
    >
      {copied ? "Скопировано ✓" : "Копировать"}
    </button>
  );
}

interface StatCard {
  label: string;
  value: string;
  sub: string;
  tone: "neutral" | "bad" | "good";
  hint: string;
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
      hint: "Сумма «Общая задолженность» по всем действующим кредитам из отчёта — тело долга плюс уже начисленные проценты",
    },
    {
      label: "Отдаст банкам, если не менять",
      value: fmtMoney(bank.totalToPay),
      sub: `переплата ${fmtMoney(bank.totalOverpay)} процентами`,
      tone: "bad",
      hint: "Прогноз: по каждому кредиту берём долг, ставку ПСК и платёж из отчёта и считаем полную стоимость погашения. Главная цифра для разговора",
    },
    {
      label: "Платить ещё",
      value: fmtMonths(bank.monthsLeft),
      sub: `по ${fmtMoney(bank.monthlyPayment)} в месяц`,
      tone: "neutral",
      hint: "Срок самого длинного кредита при текущих платежах; платёж — сумма ежемесячных платежей по всем кредитам",
    },
    {
      label: "Экономия через БФЛ",
      value: bfl.saving > 0 ? fmtMoney(bfl.saving) : "—",
      sub:
        bfl.saving > 0
          ? `${fmtPercent(bfl.savingPercent)} от будущих выплат банкам`
          : "при текущем долге процедура дороже",
      tone: bfl.saving > 0 ? "good" : "neutral",
      hint: "Сколько клиент сохранит: будущие выплаты банкам минус стоимость процедуры БФЛ из настроек",
    },
  ];

  const script: { stage: string; text: string }[] = [
    paid.paidTotal > 0
      ? {
          stage: "1 · Показать реальность",
          text:
            paid.burnedShare < 0.1
              ? `«Пока вы платили аккуратно и почти без процентов. Но дальше так не будет: на вашем долге ${fmtMoney(bank.totalDebtNow)} банки заработают ещё ${fmtMoney(bank.totalOverpay)} — примерно ${fmtMoney(analysis.dailyInterest)} процентов каждый день»`
              : `«Смотрите, что происходит с вашими деньгами: вы уже внесли ${fmtMoney(paid.paidTotal)}, а долг уменьшился только на ${fmtMoney(paid.paidPrincipal)}. ${fmtPercent(paid.burnedShare)} ваших платежей банк забрал процентами»`,
        }
      : null,
    {
      stage: "2 · Прогноз, если ничего не менять",
      text: `«Если продолжать платить как сейчас — вы отдадите банкам ещё ${fmtMoney(bank.totalToPay)} за ${fmtMonths(bank.monthsLeft)}. Это ${(bank.totalToPay / Math.max(bank.totalDebtNow, 1)).toFixed(1).replace(".", ",")} рубля с каждого рубля текущего долга»`,
    },
    bfl.saving > 0
      ? {
          stage: "3 · Предложить решение",
          text: `«Есть законный способ закрыть вопрос за ${fmtMonths(bfl.months)}: процедура стоит ${fmtMoney(bfl.cost)} — вместо ${fmtMoney(bank.totalToPay)} банкам. Ваша экономия ${fmtMoney(bfl.saving)}»`,
        }
      : null,
    {
      stage: "4 · Закрыть на решение",
      text:
        bfl.saving > 0
          ? `«Что для вас удобнее: платить банкам ${fmtMoney(bank.monthlyPayment)} в месяц ещё ${fmtMonths(bank.monthsLeft)} — или ${fmtMoney(bfl.monthlyPayment)} в месяц ${fmtMonths(bfl.months)} и полностью закрыть долги?»`
          : `«Давайте посмотрим вместе с юристом, какой вариант в вашей ситуации выгоднее — расчёт у нас уже готов»`,
    },
  ].filter((s): s is { stage: string; text: string } => s !== null);

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
        <div className="flex items-center gap-3">
          <ThemeSwitcher />
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold transition-colors hover:border-accent hover:text-accent"
          >
            ← Новый отчёт
          </button>
        </div>
      </header>

      {/* Карточки-герои */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            title={card.hint}
            className={`cursor-help rounded-2xl border p-5 shadow-[0_1px_3px_rgba(27,36,54,0.06)] ${
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

          {script.length > 0 && (
            <section className="rounded-2xl border border-accent/25 bg-accent-soft/50 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight">
                    Скрипт разговора
                  </h2>
                  <p className="mt-0.5 text-sm text-muted">
                    4 шага, цифры клиента уже подставлены — копируйте и
                    отправляйте
                  </p>
                </div>
                <CopyButton
                  text={script.map((s) => `${s.stage}\n${s.text}`).join("\n\n")}
                />
              </div>
              <ol className="mt-4 grid gap-3 lg:grid-cols-2">
                {script.map((step) => (
                  <li
                    key={step.stage}
                    className="flex flex-col rounded-xl chip p-4"
                  >
                    <p className="text-[11px] font-extrabold uppercase tracking-wide text-accent">
                      {step.stage}
                    </p>
                    <p className="mt-1.5 flex-1 text-[15px] leading-relaxed text-ink-soft">
                      {step.text}
                    </p>
                    <div className="mt-3">
                      <CopyButton text={step.text} wide />
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <PaidBreakdown analysis={analysis} />
          <LoansTable perLoan={bank.perLoan} closed={report.closedLoans} />
          <ComplianceBlock flags={flags} />
        </div>

        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <SettingsPanel settings={settings} onChange={setSettings} />
        </div>
      </div>
    </div>
  );
}
