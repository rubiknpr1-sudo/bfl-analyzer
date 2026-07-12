import type { CreditReport, Loan } from "../parser/types";

/** Настройки расчёта — всё редактируется менеджером в UI */
export interface CalcSettings {
  bflCost: number;
  bflMonths: number;
  rdgCost: number;
  rdgMonths: number;
  /** Мин. платёж как доля долга, когда платёж не виден в отчёте (кредитки) */
  minPaymentShare: number;
  /** Ставка по умолчанию, если ПСК не распознана, % годовых */
  fallbackAnnualRate: number;
}

export const DEFAULT_SETTINGS: CalcSettings = {
  bflCost: 200_000,
  bflMonths: 12,
  rdgCost: 150_000,
  rdgMonths: 15,
  minPaymentShare: 0.05,
  fallbackAnnualRate: 30,
};

const MAX_MONTHS = 600;
/** Ниже этого платёж не опускаем — иначе копеечные долги растягиваются на годы */
const MIN_ABS_PAYMENT = 1_000;

export interface LoanProjection {
  loan: Loan;
  monthlyPayment: number;
  monthlyRate: number;
  monthsLeft: number;
  totalToPay: number;
  overpay: number;
  paymentEstimated: boolean;
  paymentTooSmall: boolean;
}

export interface BankScenario {
  perLoan: LoanProjection[];
  monthlyPayment: number;
  monthsLeft: number;
  totalToPay: number;
  totalDebtNow: number;
  totalOverpay: number;
}

export interface ProcedureScenario {
  kind: "БФЛ" | "РДГ";
  cost: number;
  months: number;
  /** Сколько всего отдаст клиент: БФЛ — стоимость процедуры, РДГ — стоимость + долг */
  totalOut: number;
  monthlyPayment: number;
  saving: number;
  savingPercent: number;
  paymentDelta: number;
}

export interface PaidAnalysis {
  paidTotal: number;
  paidPrincipal: number;
  paidInterest: number;
  paidOther: number;
  principalShare: number;
  burnedShare: number;
}

export interface Analysis {
  paid: PaidAnalysis;
  bank: BankScenario;
  bfl: ProcedureScenario;
  rdg: ProcedureScenario;
}

function monthsToRepay(debt: number, payment: number, monthlyRate: number): number {
  if (debt <= 0) return 0;
  if (payment <= 0) return MAX_MONTHS;
  if (monthlyRate <= 0) return Math.ceil(debt / payment);
  const interestOnly = debt * monthlyRate;
  if (payment <= interestOnly) return MAX_MONTHS;
  const n = -Math.log(1 - (monthlyRate * debt) / payment) / Math.log(1 + monthlyRate);
  return Math.min(MAX_MONTHS, Math.ceil(n));
}

/** Аннуитетный платёж по долгу, ставке и сроку */
function annuityPayment(debt: number, monthlyRate: number, months: number): number {
  if (months <= 0) return debt;
  if (monthlyRate <= 0) return debt / months;
  return (debt * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

function monthsBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  return Math.max(
    1,
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()),
  );
}

export function projectLoan(
  loan: Loan,
  settings: CalcSettings,
  reportDate: string | null,
): LoanProjection {
  const debt = loan.debtTotal;
  const annualRate = loan.pskPercent ?? settings.fallbackAnnualRate;
  const monthlyRate = annualRate / 100 / 12;

  let payment = loan.avgMonthlyPayment ?? 0;
  let estimated = false;

  const interestOnly = debt * monthlyRate;

  if (payment <= interestOnly && debt > 0) {
    estimated = true;
    if (loan.plannedEndDate && reportDate) {
      const term = monthsBetween(reportDate, loan.plannedEndDate);
      payment = annuityPayment(debt, monthlyRate, term);
    } else {
      payment = Math.max(debt * settings.minPaymentShare, interestOnly * 1.05);
    }
  }

  if (debt > 0) {
    payment = Math.max(payment, Math.min(debt, MIN_ABS_PAYMENT));
  }

  const monthsLeft = monthsToRepay(debt, payment, monthlyRate);
  const paymentTooSmall = monthsLeft >= MAX_MONTHS && debt > 0;
  const totalToPay = debt > 0 ? payment * monthsLeft : 0;

  return {
    loan,
    monthlyPayment: debt > 0 ? payment : 0,
    monthlyRate,
    monthsLeft,
    totalToPay,
    overpay: Math.max(0, totalToPay - debt),
    paymentEstimated: estimated,
    paymentTooSmall,
  };
}

export function analyzeReport(
  report: CreditReport,
  settings: CalcSettings,
): Analysis {
  const active = report.loans.filter((l) => !l.isClosed && l.debtTotal > 0);
  const allActive = report.loans.filter((l) => !l.isClosed);

  const perLoan = active.map((l) =>
    projectLoan(l, settings, report.client.reportDate),
  );

  const totalDebtNow = active.reduce((s, l) => s + l.debtTotal, 0);
  const monthlyPayment = perLoan.reduce((s, p) => s + p.monthlyPayment, 0);
  const monthsLeft = perLoan.reduce((m, p) => Math.max(m, p.monthsLeft), 0);
  const totalToPay = perLoan.reduce((s, p) => s + p.totalToPay, 0);

  const bank: BankScenario = {
    perLoan,
    monthlyPayment,
    monthsLeft,
    totalToPay,
    totalDebtNow,
    totalOverpay: Math.max(0, totalToPay - totalDebtNow),
  };

  const paidTotal = allActive.reduce((s, l) => s + l.paidTotal, 0);
  const paidPrincipal = allActive.reduce((s, l) => s + l.paidPrincipal, 0);
  const paidInterest = allActive.reduce((s, l) => s + l.paidInterest, 0);
  const paidOther = allActive.reduce((s, l) => s + l.paidOther, 0);

  const paid: PaidAnalysis = {
    paidTotal,
    paidPrincipal,
    paidInterest,
    paidOther,
    principalShare: paidTotal > 0 ? paidPrincipal / paidTotal : 0,
    burnedShare: paidTotal > 0 ? (paidInterest + paidOther) / paidTotal : 0,
  };

  const makeProcedure = (
    kind: "БФЛ" | "РДГ",
    cost: number,
    months: number,
    totalOut: number,
  ): ProcedureScenario => {
    const monthly = months > 0 ? totalOut / months : totalOut;
    return {
      kind,
      cost,
      months,
      totalOut,
      monthlyPayment: monthly,
      saving: totalToPay - totalOut,
      savingPercent: totalToPay > 0 ? (totalToPay - totalOut) / totalToPay : 0,
      paymentDelta: monthlyPayment - monthly,
    };
  };

  return {
    paid,
    bank,
    // БФЛ: долги списываются — клиент отдаёт только стоимость процедуры
    bfl: makeProcedure("БФЛ", settings.bflCost, settings.bflMonths, settings.bflCost),
    // РДГ: долг гасится по новым условиям без будущих процентов + стоимость услуги
    rdg: makeProcedure(
      "РДГ",
      settings.rdgCost,
      settings.rdgMonths,
      settings.rdgCost + totalDebtNow,
    ),
  };
}
