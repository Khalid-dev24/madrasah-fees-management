import { createSupabaseServerClient } from "@/lib/supabase/server";

const PAGE_SIZE = 50;

async function callCoreDataRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await createSupabaseServerClient().rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

async function writeAuditLog(input: {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const client = createSupabaseServerClient();
  const { error } = await client.from("audit_logs").insert({
    actor_id: input.actorId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) throw new Error(`Unable to record audit log: ${error.message}`);
}

export async function saveSettingValue(input: {
  key: string;
  value: Record<string, unknown>;
  actorId: string;
  actorEmail?: string;
}) {
  const client = createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await client.from("settings")
    .upsert({
      key: input.key,
      value: input.value,
      updated_at: now,
    }, { onConflict: "key" })
    .select("key, value, updated_at")
    .single();

  if (error) throw new Error(`Unable to save setting: ${error.message}`);

  await writeAuditLog({
    actorId: input.actorId,
    action: "settings_updated",
    entityType: "settings",
    entityId: null,
    metadata: {
      key: input.key,
      value: input.value,
      actor_email: input.actorEmail ?? null,
      updated_at: now,
    },
  });

  return data;
}

export async function saveInstitutionSettings(input: {
  name: string;
  address: string;
  phone: string;
  email: string;
  actorId: string;
  actorEmail: string;
}) {
  return saveSettingValue({
    key: "institution",
    value: {
      name: input.name,
      address: input.address,
      phone: input.phone,
      email: input.email,
      updated_at: new Date().toISOString(),
    },
    actorId: input.actorId,
    actorEmail: input.actorEmail,
  });
}

export async function saveCurrentQuarterDueDates(input: {
  dueDates: Record<string, string>;
  actorId: string;
  actorEmail: string;
}) {
  const client = createSupabaseServerClient();
  const currentYearResult = await client
    .from("academic_years")
    .select("id")
    .eq("is_current", true)
    .limit(1)
    .maybeSingle();

  if (currentYearResult.error) {
    throw new Error(`Unable to load current academic year: ${currentYearResult.error.message}`);
  }
  if (!currentYearResult.data) {
    throw new Error("No current academic year is configured.");
  }

  const updates = Object.entries(input.dueDates)
    .filter(([quarter]) => ["Q1", "Q2", "Q3", "Q4"].includes(quarter))
    .map(([quarter, value]) => ({
      quarter: quarter,
      dueDate: value,
    }));

  for (const entry of updates) {
    const quarterNumber = Number.parseInt(entry.quarter.replace("Q", ""), 10);
    const { error } = await client
      .from("quarters")
      .update({ due_date: entry.dueDate, updated_at: new Date().toISOString() })
      .eq("academic_year_id", currentYearResult.data.id)
      .eq("number", quarterNumber);

    if (error) {
      throw new Error(`Unable to update due date for ${entry.quarter}: ${error.message}`);
    }
  }

  await writeAuditLog({
    actorId: input.actorId,
    action: "quarter_due_dates_updated",
    entityType: "settings",
    entityId: null,
    metadata: {
      due_dates: input.dueDates,
      actor_email: input.actorEmail,
      updated_at: new Date().toISOString(),
    },
  });

  return { updated: updates.length };
}

export async function setUserRole(input: {
  userId: string;
  role: "admin" | "accountant" | "viewer";
  actorId: string;
  actorEmail: string;
}) {
  const client = createSupabaseServerClient();
  const { error } = await client
    .from("profiles")
    .update({
      role: input.role,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.userId);

  if (error) throw new Error(`Unable to update user role: ${error.message}`);

  await writeAuditLog({
    actorId: input.actorId,
    action: "user_role_updated",
    entityType: "profile",
    entityId: input.userId,
    metadata: {
      role: input.role,
      actor_email: input.actorEmail,
      updated_at: new Date().toISOString(),
    },
  });

  return { ok: true };
}

export async function saveFeeSettings(input: {
  monthlyKobo: string;
  quarterlyKobo: string;
  termKobo: string;
  annualKobo: string;
  actorId: string;
  actorEmail: string;
}) {
  return callCoreDataRpc<string>("save_fee_settings", {
    p_monthly_kobo: input.monthlyKobo,
    p_quarterly_kobo: input.quarterlyKobo,
    p_term_kobo: input.termKobo,
    p_annual_kobo: input.annualKobo,
    p_actor_id: input.actorId,
    p_actor_email: input.actorEmail,
  });
}

export async function createClass(input: {
  name: string;
  level: string;
  actorId: string;
  actorEmail: string;
}) {
  return callCoreDataRpc<string>("create_class", {
    p_name: input.name,
    p_level: input.level,
    p_actor_id: input.actorId,
    p_actor_email: input.actorEmail,
  });
}

export async function setClassActive(input: {
  classId: string;
  isActive: boolean;
  actorId: string;
  actorEmail: string;
}) {
  return callCoreDataRpc<null>("set_class_active", {
    p_class_id: input.classId,
    p_is_active: input.isActive,
    p_actor_id: input.actorId,
    p_actor_email: input.actorEmail,
  });
}

export type StudentSaveInput = {
  studentId: string | null;
  familyId: string | null;
  classId: string | null;
  fullName: string;
  gender: string;
  dateOfBirth: string | null;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  admissionDate: string;
  status: string;
  paymentFrequency: string;
  notes: string;
  actorId: string;
  actorEmail: string;
};

export async function saveStudent(input: StudentSaveInput) {
  return callCoreDataRpc<string>("save_student", {
    p_student_id: input.studentId,
    p_family_id: input.familyId,
    p_class_id: input.classId,
    p_full_name: input.fullName,
    p_gender: input.gender,
    p_date_of_birth: input.dateOfBirth,
    p_parent_name: input.parentName,
    p_parent_phone: input.parentPhone,
    p_parent_email: input.parentEmail,
    p_admission_date: input.admissionDate,
    p_status: input.status,
    p_payment_frequency: input.paymentFrequency,
    p_notes: input.notes,
    p_actor_id: input.actorId,
    p_actor_email: input.actorEmail,
  });
}

export type FamilySaveInput = {
  familyId: string | null;
  familyName: string;
  primaryContactName: string;
  phone: string;
  email: string;
  address: string;
  status: string;
  actorId: string;
  actorEmail: string;
};

export async function saveFamily(input: FamilySaveInput) {
  return callCoreDataRpc<string>("save_family", {
    p_family_id: input.familyId,
    p_family_name: input.familyName,
    p_primary_contact_name: input.primaryContactName,
    p_phone: input.phone,
    p_email: input.email,
    p_address: input.address,
    p_status: input.status,
    p_actor_id: input.actorId,
    p_actor_email: input.actorEmail,
  });
}

export async function getStudentsPageData(input: {
  search: string;
  classId: string;
  familyId: string;
  status: string;
  paymentFrequency: string;
  page: number;
}) {
  const client = createSupabaseServerClient();
  let query = client
    .from("students")
    .select("id, family_id, class_id, full_name, gender, date_of_birth, parent_name, parent_phone, parent_email, admission_date, status, payment_frequency, notes", { count: "exact" })
    .order("full_name");

  if (input.classId) query = query.eq("class_id", input.classId);
  if (input.familyId) query = query.eq("family_id", input.familyId);
  if (input.status) query = query.eq("status", input.status);
  if (input.paymentFrequency) query = query.eq("payment_frequency", input.paymentFrequency);
  if (input.search) {
    const term = input.search.slice(0, 100).replace(/[^\p{L}\p{N}\s@+.'-]/gu, " ").trim();
    if (term) {
      query = query.or(
        `full_name.ilike.%${term}%,parent_name.ilike.%${term}%,parent_phone.ilike.%${term}%`,
      );
    }
  }

  const { data: students, error, count } = await query
    .range((input.page - 1) * PAGE_SIZE, input.page * PAGE_SIZE - 1);
  if (error) throw new Error(`Unable to load students: ${error.message}`);

  const studentIds = (students ?? []).map((student) => student.id);
  const [familiesResult, classesResult, balancesResult, settingsResult, adjustmentsResult] = await Promise.all([
    client.from("families").select("id, family_name").order("family_name"),
    client.from("classes").select("id, name, level, is_active").order("name"),
    studentIds.length
      ? client.from("fee_obligation_balances")
        .select("student_id, expected_kobo, paid_kobo, outstanding_kobo, due_date")
        .in("student_id", studentIds)
      : Promise.resolve({ data: [], error: null }),
    client.from("fee_settings")
      .select("monthly_kobo, quarterly_kobo, term_kobo, annual_kobo, currency")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    studentIds.length
      ? client.from("student_fee_adjustments")
        .select("student_id, custom_monthly_fee_kobo, effective_from, effective_to")
        .in("student_id", studentIds)
        .order("effective_from")
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [familiesResult, classesResult, balancesResult, settingsResult, adjustmentsResult]) {
    if (result.error) throw new Error(`Unable to load student context: ${result.error.message}`);
  }

  const familyById = new Map((familiesResult.data ?? []).map((family) => [family.id, family]));
  const classById = new Map((classesResult.data ?? []).map((item) => [item.id, item]));
  const balancesByStudent = new Map<string, { expected: bigint; paid: bigint; outstanding: bigint; oldestDue: string | null }>();
  for (const balance of balancesResult.data ?? []) {
    const current = balancesByStudent.get(balance.student_id) ?? {
      expected: 0n, paid: 0n, outstanding: 0n, oldestDue: null,
    };
    const due = BigInt(balance.outstanding_kobo) > 0n ? balance.due_date : null;
    balancesByStudent.set(balance.student_id, {
      expected: current.expected + BigInt(balance.expected_kobo),
      paid: current.paid + BigInt(balance.paid_kobo),
      outstanding: current.outstanding + BigInt(balance.outstanding_kobo),
      oldestDue: due && (!current.oldestDue || due < current.oldestDue) ? due : current.oldestDue,
    });
  }
  const adjustmentsByStudent = new Map<string, typeof adjustmentsResult.data>();
  for (const adjustment of adjustmentsResult.data ?? []) {
    adjustmentsByStudent.set(adjustment.student_id, [
      ...(adjustmentsByStudent.get(adjustment.student_id) ?? []),
      adjustment,
    ]);
  }
  const today = new Date().toISOString().slice(0, 10);
  const defaultMonthlyFee = settingsResult.data?.monthly_kobo ?? "500000";
  const items = (students ?? []).map((student) => {
    const effectiveAdjustment = [...(adjustmentsByStudent.get(student.id) ?? [])]
      .reverse()
      .find((adjustment) =>
        adjustment.effective_from <= today &&
        (!adjustment.effective_to || adjustment.effective_to >= today),
      );
    const balance = balancesByStudent.get(student.id);
    return {
      ...student,
      family_name: student.family_id ? familyById.get(student.family_id)?.family_name ?? "Unknown family" : "Individual student",
      class_name: student.class_id ? classById.get(student.class_id)?.name ?? "—" : "—",
      monthly_fee_kobo: effectiveAdjustment?.custom_monthly_fee_kobo ?? defaultMonthlyFee,
      expected_kobo: (balance?.expected ?? 0n).toString(),
      paid_kobo: (balance?.paid ?? 0n).toString(),
      outstanding_kobo: (balance?.outstanding ?? 0n).toString(),
      oldest_due_date: balance?.oldestDue ?? null,
    };
  });

  return {
    students: items,
    families: familiesResult.data ?? [],
    classes: classesResult.data ?? [],
    total: count ?? 0,
    page: input.page,
    pageSize: PAGE_SIZE,
  };
}

export async function getStudentDetailData(studentId: string) {
  const client = createSupabaseServerClient();
  const [studentResult, familiesResult, classesResult, balancesResult, paymentsResult, adjustmentsResult, settingsResult] = await Promise.all([
    client.from("students")
      .select("id, family_id, class_id, full_name, gender, date_of_birth, parent_name, parent_phone, parent_email, admission_date, status, payment_frequency, notes")
      .eq("id", studentId)
      .maybeSingle(),
    client.from("families").select("id, family_name, primary_contact_name, phone").order("family_name"),
    client.from("classes").select("id, name, level, is_active").order("name"),
    client.from("fee_obligation_balances")
      .select("id, student_id, family_id, month_id, obligation_date, due_date, expected_kobo, paid_kobo, outstanding_kobo, status")
      .eq("student_id", studentId)
      .order("obligation_date"),
    client.from("financial_payments")
      .select("id, student_id, family_id, amount_kobo, payment_date, payment_method, reference, receipt_number, voided_at, void_reason")
      .eq("student_id", studentId)
      .order("payment_date", { ascending: false }),
    client.from("student_fee_adjustments")
      .select("id, custom_monthly_fee_kobo, effective_from, effective_to, reason, notes")
      .eq("student_id", studentId)
      .order("effective_from", { ascending: false }),
    client.from("fee_settings")
      .select("monthly_kobo")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  for (const result of [studentResult, familiesResult, classesResult, balancesResult, paymentsResult, adjustmentsResult, settingsResult]) {
    if (result.error) throw new Error(`Unable to load student profile: ${result.error.message}`);
  }

  const student = studentResult.data;
  if (!student) return null;
  const today = new Date().toISOString().slice(0, 10);
  const effectiveAdjustment = (adjustmentsResult.data ?? []).find((adjustment) =>
    adjustment.effective_from <= today &&
    (!adjustment.effective_to || adjustment.effective_to >= today),
  );
  const validObligations = balancesResult.data ?? [];
  const outstanding = validObligations.reduce((total, row) => total + BigInt(row.outstanding_kobo), 0n);
  const oldestDue = validObligations
    .filter((row) => BigInt(row.outstanding_kobo) > 0n)
    .map((row) => row.due_date)
    .sort()[0] ?? null;
  const lastPayment = (paymentsResult.data ?? []).find((payment) => !payment.voided_at) ?? null;

  return {
    student: {
      ...student,
      monthly_fee_kobo: effectiveAdjustment?.custom_monthly_fee_kobo ?? settingsResult.data?.monthly_kobo ?? "500000",
    },
    family: familiesResult.data?.find((item) => item.id === student.family_id) ?? null,
    classes: classesResult.data ?? [],
    families: familiesResult.data ?? [],
    balances: validObligations,
    payments: paymentsResult.data ?? [],
    adjustments: adjustmentsResult.data ?? [],
    outstanding_kobo: outstanding.toString(),
    oldest_due_date: oldestDue,
    last_payment: lastPayment,
  };
}

export async function getSettingsPageData() {
  const client = createSupabaseServerClient();

  const [settingsResult, classesResult, familiesResult, studentsResult, discountResult, profilesResult, auditResult] = await Promise.all([
    client.from("fee_settings")
      .select("monthly_kobo, quarterly_kobo, term_kobo, annual_kobo, currency")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client.from("classes").select("id, name, level, is_active").order("name"),
    client.from("families").select("id, family_name, primary_contact_name, phone, email, address, status").order("family_name"),
    client.from("students").select("id, full_name").order("full_name"),
    client.from("family_discount_rules")
      .select("id, minimum_family_size, discount_per_eligible_student_kobo, is_active, valid_from, valid_to")
      .eq("is_active", true)
      .order("valid_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client.from("profiles").select("id, full_name, email, role").order("full_name"),
    client.from("audit_logs")
      .select("id, actor_id, action, entity_type, entity_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  for (const result of [settingsResult, classesResult, familiesResult, studentsResult, discountResult, profilesResult, auditResult]) {
    if (result.error) throw new Error(`Unable to load settings: ${result.error.message}`);
  }

  if (!settingsResult.data) {
    throw new Error("No active fee settings exist. Run the development seed or configure fees in Supabase.");
  }

  const currentYearResult = await client
    .from("academic_years")
    .select("id, label")
    .eq("is_current", true)
    .limit(1)
    .maybeSingle();

  if (currentYearResult.error) {
    throw new Error(`Unable to load current academic year: ${currentYearResult.error.message}`);
  }

  const dueDatesResult = currentYearResult.data?.id
    ? await client
        .from("quarters")
        .select("id, number, name, due_date")
        .eq("academic_year_id", currentYearResult.data.id)
        .order("number")
    : { data: [], error: null };

  if (dueDatesResult.error) {
    throw new Error(`Unable to load quarter due dates: ${dueDatesResult.error.message}`);
  }

  const institutionRow = await client.from("settings").select("key, value").eq("key", "institution").maybeSingle();
  if (institutionRow.error) {
    throw new Error(`Unable to load institution settings: ${institutionRow.error.message}`);
  }

  const defaultInstitution = {
    name: "Dārul Bayān Madrasah",
    address: "Madrasah Road",
    phone: "",
    email: "",
  };

  const dueDates = (dueDatesResult.data ?? []).reduce<Record<string, string>>((acc, quarter) => {
    acc[`Q${quarter.number}`] = quarter.due_date;
    return acc;
  }, {});

  const actorMap = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
  const auditLogs = (auditResult.data ?? []).map((entry) => ({
    ...entry,
    actor: actorMap.get(entry.actor_id) ?? null,
  }));

  return {
    feeSettings: settingsResult.data,
    classes: classesResult.data ?? [],
    families: familiesResult.data ?? [],
    students: studentsResult.data ?? [],
    discountRule: discountResult.data,
    institutionSettings: institutionRow.data && institutionRow.data.value && typeof institutionRow.data.value === "object"
      ? {
          ...defaultInstitution,
          ...(institutionRow.data.value as Record<string, unknown>),
        }
      : defaultInstitution,
    dueDates,
    users: profilesResult.data ?? [],
    auditLogs,
  };
}
