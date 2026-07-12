/** 154334.11 → «154 334 ₽» */
export function fmtMoney(value: number): string {
  return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

/** 64 → «5 лет 4 мес», 15 → «15 мес» */
export function fmtMonths(months: number): string {
  if (months < 24) return `${months} мес`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const yearWord =
    years % 10 === 1 && years % 100 !== 11
      ? "год"
      : years % 10 >= 2 && years % 10 <= 4 && (years % 100 < 12 || years % 100 > 14)
        ? "года"
        : "лет";
  return rest > 0 ? `${years} ${yearWord} ${rest} мес` : `${years} ${yearWord}`;
}

/** 0.483 → «48 %» */
export function fmtPercent(share: number): string {
  return `${Math.round(share * 100)} %`;
}

/** 1 → «1 кредит», 3 → «3 кредита», 5 → «5 кредитов» */
export function fmtLoans(n: number): string {
  const word =
    n % 10 === 1 && n % 100 !== 11
      ? "кредит"
      : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
        ? "кредита"
        : "кредитов";
  return `${n} ${word}`;
}

/** «2026-05-21» → «21.05.2026» */
export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
