# Dārul Bayān Madrasah Fee Management System

This project is a greenfield Next.js application for managing madrasah student fees, obligations, payments, family discounts, credits, and reports.

## Implemented scope

- Next.js App Router application with TypeScript and Tailwind
- Supabase Auth with database-backed `admin`, `accountant`, and `viewer` profiles
- Supabase-backed student and family create/edit flows, searchable/filterable student directory, classes, and fee configuration (administrator-only core-data writes)
- Monthly obligations, custom student fees, family discounts, payments, allocations, credits, receipts, audit events, and audited payment reversals
- Database-backed monthly collection, quarterly family/discount, outstanding, student statement, and payment history reports
- Integer-kobo financial calculations and transactional database RPCs

## Getting started

1. Create a Supabase project and copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the server-only `SUPABASE_SERVICE_ROLE_KEY`.
3. Apply migrations in order (`supabase/migrations/001_core_schema.sql` through `supabase/migrations/004_optional_student_families.sql`) using the Supabase SQL editor or your normal migration deployment process.
4. Load `supabase/seed/2026-development.sql` only into a development project. It creates fictional families, students, and example financial records; do not use it for production or an active school database.
5. To remove the known 2026 development fixtures, run `supabase/maintenance/remove-2026-development-seed.sql` in the Supabase SQL editor after applying all migrations. The script safely supports either the intact known seed dataset or a previous cleanup that already removed the demo records. It also converts the separately added student explicitly approved by the administrator to an individual record, after verifying that student has no financial history, then removes any remaining placeholder families.
5. Create users in Supabase Auth and add one matching `public.profiles` row per user with an authorized role. Do not commit real credentials or expose the service-role key.
6. Install dependencies with `npm install`, then start the app with `npm run dev`.

## Validation

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `node scripts/verify-phase1.mjs` checks migration and seed structure. These checks do not replace applying the SQL migrations to a PostgreSQL/Supabase instance.

## Financial model

The service is built around a canonical monthly ledger. All obligations are stored monthly, with quarterly, term, and annual data derived from those obligations instead of duplicated as independent ledger entries. Payments allocate oldest-due-first; excess is held as credit. Family payments require an explicit selection of children. Financial records are created through atomic server-side RPCs, while reversals preserve the original records and add audited void/reversal data.
Students may be registered individually without a family. Only students linked to a real family are considered for family-level discounts or family payments; an individual student uses the normal student payment flow.

## Database

Migration files are located under `supabase/migrations/` and a development seed file under `supabase/seed/`. Apply migration `003_phase2_core_data.sql` after `001_core_schema.sql` and `002_phase3_financial_engine.sql` to enable the administrator-only student, family, class, and standard fee-setting mutations. The new migration has not been applied or integration-tested against PostgreSQL in this development environment.

## Security

Row-level security supports `admin`, `accountant`, and `viewer` roles. Financial writes are available only through server-side RPCs called using the server-only service role; each RPC verifies the actor's database-backed finance role and records audit information. Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code.

Core student, family, class, and standard-fee mutations are administrator-only server actions backed by `003_phase2_core_data.sql` RPCs; each operation verifies the administrator profile and creates an audit log entry. Migration `004_optional_student_families.sql` makes student family membership optional without changing historical obligations or allowing students with financial history to be reassigned.
