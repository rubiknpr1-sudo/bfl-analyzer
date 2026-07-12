import { extractPdfLines } from "@/lib/parser/extract";
import { parseOkbReport } from "@/lib/parser/okb";
import type { CreditReport } from "@/lib/parser/types";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

// In-memory rate-limit: один инстанс pm2, БД нет — этого достаточно
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  // Точечная чистка протухших вёдер — без обнуления живых счётчиков
  if (rateBuckets.size > 5_000) {
    for (const [key, b] of rateBuckets) {
      if (now > b.resetAt) rateBuckets.delete(key);
    }
  }
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}

/**
 * Ищем «%PDF-» в первых 1024 байтах — как сам pdfjs.
 * Отчёты Credistory подписаны ЭЦП: PDF завёрнут в DER-конверт,
 * поэтому сигнатура не обязана стоять на нулевом смещении.
 */
function hasPdfMagicBytes(data: Uint8Array): boolean {
  const magic = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  const limit = Math.min(data.length - magic.length, 1024);
  for (let offset = 0; offset <= limit; offset++) {
    if (magic.every((byte, i) => data[offset + i] === byte)) return true;
  }
  return false;
}

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
  // X-Real-IP перезаписывается nginx ($remote_addr) — доверенный источник;
  // приложение слушает только 127.0.0.1, напрямую заголовок не подделать
  const ip = request.headers.get("x-real-ip")?.trim() ?? "direct";
  if (isRateLimited(ip)) {
    return fail("Слишком много запросов. Подождите минуту.", 429);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_FILE_SIZE + 64 * 1024) {
    return fail("Файл больше 25 МБ", 413);
  }

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
    if (!hasPdfMagicBytes(data)) {
      return fail("Файл не является PDF-документом", 400);
    }
    const lines = await extractPdfLines(data);
    const report = parseOkbReport(lines);

    if (report.loans.length === 0 && report.summary.activeLoansCount === null) {
      return fail(
        "Не удалось распознать кредитный отчёт. Поддерживаются PDF-отчёты ОКБ (Credistory).",
        422,
      );
    }
    // Сводка говорит «кредиты есть», а разбор пуст — структура не распознана,
    // молча отдавать пустой отчёт нельзя
    if (
      report.loans.length === 0 &&
      (report.summary.activeLoansCount ?? 0) > 0
    ) {
      return fail(
        "Отчёт распознан частично: сводка есть, но блоки кредитов разобрать не удалось. Сообщите разработчику.",
        422,
      );
    }

    const body: ApiResponse<CreditReport> = { success: true, data: report };
    // Отчёт нигде не сохраняется: анализ в памяти, PII не пишется на диск
    return Response.json(body);
  } catch (error: unknown) {
    // Детали — только в серверный лог; клиенту сырые сообщения pdfjs не отдаём
    process.stderr.write(
      `[analyze] ${error instanceof Error ? error.message : String(error)}\n`,
    );
    const isOurMessage =
      error instanceof Error && /кредитн|страниц|лимит|аномальн/.test(error.message);
    return fail(
      isOurMessage && error instanceof Error
        ? error.message
        : "Не удалось прочитать PDF. Убедитесь, что это отчёт ОКБ/Credistory.",
      422,
    );
  }
}
