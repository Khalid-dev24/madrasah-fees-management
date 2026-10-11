export const MONTHLY_FEE_KOBO = 500_000n;
export const QUARTERLY_FEE_KOBO = 1_500_000n;
export const TERM_FEE_KOBO = 3_000_000n;
export const ANNUAL_FEE_KOBO = 6_000_000n;

export function parseNairaToKobo(value: string): bigint {
  const trimmed = value.trim();
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) {
    throw new TypeError("Enter a non-negative naira amount with at most two decimal places.");
  }

  const naira = BigInt(match[1]);
  const kobo = BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  return naira * 100n + kobo;
}

export function toKobo(value: string): bigint {
  return parseNairaToKobo(value);
}

function exactKoboValue(value: bigint | number | string): bigint {
  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    throw new RangeError("Kobo amounts must be safe integers or bigint values.");
  }
  if (typeof value === "string" && !/^-?\d+$/.test(value)) {
    throw new TypeError("Kobo amounts must be integer strings.");
  }
  return BigInt(value);
}

export function koboToNairaInput(value: bigint | number | string): string {
  const amount = exactKoboValue(value);
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const naira = absolute / 100n;
  const kobo = (absolute % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${naira}.${kobo}`;
}

export function formatMoneyKobo(value: bigint | number | string): string {
  const amount = exactKoboValue(value);
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const naira = absolute / 100n;
  const kobo = (absolute % 100n).toString().padStart(2, "0");
  const formattedNaira = new Intl.NumberFormat("en-NG").format(naira);
  return `${negative ? "-" : ""}₦${formattedNaira}.${kobo}`;
}
