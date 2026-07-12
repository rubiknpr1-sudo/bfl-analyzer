export interface ClientInfo {
  name: string;
  reportDate: string | null;
  rating: number | null;
  ratingPercentile: number | null;
}

export interface SummaryInfo {
  activeLoansCount: number | null;
  totalDebt: number | null;
  overdueDebt: number | null;
  historyAge: string | null;
  inquiries12m: string | null;
  newLoans12m: string | null;
}

export interface LoanPayment {
  date: string; // ISO yyyy-mm-dd
  amount: number;
  principal: number | null;
  interest: number | null;
}

export interface DebtSnapshot {
  date: string; // ISO yyyy-mm-dd
  total: number;
}

export interface Loan {
  index: number;
  bank: string;
  kind: string;
  status: string;
  isClosed: boolean;
  obligationAmount: number | null;
  pskPercent: number | null;
  openDate: string | null; // ISO
  plannedEndDate: string | null; // ISO, null если 9999 (бессрочно)
  debtTotal: number;
  debtPrincipal: number;
  debtInterest: number;
  debtOther: number;
  paidTotal: number;
  paidPrincipal: number;
  paidInterest: number;
  paidOther: number;
  avgMonthlyPayment: number | null;
  payments: LoanPayment[];
  /** Кредитная линия с платёжной картой — «внесённое» по ней это оборот, не погашение займа */
  isCreditCard: boolean;
  /** История общей задолженности из отчёта, по возрастанию даты */
  debtHistory: DebtSnapshot[];
  lastUpdate: string | null; // ISO
}

export interface ClosedLoanBrief {
  bank: string;
  status: string;
}

export interface CreditReport {
  client: ClientInfo;
  summary: SummaryInfo;
  loans: Loan[];
  closedLoans: ClosedLoanBrief[];
}
