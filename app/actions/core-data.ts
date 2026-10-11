"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { FinancialActionState } from "@/app/actions/financial";
import { requireAuth } from "@/lib/auth/session";
import { parseNairaToKobo } from "@/lib/fees/money";
import {
  createClass as createClassRecord,
  saveCurrentQuarterDueDates as saveQuarterDueDatesRecord,
  saveFamily as saveFamilyRecord,
  saveFeeSettings as saveFeeSettingsRecord,
  saveInstitutionSettings as saveInstitutionSettingsRecord,
  saveStudent as saveStudentRecord,
  setClassActive as setClassActiveRecord,
  setUserRole as setUserRoleRecord,
} from "@/server/core-data";

const uuidSchema = z.string().uuid();
const optionalUuidSchema = z.union([z.literal(""), z.string().uuid()]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const studentStatusSchema = z.enum(["active", "inactive", "graduated", "withdrawn"]);
const paymentFrequencySchema = z.enum(["monthly", "quarterly"]);
const familyStatusSchema = z.enum(["active", "inactive", "archived"]);

function text(data: FormData, key: string): string {
  return String(data.get(key) ?? "").trim();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to save these records.";
}

async function requireAdminActor() {
  const actor = await requireAuth();
  if (actor.role !== "admin") {
    throw new Error("Administrator access is required to manage core records and settings.");
  }
  return actor;
}

function revalidateCoreData() {
  for (const path of ["/dashboard", "/students", "/families", "/payments", "/outstanding", "/reports", "/settings"]) {
    revalidatePath(path);
  }
}

export async function saveFeeSettings(
  _previous: FinancialActionState,
  data: FormData,
): Promise<FinancialActionState> {
  const actor = await requireAdminActor();
  let monthly: bigint;
  let quarterly: bigint;
  let term: bigint;
  let annual: bigint;
  try {
    monthly = parseNairaToKobo(text(data, "monthlyNaira"));
    quarterly = parseNairaToKobo(text(data, "quarterlyNaira"));
    term = parseNairaToKobo(text(data, "termNaira"));
    annual = parseNairaToKobo(text(data, "annualNaira"));
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  if ([monthly, quarterly, term, annual].some((amount) => amount <= 0n)) {
    return { status: "error", message: "All fee amounts must be greater than zero." };
  }
  try {
    await saveFeeSettingsRecord({
      monthlyKobo: monthly.toString(),
      quarterlyKobo: quarterly.toString(),
      termKobo: term.toString(),
      annualKobo: annual.toString(),
      actorId: actor.id,
      actorEmail: actor.email,
    });
    revalidateCoreData();
    return { status: "success", message: "Fee settings saved." };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
}

export async function createClass(
  _previous: FinancialActionState,
  data: FormData,
): Promise<FinancialActionState> {
  const actor = await requireAdminActor();
  const name = text(data, "name");
  const level = text(data, "level");
  if (!name) return { status: "error", message: "Enter a class name." };
  try {
    await createClassRecord({ name, level, actorId: actor.id, actorEmail: actor.email });
    revalidateCoreData();
    return { status: "success", message: "Class created." };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
}

export async function setClassActive(
  _previous: FinancialActionState,
  data: FormData,
): Promise<FinancialActionState> {
  const actor = await requireAdminActor();
  const classId = uuidSchema.safeParse(text(data, "classId"));
  const isActive = z.enum(["true", "false"]).safeParse(text(data, "isActive"));
  if (!classId.success || !isActive.success) {
    return { status: "error", message: "Select a valid class and status." };
  }
  try {
    await setClassActiveRecord({
      classId: classId.data,
      isActive: isActive.data === "true",
      actorId: actor.id,
      actorEmail: actor.email,
    });
    revalidateCoreData();
    return { status: "success", message: "Class status updated." };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
}

export async function saveInstitutionSettings(
  _previous: FinancialActionState,
  data: FormData,
): Promise<FinancialActionState> {
  const actor = await requireAdminActor();
  const name = text(data, "institutionName");
  const address = text(data, "institutionAddress");
  const phone = text(data, "institutionPhone");
  const email = text(data, "institutionEmail");

  if (!name || !address) {
    return { status: "error", message: "Institution name and address are required." };
  }

  try {
    await saveInstitutionSettingsRecord({
      name,
      address,
      phone,
      email,
      actorId: actor.id,
      actorEmail: actor.email,
    });
    revalidateCoreData();
    return { status: "success", message: "Institution settings saved." };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
}

export async function saveQuarterDueDates(
  _previous: FinancialActionState,
  data: FormData,
): Promise<FinancialActionState> {
  const actor = await requireAdminActor();
  const payload: Record<string, string> = {};
  for (const quarter of ["Q1", "Q2", "Q3", "Q4"]) {
    const value = text(data, `quarter-${quarter}`);
    if (value) {
      payload[quarter] = value;
    }
  }

  if (Object.keys(payload).length === 0) {
    return { status: "error", message: "Provide at least one quarter due date." };
  }

  try {
    await saveQuarterDueDatesRecord({
      dueDates: payload,
      actorId: actor.id,
      actorEmail: actor.email,
    });
    revalidateCoreData();
    return { status: "success", message: "Quarter due dates updated." };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
}

export async function updateUserRole(
  _previous: FinancialActionState,
  data: FormData,
): Promise<FinancialActionState> {
  const actor = await requireAdminActor();
  const userId = uuidSchema.safeParse(text(data, "userId"));
  const role = z.enum(["admin", "accountant", "viewer"]).safeParse(text(data, "role"));

  if (!userId.success || !role.success) {
    return { status: "error", message: "Select a valid user and role." };
  }

  try {
    await setUserRoleRecord({
      userId: userId.data,
      role: role.data,
      actorId: actor.id,
      actorEmail: actor.email,
    });
    revalidateCoreData();
    return { status: "success", message: "User role updated." };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
}

export async function saveStudent(
  _previous: FinancialActionState,
  data: FormData,
): Promise<FinancialActionState> {
  const actor = await requireAdminActor();
  const rawStudentId = text(data, "studentId");
  const studentId = optionalUuidSchema.safeParse(rawStudentId);
  const rawFamilyId = text(data, "familyId");
  const familyId = optionalUuidSchema.safeParse(rawFamilyId);
  const rawClassId = text(data, "classId");
  const classId = optionalUuidSchema.safeParse(rawClassId);
  const admissionDate = dateSchema.safeParse(text(data, "admissionDate"));
  const dateOfBirthText = text(data, "dateOfBirth");
  const dateOfBirth = dateOfBirthText ? dateSchema.safeParse(dateOfBirthText) : null;
  const status = studentStatusSchema.safeParse(text(data, "status"));
  const paymentFrequency = paymentFrequencySchema.safeParse(text(data, "paymentFrequency"));
  const fullName = text(data, "fullName");
  if (
    !studentId.success || !familyId.success || !classId.success ||
    !admissionDate.success || (dateOfBirth && !dateOfBirth.success) ||
    !status.success || !paymentFrequency.success || !fullName
  ) {
    return { status: "error", message: "Complete the required student details and select valid options." };
  }

  try {
    const savedId = await saveStudentRecord({
      studentId: studentId.data || null,
      familyId: familyId.data || null,
      classId: classId.data || null,
      fullName,
      gender: text(data, "gender"),
      dateOfBirth: dateOfBirth?.success ? dateOfBirth.data : null,
      parentName: text(data, "parentName"),
      parentPhone: text(data, "parentPhone"),
      parentEmail: text(data, "parentEmail"),
      admissionDate: admissionDate.data,
      status: status.data,
      paymentFrequency: paymentFrequency.data,
      notes: text(data, "notes"),
      actorId: actor.id,
      actorEmail: actor.email,
    });
    revalidateCoreData();
    revalidatePath(`/students/${savedId}`);
    return {
      status: "success",
      message: studentId.data ? "Student record updated." : `Student created. Student ID: ${savedId}`,
    };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
}

export async function saveFamily(
  _previous: FinancialActionState,
  data: FormData,
): Promise<FinancialActionState> {
  const actor = await requireAdminActor();
  const familyId = optionalUuidSchema.safeParse(text(data, "familyId"));
  const familyName = text(data, "familyName");
  const status = familyStatusSchema.safeParse(text(data, "status"));
  if (!familyId.success || !familyName || !status.success) {
    return { status: "error", message: "Enter a family name and select a valid status." };
  }
  try {
    const savedId = await saveFamilyRecord({
      familyId: familyId.data || null,
      familyName,
      primaryContactName: text(data, "primaryContactName"),
      phone: text(data, "phone"),
      email: text(data, "email"),
      address: text(data, "address"),
      status: status.data,
      actorId: actor.id,
      actorEmail: actor.email,
    });
    revalidateCoreData();
    revalidatePath(`/families/${savedId}`);
    return { status: "success", message: familyId.data ? "Family record updated." : "Family created." };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
}
