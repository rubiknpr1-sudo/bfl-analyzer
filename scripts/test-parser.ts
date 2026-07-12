import { readFile } from "node:fs/promises";
import { parseOkbReport } from "../src/lib/parser/okb";

// Прогон парсера по fixtures + сверка контрольных сумм.
async function main(): Promise<void> {
  for (const name of ["report1", "report2"]) {
    const text = await readFile(`fixtures/${name}.txt`, "utf8");
    const report = parseOkbReport(text.split("\n"));

    const out = {
      client: report.client,
      summary: report.summary,
      closedLoans: report.closedLoans,
      loans: report.loans.map((l) => ({
        bank: l.bank,
        status: l.status,
        obligation: l.obligationAmount,
        psk: l.pskPercent,
        open: l.openDate,
        end: l.plannedEndDate,
        debt: [l.debtTotal, l.debtPrincipal, l.debtInterest],
        paid: [l.paidTotal, l.paidPrincipal, l.paidInterest, l.paidOther],
        avgMonthly: l.avgMonthlyPayment,
        paymentsCount: l.payments.length,
        payments: l.payments,
      })),
    };
    process.stdout.write(`\n===== ${name} =====\n`);
    process.stdout.write(JSON.stringify(out, null, 1) + "\n");

    const debtSum = report.loans.reduce((s, l) => s + l.debtTotal, 0);
    process.stdout.write(
      `CHECK: sum(debtTotal)=${debtSum.toFixed(2)} vs summary.totalDebt=${report.summary.totalDebt}\n`,
    );
  }
}

main().catch((error: unknown) => {
  process.stderr.write(String(error) + "\n");
  process.exit(1);
});
