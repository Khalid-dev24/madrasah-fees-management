import { saveStudent } from "@/app/actions/core-data";
import { ActionStateForm, FormField } from "@/components/finance/action-state-form";

type StudentDefaults = {
  id?: string;
  family_id?: string;
  class_id?: string | null;
  full_name?: string;
  gender?: string | null;
  date_of_birth?: string | null;
  parent_name?: string | null;
  parent_phone?: string | null;
  parent_email?: string | null;
  admission_date?: string;
  status?: string;
  payment_frequency?: string;
  notes?: string | null;
};

export function StudentRecordForm({
  student,
  families,
  classes,
}: {
  student?: StudentDefaults;
  families: Array<{ id: string; family_name: string }>;
  classes: Array<{ id: string; name: string; is_active: boolean }>;
}) {
  return (
    <ActionStateForm
      action={saveStudent}
      submitLabel={student ? "Save student changes" : "Create student"}
    >
      <input type="hidden" name="studentId" value={student?.id ?? ""} />
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Student full name" name="fullName" defaultValue={student?.full_name ?? ""} required />
        <label className="block space-y-1.5 text-sm font-medium text-slate-700">
          <span>Family (optional)</span>
          <select name="familyId" defaultValue={student?.family_id ?? ""} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3">
            <option value="">Individual student (no family)</option>
            {families.map((family) => <option key={family.id} value={family.id}>{family.family_name}</option>)}
          </select>
          <span className="block text-xs font-normal text-slate-500">Family discounts apply only to students linked to a qualifying family.</span>
        </label>
        <label className="block space-y-1.5 text-sm font-medium text-slate-700">
          <span>Class</span>
          <select name="classId" defaultValue={student?.class_id ?? ""} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3">
            <option value="">No class assigned</option>
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}{item.is_active ? "" : " (archived)"}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5 text-sm font-medium text-slate-700">
          <span>Gender (optional)</span>
          <select name="gender" defaultValue={student?.gender ?? ""} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3">
            <option value="">Not specified</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
        <FormField label="Date of birth (optional)" name="dateOfBirth" type="date" defaultValue={student?.date_of_birth ?? ""} />
        <FormField label="Admission date" name="admissionDate" type="date" defaultValue={student?.admission_date ?? ""} required />
        <FormField label="Parent / guardian name" name="parentName" defaultValue={student?.parent_name ?? ""} />
        <FormField label="Parent / guardian phone" name="parentPhone" type="tel" defaultValue={student?.parent_phone ?? ""} />
        <FormField label="Parent / guardian email" name="parentEmail" type="email" defaultValue={student?.parent_email ?? ""} />
        <label className="block space-y-1.5 text-sm font-medium text-slate-700">
          <span>Status</span>
          <select name="status" defaultValue={student?.status ?? "active"} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="graduated">Graduated</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
        </label>
        <label className="block space-y-1.5 text-sm font-medium text-slate-700">
          <span>Payment frequency</span>
          <select name="paymentFrequency" defaultValue={student?.payment_frequency ?? "monthly"} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3">
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
          <span className="block text-xs font-normal text-slate-500">This does not change the monthly fee ledger.</span>
        </label>
      </div>
      <label className="block space-y-1.5 text-sm font-medium text-slate-700">
        <span>Notes (optional)</span>
        <textarea name="notes" rows={3} defaultValue={student?.notes ?? ""} className="w-full rounded-md border border-slate-200 bg-white px-3 py-2" />
      </label>
    </ActionStateForm>
  );
}
