import {
  createClass,
  saveFeeSettings,
  saveInstitutionSettings,
  saveQuarterDueDates,
  setClassActive,
  updateUserRole,
} from "@/app/actions/core-data";
import { setStudentFeeAction } from "@/app/actions/financial";
import { ActionStateForm, FormField } from "@/components/finance/action-state-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyKobo, koboToNairaInput } from "@/lib/fees/money";
import { requireAuth } from "@/lib/auth/session";
import { getSettingsPageData } from "@/server/core-data";

export default async function SettingsPage() {
  const session = await requireAuth();
  const data = await getSettingsPageData();
  const { feeSettings, classes, students, discountRule, institutionSettings, dueDates, users, auditLogs } = data;
  const canManageFinancialRecords = session.role === "admin" || session.role === "accountant";
  const isAdmin = session.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-700">Settings</p>
        <h1 className="text-3xl font-bold text-slate-900">Administration & configuration</h1>
        <p className="mt-1 text-sm text-slate-600">Institution details, due dates, roles, and audit history are managed here.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Institution settings</CardTitle>
              <CardDescription>Update the school details that appear on receipts and institutional communications.</CardDescription>
            </CardHeader>
            <CardContent>
              <ActionStateForm action={saveInstitutionSettings} submitLabel="Save institution settings">
                <div className="grid gap-4">
                  <FormField label="Institution name" name="institutionName" defaultValue={institutionSettings.name} required />
                  <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                    <span>Address</span>
                    <textarea
                      name="institutionAddress"
                      defaultValue={institutionSettings.address}
                      required
                      className="min-h-[90px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Phone" name="institutionPhone" defaultValue={institutionSettings.phone} />
                    <FormField label="Email" name="institutionEmail" type="email" defaultValue={institutionSettings.email} />
                  </div>
                </div>
              </ActionStateForm>
            </CardContent>
          </Card>
        )}

        {canManageFinancialRecords && (
          <Card>
            <CardHeader>
              <CardTitle>Student fee adjustment</CardTitle>
              <CardDescription>
                Applies a student-specific monthly fee to future obligations in the selected date range. Existing obligations are unchanged.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActionStateForm action={setStudentFeeAction} submitLabel="Save fee adjustment">
                <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                  <span>Student</span>
                  <select name="studentId" required className="h-10 w-full rounded-md border border-slate-200 bg-white px-3">
                    <option value="">Select student</option>
                    {students.map((student) => <option key={student.id} value={student.id}>{student.full_name}</option>)}
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <FormField label="Monthly fee (₦)" name="monthlyFee" type="number" min="0.01" step="0.01" required />
                  <FormField label="Effective from" name="effectiveFrom" type="date" required />
                  <FormField label="Effective to (optional)" name="effectiveTo" type="date" />
                </div>
                <FormField label="Reason" name="reason" />
                <FormField label="Notes (optional)" name="notes" />
              </ActionStateForm>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Standard fee settings</CardTitle>
            <CardDescription>Amounts are entered in naira and stored exactly as integer kobo. Prior configurations are retained.</CardDescription>
          </CardHeader>
          <CardContent>
            {session.role === "admin" ? (
              <ActionStateForm action={saveFeeSettings} submitLabel="Save fee settings">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Monthly fee (₦)" name="monthlyNaira" type="number" min="0.01" step="0.01" defaultValue={koboToNairaInput(feeSettings.monthly_kobo)} required />
                  <FormField label="Quarterly summary (₦)" name="quarterlyNaira" type="number" min="0.01" step="0.01" defaultValue={koboToNairaInput(feeSettings.quarterly_kobo)} required />
                  <FormField label="Term summary (₦)" name="termNaira" type="number" min="0.01" step="0.01" defaultValue={koboToNairaInput(feeSettings.term_kobo)} required />
                  <FormField label="Annual summary (₦)" name="annualNaira" type="number" min="0.01" step="0.01" defaultValue={koboToNairaInput(feeSettings.annual_kobo)} required />
                </div>
              </ActionStateForm>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Monthly", feeSettings.monthly_kobo],
                  ["Quarterly", feeSettings.quarterly_kobo],
                  ["Term", feeSettings.term_kobo],
                  ["Annual", feeSettings.annual_kobo],
                ].map(([label, amount]) => (
                  <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">{label}</p>
                    <p className="mt-2 text-xl font-bold">{formatMoneyKobo(String(amount))}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Quarter due dates</CardTitle>
              <CardDescription>Configure the current academic year’s due dates by quarter. Historical due dates remain preserved in the quarter records.</CardDescription>
            </CardHeader>
            <CardContent>
              <ActionStateForm action={saveQuarterDueDates} submitLabel="Save due dates">
                <div className="grid gap-4 sm:grid-cols-2">
                  {(["Q1", "Q2", "Q3", "Q4"] as const).map((quarter) => (
                    <label key={quarter} className="block space-y-1.5 text-sm font-medium text-slate-700">
                      <span>{quarter}</span>
                      <input
                        name={`quarter-${quarter}`}
                        type="date"
                        defaultValue={dueDates[quarter] ?? ""}
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                      />
                    </label>
                  ))}
                </div>
              </ActionStateForm>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Classes</CardTitle>
            <CardDescription>Classes currently stored in the database. Archive rather than delete classes that may have student history.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {session.role === "admin" && (
              <ActionStateForm action={createClass} submitLabel="Add class">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Class name" name="name" required />
                  <FormField label="Level (optional)" name="level" />
                </div>
              </ActionStateForm>
            )}
            <div className="space-y-2">
              {classes.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div>
                    <div className="font-medium text-slate-900">{item.name}</div>
                    <div className="text-sm text-slate-500">{item.level ?? "No level set"}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={item.is_active ? "success" : "warning"}>{item.is_active ? "Active" : "Archived"}</Badge>
                    {session.role === "admin" && (
                      <ActionStateForm action={setClassActive} submitLabel={item.is_active ? "Archive" : "Restore"}>
                        <input type="hidden" name="classId" value={item.id} />
                        <input type="hidden" name="isActive" value={item.is_active ? "false" : "true"} />
                      </ActionStateForm>
                    )}
                  </div>
                </div>
              ))}
              {classes.length === 0 && <p className="text-sm text-slate-500">No classes have been created.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Family discount rule</CardTitle>
            <CardDescription>Discounts remain family-level adjustments and never alter monthly student obligations.</CardDescription>
          </CardHeader>
          <CardContent>
            {discountRule ? (
              <div className="space-y-2 text-sm text-slate-700">
                <p>Minimum eligible family size: <strong>{discountRule.minimum_family_size}</strong></p>
                <p>Discount per eligible student per quarter: <strong>{formatMoneyKobo(discountRule.discount_per_eligible_student_kobo)}</strong></p>
                <p className="text-slate-500">Effective from {discountRule.valid_from.slice(0, 10)}{discountRule.valid_to ? ` to ${discountRule.valid_to.slice(0, 10)}` : ""}.</p>
              </div>
            ) : (
              <p className="text-sm text-amber-800">No active discount rule is configured.</p>
            )}
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>User access & roles</CardTitle>
              <CardDescription>Only admins may change user roles. Accountant accounts remain restricted from sensitive settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {users.map((user) => (
                <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div>
                    <p className="font-medium text-slate-900">{user.full_name}</p>
                    <p className="text-sm text-slate-500">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={user.role === "admin" ? "success" : user.role === "accountant" ? "warning" : "secondary"}>{user.role}</Badge>
                    <ActionStateForm action={updateUserRole} submitLabel="Update role">
                      <input type="hidden" name="userId" value={user.id} />
                      <select name="role" defaultValue={user.role} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                        <option value="admin">admin</option>
                        <option value="accountant">accountant</option>
                        <option value="viewer">viewer</option>
                      </select>
                    </ActionStateForm>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Audit log</CardTitle>
            <CardDescription>Recent administrative and financial actions recorded by the system.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {auditLogs.length === 0 ? (
              <p className="text-sm text-slate-500">No recent audit entries.</p>
            ) : (
              auditLogs.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">{entry.action}</p>
                    <span className="text-xs text-slate-500">{new Date(entry.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-slate-600">Actor: {entry.actor?.full_name ?? "System"}</p>
                  <p className="text-xs text-slate-500">Entity: {entry.entity_type}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
