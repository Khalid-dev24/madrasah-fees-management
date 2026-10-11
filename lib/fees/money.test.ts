import { describe, expect, it } from "vitest";

import { formatMoneyKobo, koboToNairaInput, parseNairaToKobo } from "./money";

describe("integer-kobo money utilities", () => {
  it("parses naira input exactly without floating-point conversion", () => {
    expect(parseNairaToKobo("5000")).toBe(500_000n);
    expect(parseNairaToKobo("4000.5")).toBe(400_050n);
    expect(parseNairaToKobo("0.01")).toBe(1n);
  });

  it("rejects negative, malformed, and over-precision amounts", () => {
    expect(() => parseNairaToKobo("-1")).toThrow();
    expect(() => parseNairaToKobo("1.001")).toThrow();
    expect(() => parseNairaToKobo("1e3")).toThrow();
    expect(() => parseNairaToKobo("1,000")).toThrow();
  });

  it("formats large integer-kobo amounts without Number conversion", () => {
    expect(formatMoneyKobo(4_200_000_000_000_001n)).toBe("₦42,000,000,000,000.01");
    expect(() => formatMoneyKobo(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });

  it("converts kobo to exact decimal input text without Number conversion", () => {
    expect(koboToNairaInput(500_000n)).toBe("5000.00");
    expect(koboToNairaInput(400_050n)).toBe("4000.50");
    expect(koboToNairaInput(4_200_000_000_000_001n)).toBe("42000000000000.01");
    expect(() => koboToNairaInput(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });
});
