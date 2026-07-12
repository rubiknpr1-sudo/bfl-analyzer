"use client";

import { useState } from "react";
import type { CreditReport } from "@/lib/parser/types";
import { UploadZone } from "@/components/UploadZone";
import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  const [report, setReport] = useState<CreditReport | null>(null);

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-8">
      {report === null ? (
        <div className="mx-auto flex min-h-[80vh] max-w-3xl flex-col justify-center py-10">
          <p className="text-xs font-bold uppercase tracking-widest text-accent">
            БФЛ Аналитик
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-[2.6rem] sm:leading-[1.1]">
            Разбор кредитного отчёта
            <br />
            <span className="text-muted">за 10 секунд — вместо часа</span>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-soft">
            Загрузите PDF-отчёт клиента — система покажет реальную финансовую
            картину: сколько уже сгорело на процентах, сколько он ещё отдаст
            банкам и сколько сэкономит через БФЛ или РДГ. Отдельно подсветит
            compliance-риски для юриста.
          </p>
          <div className="mt-8">
            <UploadZone onParsed={setReport} />
          </div>
          <ul className="mt-8 grid gap-3 text-sm text-muted sm:grid-cols-3">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-good">✓</span> Проценты против тела
              долга — из отчёта, не из головы
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-good">✓</span> Сравнение: банки vs
              БФЛ vs РДГ с настройками
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-good">✓</span> Рисковые кредиты — 0–2
              платежа, серии займов
            </li>
          </ul>
        </div>
      ) : (
        <Dashboard report={report} onReset={() => setReport(null)} />
      )}
    </main>
  );
}
