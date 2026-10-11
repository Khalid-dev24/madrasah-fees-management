import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function escapeCsv(value: string | null | undefined): string {
  const safe = String(value ?? "").replace(/"/g, '""');
  return `"${safe}"`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const client = createSupabaseServerClient();
  const { data: payment, error: paymentError } = await client
    .from("financial_payments")
    .select("id, student_id, family_id, amount_kobo, payment_date, payment_method, reference, receipt_number, voided_at, notes")
    .eq("id", id)
    .maybeSingle();

  if (paymentError) {
    throw new Error(paymentError.message);
  }
  if (!payment) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  const [studentResult, familyResult, allocationsResult] = await Promise.all([
    payment.student_id
      ? client.from("students").select("id, full_name").eq("id", payment.student_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    payment.family_id
      ? client.from("families").select("id, family_name").eq("id", payment.family_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    client
      .from("financial_payment_allocations")
      .select("id, obligation_id, allocated_kobo")
      .eq("payment_id", payment.id),
  ]);

  if (studentResult.error) {
    throw new Error(studentResult.error.message);
  }
  if (familyResult.error) {
    throw new Error(familyResult.error.message);
  }
  if (allocationsResult.error) {
    throw new Error(allocationsResult.error.message);
  }

  const obligationIds = allocationsResult.data?.map((allocation) => allocation.obligation_id) ?? [];
  const balanceMap = new Map<string, { month_id: string; due_date: string }>();
  if (obligationIds.length > 0) {
    const { data: balances, error: balancesError } = await client
      .from("fee_obligation_balances")
      .select("id, month_id, due_date")
      .in("id", obligationIds);

    if (balancesError) {
      throw new Error(balancesError.message);
    }
    for (const balance of balances ?? []) {
      balanceMap.set(balance.id, { month_id: balance.month_id, due_date: balance.due_date });
    }
  }

  const payer = payment.student_id
    ? studentResult.data?.full_name ?? "Student"
    : familyResult.data?.family_name ?? "Family";

  const rows = [
    ["Receipt Number", "Payment Date", "Payer", "Payment Method", "Reference", "Amount Kobo", "Obligation Id", "Month Id", "Due Date", "Allocated Kobo"],
    ...((allocationsResult.data ?? []).map((allocation) => {
      const balance = balanceMap.get(allocation.obligation_id);
      return [
        payment.receipt_number,
        payment.payment_date,
        payer,
        payment.payment_method,
        payment.reference ?? "",
        String(payment.amount_kobo),
        allocation.obligation_id,
        balance?.month_id ?? "",
        balance?.due_date ?? "",
        String(allocation.allocated_kobo),
      ];
    })),
  ];

  const csv = rows
    .map((row) => row.map((cell) => escapeCsv(String(cell))).join(","))
    .join("\n");
  const fileName = `${payment.receipt_number}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
