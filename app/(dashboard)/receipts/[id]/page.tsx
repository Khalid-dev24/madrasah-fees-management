import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyKobo } from "@/lib/fees/money";
import { requireAuth } from "@/lib/auth/session";
import { getFinancePageData } from "@/server/financial-service";

export default async function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const { payments, students, families, allocations, allBalances, months } = await getFinancePageData();
  const payment = payments.find((item) => item.id === id);
  if (!payment) {
    notFound();
  }

  const studentNameById = new Map(students.map((student) => [student.id, student.full_name]));
  const familyNameById = new Map(families.map((family) => [family.id, family.family_name]));
  const payer = payment.student_id
    ? studentNameById.get(payment.student_id)
    : familyNameById.get(payment.family_id ?? "");
  const paymentAllocations = allocations.filter((allocation) => allocation.payment_id === payment.id);
  const monthById = new Map(months.map((month) => [month.id, month.month_name]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-emerald-700">Receipt</p>
          <h1 className="text-3xl font-bold text-slate-900">{payment.receipt_number}</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <a href={`/api/receipts/${payment.id}?format=csv`} download>
              Download CSV
            </a>
          </Button>
          <Button asChild variant="outline">
            <Link href="/receipts">Back to receipts</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dārul Bayān Madrasah</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-slate-500">Receipt number</p>
            <p className="text-lg font-semibold text-slate-900">{payment.receipt_number}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Receipt status</p>
            <p className="text-lg font-semibold text-slate-900">{payment.voided_at ? <Badge variant="warning">Reversed</Badge> : <Badge variant="success">Valid</Badge>}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Payer</p>
            <p className="text-lg font-semibold text-slate-900">{payer ?? "Unknown payer"}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Payment date</p>
            <p className="text-lg font-semibold text-slate-900">{payment.payment_date}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Payment method</p>
            <p className="text-lg font-semibold text-slate-900">{payment.payment_method.replaceAll("_", " ")}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Amount paid</p>
            <p className="text-lg font-semibold text-slate-900">{formatMoneyKobo(payment.amount_kobo)}</p>
          </div>
          {payment.reference && (
            <div className="md:col-span-2">
              <p className="text-sm text-slate-500">Reference</p>
              <p className="text-lg font-semibold text-slate-900">{payment.reference}</p>
            </div>
          )}
          {payment.notes && (
            <div className="md:col-span-2">
              <p className="text-sm text-slate-500">Notes</p>
              <p className="text-lg font-semibold text-slate-900">{payment.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Allocation breakdown</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-3 py-3">Month</th>
                <th className="px-3 py-3">Due date</th>
                <th className="px-3 py-3">Obligation</th>
                <th className="px-3 py-3">Allocated</th>
              </tr>
            </thead>
            <tbody>
              {paymentAllocations.map((allocation) => {
                const obligation = allBalances.find((balance) => balance.id === allocation.obligation_id);
                return (
                  <tr key={allocation.id} className="border-b border-slate-100">
                    <td className="px-3 py-3">{obligation ? monthById.get(obligation.month_id) ?? "—" : "—"}</td>
                    <td className="px-3 py-3">{obligation?.due_date ?? "—"}</td>
                    <td className="px-3 py-3">{obligation?.id ?? allocation.obligation_id}</td>
                    <td className="px-3 py-3">{formatMoneyKobo(allocation.allocated_kobo)}</td>
                  </tr>
                );
              })}
              {paymentAllocations.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate-500">No allocations are recorded for this payment.</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
