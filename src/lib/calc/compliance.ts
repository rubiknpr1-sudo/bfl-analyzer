import type { CreditReport, Loan } from "../parser/types";

export type ComplianceSeverity = "high" | "medium";

export interface ComplianceFlag {
  severity: ComplianceSeverity;
  title: string;
  detail: string;
  loans: string[];
}

export interface ComplianceSettings {
  /** «Крупный долг» для правила «крупный долг + мало платежей» */
  largeDebtThreshold: number;
  /** Окно «кредиты взяты подряд», дней */
  rapidWindowDays: number;
}

export const DEFAULT_COMPLIANCE: ComplianceSettings = {
  largeDebtThreshold: 100_000,
  rapidWindowDays: 4,
};

const DAY_MS = 24 * 60 * 60 * 1000;

function label(loan: Loan): string {
  return `${loan.bank} (долг ${Math.round(loan.debtTotal).toLocaleString("ru-RU")} ₽)`;
}

function paymentWord(n: number): string {
  if (n === 1) return "1 платёж";
  if (n >= 2 && n <= 4) return `${n} платежа`;
  return `${n} платежей`;
}

/**
 * Compliance-проверки. Это НЕ продажные аргументы — риски для юриста:
 * кредиты почти без платежей и серии кредитов, взятых за несколько дней,
 * суд может расценить как недобросовестность должника.
 */
export function checkCompliance(
  report: CreditReport,
  settings: ComplianceSettings = DEFAULT_COMPLIANCE,
): ComplianceFlag[] {
  const flags: ComplianceFlag[] = [];
  const active = report.loans.filter((l) => !l.isClosed);
  // Правила по числу платежей — только для кредитов с живым долгом
  const withDebt = active.filter((l) => l.debtTotal > 0);

  const zero = withDebt.filter((l) => l.payments.length === 0);
  if (zero.length > 0) {
    flags.push({
      severity: "high",
      title: "Ни одного платежа",
      detail:
        "По этим договорам в отчёте нет ни одного фактического платежа. Риск признания недобросовестности при банкротстве.",
      loans: zero.map(label),
    });
  }

  const few = withDebt.filter(
    (l) => l.payments.length > 0 && l.payments.length < 3,
  );
  if (few.length > 0) {
    flags.push({
      severity: "high",
      title: "Меньше 3 платежей",
      detail:
        "Кредит обслуживался минимально. Суд и финансовый управляющий обращают на это внимание.",
      loans: few.map((l) => `${label(l)} — ${paymentWord(l.payments.length)}`),
    });
  }

  // Кредиты, открытые в окне N дней друг от друга
  const dated = active
    .filter((l) => l.openDate !== null)
    .map((l) => ({ loan: l, ts: new Date(l.openDate as string).getTime() }))
    .sort((a, b) => a.ts - b.ts);
  const rapid = new Set<Loan>();
  for (let i = 1; i < dated.length; i++) {
    const gapDays = (dated[i].ts - dated[i - 1].ts) / DAY_MS;
    if (gapDays < settings.rapidWindowDays) {
      rapid.add(dated[i - 1].loan);
      rapid.add(dated[i].loan);
    }
  }
  if (rapid.size > 0) {
    flags.push({
      severity: "high",
      title: `Несколько кредитов за < ${settings.rapidWindowDays} дней`,
      detail:
        "Серия кредитов, взятых почти одновременно, — классический маркер наращивания долга перед банкротством.",
      loans: [...rapid].map((l) => `${l.bank} — открыт ${l.openDate ?? "?"}`),
    });
  }

  const largeFew = withDebt.filter(
    (l) => l.debtTotal >= settings.largeDebtThreshold && l.payments.length < 3,
  );
  if (largeFew.length > 0) {
    flags.push({
      severity: "high",
      title: "Крупный долг при малом числе платежей",
      detail: `Долг от ${settings.largeDebtThreshold.toLocaleString("ru-RU")} ₽ и меньше 3 платежей — приоритет на проверку юристом.`,
      loans: largeFew.map(
        (l) => `${label(l)} — ${paymentWord(l.payments.length)}`,
      ),
    });
  }

  const inquiries = Number.parseInt(report.summary.inquiries12m ?? "", 10);
  if (Number.isFinite(inquiries) && inquiries >= 30) {
    flags.push({
      severity: "medium",
      title: "Аномальная заявочная активность",
      detail: `${inquiries} запросов кредитной истории за 12 месяцев — клиент активно искал деньги. Проверить, нет ли свежих займов, ещё не попавших в отчёт.`,
      loans: [],
    });
  }

  const ageYears = Number.parseInt(report.summary.historyAge ?? "", 10);
  if (
    report.summary.historyAge !== null &&
    (report.summary.historyAge.includes("мес") ||
      (Number.isFinite(ageYears) &&
        ageYears <= 1 &&
        report.summary.historyAge.includes("год")))
  ) {
    flags.push({
      severity: "medium",
      title: "Молодая кредитная история",
      detail: `Возраст кредитной истории — ${report.summary.historyAge}. Все долги набраны недавно, суд оценит добросовестность строже.`,
      loans: [],
    });
  }

  return flags;
}
