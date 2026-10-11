"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";

import type { FinancialActionState } from "@/app/actions/financial";
import { Button } from "@/components/ui/button";

type FinancialAction = (
  state: FinancialActionState,
  formData: FormData,
) => Promise<FinancialActionState>;

export function ActionStateForm({
  action,
  children,
  submitLabel,
}: {
  action: FinancialAction;
  children: ReactNode;
  submitLabel: string;
}) {
  const initialState: FinancialActionState = {
    status: "idle",
    message: "",
  };
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {children}
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={
            state.status === "error"
              ? "text-sm font-medium text-red-700"
              : "text-sm font-medium text-emerald-800"
          }
        >
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Processing..." : submitLabel}
      </Button>
    </form>
  );
}

export function FormField({
  label,
  name,
  type = "text",
  defaultValue,
  required = false,
  min,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  min?: string;
  step?: string;
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        min={min}
        step={step}
        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
      />
    </label>
  );
}
