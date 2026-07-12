import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

type TextItem = { str: string; x: number; y: number; w: number };

const Y_TOLERANCE = 3;
const COLUMN_GAP_PT = 8;
const PT_PER_SPACE = 4;
// Защита от PDF-бомб: реальные отчёты — 30–60 страниц
const MAX_PAGES = 200;
const MAX_TOTAL_CHARS = 2_000_000;
const EXTRACT_TIMEOUT_MS = 30_000;

/**
 * Извлекает текст из PDF, восстанавливая строки и колонки по координатам:
 * элементы группируются по Y (строка), сортируются по X, широкие разрывы
 * превращаются в несколько пробелов — колонки можно разделять по /\s{2,}/.
 */
export async function extractPdfLines(data: Uint8Array): Promise<string[]> {
  const loadingTask = getDocument({ data });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      void loadingTask.destroy();
      reject(new Error("PDF слишком сложный: превышен лимит времени разбора"));
    }, EXTRACT_TIMEOUT_MS);
  });
  try {
    return await Promise.race([extractAllPages(loadingTask), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function extractAllPages(
  loadingTask: ReturnType<typeof getDocument>,
): Promise<string[]> {
  const doc = await loadingTask.promise;
  if (doc.numPages > MAX_PAGES) {
    await loadingTask.destroy();
    throw new Error(`PDF больше ${MAX_PAGES} страниц — это не похоже на кредитный отчёт`);
  }
  const lines: string[] = [];
  let totalChars = 0;

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    const items: TextItem[] = [];
    for (const it of content.items) {
      if (!("str" in it) || it.str.trim() === "") continue;
      items.push({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        w: it.width,
      });
    }

    items.sort((a, b) => b.y - a.y || a.x - b.x);

    const rows: TextItem[][] = [];
    for (const item of items) {
      const row = rows.length > 0 ? rows[rows.length - 1] : null;
      if (row && Math.abs(row[0].y - item.y) <= Y_TOLERANCE) {
        row.push(item);
      } else {
        rows.push([item]);
      }
    }

    for (const row of rows) {
      row.sort((a, b) => a.x - b.x);
      let line = "";
      let cursorX = row[0].x;
      for (const item of row) {
        const gap = item.x - cursorX;
        if (line !== "") {
          const spaces =
            gap > COLUMN_GAP_PT ? Math.max(2, Math.round(gap / PT_PER_SPACE)) : 1;
          line += " ".repeat(spaces);
        }
        line += item.str;
        cursorX = item.x + item.w;
      }
      lines.push(line);
      totalChars += line.length;
    }
    lines.push("\f");
    if (totalChars > MAX_TOTAL_CHARS) {
      await loadingTask.destroy();
      throw new Error("PDF содержит аномально много текста — разбор остановлен");
    }
  }

  await loadingTask.destroy();
  return lines;
}
