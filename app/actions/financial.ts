"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  applyCreditToStudent as applyCredit,
  generateQuarterObligations,
  recordFamilyPayment,
  recordStudentPayment,
  reversePayment as voidPayment,
  setStudentFeeAdjustment,
} from "@/server/financial-service";
import { parseNairaToKobo } from "@/lib/fees/money";
import { requireFinanceUser } from "@/lib/auth/session";

export type FinancialActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const uuidSchema = z.string().uuid();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function readText(data: FormData, key: string): string {
  return String(data.get(key) ?? "").trim();
}

function readPaymentMethod(value: string) {
  return z.enum(["bank_transfer", "cash", "other"]).safeParse(value);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The financial operation failed.";
}

function refreshFinanceViews() {
  revalidatePath("/dashboard");
  revalidatePath("/payments");
  revalidatePath("/outstanding");
  revalidatePath("/families");
  revalidatePath("/students");
}

export async function generateObligationsAction(
  _previousState: FinancialActionState,
  data: FormData,
): Promise<FinancialActionState> {
  const actor = await requireFinanceUser();
  const quarterId = uuidSchema.safeParse(readText(data, "quarterId"));
  if (!quarterId.success) {
    return { status: "error", message: "Select a valid quarter." };
  }

  try {
    const result = await generateQuarterObligations(quarterId.data, actor.email, actor.id);
    refreshFinanceViews();
    return {
      status: "success",
      message: `Monthly obligations generated. New records: ${String(result.inserted_count ?? 0)}.`,
    };
  } catch (error) {
    return { status: "error", message: getErrorMessage(error) };
  }
}

export async function setStudentFeeAction(
  _previousState: FinancialActionState,
  data: FormData,
): Promise<FinancialActionState> {
  const actor = await requireFinanceUser();
  const studentId = uuidSchema.safeParse(readText(data, "studentId"));
  const effectiveFrom = dateSchema.safeParse(readText(data, "effectiveFrom"));
  const effectiveToText = readText(data, "effectiveTo");
  const effectiveTo = effectiveToText ? dateSchema.safeParse(effectiveToText) : null;
  let feeKobo: bigint;

  try {
    feeKobo = parseNairaToKobo(readText(data, "monthlyFee"));
  } catch (error) {
    return { status: "error", message: getErrorMessage(error) };
  }

  if (
    !studentId.success ||
    !effectiveFrom.success ||
    (effectiveTo && !effectiveTo.success) ||
    feeKobo <= 0n
  ) {
    return { status: "error", message: "Enter a student, positive fee, and valid effective dates." };
  }

  try {
    await setStudentFeeAdjustment({
      studentId: studentId.data,
      feeKobo: feeKobo.toString(),
      effectiveFrom: effectiveFrom.data,
      effectiveTo: effectiveTo?.success ? effectiveTo.data : null,
      reason: readText(data, "reason"),
      notes: readText(data, "notes"),
      actorEmail: actor.email,
      actorId: actor.id,
    });
    refreshFinanceViews();
    return { status: "success", message: "Fee adjustment saved; existing obligations were not changed." };
  } catch (error) {
    return { status: "error", message: getErrorMessage(error) };
  }
}

export async function recordStudentPaymentAction(
  _previousState: FinancialActionState,
  data: FormData,
): Promise<FinancialActionState> {
  const actor = await requireFinanceUser();
  const studentId = uuidSchema.safeParse(readText(data, "studentId"));
  const paymentDate = dateSchema.safeParse(readText(data, "paymentDate"));
  const paymentMethod = readPaymentMethod(readText(data, "paymentMethod"));
  let amountKobo: bigint;

  try {
    amountKobo = parseNairaToKobo(readText(data, "amountNaira"));
  } catch (error) {
    return { status: "error", message: getErrorMessage(error) };
  }

  if (!studentId.success || !paymentDate.success || !paymentMethod.success || amountKobo <= 0n) {
    return { status: "error", message: "Enter a valid student, positive amount, date, and payment method." };
  }

  try {
    const result = await recordStudentPayment({
      studentId: studentId.data,
      amountKobo: amountKobo.toString(),
      paymentDate: paymentDate.data,
      paymentMethod: paymentMethod.data,
      reference: readText(data, "reference"),
      notes: readText(data, "notes"),
      actorEmail: actor.email,
      actorId: actor.id,
    });
    refreshFinanceViews();
    return { status: "success", message: `Payment recorded. Receipt ${String(result.receipt_number)}.` };
  } catch (error) {
    return { status: "error", message: getErrorMessage(error) };
  }
}

export async function recordFamilyPaymentAction(
  _previousState: FinancialActionState,
  data: FormData,
): Promise<FinancialActionState> {
  const actor = await requireFinanceUser();
  const familyId = uuidSchema.safeParse(readText(data, "familyId"));
  const studentIds = data.getAll("studentIds").map((value) => String(value));
  const students = z.array(uuidSchema).min(1).safeParse(studentIds);
  const paymentDate = dateSchema.safeParse(readText(data, "paymentDate"));
  const paymentMethod = readPaymentMethod(readText(data, "paymentMethod"));
  let amountKobo: bigint;

  try {
    amountKobo = parseNairaToKobo(readText(data, "amountNaira"));
  } catch (error) {
    return { status: "error", message: getErrorMessage(error) };
  }

  if (
    !familyId.success ||
    !students.success ||
    !paymentDate.success ||
    !paymentMethod.success ||
    amountKobo <= 0n
  ) {
    return { status: "error", message: "Select at least one child and enter valid payment details." };
  }

  try {
    const result = await recordFamilyPayment({
      familyId: familyId.data,
      studentIds: students.data,
      amountKobo: amountKobo.toString(),
      paymentDate: paymentDate.data,
      paymentMethod: paymentMethod.data,
      reference: readText(data, "reference"),
      notes: readText(data, "notes"),
      actorEmail: actor.email,
      actorId: actor.id,
    });
    refreshFinanceViews();
    return { status: "success", message: `Family payment recorded. Receipt ${String(result.receipt_number)}.` };
  } catch (error) {
    return { status: "error", message: getErrorMessage(error) };
  }
}

export async function applyCreditAction(
  _previousState: FinancialActionState,
  data: FormData,
): Promise<FinancialActionState> {
  const actor = await requireFinanceUser();
  const creditId = uuidSchema.safeParse(readText(data, "creditId"));
  const studentId = uuidSchema.safeParse(readText(data, "studentId"));
  if (!creditId.success || !studentId.success) {
    return { status: "error", message: "Select a valid credit and student." };
  }

  try {
    const result = await applyCredit(creditId.data, studentId.data, actor.email, actor.id);
    refreshFinanceViews();
    return {
      status: "success",
      message: `Credit applied. Remaining credit: ${String(result.remaining_kobo ?? 0)} kobo.`,
    };
  } catch (error) {
    return { status: "error", message: getErrorMessage(error) };
  }
}

export async function reversePaymentAction(
  _previousState: FinancialActionState,
  data: FormData,
): Promise<FinancialActionState> {
  const actor = await requireFinanceUser();
  const paymentId = uuidSchema.safeParse(readText(data, "paymentId"));
  const reason = readText(data, "reason");
  if (!paymentId.success || reason.length < 3) {
    return { status: "error", message: "Select a payment and provide a reversal reason." };
  }

  try {
    await voidPayment(paymentId.data, reason, actor.email, actor.id);
    refreshFinanceViews();
    return { status: "success", message: "Payment reversed; the original record and allocations were preserved." };
  } catch (error) {
    return { status: "error", message: getErrorMessage(error) };
  }
}
