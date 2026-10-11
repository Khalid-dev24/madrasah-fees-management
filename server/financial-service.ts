import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type FinancialRpcName =
  | "generate_monthly_obligations"
  | "set_student_fee_adjustment"
  | "record_student_payment"
  | "record_family_payment"
  | "apply_credit_to_student"
  | "reverse_payment"
  | "family_quarter_summary";

async function fetchAllPages<T>(
  loadPage: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await loadPage(from, from + pageSize - 1);
    if (error) {
      throw new Error(error.message);
    }
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) {
      return rows;
    }
  }
}

async function callRpc<T>(
  client: SupabaseClient,
  name: FinancialRpcName,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    throw new Error(error.message);
  }
  return data as T;
}

type ReportPayment = {
  id: string;
  student_id: string | null;
  family_id: string | null;
  amount_kobo: string;
  payment_date: string;
  payment_method: string;
  reference: string | null;
  receipt_number: string;
  voided_at: string | null;
  void_reason: string | null;
  notes: string | null;
};

type ReportBalance = {
  id: string;
  student_id: string;
  family_id: string;
  month_id: string;
  due_date: string;
  expected_kobo: string;
  paid_kobo: string;
  outstanding_kobo: string;
  status: "unpaid" | "partial" | "paid";
};

type ReportAllocation = {
  id: string;
  payment_id: string;
  obligation_id: string;
  allocated_kobo: string;
  payment_date: string;
};

export async function generateQuarterObligations(
  quarterId: string,
  actorEmail: string,
  actorId: string,
) {
  return callRpc<Record<string, unknown>>(
    createSupabaseServerClient(),
    "generate_monthly_obligations",
    { p_quarter_id: quarterId, p_actor_email: actorEmail, p_actor_id: actorId },
  );
}

export async function setStudentFeeAdjustment(input: {
  studentId: string;
  feeKobo: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  reason: string;
  notes: string;
  actorEmail: string;
  actorId: string;
}) {
  return callRpc<string>(
    createSupabaseServerClient(),
    "set_student_fee_adjustment",
    {
      p_student_id: input.studentId,
      p_custom_monthly_fee_kobo: input.feeKobo,
      p_effective_from: input.effectiveFrom,
      p_effective_to: input.effectiveTo,
      p_reason: input.reason,
      p_notes: input.notes,
      p_actor_email: input.actorEmail,
      p_actor_id: input.actorId,
    },
  );
}

export async function recordStudentPayment(input: {
  studentId: string;
  amountKobo: string;
  paymentDate: string;
  paymentMethod: string;
  reference: string;
  notes: string;
  actorEmail: string;
  actorId: string;
}) {
  return callRpc<Record<string, unknown>>(
    createSupabaseServerClient(),
    "record_student_payment",
    {
      p_student_id: input.studentId,
      p_amount_kobo: input.amountKobo,
      p_payment_date: input.paymentDate,
      p_payment_method: input.paymentMethod,
      p_reference: input.reference,
      p_notes: input.notes,
      p_actor_email: input.actorEmail,
      p_actor_id: input.actorId,
    },
  );
}

export async function recordFamilyPayment(input: {
  familyId: string;
  studentIds: string[];
  amountKobo: string;
  paymentDate: string;
  paymentMethod: string;
  reference: string;
  notes: string;
  actorEmail: string;
  actorId: string;
}) {
  return callRpc<Record<string, unknown>>(
    createSupabaseServerClient(),
    "record_family_payment",
    {
      p_family_id: input.familyId,
      p_student_ids: input.studentIds,
      p_amount_kobo: input.amountKobo,
      p_payment_date: input.paymentDate,
      p_payment_method: input.paymentMethod,
      p_reference: input.reference,
      p_notes: input.notes,
      p_actor_email: input.actorEmail,
      p_actor_id: input.actorId,
    },
  );
}

export async function applyCreditToStudent(
  creditId: string,
  studentId: string,
  actorEmail: string,
  actorId: string,
) {
  return callRpc<Record<string, unknown>>(
    createSupabaseServerClient(),
    "apply_credit_to_student",
    {
      p_credit_id: creditId,
      p_student_id: studentId,
      p_actor_email: actorEmail,
      p_actor_id: actorId,
    },
  );
}

export async function reversePayment(
  paymentId: string,
  reason: string,
  actorEmail: string,
  actorId: string,
) {
  return callRpc<Record<string, unknown>>(
    createSupabaseServerClient(),
    "reverse_payment",
    {
      p_payment_id: paymentId,
      p_reason: reason,
      p_actor_email: actorEmail,
      p_actor_id: actorId,
    },
  );
}

export async function getFamilyQuarterSummary(quarterId: string) {
  return callRpc<Array<Record<string, unknown>>>(
    createSupabaseServerClient(),
    "family_quarter_summary",
    { p_quarter_id: quarterId },
  );
}

export async function getReportsPageData(quarterId: string | null) {
  const client = createSupabaseServerClient();
  const [
    payments,
    balances,
    studentsResult,
    familiesResult,
    monthsResult,
    quartersResult,
    allocations,
  ] = await Promise.all([
    fetchAllPages<ReportPayment>((from, to) =>
      client
        .from("financial_payments")
        .select("id, student_id, family_id, amount_kobo, payment_date, payment_method, reference, receipt_number, voided_at, void_reason, notes")
        .order("payment_date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllPages<ReportBalance>((from, to) =>
      client
        .from("fee_obligation_balances")
        .select("id, student_id, family_id, month_id, due_date, expected_kobo, paid_kobo, outstanding_kobo, status")
        .order("due_date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    client.from("students").select("id, family_id, full_name, status").order("full_name"),
    client.from("families").select("id, family_name").order("family_name"),
    client.from("months").select("id, month_name, month_number, start_date, end_date, quarter_id").order("month_number"),
    client.from("quarters").select("id, name, start_date, end_date, is_current").order("start_date", { ascending: false }),
    fetchAllPages<ReportAllocation>((from, to) =>
      client
        .from("financial_payment_allocations")
        .select("id, payment_id, obligation_id, allocated_kobo, payment_date")
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);

  for (const result of [studentsResult, familiesResult, monthsResult, quartersResult]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const quarter = quartersResult.data?.find((item) => item.id === quarterId)
    ?? quartersResult.data?.find((item) => item.is_current)
    ?? null;
  const familySummary = quarter ? await getFamilyQuarterSummary(quarter.id) : [];

  return {
    payments,
    balances,
    students: studentsResult.data ?? [],
    families: familiesResult.data ?? [],
    months: monthsResult.data ?? [],
    quarters: quartersResult.data ?? [],
    allocations,
    quarter,
    familySummary,
  };
}

export async function getFinancePageData() {
  const client = createSupabaseServerClient();
  const [
    paymentsResult,
    balancesResult,
    studentsResult,
    familiesResult,
    classesResult,
    monthsResult,
    creditsResult,
    quartersResult,
    allocationsResult,
    feeSettingsResult,
    adjustmentsResult,
  ] = await Promise.all([
      client
        .from("financial_payments")
        .select("id, student_id, family_id, amount_kobo, payment_date, payment_method, reference, receipt_number, voided_at, void_reason, notes")
        .order("payment_date", { ascending: false })
        .limit(100),
      client
        .from("fee_obligation_balances")
        .select("id, student_id, family_id, month_id, due_date, expected_kobo, paid_kobo, outstanding_kobo, status")
        .order("due_date", { ascending: true }),
      client.from("students")
        .select("id, family_id, class_id, full_name, status, payment_frequency, admission_date, financially_active_until")
        .order("full_name"),
      client.from("families").select("id, family_name").order("family_name"),
      client.from("classes").select("id, name").order("name"),
      client.from("months").select("id, month_name, month_number, quarter_id"),
      client
        .from("financial_credits")
        .select("id, student_id, family_id, source_payment_id, amount_kobo, remaining_kobo, created_at")
        .order("created_at", { ascending: true }),
      client.from("quarters").select("id, name, start_date, end_date, is_current").order("start_date", { ascending: false }),
      client
        .from("financial_payment_allocations")
        .select("id, payment_id, obligation_id, allocated_kobo, payment_date"),
      client
        .from("fee_settings")
        .select("monthly_kobo, quarterly_kobo, term_kobo, annual_kobo, currency")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1),
      client
        .from("student_fee_adjustments")
        .select("id, student_id, custom_monthly_fee_kobo, effective_from, effective_to, reason, notes")
        .order("effective_from"),
  ]);

  for (const result of [
    paymentsResult,
    balancesResult,
    studentsResult,
    familiesResult,
    classesResult,
    monthsResult,
    creditsResult,
    quartersResult,
    allocationsResult,
    feeSettingsResult,
    adjustmentsResult,
  ]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  return {
    payments: paymentsResult.data ?? [],
    allBalances: balancesResult.data ?? [],
    outstanding: (balancesResult.data ?? []).filter(
      (balance) => BigInt(balance.outstanding_kobo) > 0n,
    ),
    students: studentsResult.data ?? [],
    families: familiesResult.data ?? [],
    classes: classesResult.data ?? [],
    months: monthsResult.data ?? [],
    credits: (creditsResult.data ?? []).filter(
      (credit) => BigInt(credit.remaining_kobo) > 0n,
    ),
    quarters: quartersResult.data ?? [],
    allocations: allocationsResult.data ?? [],
    feeSettings: feeSettingsResult.data?.[0] ?? null,
    adjustments: adjustmentsResult.data ?? [],
  };
}

export async function getFamilyPageData() {
  const client = createSupabaseServerClient();
  const [familiesResult, studentsResult, quartersResult] = await Promise.all([
    client.from("families").select("id, family_name, primary_contact_name, phone, email, address, status").order("family_name"),
    client.from("students").select("id, family_id, full_name, status").order("full_name"),
    client.from("quarters").select("id, name, is_current").order("start_date", { ascending: false }),
  ]);

  for (const result of [familiesResult, studentsResult, quartersResult]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  const quarter = quartersResult.data?.find((item) => item.is_current);
  const summary = quarter ? await getFamilyQuarterSummary(quarter.id) : [];

  return {
    families: familiesResult.data ?? [],
    students: studentsResult.data ?? [],
    quarters: quartersResult.data ?? [],
    quarter,
    summary,
  };
}

export async function getFamilyDetailData(familyId: string) {
  const client = createSupabaseServerClient();
  const [familyResult, studentsResult, balancesResult] = await Promise.all([
    client
      .from("families")
      .select("id, family_name, primary_contact_name, phone, email, address, status")
      .eq("id", familyId)
      .maybeSingle(),
    client
      .from("students")
      .select("id, family_id, full_name, status, payment_frequency, class_id")
      .eq("family_id", familyId)
      .order("full_name"),
    client
      .from("fee_obligation_balances")
      .select("id, student_id, due_date, expected_kobo, paid_kobo, outstanding_kobo, status")
      .eq("family_id", familyId)
      .order("due_date"),
  ]);

  for (const result of [familyResult, studentsResult, balancesResult]) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }

  return {
    family: familyResult.data,
    students: studentsResult.data ?? [],
    balances: balancesResult.data ?? [],
  };
}
