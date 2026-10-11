import { applyCreditAction, recordFamilyPaymentAction, recordStudentPaymentAction, reversePaymentAction } from "@/app/actions/financial";
import { ActionStateForm, FormField } from "@/components/finance/action-state-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyKobo } from "@/lib/fees/money";
import { requireAuth } from "@/lib/auth/session";
import { getFinancePageData } from "@/server/financial-service";

const paymentDate = new Date().toISOString().slice(0, 10);

export default async function PaymentsPage() {
  await requireAuth();
  const { payments, students, families, credits } = await getFinancePageData();
  const studentNames = new Map(students.map((student) => [student.id, student.full_name]));
  const familyNames = new Map(families.map((family) => [family.id, family.family_name]));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-700">Payments</p>
        <h1 className="text-3xl font-bold text-slate-900">Payment ledger</h1>
        <p className="mt-1 text-sm text-slate-600">Payments and allocations are written atomically by PostgreSQL.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Record student payment</CardTitle>
            <CardDescription>Allocates oldest-due obligations first; excess becomes student credit.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionStateForm action={recordStudentPaymentAction} submitLabel="Record student payment">
              <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                <span>Student</span>
                <select name="studentId" required className="h-10 w-full rounded-md border border-slate-200 bg-white px-3">
                  <option value="">Select student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>{student.full_name}</option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Amount (₦)" name="amountNaira" type="number" min="0.01" step="0.01" required />
                <FormField label="Payment date" name="paymentDate" type="date" defaultValue={paymentDate} required />
              </div>
              <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                <span>Payment method</span>
                <select name="paymentMethod" required className="h-10 w-full rounded-md border border-slate-200 bg-white px-3">
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="cash">Cash</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <FormField label="Reference (optional)" name="reference" />
              <FormField label="Notes (optional)" name="notes" />
            </ActionStateForm>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Record family payment</CardTitle>
            <CardDescription>Each family form explicitly limits allocation to the selected children.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {families.map((family) => {
              const children = students.filter((student) => student.family_id === family.id);
              if (children.length === 0) {
                return null;
              }
              return (
                <details key={family.id} className="rounded-xl border border-slate-200 p-4">
                  <summary className="cursor-pointer font-medium text-slate-900">
                    {family.family_name} ({children.length} children)
                  </summary>
                  <div className="mt-4">
                    <ActionStateForm action={recordFamilyPaymentAction} submitLabel="Record family payment">
                      <input type="hidden" name="familyId" value={family.id} />
                      <fieldset className="space-y-2">
                        <legend className="text-sm font-medium text-slate-700">Children covered by this payment</legend>
                        {children.map((student) => (
                          <label key={student.id} className="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" name="studentIds" value={student.id} />
                            {student.full_name}
                          </label>
                        ))}
                      </fieldset>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <FormField label="Amount (₦)" name="amountNaira" type="number" min="0.01" step="0.01" required />
                        <FormField label="Payment date" name="paymentDate" type="date" defaultValue={paymentDate} required />
                      </div>
                      <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                        <span>Payment method</span>
                        <select name="paymentMethod" required className="h-10 w-full rounded-md border border-slate-200 bg-white px-3">
                          <option value="bank_transfer">Bank transfer</option>
                          <option value="cash">Cash</option>
                          <option value="other">Other</option>
                        </select>
                      </label>
                      <FormField label="Reference (optional)" name="reference" />
                      <FormField label="Notes (optional)" name="notes" />
                    </ActionStateForm>
                  </div>
                </details>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {credits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Available credits</CardTitle>
            <CardDescription>Family credits require explicitly choosing a child; student credits remain with that student.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {credits.map((credit) => {
              const permittedStudents = credit.student_id
                ? students.filter((student) => student.id === credit.student_id)
                : students.filter((student) => student.family_id === credit.family_id);
              const ownerLabel = credit.student_id
                ? studentNames.get(credit.student_id)
                : familyNames.get(credit.family_id ?? "");
              return (
                <details key={credit.id} className="rounded-xl border border-slate-200 p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <span className="font-medium text-slate-900">{ownerLabel ?? "Unknown owner"}</span>
                    <Badge variant="warning">{formatMoneyKobo(credit.remaining_kobo)} remaining</Badge>
                  </summary>
                  <div className="mt-4">
                    <ActionStateForm action={applyCreditAction} submitLabel="Apply credit oldest-first">
                      <input type="hidden" name="creditId" value={credit.id} />
                      <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                        <span>Apply to student</span>
                        <select name="studentId" required className="h-10 w-full rounded-md border border-slate-200 bg-white px-3">
                          <option value="">Select student</option>
                          {permittedStudents.map((student) => (
                            <option key={student.id} value={student.id}>{student.full_name}</option>
                          ))}
                        </select>
                      </label>
                    </ActionStateForm>
                  </div>
                </details>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recorded payments</CardTitle>
          <CardDescription>Payment history is immutable; reversal preserves the payment and its allocations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {payments.length === 0 && <p className="text-sm text-slate-500">No payments recorded yet.</p>}
          {payments.map((payment) => {
            const payer = payment.student_id
              ? studentNames.get(payment.student_id)
              : familyNames.get(payment.family_id ?? "");
            return (
              <div key={payment.id} className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-medium text-slate-900">{payer ?? "Unknown payer"}</div>
                  <div className="text-sm text-slate-500">
                    {payment.payment_date} · {payment.payment_method.replace("_", " ")} · Receipt {payment.receipt_number}
                  </div>
                  {payment.reference && <div className="text-xs text-slate-500">Reference: {payment.reference}</div>}
                </div>
                <div className="flex items-center gap-4">
                  <strong>{formatMoneyKobo(payment.amount_kobo)}</strong>
                  {payment.voided_at ? (
                    <Badge variant="warning">Reversed</Badge>
                  ) : (
                    <details>
                      <summary className="cursor-pointer text-sm font-medium text-red-700">Reverse</summary>
                      <div className="mt-3 min-w-64 rounded-lg border border-red-100 bg-red-50 p-3">
                        <ActionStateForm action={reversePaymentAction} submitLabel="Confirm reversal">
                          <input type="hidden" name="paymentId" value={payment.id} />
                          <FormField label="Reason" name="reason" required />
                        </ActionStateForm>
                      </div>
                    </details>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
