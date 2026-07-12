import { readFile, writeFile } from "node:fs/promises";
import { extractPdfLines } from "../src/lib/parser/extract";

// Дамп текстового слоя PDF в fixtures/ — парсер пишется против этого вывода.
async function main(): Promise<void> {
  for (const name of ["report1", "report2"]) {
    const buf = await readFile(`samples/${name}.pdf`);
    const lines = await extractPdfLines(new Uint8Array(buf));
    await writeFile(`fixtures/${name}.txt`, lines.join("\n"), "utf8");
    process.stdout.write(`${name}: ${lines.length} lines\n`);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(String(error) + "\n");
  process.exit(1);
});
