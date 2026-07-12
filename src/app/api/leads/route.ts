import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  LEAD_STATUSES,
  type Lead,
  type LeadStatus,
} from "@/lib/leads";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "leads.json");
const MAX_LEADS = 1_000;
const MAX_NAME_LEN = 200;

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function fail(error: string, status: number): Response {
  const body: ApiResponse<never> = { success: false, error };
  return Response.json(body, { status });
}

function ok<T>(data: T): Response {
  const body: ApiResponse<T> = { success: true, data };
  return Response.json(body);
}

async function loadLeads(): Promise<Lead[]> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Lead[]) : [];
  } catch {
    return [];
  }
}

/** Атомарная запись: tmp-файл + rename, чтобы не побить JSON на полуслове */
async function saveLeads(leads: Lead[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(leads, null, 1), "utf8");
  await rename(tmp, DATA_FILE);
}

// Последовательная очередь записи — защита от гонки параллельных запросов
let writeQueue: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task);
  writeQueue = run.catch(() => undefined);
  return run;
}

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, MAX_NAME_LEN);
  return trimmed.length >= 2 ? trimmed : null;
}

function cleanAmount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}

export async function GET(): Promise<Response> {
  return ok(await loadLeads());
}

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return fail("Ожидается JSON", 400);
  }

  const manager = cleanName(body.manager);
  const client = cleanName(body.client);
  const debt = cleanAmount(body.debt);
  const toPay = cleanAmount(body.toPay);
  const saving = typeof body.saving === "number" && Number.isFinite(body.saving)
    ? Math.round(body.saving)
    : null;
  const flagsCount = cleanAmount(body.flagsCount);

  if (!manager || !client || debt === null || toPay === null || saving === null || flagsCount === null) {
    return fail("Некорректные поля заявки", 400);
  }

  return enqueue(async () => {
    const leads = await loadLeads();
    const now = new Date().toISOString();
    const existing = leads.find(
      (l) => l.client === client && l.status !== "won" && l.status !== "lost",
    );

    if (existing) {
      // Повторный разбор того же клиента — обновляем цифры, статус не трогаем
      const updated: Lead = {
        ...existing,
        manager,
        debt,
        toPay,
        saving,
        flagsCount,
        updatedAt: now,
      };
      await saveLeads(leads.map((l) => (l.id === existing.id ? updated : l)));
      return ok(updated);
    }

    const lead: Lead = {
      id: crypto.randomUUID(),
      manager,
      client,
      debt,
      toPay,
      saving,
      flagsCount,
      status: "new",
      createdAt: now,
      updatedAt: now,
    };
    await saveLeads([lead, ...leads].slice(0, MAX_LEADS));
    return ok(lead);
  });
}

export async function PATCH(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return fail("Ожидается JSON", 400);
  }

  const id = typeof body.id === "string" ? body.id : null;
  const status = LEAD_STATUSES.some((s) => s.id === body.status)
    ? (body.status as LeadStatus)
    : null;
  if (!id || !status) return fail("Нужны id и корректный status", 400);

  return enqueue(async () => {
    const leads = await loadLeads();
    const lead = leads.find((l) => l.id === id);
    if (!lead) return fail("Заявка не найдена", 404);

    const updated: Lead = { ...lead, status, updatedAt: new Date().toISOString() };
    await saveLeads(leads.map((l) => (l.id === id ? updated : l)));
    return ok(updated);
  });
}
