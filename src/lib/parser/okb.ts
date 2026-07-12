import type {
  ClientInfo,
  ClosedLoanBrief,
  CreditReport,
  Loan,
  LoanPayment,
  SummaryInfo,
} from "./types";

const MONTHS: Record<string, string> = {
  января: "01",
  февраля: "02",
  марта: "03",
  апреля: "04",
  мая: "05",
  июня: "06",
  июля: "07",
  августа: "08",
  сентября: "09",
  октября: "10",
  ноября: "11",
  декабря: "12",
};

const MONTH_NAMES = Object.keys(MONTHS).join("|");
const RU_DATE_RE = new RegExp(`(\\d{1,2})\\s+(${MONTH_NAMES})\\s+(\\d{4})`);
const RU_DATE_NO_YEAR_RE = new RegExp(`(\\d{1,2})\\s+(${MONTH_NAMES})`, "g");
const AMOUNT_RE = /(\d[\d\s]*(?:[.,]\d+)?)\s*р\./g;
const LOAN_HEADER_RE = /^(\d+)\.\s+(.+?)\s+-\s+(Договор.*)$/;
const FOOTER_RE = /^Сформирован \d{2} .+ v\d/;

/** «53 987,05 р.» → 53987.05 */
export function parseAmount(raw: string): number {
  const cleaned = raw.replace(/\s/g, "").replace(",", ".");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : 0;
}

/** «30 ноября 2025» → «2025-11-30» */
export function parseRuDate(raw: string): string | null {
  const m = raw.match(RU_DATE_RE);
  if (!m) return null;
  const year = m[3];
  if (year === "9999") return null;
  return `${year}-${MONTHS[m[2]]}-${m[1].padStart(2, "0")}`;
}

function extractAmounts(line: string): number[] {
  const out: number[] = [];
  for (const m of line.matchAll(AMOUNT_RE)) {
    out.push(parseAmount(m[1]));
  }
  return out;
}

function cleanLines(lines: string[]): string[] {
  return lines.filter(
    (l) => l.trim() !== "" && l !== "\f" && !FOOTER_RE.test(l.trim()),
  );
}

function findIndex(
  lines: string[],
  predicate: (line: string) => boolean,
  from = 0,
): number {
  for (let i = from; i < lines.length; i++) {
    if (predicate(lines[i])) return i;
  }
  return -1;
}

function parseClient(lines: string[]): ClientInfo {
  const subjectIdx = findIndex(lines, (l) =>
    l.trim().startsWith("СУБЪЕКТ КРЕДИТНОЙ ИСТОРИИ"),
  );
  const name =
    subjectIdx >= 0 && lines[subjectIdx + 1]
      ? lines[subjectIdx + 1].trim()
      : "Не распознано";

  const reportDate = parseRuDate(lines.slice(0, 5).join(" ").toLowerCase());

  let rating: number | null = null;
  let ratingPercentile: number | null = null;
  const ratingIdx = findIndex(lines, (l) => l.includes("Ваш рейтинг лучше"));
  if (ratingIdx >= 0) {
    const pm = lines[ratingIdx].match(/лучше, чем у ([\d,]+)%/);
    if (pm) ratingPercentile = parseAmount(pm[1]);
    const next = lines[ratingIdx + 1]?.trim().match(/^(\d{1,3})\b/);
    if (next) rating = Number.parseInt(next[1], 10);
  }

  return { name, reportDate, rating, ratingPercentile };
}

function parseSummary(lines: string[]): SummaryInfo {
  const summary: SummaryInfo = {
    activeLoansCount: null,
    totalDebt: null,
    overdueDebt: null,
    historyAge: null,
    inquiries12m: null,
    newLoans12m: null,
  };

  const loansLabelIdx = findIndex(lines, (l) =>
    l.trim().startsWith("Действующие кредиты/займы"),
  );
  if (loansLabelIdx > 0) {
    const cols = lines[loansLabelIdx - 1].trim().split(/\s{2,}/);
    if (cols[0]) summary.activeLoansCount = Number.parseInt(cols[0], 10) || null;
    if (cols[1]) summary.totalDebt = parseAmount(cols[1]);
    if (cols[2]) {
      summary.overdueDebt = cols[2].includes("Отсутствует")
        ? 0
        : parseAmount(cols[2]);
    }
  }

  const ageLabelIdx = findIndex(lines, (l) =>
    l.trim().startsWith("Возраст кредитной истории"),
  );
  if (ageLabelIdx > 0) {
    const cols = lines[ageLabelIdx - 1].trim().split(/\s{2,}/);
    summary.historyAge = cols[0] ?? null;
    summary.inquiries12m = cols[1] ?? null;
    summary.newLoans12m = cols[2] ?? null;
  }

  return summary;
}

/** Строка целиком из русских дат без года («27 января    14 марта») */
function isDateOnlyRow(line: string): boolean {
  const stripped = line.replace(RU_DATE_NO_YEAR_RE, "").trim();
  return stripped === "" && line.trim() !== "";
}

/** Строка целиком из сумм/прочерков («500 р.   970 р.   -») */
function isAmountOnlyRow(line: string): boolean {
  const stripped = line
    .replace(AMOUNT_RE, "")
    .replace(/-/g, "")
    .trim();
  return stripped === "" && extractAmounts(line).length > 0;
}

function parsePayments(block: string[]): LoanPayment[] {
  const start = findIndex(block, (l) =>
    l.trim().startsWith("Фактические платежи по договору"),
  );
  if (start < 0) return [];

  const payments: LoanPayment[] = [];
  let currentYear: string | null = null;
  let pendingDates: { day: string; month: string }[] = [];
  let amountRowsSeen = 0;
  let pendingAmounts: number[][] = [];

  const flush = (): void => {
    if (pendingDates.length === 0 || currentYear === null) return;
    const [sums, principals, interests] = pendingAmounts;
    pendingDates.forEach((d, i) => {
      payments.push({
        date: `${currentYear}-${MONTHS[d.month]}-${d.day.padStart(2, "0")}`,
        amount: sums?.[i] ?? 0,
        principal: principals?.[i] ?? null,
        interest: interests?.[i] ?? null,
      });
    });
    pendingDates = [];
    pendingAmounts = [];
    amountRowsSeen = 0;
  };

  for (let i = start + 1; i < block.length; i++) {
    const line = block[i].trim();
    if (line.startsWith("Дата платежа")) continue;
    const yearMatch = line.match(/^(20\d{2})$/);
    if (yearMatch) {
      flush();
      currentYear = yearMatch[1];
      continue;
    }
    if (isDateOnlyRow(line)) {
      flush();
      for (const m of line.matchAll(RU_DATE_NO_YEAR_RE)) {
        pendingDates.push({ day: m[1], month: m[2] });
      }
      continue;
    }
    if (isAmountOnlyRow(line) && pendingDates.length > 0 && amountRowsSeen < 3) {
      pendingAmounts.push(extractAmounts(line));
      amountRowsSeen += 1;
      continue;
    }
    if (!isAmountOnlyRow(line)) {
      // конец таблицы платежей
      flush();
      break;
    }
  }
  flush();
  return payments;
}

function parseLoanBlock(
  block: string[],
  index: number,
  header: { bank: string; kind: string; status: string; isClosed: boolean },
): Loan {
  const loan: Loan = {
    index,
    bank: header.bank,
    kind: header.kind,
    status: header.status,
    isClosed: header.isClosed,
    obligationAmount: null,
    pskPercent: null,
    openDate: null,
    plannedEndDate: null,
    debtTotal: 0,
    debtPrincipal: 0,
    debtInterest: 0,
    debtOther: 0,
    paidTotal: 0,
    paidPrincipal: 0,
    paidInterest: 0,
    paidOther: 0,
    avgMonthlyPayment: null,
    payments: [],
    lastUpdate: null,
  };

  const updIdx = findIndex(block, (l) =>
    l.includes("Последнее обновление кредитной информации"),
  );
  if (updIdx >= 0) loan.lastUpdate = parseRuDate(block[updIdx]);

  // Сумма обязательства: значения между заголовком секции и секцией ПСК, берём максимум
  const oblIdx = findIndex(
    block,
    (l) => l.trim() === "Сумма и валюта обязательства",
  );
  if (oblIdx >= 0) {
    const end = findIndex(
      block,
      (l) =>
        l.includes("полной стоимости кредита") ||
        l.includes("Общие сведения о сделке"),
      oblIdx,
    );
    const amounts: number[] = [];
    for (let i = oblIdx + 1; i < (end < 0 ? block.length : end); i++) {
      const rowAmounts = extractAmounts(block[i]);
      if (rowAmounts.length > 0) amounts.push(rowAmounts[0]);
    }
    if (amounts.length > 0) loan.obligationAmount = Math.max(...amounts);
  }

  // ПСК, % годовых: строка значений внутри секции ПСК
  const pskIdx = findIndex(block, (l) =>
    l.includes("полной стоимости кредита"),
  );
  if (pskIdx >= 0) {
    const end = findIndex(
      block,
      (l) => l.includes("Общие сведения о сделке"),
      pskIdx,
    );
    const percents: number[] = [];
    for (let i = pskIdx + 1; i < (end < 0 ? block.length : end); i++) {
      for (const m of block[i].matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)) {
        percents.push(parseAmount(m[1]));
      }
    }
    if (percents.length > 0) loan.pskPercent = Math.max(...percents);
  }

  // Даты сделки: строка значений после заголовка «Дата совершения сделки»
  const dealIdx = findIndex(block, (l) =>
    l.trim().startsWith("Дата совершения сделки"),
  );
  if (dealIdx >= 0 && block[dealIdx + 1]) {
    const dates = block[dealIdx + 1].trim().split(/\s{2,}/);
    loan.openDate = dates[0] ? parseRuDate(dates[0]) : null;
    loan.plannedEndDate = dates[2] ? parseRuDate(dates[2]) : null;
  }

  // Текущая задолженность: первая строка «Общая» после «Сведения о сумме задолженности»
  const debtIdx = findIndex(block, (l) =>
    l.trim().startsWith("Сведения о сумме задолженности"),
  );
  if (debtIdx >= 0) {
    const generalIdx = findIndex(
      block,
      (l) => l.trim().startsWith("Общая"),
      debtIdx,
    );
    if (generalIdx >= 0) {
      const amounts = extractAmounts(block[generalIdx]);
      loan.debtTotal = amounts[0] ?? 0;
      loan.debtPrincipal = amounts[1] ?? 0;
      loan.debtInterest = amounts[2] ?? 0;
      loan.debtOther = amounts[3] ?? 0;
    }
  }

  // Всего внесено: секция «Сумма всех внесенных платежей»
  const paidIdx = findIndex(block, (l) =>
    l.trim().startsWith("Сумма всех внесенных платежей"),
  );
  if (paidIdx >= 0) {
    for (let i = paidIdx + 1; i < Math.min(paidIdx + 5, block.length); i++) {
      const amounts = extractAmounts(block[i]);
      if (amounts.length >= 2) {
        loan.paidTotal = amounts[0] ?? 0;
        loan.paidPrincipal = amounts[1] ?? 0;
        loan.paidInterest = amounts[2] ?? 0;
        loan.paidOther = amounts[3] ?? 0;
        break;
      }
    }
  }

  // Среднемесячный платёж
  const avgIdx = findIndex(block, (l) =>
    l.trim().startsWith("Величина среднемесячного платежа по договору"),
  );
  if (avgIdx >= 0) {
    for (let i = avgIdx + 1; i < Math.min(avgIdx + 4, block.length); i++) {
      const amounts = extractAmounts(block[i]);
      if (amounts.length > 0) {
        loan.avgMonthlyPayment = amounts[0];
        break;
      }
    }
  }

  loan.payments = parsePayments(block);
  return loan;
}

function parseHeader(line: string): {
  bank: string;
  kind: string;
  status: string;
  isClosed: boolean;
} | null {
  const cols = line.trim().split(/\s{2,}/);
  const m = cols[0].match(LOAN_HEADER_RE);
  if (!m) return null;
  const statusParts = cols.slice(1);
  return {
    bank: m[2].trim(),
    kind: m[3].trim(),
    status: statusParts.filter((s) => s !== "Закрыт").join(", ") || "—",
    isClosed: statusParts.includes("Закрыт"),
  };
}

function sliceSection(lines: string[], title: string, from: number): number {
  return findIndex(lines, (l) => l.trim() === title, from);
}

export function parseOkbReport(rawLines: string[]): CreditReport {
  const lines = cleanLines(rawLines);

  const client = parseClient(lines);
  const summary = parseSummary(lines);

  // Детальные блоки идут после ВТОРОГО вхождения заголовка секции (первое — оглавление)
  const firstActive = sliceSection(lines, "ДЕЙСТВУЮЩИЕ КРЕДИТНЫЕ ДОГОВОРЫ", 0);
  const activeStart = sliceSection(
    lines,
    "ДЕЙСТВУЮЩИЕ КРЕДИТНЫЕ ДОГОВОРЫ",
    firstActive + 1,
  );

  const closedTitleIdx = sliceSection(
    lines,
    "ЗАКРЫТЫЕ КРЕДИТНЫЕ ДОГОВОРЫ",
    activeStart + 1,
  );
  const stopIdx = findIndex(
    lines,
    (l) =>
      l.trim() === "ЗАПРЕТ НА КРЕДИТЫ И ЗАЙМЫ" ||
      l.trim() === "КТО ИНТЕРЕСОВАЛСЯ КРЕДИТНОЙ ИСТОРИЕЙ?",
    activeStart + 1,
  );
  const activeEnd =
    closedTitleIdx >= 0 ? closedTitleIdx : stopIdx >= 0 ? stopIdx : lines.length;

  const loans: Loan[] = [];
  if (activeStart >= 0) {
    const section = lines.slice(activeStart, activeEnd);
    const headerIdxs: number[] = [];
    section.forEach((l, i) => {
      if (l.includes("Договор") && parseHeader(l) !== null) headerIdxs.push(i);
    });
    headerIdxs.forEach((h, n) => {
      const blockEnd =
        n + 1 < headerIdxs.length ? headerIdxs[n + 1] : section.length;
      const header = parseHeader(section[h]);
      if (!header) return;
      const block = section.slice(h, blockEnd);
      loans.push(parseLoanBlock(block, loans.length + 1, header));
    });
  }

  // Закрытые — только шапки, в расчёты не идут
  const closedLoans: ClosedLoanBrief[] = [];
  if (closedTitleIdx >= 0) {
    const closedEnd = stopIdx >= 0 ? stopIdx : lines.length;
    for (let i = closedTitleIdx; i < closedEnd; i++) {
      const header = parseHeader(lines[i]);
      if (header) {
        closedLoans.push({ bank: header.bank, status: header.status });
      }
    }
  }

  return { client, summary, loans, closedLoans };
}
