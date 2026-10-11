import { saveFamily } from "@/app/actions/core-data";
import { ActionStateForm, FormField } from "@/components/finance/action-state-form";

type FamilyDefaults = {
  id?: string;
  family_name?: string;
  primary_contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  status?: string;
};

export function FamilyRecordForm({ family }: { family?: FamilyDefaults }) {
  return (
    <ActionStateForm action={saveFamily} submitLabel={family ? "Save family changes" : "Create family"}>
      <input type="hidden" name="familyId" value={family?.id ?? ""} />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Family name" name="familyName" defaultValue={family?.family_name ?? ""} required />
        <FormField label="Primary contact" name="primaryContactName" defaultValue={family?.primary_contact_name ?? ""} />
        <FormField label="Phone" name="phone" type="tel" defaultValue={family?.phone ?? ""} />
        <FormField label="Email" name="email" type="email" defaultValue={family?.email ?? ""} />
        <label className="block space-y-1.5 text-sm font-medium text-slate-700">
          <span>Status</span>
          <select name="status" defaultValue={family?.status ?? "active"} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </div>
      <label className="block space-y-1.5 text-sm font-medium text-slate-700">
        <span>Address</span>
        <textarea name="address" rows={2} defaultValue={family?.address ?? ""} className="w-full rounded-md border border-slate-200 bg-white px-3 py-2" />
      </label>
    </ActionStateForm>
  );
}
