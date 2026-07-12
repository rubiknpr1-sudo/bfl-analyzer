"use client";

import type { ComplianceFlag } from "@/lib/calc/compliance";

interface ComplianceBlockProps {
  flags: ComplianceFlag[];
}

/**
 * Compliance-блок. Намеренно визуально отделён от продажных расчётов:
 * янтарная рамка, штриховой разделитель, явная пометка «передать юристу».
 */
export function ComplianceBlock({ flags }: ComplianceBlockProps) {
  return (
    <section className="relative mt-2 rounded-2xl border-2 border-warn/40 bg-warn-soft/60 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-warn text-white">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-warn">
            Compliance: риски для юриста
          </h2>
          <p className="text-sm text-warn/90">
            Это не аргументы продажи — эти кредиты нужно показать юристу или
            старшему специалисту до сделки.
          </p>
        </div>
      </div>

      {flags.length === 0 ? (
        <p className="mt-5 rounded-xl chip px-4 py-3 text-sm font-medium text-ink-soft">
          Рисковых паттернов не найдено: по всем действующим кредитам есть
          история платежей, серий одновременных кредитов нет.
        </p>
      ) : (
        <ul className="mt-5 grid gap-3 lg:grid-cols-2">
          {flags.map((flag) => (
            <li
              key={flag.title}
              className="rounded-xl border border-warn/25 chip p-4"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white ${
                    flag.severity === "high" ? "bg-bad" : "bg-warn"
                  }`}
                >
                  {flag.severity === "high" ? "Высокий" : "Средний"}
                </span>
                <h3 className="font-bold">{flag.title}</h3>
              </div>
              <p className="mt-1.5 text-sm text-ink-soft">{flag.detail}</p>
              {flag.loans.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {flag.loans.map((loan, i) => (
                    <li key={`${i}-${loan}`} className="flex items-start gap-2 text-sm font-medium">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
                      {loan}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
