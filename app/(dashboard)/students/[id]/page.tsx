import Link from "next/link";
import { notFound } from "next/navigation";

import { StudentRecordForm } from "@/components/students/student-record-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyKobo } from "@/lib/fees/money";
import { requireAuth } from "@/lib/auth/session";
import { getStudentDetailData } from "@/server/core-data";

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  const { id } = await params;
  const data = await getStudentDetailData(id);
  if (!data) notFound();

  const { student } = data;
  const className = data.classes.find((item) => item.id === student.class_id)?.name ?? "No class assigned";
  const today = new Date().toISOString().slice(0, 10);
  const activeAdjustment = data.adjustments.find((adjustment) =>
    adjustment.effective_from <= today &&
    (!adjustment.effective_to || adjustment.effective_to >= today),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-emerald-700">Student profile</p>
          <h1 className="text-3xl font-bold text-slate-900">{student.full_name}</h1>
        </div>
        <div className="flex gap-3">
          <Link href={`/reports?student=${student.id}`} className="text-sm font-medium text-emerald-700">View statement</Link>
          <Link href="/students" className="text-sm font-medium text-emerald-700">Back to students</Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Student information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div><p className="text-sm text-slate-500">Family</p><p className="font-medium">{data.family?.family_name ?? "—"}</p></div>
            <div><p className="text-sm text-slate-500">Class</p><p className="font-medium">{className}</p></div>
            <div><p className="text-sm text-slate-500">Parent / guardian</p><p className="font-medium">{student.parent_name ?? "—"}</p></div>
            <div><p className="text-sm text-slate-500">Phone</p><p className="font-medium">{student.parent_phone ?? "—"}</p></div>
            <div><p className="text-sm text-slate-500">Email</p><p className="font-medium">{student.parent_email ?? "—"}</p></div>
            <div><p className="text-sm text-slate-500">Date of birth</p><p className="font-medium">{student.date_of_birth ?? "—"}</p></div>
            <div><p className="text-sm text-slate-500">Admission date</p><p className="font-medium">{student.admission_date}</p></div>
            <div><p className="text-sm text-slate-500">Payment frequency</p><p className="font-medium capitalize">{student.payment_frequency}</p></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Fee and status</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Badge variant={student.status === "active" ? "success" : "warning"}>{student.status}</Badge>
            <p className="text-sm text-slate-600">Current monthly fee: <strong>{formatMoneyKobo(student.monthly_fee_kobo)}</strong></p>
            {activeAdjustment && (
              <p className="text-sm text-emerald-800">
                Custom fee effective {activeAdjustment.effective_from}
                {activeAdjustment.effective_to ? ` through ${activeAdjustment.effective_to}` : ""}.
                {activeAdjustment.reason ? ` ${activeAdjustment.reason}` : ""}
              </p>
            )}
            <p className="text-sm text-slate-600">Total outstanding: <strong>{formatMoneyKobo(data.outstanding_kobo)}</strong></p>
            <p className="text-sm text-slate-600">Oldest unpaid due date: <strong>{data.oldest_due_date ?? "—"}</strong></p>
            <p className="text-sm text-slate-600">Last valid payment: <strong>{data.last_payment?.payment_date ?? "No recorded payment"}</strong></p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly fee obligations</CardTitle>
          <CardDescription>Historical obligations are preserved. Status and balances are derived from valid allocations.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead><tr className="border-b text-slate-500"><th className="px-3 py-3">Month</th><th className="px-3 py-3">Due date</th><th className="px-3 py-3">Expected</th><th className="px-3 py-3">Paid</th><th className="px-3 py-3">Outstanding</th><th className="px-3 py-3">Status</th></tr></thead>
            <tbody>
              {data.balances.map((balance) => (
                <tr key={balance.id} className="border-b border-slate-100">
                  <td className="px-3 py-3">{balance.obligation_date}</td>
                  <td className="px-3 py-3">{balance.due_date}</td>
                  <td className="px-3 py-3">{formatMoneyKobo(balance.expected_kobo)}</td>
                  <td className="px-3 py-3">{formatMoneyKobo(balance.paid_kobo)}</td>
                  <td className="px-3 py-3 font-medium">{formatMoneyKobo(balance.outstanding_kobo)}</td>
                  <td className="px-3 py-3"><Badge variant={balance.status === "paid" ? "success" : balance.status === "partial" ? "warning" : "outline"}>{balance.status}</Badge></td>
                </tr>
              ))}
              {data.balances.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No obligations generated yet.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Payment history</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.payments.map((payment) => (
            <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
              <div>
                <p className="font-medium">{payment.receipt_number}</p>
                <p className="text-sm text-slate-500">{payment.payment_date} · {payment.payment_method.replaceAll("_", " ")}{payment.reference ? ` · ${payment.reference}` : ""}</p>
              </div>
              <div className="flex items-center gap-3">
                <strong>{formatMoneyKobo(payment.amount_kobo)}</strong>
                {payment.voided_at && <Badge variant="warning">Reversed</Badge>}
              </div>
            </div>
          ))}
          {data.payments.length === 0 && <p className="text-sm text-slate-500">No payments recorded.</p>}
        </CardContent>
      </Card>

      {session.role === "admin" && (
        <Card>
          <CardHeader><CardTitle>Edit student record</CardTitle></CardHeader>
          <CardContent>
            <StudentRecordForm student={student} families={data.families} classes={data.classes} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
