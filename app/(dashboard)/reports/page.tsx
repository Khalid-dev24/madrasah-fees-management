import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyKobo } from "@/lib/fees/money";
import { requireAuth } from "@/lib/auth/session";
import { getReportsPageData } from "@/server/financial-service";

type ReportsPageProps = {
  searchParams: Promise<{ quarter?: string; month?: string; student?: string }>;
};

const tableClass = "min-w-full text-left text-sm";
const cellClass = "border-b border-slate-100 px-3 py-2.5";

function EmptyRow({ columns, message }: { columns: number; message: string }) {
  return (
    <tr>
      <td colSpan={columns} className={`${cellClass} text-slate-500`}>{message}</td>
    </tr>
  );
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  await requireAuth();
  const params = await searchParams;
  const data = await getReportsPageData(params.quarter ?? null);
  const quarter = data.quarter;
  const monthsInQuarter = data.months.filter((month) => month.quarter_id === quarter?.id);
  const selectedMonth = monthsInQuarter.find((month) => month.id === params.month) ?? null;
  const selectedStudent = data.students.find((student) => student.id === params.student) ?? null;
  const monthIds = new Set(monthsInQuarter.map((month) => month.id));
  const quarterBalances = data.balances.filter((balance) => monthIds.has(balance.month_id));
  const periodStart = quarter?.start_date ?? "";
  const periodEnd = quarter?.end_date ?? "";
  const collectedInQuarter = data.payments
    .filter((payment) => !payment.voided_at && payment.payment_date >= periodStart && payment.payment_date <= periodEnd)
    .reduce((total, payment) => total + BigInt(payment.amount_kobo), 0n);
  const expectedInQuarter = quarterBalances.reduce(
    (total, balance) => total + BigInt(balance.expected_kobo),
    0n,
  );
  const netOutstandingInQuarter = data.familySummary.reduce(
    (total, family) => total + BigInt(String(family.outstanding_kobo ?? "0")),
    0n,
  );
  const discountInQuarter = data.familySummary.reduce(
    (total, family) => total + BigInt(String(family.discount_kobo ?? "0")),
    0n,
  );

  const monthlyCollections = monthsInQuarter.map((month) => {
    const monthPayments = data.payments.filter((payment) =>
      !payment.voided_at && payment.payment_date >= month.start_date && payment.payment_date <= month.end_date,
    );
    const monthBalances = data.balances.filter((balance) => balance.month_id === month.id);
    return {
      ...month,
      receipts: monthPayments.length,
      collected: monthPayments.reduce((total, payment) => total + BigInt(payment.amount_kobo), 0n),
      expected: monthBalances.reduce((total, balance) => total + BigInt(balance.expected_kobo), 0n),
      outstanding: monthBalances.reduce((total, balance) => total + BigInt(balance.outstanding_kobo), 0n),
    };
  });

  const outstandingByStudent = new Map<string, bigint>();
  for (const balance of data.balances) {
    if (selectedMonth && balance.month_id !== selectedMonth.id) continue;
    if (!selectedMonth && quarter && !monthIds.has(balance.month_id)) continue;
    const outstanding = BigInt(balance.outstanding_kobo);
    if (outstanding > 0n) {
      outstandingByStudent.set(
        balance.student_id,
        (outstandingByStudent.get(balance.student_id) ?? 0n) + outstanding,
      );
    }
  }
  const studentNameById = new Map(data.students.map((student) => [student.id, student.full_name]));
  const familyNameById = new Map(data.families.map((family) => [family.id, family.family_name]));
  const paymentById = new Map(data.payments.map((payment) => [payment.id, payment]));
  const familySummary = [...data.familySummary].sort((left, right) =>
    String(left.family_name).localeCompare(String(right.family_name)),
  );
  const studentObligations = selectedStudent
    ? data.balances.filter((balance) => balance.student_id === selectedStudent.id)
    : [];
  const studentObligationIds = new Set(studentObligations.map((balance) => balance.id));
  const studentAllocations = selectedStudent
    ? data.allocations.filter((allocation) => studentObligationIds.has(allocation.obligation_id))
    : [];
  const studentPaymentRows = studentAllocations
    .flatMap((allocation) => {
      const payment = paymentById.get(allocation.payment_id);
      return payment ? [{ allocation, payment }] : [];
    })
    .sort((left, right) => left.payment.payment_date.localeCompare(right.payment.payment_date));
  const monthNameById = new Map(data.months.map((month) => [month.id, month.month_name]));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-700">Reports</p>
        <h1 className="text-3xl font-bold text-slate-900">School reporting</h1>
        <p className="mt-1 text-sm text-slate-600">
          Live reports from the fee ledger, payments, allocations, and family discount summary.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report filters</CardTitle>
          <CardDescription>Select an academic quarter, month, or student statement.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/reports" className="grid gap-3 sm:grid-cols-3 sm:items-end">
            <label className="space-y-1.5 text-sm font-medium text-slate-700">
              <span>Quarter</span>
              <select name="quarter" defaultValue={quarter?.id ?? ""} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3">
                {data.quarters.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700">
              <span>Month for outstanding analysis</span>
              <select name="month" defaultValue={selectedMonth?.id ?? ""} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3">
                <option value="">Entire selected quarter</option>
                {monthsInQuarter.map((month) => (
                  <option key={month.id} value={month.id}>{month.month_name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700">
              <span>Student statement</span>
              <select name="student" defaultValue={selectedStudent?.id ?? ""} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3">
                <option value="">Select a student</option>
                {data.students.map((student) => (
                  <option key={student.id} value={student.id}>{student.full_name}</option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-3">
              <Button type="submit">Apply filters</Button>
              <Button asChild variant="outline"><Link href="/reports">Clear</Link></Button>
              <Button asChild variant="outline">
                <a href={`/api/reports/export${quarter ? `?quarter=${encodeURIComponent(quarter.id)}` : ""}${selectedStudent ? `${quarter ? "&" : "?"}student=${encodeURIComponent(selectedStudent.id)}` : ""}`} download>
                  Export CSV
                </a>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {!quarter ? (
        <Card><CardContent className="py-8 text-sm text-slate-600">No academic quarter is configured yet.</CardContent></Card>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Quarterly financial summary">
            {[
              { label: "Quarterly obligations", amount: expectedInQuarter, note: `${quarter.name}, before family discounts` },
              { label: "Cash received", amount: collectedInQuarter, note: "Valid payments dated in this quarter" },
              { label: "Family discounts", amount: discountInQuarter, note: "Discounts calculated for eligible families" },
              { label: "Net outstanding", amount: netOutstandingInQuarter, note: "Quarter balances after family discounts" },
            ].map((item) => (
              <Card key={item.label}>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{item.label}</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{formatMoneyKobo(item.amount)}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.note}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Monthly collection</CardTitle>
              <CardDescription>Cash receipts are counted by payment date; obligations and balances are counted by ledger month.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className={tableClass}>
                <thead><tr className="text-slate-500"><th className={cellClass}>Month</th><th className={cellClass}>Receipts</th><th className={cellClass}>Expected</th><th className={cellClass}>Collected</th><th className={cellClass}>Outstanding</th></tr></thead>
                <tbody>
                  {monthlyCollections.map((month) => (
                    <tr key={month.id}>
                      <td className={cellClass}>{month.month_name}</td>
                      <td className={cellClass}>{month.receipts}</td>
                      <td className={cellClass}>{formatMoneyKobo(month.expected)}</td>
                      <td className={cellClass}>{formatMoneyKobo(month.collected)}</td>
                      <td className={cellClass}>{formatMoneyKobo(month.outstanding)}</td>
                    </tr>
                  ))}
                  {monthlyCollections.length === 0 && <EmptyRow columns={5} message="No months are configured for this quarter." />}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quarterly family summary and discount impact</CardTitle>
              <CardDescription>Family discount is shown separately from the individual monthly obligation ledger.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className={tableClass}>
                <thead><tr className="text-slate-500"><th className={cellClass}>Family</th><th className={cellClass}>Eligible students</th><th className={cellClass}>Gross expected</th><th className={cellClass}>Discount</th><th className={cellClass}>Net expected</th><th className={cellClass}>Outstanding</th></tr></thead>
                <tbody>
                  {familySummary.map((family) => (
                    <tr key={String(family.family_id)}>
                      <td className={cellClass}>{String(family.family_name)}</td>
                      <td className={cellClass}>{Number(family.eligible_student_count ?? 0)}</td>
                      <td className={cellClass}>{formatMoneyKobo(String(family.expected_kobo ?? "0"))}</td>
                      <td className={cellClass}>{formatMoneyKobo(String(family.discount_kobo ?? "0"))}</td>
                      <td className={cellClass}>{formatMoneyKobo(String(family.net_expected_kobo ?? "0"))}</td>
                      <td className={cellClass}>{formatMoneyKobo(String(family.outstanding_kobo ?? "0"))}</td>
                    </tr>
                  ))}
                  {familySummary.length === 0 && <EmptyRow columns={6} message="No family summary data is available for this quarter." />}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Outstanding analysis</CardTitle>
              <CardDescription>
                {selectedMonth ? `Gross student ledger balances for ${selectedMonth.month_name}; family-level discounts are not assigned to individual students.` : `Gross student ledger balances for ${quarter.name}; family-level discounts are not assigned to individual students.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className={tableClass}>
                <thead><tr className="text-slate-500"><th className={cellClass}>Student</th><th className={cellClass}>Family</th><th className={cellClass}>Gross outstanding</th></tr></thead>
                <tbody>
                  {[...outstandingByStudent.entries()]
                    .sort((left, right) => left[1] === right[1] ? 0 : left[1] > right[1] ? -1 : 1)
                    .map(([studentId, amount]) => (
                      <tr key={studentId}>
                        <td className={cellClass}>{studentNameById.get(studentId) ?? "Unknown student"}</td>
                        <td className={cellClass}>{familyNameById.get(data.students.find((student) => student.id === studentId)?.family_id ?? "") ?? "—"}</td>
                        <td className={cellClass}>{formatMoneyKobo(amount)}</td>
                      </tr>
                    ))}
                  {outstandingByStudent.size === 0 && <EmptyRow columns={3} message="No outstanding balances for the selected period." />}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Student statement</CardTitle>
              <CardDescription>
                {selectedStudent ? `Monthly obligations and allocations for ${selectedStudent.full_name}.` : "Choose a student above to view their obligation statement."}
              </CardDescription>
            </CardHeader>
            {selectedStudent && (
              <CardContent className="overflow-x-auto">
                <table className={tableClass}>
                  <thead><tr className="text-slate-500"><th className={cellClass}>Ledger month</th><th className={cellClass}>Due date</th><th className={cellClass}>Expected</th><th className={cellClass}>Paid / credited</th><th className={cellClass}>Outstanding</th><th className={cellClass}>Status</th></tr></thead>
                  <tbody>
                    {studentObligations.map((balance) => (
                      <tr key={balance.id}>
                        <td className={cellClass}>{monthNameById.get(balance.month_id) ?? "—"}</td>
                        <td className={cellClass}>{balance.due_date}</td>
                        <td className={cellClass}>{formatMoneyKobo(balance.expected_kobo)}</td>
                        <td className={cellClass}>{formatMoneyKobo(balance.paid_kobo)}</td>
                        <td className={cellClass}>{formatMoneyKobo(balance.outstanding_kobo)}</td>
                        <td className={cellClass}><Badge variant={balance.status === "paid" ? "success" : balance.status === "partial" ? "warning" : "outline"}>{balance.status}</Badge></td>
                      </tr>
                    ))}
                    {studentObligations.length === 0 && <EmptyRow columns={6} message="No monthly obligations have been generated for this student." />}
                  </tbody>
                </table>
                <h3 className="mb-2 mt-6 font-semibold text-slate-900">Payment allocations</h3>
                <table className={tableClass}>
                  <thead><tr className="text-slate-500"><th className={cellClass}>Payment date</th><th className={cellClass}>Receipt</th><th className={cellClass}>Ledger month</th><th className={cellClass}>Allocated amount</th></tr></thead>
                  <tbody>
                    {studentPaymentRows.map(({ allocation, payment }) => (
                      <tr key={allocation.id}>
                        <td className={cellClass}>{payment.payment_date}</td>
                        <td className={cellClass}>{payment.receipt_number}</td>
                        <td className={cellClass}>{monthNameById.get(data.balances.find((balance) => balance.id === allocation.obligation_id)?.month_id ?? "") ?? "—"}</td>
                        <td className={cellClass}>{formatMoneyKobo(allocation.allocated_kobo)}</td>
                      </tr>
                    ))}
                    {studentPaymentRows.length === 0 && <EmptyRow columns={4} message="No payment allocations are recorded for this student." />}
                  </tbody>
                </table>
              </CardContent>
            )}
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Payment history</CardTitle>
          <CardDescription>Payments are listed by payment date. Reversed payments remain visible and are marked as void.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className={tableClass}>
            <thead><tr className="text-slate-500"><th className={cellClass}>Date</th><th className={cellClass}>Receipt</th><th className={cellClass}>Payer</th><th className={cellClass}>Method</th><th className={cellClass}>Reference</th><th className={cellClass}>Amount</th><th className={cellClass}>Status</th></tr></thead>
            <tbody>
              {[...data.payments].reverse().map((payment) => {
                const payer = payment.student_id
                  ? studentNameById.get(payment.student_id)
                  : familyNameById.get(payment.family_id ?? "");
                return (
                  <tr key={payment.id}>
                    <td className={cellClass}>{payment.payment_date}</td>
                    <td className={cellClass}>{payment.receipt_number}</td>
                    <td className={cellClass}>{payer ?? "Unknown payer"}</td>
                    <td className={cellClass}>{payment.payment_method.replaceAll("_", " ")}</td>
                    <td className={cellClass}>{payment.reference ?? "—"}</td>
                    <td className={cellClass}>{formatMoneyKobo(payment.amount_kobo)}</td>
                    <td className={cellClass}>
                      {payment.voided_at ? <Badge variant="warning">Reversed</Badge> : <Badge variant="success">Valid</Badge>}
                    </td>
                  </tr>
                );
              })}
              {data.payments.length === 0 && <EmptyRow columns={7} message="No payments have been recorded." />}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
