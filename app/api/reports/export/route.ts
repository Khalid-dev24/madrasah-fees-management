import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function escapeCsv(value: string | null | undefined): string {
  const safe = String(value ?? "").replace(/"/g, '""');
  return `"${safe}"`;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const quarterId = searchParams.get("quarter");
  const studentId = searchParams.get("student");
  const client = createSupabaseServerClient();

  let paymentQuery = client
    .from("financial_payments")
    .select("id, student_id, family_id, amount_kobo, payment_date, payment_method, reference, receipt_number, voided_at")
    .order("payment_date", { ascending: false });

  if (quarterId) {
    const { data: quarter, error: quarterError } = await client
      .from("quarters")
      .select("start_date, end_date")
      .eq("id", quarterId)
      .maybeSingle();

    if (quarterError) {
      throw new Error(quarterError.message);
    }

    if (quarter) {
      paymentQuery = paymentQuery.gte("payment_date", quarter.start_date).lte("payment_date", quarter.end_date);
    }
  }

  if (studentId) {
    paymentQuery = paymentQuery.eq("student_id", studentId);
  }

  const { data: payments, error } = await paymentQuery;
  if (error) {
    throw new Error(error.message);
  }

  const studentIds = [...new Set((payments ?? []).map((payment) => payment.student_id).filter(Boolean))] as string[];
  const familyIds = [...new Set((payments ?? []).map((payment) => payment.family_id).filter(Boolean))] as string[];

  const [studentsResult, familiesResult] = await Promise.all([
    studentIds.length > 0
      ? client.from("students").select("id, full_name").in("id", studentIds)
      : Promise.resolve({ data: [], error: null }),
    familyIds.length > 0
      ? client.from("families").select("id, family_name").in("id", familyIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (studentsResult.error) {
    throw new Error(studentsResult.error.message);
  }
  if (familiesResult.error) {
    throw new Error(familiesResult.error.message);
  }

  const studentNameById = new Map((studentsResult.data ?? []).map((student) => [student.id, student.full_name]));
  const familyNameById = new Map((familiesResult.data ?? []).map((family) => [family.id, family.family_name]));

  const rows = [
    ["Receipt Number", "Payment Date", "Payer", "Method", "Reference", "Amount Kobo", "Status"],
    ...((payments ?? []).map((payment) => {
      const payer = payment.student_id
        ? studentNameById.get(payment.student_id) ?? "Student"
        : familyNameById.get(payment.family_id ?? "") ?? "Family";
      return [
        payment.receipt_number,
        payment.payment_date,
        payer,
        payment.payment_method,
        payment.reference ?? "",
        String(payment.amount_kobo),
        payment.voided_at ? "Reversed" : "Valid",
      ];
    })),
  ];

  const csv = rows
    .map((row) => row.map((cell) => escapeCsv(String(cell))).join(","))
    .join("\n");
  const fileName = quarterId ? `madrasah-quarter-report-${quarterId}.csv` : studentId ? `madrasah-student-report-${studentId}.csv` : "madrasah-payment-report.csv";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
