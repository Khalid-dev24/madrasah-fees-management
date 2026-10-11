export type MoneyValue = bigint | number | string;

export type FeeSettings = {
  monthly_kobo: bigint;
  quarterly_kobo: bigint;
  term_kobo: bigint;
  annual_kobo: bigint;
  currency: "NGN";
};

export type StudentFeeAdjustment = {
  custom_monthly_fee_kobo: MoneyValue;
  effective_from: string;
  effective_to?: string | null;
};

export type StudentLike = {
  base_monthly_fee_kobo?: MoneyValue;
  fee_adjustments?: StudentFeeAdjustment[];
  status?: string;
};

export type FamilyDiscountRule = {
  minimum_family_size: number;
  discount_per_eligible_student_kobo: MoneyValue;
};

export type ObligationLike = {
  id: string;
  student_id: string;
  family_id?: string | null;
  due_date: string;
  expected_kobo: MoneyValue;
  paid_kobo?: MoneyValue;
};

export const DEFAULT_FEE_SETTINGS: FeeSettings = {
  monthly_kobo: 500_000n,
  quarterly_kobo: 1_500_000n,
  term_kobo: 3_000_000n,
  annual_kobo: 6_000_000n,
  currency: "NGN",
};

export const DEFAULT_FAMILY_DISCOUNT_RULE: FamilyDiscountRule = {
  minimum_family_size: 3,
  discount_per_eligible_student_kobo: 100_000n,
};

export function toMoneyKobo(value: MoneyValue): bigint {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    throw new RangeError("Kobo amounts must be safe integers or bigint values.");
  }

  if (typeof value === "string" && !/^-?\d+$/.test(value)) {
    throw new TypeError("Kobo amounts must be integer strings.");
  }

  return BigInt(value);
}

function assertNonNegativeKobo(value: MoneyValue, label: string): bigint {
  const result = toMoneyKobo(value);
  if (result < 0n) {
    throw new RangeError(`${label} cannot be negative.`);
  }
  return result;
}

function assertValidIsoDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError(`Invalid ISO date: ${value}`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new TypeError(`Invalid ISO date: ${value}`);
  }
}

export function getEffectiveMonthlyFee(
  student: StudentLike,
  atDate: Date | string,
  feeSettings: FeeSettings = DEFAULT_FEE_SETTINGS,
): bigint {
  const date = atDate instanceof Date ? atDate.toISOString().slice(0, 10) : atDate;
  assertValidIsoDate(date);
  const activeAdjustments = (student.fee_adjustments ?? []).filter((adjustment) => {
    assertValidIsoDate(adjustment.effective_from);
    if (adjustment.effective_to) {
      assertValidIsoDate(adjustment.effective_to);
    }
    return adjustment.effective_from <= date &&
      (!adjustment.effective_to || adjustment.effective_to >= date);
  });

  activeAdjustments.sort((left, right) =>
    left.effective_from.localeCompare(right.effective_from),
  );
  const activeAdjustment = activeAdjustments.at(-1);

  if (activeAdjustment) {
    const amount = assertNonNegativeKobo(activeAdjustment.custom_monthly_fee_kobo, "Custom monthly fee");
    if (amount === 0n) {
      throw new RangeError("Custom monthly fee must be greater than zero.");
    }
    return amount;
  }

  return assertNonNegativeKobo(
    student.base_monthly_fee_kobo ?? feeSettings.monthly_kobo,
    "Monthly fee",
  );
}

function summarizeMonthlyFee(monthlyFeeKobo: MoneyValue, monthCount: number): bigint {
  const monthlyFee = assertNonNegativeKobo(monthlyFeeKobo, "Monthly fee");
  if (!Number.isSafeInteger(monthCount) || monthCount < 0) {
    throw new RangeError("Month count must be a non-negative safe integer.");
  }
  return monthlyFee * BigInt(monthCount);
}

export function calculateQuarterlySummary(monthlyFeeKobo: MoneyValue, monthCount = 3): bigint {
  return summarizeMonthlyFee(monthlyFeeKobo, monthCount);
}

export function calculateTermSummary(monthlyFeeKobo: MoneyValue, monthCount = 6): bigint {
  return summarizeMonthlyFee(monthlyFeeKobo, monthCount);
}

export function calculateAnnualSummary(monthlyFeeKobo: MoneyValue, monthCount = 12): bigint {
  return summarizeMonthlyFee(monthlyFeeKobo, monthCount);
}

export function calculateFamilyDiscount(
  eligibleStudentCount: number,
  rule: FamilyDiscountRule = DEFAULT_FAMILY_DISCOUNT_RULE,
): bigint {
  if (!Number.isSafeInteger(eligibleStudentCount) || eligibleStudentCount < 0) {
    throw new RangeError("Eligible student count must be a non-negative safe integer.");
  }
  if (!Number.isSafeInteger(rule.minimum_family_size) || rule.minimum_family_size < 1) {
    throw new RangeError("Minimum family size must be a positive safe integer.");
  }

  const discount = assertNonNegativeKobo(
    rule.discount_per_eligible_student_kobo,
    "Discount per eligible student",
  );
  return eligibleStudentCount < rule.minimum_family_size
    ? 0n
    : BigInt(eligibleStudentCount) * discount;
}

export function calculateStudentOutstanding(
  obligations: Array<{ expected_kobo: MoneyValue; paid_kobo?: MoneyValue }>,
): bigint {
  return obligations.reduce((total, obligation) => {
    const expected = assertNonNegativeKobo(obligation.expected_kobo, "Expected obligation");
    const paid = assertNonNegativeKobo(obligation.paid_kobo ?? 0n, "Paid amount");
    if (paid > expected) {
      throw new RangeError("Paid allocations cannot exceed the expected obligation.");
    }
    return total + expected - paid;
  }, 0n);
}

export function calculateFamilyOutstanding(
  obligations: Array<{ expected_kobo: MoneyValue; paid_kobo?: MoneyValue }>,
  familyDiscountKobo: MoneyValue = 0n,
): bigint {
  const grossOutstanding = calculateStudentOutstanding(obligations);
  const discount = assertNonNegativeKobo(familyDiscountKobo, "Family discount");
  return grossOutstanding > discount ? grossOutstanding - discount : 0n;
}

export function calculateObligationPaidKobo(
  paymentAllocations: Array<{ allocated_kobo: MoneyValue; voided?: boolean }>,
  creditAllocations: Array<{ allocated_kobo: MoneyValue; reversed?: boolean }>,
): bigint {
  const paymentTotal = paymentAllocations.reduce(
    (total, allocation) => allocation.voided
      ? total
      : total + assertNonNegativeKobo(allocation.allocated_kobo, "Payment allocation"),
    0n,
  );
  const creditTotal = creditAllocations.reduce(
    (total, allocation) => allocation.reversed
      ? total
      : total + assertNonNegativeKobo(allocation.allocated_kobo, "Credit allocation"),
    0n,
  );
  return paymentTotal + creditTotal;
}

export type PaymentAllocation = {
  obligation_id: string;
  allocated_kobo: bigint;
  due_date: string;
};

export type AllocationResult = {
  allocations: PaymentAllocation[];
  remainingKobo: bigint;
  creditKobo: bigint;
};

export function allocateOldestFirst(
  paymentAmountKobo: MoneyValue,
  obligations: ObligationLike[],
): AllocationResult {
  let remaining = assertNonNegativeKobo(paymentAmountKobo, "Payment amount");
  const sortedObligations = [...obligations].sort((left, right) => {
    assertValidIsoDate(left.due_date);
    assertValidIsoDate(right.due_date);
    return left.due_date.localeCompare(right.due_date) || left.id.localeCompare(right.id);
  });
  const allocations: PaymentAllocation[] = [];

  for (const obligation of sortedObligations) {
    if (remaining === 0n) {
      break;
    }

    const expected = assertNonNegativeKobo(obligation.expected_kobo, "Expected obligation");
    const paid = assertNonNegativeKobo(obligation.paid_kobo ?? 0n, "Paid amount");
    if (paid > expected) {
      throw new RangeError("Paid allocations cannot exceed the expected obligation.");
    }
    const outstanding = expected > paid ? expected - paid : 0n;
    if (outstanding === 0n) {
      continue;
    }

    const allocated = remaining < outstanding ? remaining : outstanding;
    allocations.push({
      obligation_id: obligation.id,
      allocated_kobo: allocated,
      due_date: obligation.due_date,
    });
    remaining -= allocated;
  }

  return {
    allocations,
    remainingKobo: remaining,
    creditKobo: remaining,
  };
}

export function allocateFamilyPayment(
  paymentAmountKobo: MoneyValue,
  selectedStudentIds: string[],
  obligations: ObligationLike[],
): AllocationResult {
  const selected = new Set(selectedStudentIds);
  const eligibleObligations = obligations.filter((obligation) =>
    selected.has(obligation.student_id),
  );
  return allocateOldestFirst(paymentAmountKobo, eligibleObligations);
}

export function calculateCredit(
  totalOutstandingKobo: MoneyValue,
  paymentAmountKobo: MoneyValue,
): bigint {
  const outstanding = assertNonNegativeKobo(totalOutstandingKobo, "Outstanding amount");
  const payment = assertNonNegativeKobo(paymentAmountKobo, "Payment amount");
  return payment > outstanding ? payment - outstanding : 0n;
}

export function generateMonthlyObligations(
  studentId: string,
  familyId: string | null,
  months: Array<{ id: string; start_date: string; month_name: string; due_date?: string }>,
  monthlyFeeKobo: MoneyValue,
): Array<{
  student_id: string;
  family_id: string | null;
  month_id: string;
  obligation_date: string;
  due_date: string;
  expected_kobo: bigint;
}> {
  const monthlyFee = assertNonNegativeKobo(monthlyFeeKobo, "Monthly fee");
  return months.map((month) => {
    assertValidIsoDate(month.start_date);
    const dueDate = month.due_date ?? month.start_date;
    assertValidIsoDate(dueDate);
    return {
      student_id: studentId,
      family_id: familyId,
      month_id: month.id,
      obligation_date: month.start_date,
      due_date: dueDate,
      expected_kobo: monthlyFee,
    };
  });
}

export function determineObligationStatus(
  obligation: { expected_kobo: MoneyValue; paid_kobo?: MoneyValue },
): "unpaid" | "partial" | "paid" {
  const expected = assertNonNegativeKobo(obligation.expected_kobo, "Expected obligation");
  const paid = assertNonNegativeKobo(obligation.paid_kobo ?? 0n, "Paid amount");
  if (paid >= expected) {
    return "paid";
  }
  return paid > 0n ? "partial" : "unpaid";
}

export function calculateArrearsCarryForward(
  previousArrearsKobo: MoneyValue,
  newObligationKobo: MoneyValue,
): bigint {
  return assertNonNegativeKobo(previousArrearsKobo, "Previous arrears") +
    assertNonNegativeKobo(newObligationKobo, "New obligation");
}

export function calculateRemainingCredit(
  creditAmountKobo: MoneyValue,
  creditAllocationsKobo: MoneyValue[],
): bigint {
  const amount = assertNonNegativeKobo(creditAmountKobo, "Credit amount");
  const allocated = creditAllocationsKobo.reduce<bigint>(
    (total, value) => total + assertNonNegativeKobo(value, "Credit allocation"),
    0n,
  );
  if (allocated > amount) {
    throw new RangeError("Credit allocations cannot exceed the original credit.");
  }
  return amount - allocated;
}

export function isStudentActiveForDate(
  status: string | undefined,
  studentDate: Date | string,
  inactiveDate?: Date | string,
): boolean {
  if (status && ["inactive", "graduated", "withdrawn"].includes(status)) {
    return false;
  }

  const date = studentDate instanceof Date
    ? studentDate.toISOString().slice(0, 10)
    : studentDate;
  assertValidIsoDate(date);
  if (!inactiveDate) {
    return true;
  }

  const endDate = inactiveDate instanceof Date
    ? inactiveDate.toISOString().slice(0, 10)
    : inactiveDate;
  assertValidIsoDate(endDate);
  return date <= endDate;
}
