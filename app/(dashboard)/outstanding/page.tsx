import { generateObligationsAction } from "@/app/actions/financial";
import { ActionStateForm } from "@/components/finance/action-state-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyKobo } from "@/lib/fees/money";
import { requireAuth } from "@/lib/auth/session";
import { getFinancePageData } from "@/server/financial-service";

export default async function OutstandingPage() {
  const session = await requireAuth();
  const financeData = await getFinancePageData();
  const studentById = new Map(financeData.students.map((student) => [student.id, student]));
  const familyById = new Map(financeData.families.map((family) => [family.id, family]));
  const classById = new Map(financeData.classes.map((classItem) => [classItem.id, classItem.name]));
  const monthById = new Map(financeData.months.map((month) => [month.id, month.month_name]));
  const totalOutstanding = financeData.outstanding.reduce(
    (total, obligation) => total + BigInt(obligation.outstanding_kobo),
    0n,
  );
  const oldestDue = financeData.outstanding[0]?.due_date;
  const overdueCount = financeData.outstanding.filter(
    (obligation) => obligation.due_date < new Date().toISOString().slice(0, 10),
  ).length;
  const currentQuarter = financeData.quarters.find((quarter) => quarter.is_current);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-700">Outstanding</p>
        <h1 className="text-3xl font-bold text-slate-900">Fee arrears</h1>
        <p className="mt-1 text-sm text-slate-600">Balances derive from the monthly ledger, valid payments, and applied credits.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Total outstanding</p>
            <p className="mt-2 text-2xl font-bold">{formatMoneyKobo(totalOutstanding)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Unpaid obligations</p>
            <p className="mt-2 text-2xl font-bold">{financeData.outstanding.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Overdue obligations</p>
            <p className="mt-2 text-2xl font-bold">{overdueCount}</p>
            <p className="mt-1 text-xs text-slate-500">Oldest due: {oldestDue ?? "—"}</p>
          </CardContent>
        </Card>
      </div>

      {session.role !== "viewer" && (
        <Card>
          <CardHeader>
            <CardTitle>Generate monthly obligations</CardTitle>
            <CardDescription>
              Generates one monthly obligation per active student/month. Existing ledger rows are never rewritten.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActionStateForm action={generateObligationsAction} submitLabel="Generate obligations">
              <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                <span>Quarter</span>
                <select name="quarterId" required defaultValue={currentQuarter?.id ?? ""} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3">
                  <option value="">Select quarter</option>
                  {financeData.quarters.map((quarter) => (
                    <option key={quarter.id} value={quarter.id}>
                      {quarter.name} · {quarter.start_date}–{quarter.end_date}
                    </option>
                  ))}
                </select>
              </label>
            </ActionStateForm>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Unpaid monthly obligations</CardTitle>
          <CardDescription>Older arrears remain listed when new months are generated.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-3 py-3">Student</th>
                <th className="px-3 py-3">Family</th>
                <th className="px-3 py-3">Class</th>
                <th className="px-3 py-3">Month</th>
                <th className="px-3 py-3">Due date</th>
                <th className="px-3 py-3">Expected</th>
                <th className="px-3 py-3">Paid</th>
                <th className="px-3 py-3">Outstanding</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {financeData.outstanding.map((obligation) => {
                const student = studentById.get(obligation.student_id);
                const overdue = obligation.due_date < new Date().toISOString().slice(0, 10);
                return (
                  <tr key={obligation.id} className="border-b border-slate-100">
                    <td className="px-3 py-3 font-medium text-slate-900">{student?.full_name ?? "Unknown student"}</td>
                    <td className="px-3 py-3">{familyById.get(obligation.family_id)?.family_name ?? "—"}</td>
                    <td className="px-3 py-3">{student?.class_id ? classById.get(student.class_id) ?? "—" : "—"}</td>
                    <td className="px-3 py-3">{monthById.get(obligation.month_id) ?? "—"}</td>
                    <td className="px-3 py-3">{obligation.due_date}</td>
                    <td className="px-3 py-3">{formatMoneyKobo(obligation.expected_kobo)}</td>
                    <td className="px-3 py-3">{formatMoneyKobo(obligation.paid_kobo)}</td>
                    <td className="px-3 py-3 font-semibold">{formatMoneyKobo(obligation.outstanding_kobo)}</td>
                    <td className="px-3 py-3">
                      <Badge variant={overdue ? "warning" : "outline"}>{overdue ? "Overdue" : "Due"}</Badge>
                    </td>
                  </tr>
                );
              })}
              {financeData.outstanding.length === 0 && (
                <tr><td className="px-3 py-6 text-center text-slate-500" colSpan={9}>No outstanding monthly obligations.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
