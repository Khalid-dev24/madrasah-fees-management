import { describe, expect, it } from "vitest";

import {
  DEFAULT_FAMILY_DISCOUNT_RULE,
  DEFAULT_FEE_SETTINGS,
  allocateFamilyPayment,
  allocateOldestFirst,
  calculateAnnualSummary,
  calculateArrearsCarryForward,
  calculateCredit,
  calculateFamilyDiscount,
  calculateFamilyOutstanding,
  calculateObligationPaidKobo,
  calculateQuarterlySummary,
  calculateRemainingCredit,
  calculateStudentOutstanding,
  calculateTermSummary,
  determineObligationStatus,
  generateMonthlyObligations,
  getEffectiveMonthlyFee,
  isStudentActiveForDate,
  toMoneyKobo,
} from "./fee-engine";

describe("Madrasah fee engine", () => {
  it("uses exact integer-kobo standard fees", () => {
    expect(DEFAULT_FEE_SETTINGS.monthly_kobo).toBe(500_000n);
    expect(toMoneyKobo("500000")).toBe(500_000n);
    expect(() => toMoneyKobo(500_000.5)).toThrow(RangeError);
  });

  it("calculates quarterly, term, and annual summaries from monthly fees", () => {
    expect(calculateQuarterlySummary(500_000n)).toBe(1_500_000n);
    expect(calculateTermSummary(500_000n)).toBe(3_000_000n);
    expect(calculateAnnualSummary(500_000n)).toBe(6_000_000n);
  });

  it("applies a custom fee starting at its effective date without changing earlier months", () => {
    const student = {
      base_monthly_fee_kobo: 500_000n,
      fee_adjustments: [{ custom_monthly_fee_kobo: 400_000n, effective_from: "2026-10-01" }],
    };

    expect(getEffectiveMonthlyFee(student, "2026-09-01")).toBe(500_000n);
    expect(getEffectiveMonthlyFee(student, "2026-10-01")).toBe(400_000n);
    expect(getEffectiveMonthlyFee(student, "2026-12-01")).toBe(400_000n);
  });

  it("calculates family discount thresholds exactly for 2 through 5 students", () => {
    expect(calculateFamilyDiscount(2)).toBe(0n);
    expect(calculateFamilyDiscount(3)).toBe(300_000n);
    expect(calculateFamilyDiscount(4)).toBe(400_000n);
    expect(calculateFamilyDiscount(5)).toBe(500_000n);
    expect(calculateFamilyDiscount(3, {
      minimum_family_size: 4,
      discount_per_eligible_student_kobo: 125_000n,
    })).toBe(0n);
  });

  it("keeps mixed family fees and the family discount separate", () => {
    const monthlyFees = [500_000n, 500_000n, 400_000n];
    const quarterlyLedgerTotal = monthlyFees.reduce(
      (total, fee) => total + calculateQuarterlySummary(fee),
      0n,
    );
    const familyDiscount = calculateFamilyDiscount(3, DEFAULT_FAMILY_DISCOUNT_RULE);

    expect(quarterlyLedgerTotal).toBe(4_200_000n);
    expect(familyDiscount).toBe(300_000n);
    expect(quarterlyLedgerTotal - familyDiscount).toBe(3_900_000n);
  });

  it("calculates partial payment balances and unpaid/partial/paid status", () => {
    const obligation = { expected_kobo: 500_000n, paid_kobo: 200_000n };
    expect(calculateStudentOutstanding([obligation])).toBe(300_000n);
    expect(determineObligationStatus({ expected_kobo: 500_000n, paid_kobo: 0n })).toBe("unpaid");
    expect(determineObligationStatus(obligation)).toBe("partial");
    expect(determineObligationStatus({ expected_kobo: 500_000n, paid_kobo: 500_000n })).toBe("paid");
    expect(determineObligationStatus({ expected_kobo: 500_000n, paid_kobo: 500_001n })).toBe("paid");
  });

  it("sums multiple payments to fully pay an obligation", () => {
    const paymentAllocations = [200_000n, 100_000n, 200_000n];
    const paid = paymentAllocations.reduce((total, amount) => total + amount, 0n);
    expect(calculateStudentOutstanding([{ expected_kobo: 500_000n, paid_kobo: paid }])).toBe(0n);
  });

  it("allocates a payment to obligations oldest due first", () => {
    const obligations = [
      { id: "mar", student_id: "s1", due_date: "2026-03-01", expected_kobo: 500_000n },
      { id: "jan", student_id: "s1", due_date: "2026-01-01", expected_kobo: 500_000n },
      { id: "feb", student_id: "s1", due_date: "2026-02-01", expected_kobo: 500_000n },
    ];

    const result = allocateOldestFirst(800_000n, obligations);
    expect(result.allocations).toEqual([
      { obligation_id: "jan", allocated_kobo: 500_000n, due_date: "2026-01-01" },
      { obligation_id: "feb", allocated_kobo: 300_000n, due_date: "2026-02-01" },
    ]);
    expect(result.remainingKobo).toBe(0n);
  });

  it("carries old arrears forward when a new monthly obligation is added", () => {
    expect(calculateArrearsCarryForward(700_000n, 500_000n)).toBe(1_200_000n);
  });

  it("creates a credit when a payment exceeds the outstanding balance", () => {
    expect(calculateCredit(300_000n, 500_000n)).toBe(200_000n);
  });

  it("tracks credit use and rejects excess credit allocations", () => {
    expect(calculateRemainingCredit(500_000n, [100_000n, 200_000n])).toBe(200_000n);
    expect(() => calculateRemainingCredit(100_000n, [60_000n, 50_000n])).toThrow(
      "Credit allocations cannot exceed the original credit.",
    );
  });

  it("does not generate new obligations for inactive students and observes their financial end date", () => {
    expect(isStudentActiveForDate("inactive", "2026-10-01")).toBe(false);
    expect(isStudentActiveForDate("withdrawn", "2026-10-01")).toBe(false);
    expect(isStudentActiveForDate("active", "2026-10-01", "2026-09-30")).toBe(false);
    expect(isStudentActiveForDate("active", "2026-09-30", "2026-09-30")).toBe(true);
  });

  it("generates one monthly obligation per supplied ledger month and snapshots the due date", () => {
    const months = [
      { id: "oct", start_date: "2026-10-01", month_name: "October", due_date: "2026-12-31" },
      { id: "nov", start_date: "2026-11-01", month_name: "November", due_date: "2026-12-31" },
      { id: "dec", start_date: "2026-12-01", month_name: "December", due_date: "2026-12-31" },
    ];

    const obligations = generateMonthlyObligations("student-1", "family-1", months, 500_000n);
    expect(obligations).toHaveLength(3);
    expect(obligations.map((obligation) => obligation.expected_kobo)).toEqual([
      500_000n,
      500_000n,
      500_000n,
    ]);
    expect(obligations.every((obligation) => obligation.due_date === "2026-12-31")).toBe(true);
  });

  it("generates individual student obligations without assigning a family", () => {
    const obligations = generateMonthlyObligations(
      "individual-student",
      null,
      [{ id: "oct", start_date: "2026-10-01", month_name: "October", due_date: "2026-10-31" }],
      500_000n,
    );

    expect(obligations).toEqual([{
      student_id: "individual-student",
      family_id: null,
      month_id: "oct",
      obligation_date: "2026-10-01",
      due_date: "2026-10-31",
      expected_kobo: 500_000n,
    }]);
  });

  it("calculates outstanding totals over historical obligations without resetting arrears", () => {
    const obligations = [
      { expected_kobo: 500_000n, paid_kobo: 0n },
      { expected_kobo: 500_000n, paid_kobo: 300_000n },
      { expected_kobo: 500_000n, paid_kobo: 0n },
    ];
    expect(calculateStudentOutstanding(obligations)).toBe(1_200_000n);
    expect(calculateFamilyOutstanding(obligations)).toBe(1_200_000n);
  });

  it("allocates family payments only across children explicitly selected", () => {
    const familyObligations = [
      { id: "older-selected", student_id: "child-a", family_id: "family-1", due_date: "2026-10-01", expected_kobo: 500_000n },
      { id: "not-selected", student_id: "child-b", family_id: "family-1", due_date: "2026-10-02", expected_kobo: 500_000n },
      { id: "newer-selected", student_id: "child-c", family_id: "family-1", due_date: "2026-10-03", expected_kobo: 500_000n },
    ];

    const result = allocateFamilyPayment(700_000n, ["child-a", "child-c"], familyObligations);
    expect(result.allocations.map((allocation) => allocation.obligation_id)).toEqual([
      "older-selected",
      "newer-selected",
    ]);
    expect(result.allocations[1].allocated_kobo).toBe(200_000n);
  });

  it("restores payment and credit allocations when their source payment is reversed", () => {
    const paymentAllocations = [{ allocated_kobo: 300_000n, voided: false }];
    const creditAllocations = [{ allocated_kobo: 200_000n, reversed: false }];
    expect(calculateObligationPaidKobo(paymentAllocations, creditAllocations)).toBe(500_000n);

    paymentAllocations[0].voided = true;
    creditAllocations[0].reversed = true;
    expect(calculateObligationPaidKobo(paymentAllocations, creditAllocations)).toBe(0n);
    expect(paymentAllocations).toHaveLength(1);
    expect(creditAllocations).toHaveLength(1);
  });

  it("supports separate family and student balances", () => {
    const studentOutstanding = calculateStudentOutstanding([
      { expected_kobo: 500_000n, paid_kobo: 250_000n },
    ]);
    const familyOutstanding = calculateFamilyOutstanding([
      { expected_kobo: 500_000n, paid_kobo: 250_000n },
      { expected_kobo: 400_000n, paid_kobo: 0n },
    ]);
    expect(studentOutstanding).toBe(250_000n);
    expect(familyOutstanding).toBe(650_000n);
    expect(calculateFamilyOutstanding([
      { expected_kobo: 500_000n, paid_kobo: 250_000n },
      { expected_kobo: 400_000n, paid_kobo: 0n },
    ], 100_000n)).toBe(550_000n);
  });
});
