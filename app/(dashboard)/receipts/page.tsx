import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyKobo } from "@/lib/fees/money";
import { requireAuth } from "@/lib/auth/session";
import { getFinancePageData } from "@/server/financial-service";

export default async function ReceiptsPage() {
  await requireAuth();
  const { payments, students, families } = await getFinancePageData();
  const studentNameById = new Map(students.map((student) => [student.id, student.full_name]));
  const familyNameById = new Map(families.map((family) => [family.id, family.family_name]));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-700">Receipts</p>
        <h1 className="text-3xl font-bold text-slate-900">Printable receipts</h1>
        <p className="mt-1 text-sm text-slate-600">Every recorded payment has a globally unique receipt number and an immutable allocation trail.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Receipt ledger</CardTitle>
          <CardDescription>View or download a receipt for any valid payment.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-3 py-3">Receipt</th>
                <th className="px-3 py-3">Payer</th>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Method</th>
                <th className="px-3 py-3">Amount</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...payments].reverse().map((payment) => {
                const payer = payment.student_id
                  ? studentNameById.get(payment.student_id)
                  : familyNameById.get(payment.family_id ?? "");
                return (
                  <tr key={payment.id} className="border-b border-slate-100">
                    <td className="px-3 py-3 font-medium text-slate-900">{payment.receipt_number}</td>
                    <td className="px-3 py-3">{payer ?? "Unknown payer"}</td>
                    <td className="px-3 py-3">{payment.payment_date}</td>
                    <td className="px-3 py-3">{payment.payment_method.replaceAll("_", " ")}</td>
                    <td className="px-3 py-3">{formatMoneyKobo(payment.amount_kobo)}</td>
                    <td className="px-3 py-3">
                      {payment.voided_at ? <Badge variant="warning">Reversed</Badge> : <Badge variant="success">Valid</Badge>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/receipts/${payment.id}`}>View</Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <a href={`/api/receipts/${payment.id}?format=csv`} download>
                            Download CSV
                          </a>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-500">No valid payment receipts yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
