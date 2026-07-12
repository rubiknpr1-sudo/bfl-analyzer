import { extractPdfLines } from "@/lib/parser/extract";
import { parseOkbReport } from "@/lib/parser/okb";
import type { CreditReport } from "@/lib/parser/types";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function fail(error: string, status: number): Response {
  const body: ApiResponse<never> = { success: false, error };
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Ожидается multipart/form-data с полем file", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return fail("Файл не передан", 400);
  }
  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return fail("Файл пустой или больше 25 МБ", 400);
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return fail("Ожидается PDF кредитного отчёта", 400);
  }

  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const lines = await extractPdfLines(data);
    const report = parseOkbReport(lines);

    if (report.loans.length === 0 && report.summary.activeLoansCount === null) {
      return fail(
        "Не удалось распознать кредитный отчёт. Поддерживаются PDF-отчёты ОКБ (Credistory).",
        422,
      );
    }

    const body: ApiResponse<CreditReport> = { success: true, data: report };
    // Отчёт нигде не сохраняется: анализ в памяти, PII не пишется на диск
    return Response.json(body);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Не удалось прочитать PDF";
    return fail(message, 422);
  }
}
