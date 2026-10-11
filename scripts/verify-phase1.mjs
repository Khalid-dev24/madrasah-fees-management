import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationDir = path.join(root, "supabase", "migrations");
const seedDir = path.join(root, "supabase", "seed");

const migrationFiles = fs.readdirSync(migrationDir).filter((file) => file.endsWith(".sql"));
if (migrationFiles.length === 0) {
  throw new Error("No SQL migration files found in supabase/migrations.");
}

const seedFiles = fs.readdirSync(seedDir).filter((file) => file.endsWith(".sql"));
if (seedFiles.length === 0) {
  throw new Error("No SQL seed files found in supabase/seed.");
}

const migrationText = migrationFiles
  .map((file) => fs.readFileSync(path.join(migrationDir, file), "utf8"))
  .join("\n");

const requiredTables = [
  "profiles",
  "academic_years",
  "terms",
  "quarters",
  "months",
  "fee_settings",
  "family_discount_rules",
  "classes",
  "families",
  "students",
  "student_fee_adjustments",
  "fee_obligations",
  "payments",
  "payment_allocations",
  "credits",
  "credit_allocations",
  "receipts",
  "audit_logs",
  "settings",
];

for (const table of requiredTables) {
  const tablePattern = new RegExp(
    `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:public\\.)?${table.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`,
    "i",
  );

  if (!tablePattern.test(migrationText)) {
    throw new Error(`Migration is missing required table: ${table}`);
  }
}

const financialMigration = fs.readFileSync(
  path.join(migrationDir, "002_phase3_financial_engine.sql"),
  "utf8",
);
const requiredFinancialFeatures = [
  "generate_monthly_obligations",
  "set_student_fee_adjustment",
  "record_student_payment",
  "record_family_payment",
  "apply_credit_to_student",
  "reverse_payment",
  "family_quarter_summary",
  "financial_obligations_rpc_only",
  "financial_payments_rpc_only",
  "financial_allocations_rpc_only",
  "financial_credits_rpc_only",
  "financial_credit_allocations_rpc_only",
  "financial_receipts_rpc_only",
];

for (const feature of requiredFinancialFeatures) {
  if (!financialMigration.includes(feature)) {
    throw new Error(`Phase 3 migration is missing required feature: ${feature}`);
  }
}

const coreDataMigration = fs.readFileSync(
  path.join(migrationDir, "003_phase2_core_data.sql"),
  "utf8",
);
const requiredCoreDataFeatures = [
  "assert_admin_actor",
  "save_fee_settings",
  "create_class",
  "set_class_active",
  "save_student",
  "save_family",
  "student_created",
  "student_updated",
  "family_created",
  "family_updated",
];

for (const feature of requiredCoreDataFeatures) {
  if (!coreDataMigration.includes(feature)) {
    throw new Error(`Phase 2 migration is missing required feature: ${feature}`);
  }
}

const optionalFamilyMigration = fs.readFileSync(
  path.join(migrationDir, "004_optional_student_families.sql"),
  "utf8",
);
for (const feature of [
  "ALTER COLUMN family_id DROP NOT NULL",
  "existing_family_id IS DISTINCT FROM p_family_id",
  "A student with financial history cannot be moved to or from a family",
]) {
  if (!optionalFamilyMigration.includes(feature)) {
    throw new Error(`Optional-family migration is missing required safeguard: ${feature}`);
  }
}

const seedCleanup = fs.readFileSync(
  path.join(root, "supabase", "maintenance", "remove-2026-development-seed.sql"),
  "utf8",
);
for (const feature of [
  "Demo cleanup stopped",
  "development_seed_data_removed",
  "expected_test_payment_count",
  "safe_to_retry_after_demo_fixtures_have_already_been_removed",
  "additional_student_id",
]) {
  if (!seedCleanup.includes(feature)) {
    throw new Error(`Seed cleanup script is missing required safeguard or audit detail: ${feature}`);
  }
}

const seedText = seedFiles.map((file) => fs.readFileSync(path.join(seedDir, file), "utf8")).join("\n");
if (!seedText.includes("2026") || !seedText.includes("Q4")) {
  throw new Error("Seed data does not include the expected 2026 academic period.");
}

console.log(`Verified ${migrationFiles.length} migration file(s), Phase 2/3 features, and ${seedFiles.length} seed file(s).`);
console.log(`Found tables: ${requiredTables.join(", ")}`);
