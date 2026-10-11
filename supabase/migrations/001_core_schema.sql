CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'accountant', 'viewer')),
    phone TEXT,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (start_date < end_date)
);

CREATE TABLE IF NOT EXISTS public.terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    number INTEGER NOT NULL CHECK (number BETWEEN 1 AND 2),
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (academic_year_id, number),
    CHECK (start_date < end_date)
);

CREATE TABLE IF NOT EXISTS public.quarters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    term_id UUID REFERENCES public.terms(id) ON DELETE CASCADE,
    number INTEGER NOT NULL CHECK (number BETWEEN 1 AND 4),
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    due_date DATE NOT NULL,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (academic_year_id, term_id, number),
    CHECK (start_date < end_date)
);

CREATE TABLE IF NOT EXISTS public.months (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    quarter_id UUID NOT NULL REFERENCES public.quarters(id) ON DELETE CASCADE,
    month_number INTEGER NOT NULL CHECK (month_number BETWEEN 1 AND 12),
    month_name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (academic_year_id, quarter_id, month_number),
    CHECK (start_date <= end_date)
);

CREATE TABLE IF NOT EXISTS public.fee_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monthly_kobo BIGINT NOT NULL CHECK (monthly_kobo > 0),
    quarterly_kobo BIGINT NOT NULL CHECK (quarterly_kobo > 0),
    term_kobo BIGINT NOT NULL CHECK (term_kobo > 0),
    annual_kobo BIGINT NOT NULL CHECK (annual_kobo > 0),
    currency TEXT NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.family_discount_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    minimum_family_size INTEGER NOT NULL CHECK (minimum_family_size >= 1),
    discount_per_eligible_student_kobo BIGINT NOT NULL CHECK (discount_per_eligible_student_kobo >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_to TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    level TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_name TEXT NOT NULL,
    primary_contact_name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE RESTRICT,
    class_id UUID REFERENCES public.classes(id) ON DELETE RESTRICT,
    full_name TEXT NOT NULL,
    gender TEXT,
    date_of_birth DATE,
    parent_name TEXT,
    parent_phone TEXT,
    parent_email TEXT,
    admission_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated', 'withdrawn')),
    payment_frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (payment_frequency IN ('monthly', 'quarterly')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_fee_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    custom_monthly_fee_kobo BIGINT NOT NULL CHECK (custom_monthly_fee_kobo > 0),
    effective_from DATE NOT NULL,
    effective_to DATE,
    reason TEXT,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (effective_to IS NULL OR effective_from <= effective_to)
);

CREATE TABLE IF NOT EXISTS public.fee_obligations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE RESTRICT,
    family_id UUID REFERENCES public.families(id) ON DELETE RESTRICT,
    month_id UUID REFERENCES public.months(id) ON DELETE RESTRICT,
    obligation_date DATE NOT NULL,
    due_date DATE NOT NULL,
    expected_kobo BIGINT NOT NULL CHECK (expected_kobo >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, month_id)
);

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id) ON DELETE RESTRICT,
    family_id UUID REFERENCES public.families(id) ON DELETE RESTRICT,
    amount_kobo BIGINT NOT NULL CHECK (amount_kobo >= 0),
    payment_date DATE NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('bank_transfer', 'cash', 'other')),
    reference TEXT,
    notes TEXT,
    receipt_number TEXT NOT NULL UNIQUE,
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    voided_at TIMESTAMPTZ,
    void_reason TEXT,
    CHECK ((student_id IS NOT NULL) OR (family_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.payment_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
    obligation_id UUID NOT NULL REFERENCES public.fee_obligations(id) ON DELETE RESTRICT,
    allocated_kobo BIGINT NOT NULL CHECK (allocated_kobo >= 0),
    allocation_order INTEGER NOT NULL CHECK (allocation_order >= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (payment_id, obligation_id, allocation_order)
);

CREATE TABLE IF NOT EXISTS public.credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id) ON DELETE RESTRICT,
    family_id UUID REFERENCES public.families(id) ON DELETE RESTRICT,
    source_payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
    amount_kobo BIGINT NOT NULL CHECK (amount_kobo >= 0),
    remaining_kobo BIGINT NOT NULL CHECK (remaining_kobo >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    consumed_at TIMESTAMPTZ,
    CHECK ((student_id IS NOT NULL) OR (family_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE RESTRICT,
    receipt_number TEXT NOT NULL UNIQUE,
    rendered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    content_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_terms_academic_year_id ON public.terms (academic_year_id);
CREATE INDEX IF NOT EXISTS idx_quarters_academic_year_id ON public.quarters (academic_year_id, term_id);
CREATE INDEX IF NOT EXISTS idx_months_quarter_id ON public.months (quarter_id);
CREATE INDEX IF NOT EXISTS idx_students_family_id ON public.students (family_id);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON public.students (class_id);
CREATE INDEX IF NOT EXISTS idx_fee_obligations_student_due ON public.fee_obligations (student_id, due_date);
CREATE INDEX IF NOT EXISTS idx_fee_obligations_family_due ON public.fee_obligations (family_id, due_date);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment_id ON public.payment_allocations (payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_obligation_id ON public.payment_allocations (obligation_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT public.user_role() = 'admin';
$$;

CREATE OR REPLACE FUNCTION public.is_accountant()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT public.user_role() IN ('admin', 'accountant');
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quarters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.months ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_discount_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_fee_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_view_self_or_admin" ON public.profiles
  FOR SELECT
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "profiles_manage_admin_only" ON public.profiles
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "read_access_for_authenticated_users" ON public.academic_years
  FOR SELECT
  USING (public.user_role() IN ('admin', 'accountant', 'viewer'));

CREATE POLICY "write_access_admin_only" ON public.academic_years
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "read_access_for_authenticated_users_terms" ON public.terms
  FOR SELECT
  USING (public.user_role() IN ('admin', 'accountant', 'viewer'));

CREATE POLICY "write_access_admin_only_terms" ON public.terms
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "read_access_for_authenticated_users_quarters" ON public.quarters
  FOR SELECT
  USING (public.user_role() IN ('admin', 'accountant', 'viewer'));

CREATE POLICY "write_access_admin_only_quarters" ON public.quarters
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "read_access_for_authenticated_users_months" ON public.months
  FOR SELECT
  USING (public.user_role() IN ('admin', 'accountant', 'viewer'));

CREATE POLICY "write_access_admin_only_months" ON public.months
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "read_access_for_authenticated_users_fee_settings" ON public.fee_settings
  FOR SELECT
  USING (public.user_role() IN ('admin', 'accountant', 'viewer'));

CREATE POLICY "write_access_admin_only_fee_settings" ON public.fee_settings
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "read_access_for_authenticated_users_discount_rules" ON public.family_discount_rules
  FOR SELECT
  USING (public.user_role() IN ('admin', 'accountant', 'viewer'));

CREATE POLICY "write_access_admin_only_discount_rules" ON public.family_discount_rules
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "read_access_for_authenticated_users_classes" ON public.classes
  FOR SELECT
  USING (public.user_role() IN ('admin', 'accountant', 'viewer'));

CREATE POLICY "write_access_admin_only_classes" ON public.classes
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "read_access_for_authenticated_users_families" ON public.families
  FOR SELECT
  USING (public.user_role() IN ('admin', 'accountant', 'viewer'));

CREATE POLICY "write_access_admin_only_families" ON public.families
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "read_access_for_authenticated_users_students" ON public.students
  FOR SELECT
  USING (public.user_role() IN ('admin', 'accountant', 'viewer'));

CREATE POLICY "write_access_admin_only_students" ON public.students
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "read_access_for_authenticated_users_adjustments" ON public.student_fee_adjustments
  FOR SELECT
  USING (public.user_role() IN ('admin', 'accountant', 'viewer'));

CREATE POLICY "write_access_admin_only_adjustments" ON public.student_fee_adjustments
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "read_access_for_authenticated_users_obligations" ON public.fee_obligations
  FOR SELECT
  USING (public.user_role() IN ('admin', 'accountant', 'viewer'));

CREATE POLICY "write_access_accountant_admin_only_obligations" ON public.fee_obligations
  FOR ALL
  USING (public.is_accountant())
  WITH CHECK (public.is_accountant());

CREATE POLICY "read_access_for_authenticated_users_payments" ON public.payments
  FOR SELECT
  USING (public.user_role() IN ('admin', 'accountant', 'viewer'));

CREATE POLICY "write_access_accountant_admin_only_payments" ON public.payments
  FOR ALL
  USING (public.is_accountant())
  WITH CHECK (public.is_accountant());

CREATE POLICY "read_access_for_authenticated_users_allocations" ON public.payment_allocations
  FOR SELECT
  USING (public.user_role() IN ('admin', 'accountant', 'viewer'));

CREATE POLICY "write_access_accountant_admin_only_allocations" ON public.payment_allocations
  FOR ALL
  USING (public.is_accountant())
  WITH CHECK (public.is_accountant());

CREATE POLICY "read_access_for_authenticated_users_credits" ON public.credits
  FOR SELECT
  USING (public.user_role() IN ('admin', 'accountant', 'viewer'));

CREATE POLICY "write_access_accountant_admin_only_credits" ON public.credits
  FOR ALL
  USING (public.is_accountant())
  WITH CHECK (public.is_accountant());

CREATE POLICY "read_access_for_authenticated_users_receipts" ON public.receipts
  FOR SELECT
  USING (public.user_role() IN ('admin', 'accountant', 'viewer'));

CREATE POLICY "write_access_accountant_admin_only_receipts" ON public.receipts
  FOR ALL
  USING (public.is_accountant())
  WITH CHECK (public.is_accountant());

CREATE POLICY "read_access_for_authenticated_users_audit_logs" ON public.audit_logs
  FOR SELECT
  USING (public.user_role() IN ('admin', 'accountant', 'viewer'));

CREATE POLICY "write_access_admin_only_audit_logs" ON public.audit_logs
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "read_access_for_authenticated_users_settings" ON public.settings
  FOR SELECT
  USING (public.user_role() IN ('admin', 'accountant', 'viewer'));

CREATE POLICY "write_access_admin_only_settings" ON public.settings
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
