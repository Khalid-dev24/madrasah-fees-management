CREATE SEQUENCE IF NOT EXISTS public.receipt_number_seq START WITH 1;

ALTER TABLE public.students
    ADD COLUMN IF NOT EXISTS financially_active_until DATE;

UPDATE public.fee_obligations AS obligation
SET family_id = student.family_id
FROM public.students AS student
WHERE obligation.student_id = student.id
  AND obligation.family_id IS NULL;

ALTER TABLE public.fee_obligations
    ALTER COLUMN month_id SET NOT NULL,
    ALTER COLUMN family_id SET NOT NULL;

UPDATE public.payments AS payment
SET family_id = NULL
FROM public.students AS student
WHERE payment.student_id = student.id
  AND payment.family_id = student.family_id;

UPDATE public.credits AS credit
SET family_id = NULL
FROM public.students AS student
WHERE credit.student_id = student.id
  AND credit.family_id = student.family_id;

ALTER TABLE public.payments
    DROP CONSTRAINT IF EXISTS payments_check,
    ADD CONSTRAINT payments_payer_xor_check
        CHECK ((student_id IS NOT NULL) <> (family_id IS NOT NULL)),
    ADD CONSTRAINT payments_positive_amount_check
        CHECK (amount_kobo > 0);

ALTER TABLE public.credits
    ADD CONSTRAINT credits_owner_xor_check
        CHECK ((student_id IS NOT NULL) <> (family_id IS NOT NULL)),
    ADD CONSTRAINT credits_remaining_within_amount_check
        CHECK (remaining_kobo <= amount_kobo);

ALTER TABLE public.payment_allocations
    ADD CONSTRAINT payment_allocations_order_unique
        UNIQUE (payment_id, allocation_order);

CREATE TABLE IF NOT EXISTS public.credit_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_id UUID NOT NULL REFERENCES public.credits(id) ON DELETE RESTRICT,
    obligation_id UUID NOT NULL REFERENCES public.fee_obligations(id) ON DELETE RESTRICT,
    allocated_kobo BIGINT NOT NULL CHECK (allocated_kobo > 0),
    allocation_order INTEGER NOT NULL CHECK (allocation_order > 0),
    applied_by_email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reversed_at TIMESTAMPTZ,
    reversed_by_email TEXT,
    reversal_reason TEXT,
    UNIQUE (credit_id, allocation_order),
    CHECK (
        (reversed_at IS NULL AND reversed_by_email IS NULL AND reversal_reason IS NULL)
        OR
        (reversed_at IS NOT NULL AND reversed_by_email IS NOT NULL AND reversal_reason IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_credit_allocations_credit ON public.credit_allocations (credit_id);
CREATE INDEX IF NOT EXISTS idx_credit_allocations_obligation ON public.credit_allocations (obligation_id);
CREATE INDEX IF NOT EXISTS idx_credits_student_remaining ON public.credits (student_id, remaining_kobo);
CREATE INDEX IF NOT EXISTS idx_credits_family_remaining ON public.credits (family_id, remaining_kobo);

ALTER TABLE public.credit_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_access_for_authenticated_users_credit_allocations"
    ON public.credit_allocations
    FOR SELECT
    USING (public.user_role() IN ('admin', 'accountant', 'viewer'));

CREATE OR REPLACE FUNCTION public.reject_financial_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_TABLE_NAME IN ('fee_obligations', 'payment_allocations', 'receipts', 'audit_logs') THEN
        RAISE EXCEPTION '% rows are immutable', TG_TABLE_NAME USING ERRCODE = '55000';
    END IF;

    IF TG_TABLE_NAME = 'payments' THEN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'Payments cannot be deleted' USING ERRCODE = '55000';
        END IF;

        IF OLD.voided_at IS NOT NULL
           OR NEW.id IS DISTINCT FROM OLD.id
           OR NEW.student_id IS DISTINCT FROM OLD.student_id
           OR NEW.family_id IS DISTINCT FROM OLD.family_id
           OR NEW.amount_kobo IS DISTINCT FROM OLD.amount_kobo
           OR NEW.payment_date IS DISTINCT FROM OLD.payment_date
           OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
           OR NEW.reference IS DISTINCT FROM OLD.reference
           OR NEW.notes IS DISTINCT FROM OLD.notes
           OR NEW.receipt_number IS DISTINCT FROM OLD.receipt_number
           OR NEW.recorded_by IS DISTINCT FROM OLD.recorded_by
           OR NEW.created_at IS DISTINCT FROM OLD.created_at
           OR NEW.voided_at IS NULL
           OR NEW.void_reason IS NULL
        THEN
            RAISE EXCEPTION 'Payments are immutable except for one audited void' USING ERRCODE = '55000';
        END IF;
        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'credits' THEN
        IF TG_OP = 'DELETE'
           OR NEW.id IS DISTINCT FROM OLD.id
           OR NEW.student_id IS DISTINCT FROM OLD.student_id
           OR NEW.family_id IS DISTINCT FROM OLD.family_id
           OR NEW.source_payment_id IS DISTINCT FROM OLD.source_payment_id
           OR NEW.amount_kobo IS DISTINCT FROM OLD.amount_kobo
           OR NEW.created_at IS DISTINCT FROM OLD.created_at
        THEN
            RAISE EXCEPTION 'Credit source records cannot be deleted or rewritten' USING ERRCODE = '55000';
        END IF;
        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'credit_allocations' THEN
        IF TG_OP = 'DELETE'
           OR OLD.reversed_at IS NOT NULL
           OR NEW.id IS DISTINCT FROM OLD.id
           OR NEW.credit_id IS DISTINCT FROM OLD.credit_id
           OR NEW.obligation_id IS DISTINCT FROM OLD.obligation_id
           OR NEW.allocated_kobo IS DISTINCT FROM OLD.allocated_kobo
           OR NEW.allocation_order IS DISTINCT FROM OLD.allocation_order
           OR NEW.applied_by_email IS DISTINCT FROM OLD.applied_by_email
           OR NEW.created_at IS DISTINCT FROM OLD.created_at
           OR NEW.reversed_at IS NULL
           OR NEW.reversed_by_email IS NULL
           OR NEW.reversal_reason IS NULL
        THEN
            RAISE EXCEPTION 'Credit allocations are immutable except for an audited reversal' USING ERRCODE = '55000';
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER protect_fee_obligations
    BEFORE UPDATE OR DELETE ON public.fee_obligations
    FOR EACH ROW EXECUTE FUNCTION public.reject_financial_ledger_mutation();

CREATE TRIGGER protect_payments
    BEFORE UPDATE OR DELETE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.reject_financial_ledger_mutation();

CREATE TRIGGER protect_payment_allocations
    BEFORE UPDATE OR DELETE ON public.payment_allocations
    FOR EACH ROW EXECUTE FUNCTION public.reject_financial_ledger_mutation();

CREATE TRIGGER protect_receipts
    BEFORE UPDATE OR DELETE ON public.receipts
    FOR EACH ROW EXECUTE FUNCTION public.reject_financial_ledger_mutation();

CREATE TRIGGER protect_credits
    BEFORE UPDATE OR DELETE ON public.credits
    FOR EACH ROW EXECUTE FUNCTION public.reject_financial_ledger_mutation();

CREATE TRIGGER protect_credit_allocations
    BEFORE UPDATE OR DELETE ON public.credit_allocations
    FOR EACH ROW EXECUTE FUNCTION public.reject_financial_ledger_mutation();

CREATE TRIGGER protect_audit_logs
    BEFORE UPDATE OR DELETE ON public.audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.reject_financial_ledger_mutation();

CREATE OR REPLACE FUNCTION public.validate_payment_allocation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    payment_row public.payments%ROWTYPE;
    obligation_row public.fee_obligations%ROWTYPE;
    current_payment_allocated BIGINT;
    existing_obligation_allocated BIGINT;
    existing_credit_allocated BIGINT;
BEGIN
    SELECT * INTO STRICT payment_row
    FROM public.payments
    WHERE id = NEW.payment_id
    FOR UPDATE;

    SELECT * INTO STRICT obligation_row
    FROM public.fee_obligations
    WHERE id = NEW.obligation_id
    FOR UPDATE;

    IF payment_row.voided_at IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot allocate a voided payment' USING ERRCODE = '23514';
    END IF;

    IF payment_row.student_id IS NOT NULL
       AND obligation_row.student_id <> payment_row.student_id THEN
        RAISE EXCEPTION 'Payment allocation student does not own the obligation' USING ERRCODE = '23514';
    END IF;

    IF payment_row.family_id IS NOT NULL
       AND obligation_row.family_id <> payment_row.family_id THEN
        RAISE EXCEPTION 'Payment allocation family does not own the obligation' USING ERRCODE = '23514';
    END IF;

    SELECT COALESCE(SUM(allocated_kobo), 0) INTO current_payment_allocated
    FROM public.payment_allocations
    WHERE payment_id = NEW.payment_id;

    IF current_payment_allocated + NEW.allocated_kobo > payment_row.amount_kobo THEN
        RAISE EXCEPTION 'Allocations cannot exceed the payment amount' USING ERRCODE = '23514';
    END IF;

    SELECT COALESCE(SUM(allocation.allocated_kobo), 0) INTO existing_obligation_allocated
    FROM public.payment_allocations AS allocation
    JOIN public.payments AS source_payment ON source_payment.id = allocation.payment_id
    WHERE allocation.obligation_id = NEW.obligation_id
      AND source_payment.voided_at IS NULL;

    SELECT COALESCE(SUM(allocated_kobo), 0) INTO existing_credit_allocated
    FROM public.credit_allocations
    WHERE obligation_id = NEW.obligation_id
      AND reversed_at IS NULL;

    IF existing_obligation_allocated + existing_credit_allocated + NEW.allocated_kobo
       > obligation_row.expected_kobo THEN
        RAISE EXCEPTION 'Allocation exceeds the obligation balance' USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_payment_allocation_integrity
    BEFORE INSERT ON public.payment_allocations
    FOR EACH ROW EXECUTE FUNCTION public.validate_payment_allocation();

CREATE OR REPLACE FUNCTION public.validate_credit_allocation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    credit_row public.credits%ROWTYPE;
    source_payment public.payments%ROWTYPE;
    obligation_row public.fee_obligations%ROWTYPE;
    already_allocated BIGINT;
    obligation_paid BIGINT;
BEGIN
    SELECT * INTO STRICT credit_row FROM public.credits WHERE id = NEW.credit_id FOR UPDATE;
    SELECT * INTO STRICT source_payment FROM public.payments WHERE id = credit_row.source_payment_id;
    SELECT * INTO STRICT obligation_row FROM public.fee_obligations WHERE id = NEW.obligation_id FOR UPDATE;

    IF source_payment.voided_at IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot apply credit from a voided payment' USING ERRCODE = '23514';
    END IF;

    IF credit_row.student_id IS NOT NULL
       AND obligation_row.student_id <> credit_row.student_id THEN
        RAISE EXCEPTION 'Student credit can only be applied to that student' USING ERRCODE = '23514';
    END IF;

    IF credit_row.family_id IS NOT NULL THEN
        IF obligation_row.family_id <> credit_row.family_id THEN
            RAISE EXCEPTION 'Family credit can only be applied to that family' USING ERRCODE = '23514';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.students
            WHERE id = obligation_row.student_id
              AND family_id = credit_row.family_id
        ) THEN
            RAISE EXCEPTION 'Credit recipient is not a member of the family' USING ERRCODE = '23514';
        END IF;
    END IF;

    SELECT COALESCE(SUM(allocated_kobo), 0) INTO already_allocated
    FROM public.credit_allocations
    WHERE credit_id = NEW.credit_id
      AND reversed_at IS NULL;

    IF already_allocated + NEW.allocated_kobo > credit_row.amount_kobo THEN
        RAISE EXCEPTION 'Credit allocations cannot exceed the credit amount' USING ERRCODE = '23514';
    END IF;

    SELECT
        COALESCE((
            SELECT SUM(allocation.allocated_kobo)
            FROM public.payment_allocations AS allocation
            JOIN public.payments AS payment ON payment.id = allocation.payment_id
            WHERE allocation.obligation_id = NEW.obligation_id
              AND payment.voided_at IS NULL
        ), 0)
        +
        COALESCE((
            SELECT SUM(allocation.allocated_kobo)
            FROM public.credit_allocations AS allocation
            WHERE allocation.obligation_id = NEW.obligation_id
              AND allocation.reversed_at IS NULL
        ), 0)
    INTO obligation_paid;

    IF obligation_paid + NEW.allocated_kobo > obligation_row.expected_kobo THEN
        RAISE EXCEPTION 'Credit allocation exceeds the obligation balance' USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_credit_allocation_integrity
    BEFORE INSERT ON public.credit_allocations
    FOR EACH ROW EXECUTE FUNCTION public.validate_credit_allocation();

CREATE OR REPLACE FUNCTION public.assert_finance_actor(p_actor_id UUID, p_actor_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_actor_id IS NULL OR p_actor_email IS NULL OR BTRIM(p_actor_email) = ''
       OR NOT EXISTS (
            SELECT 1
            FROM public.profiles AS profile
            WHERE profile.id = p_actor_id
              AND profile.role IN ('admin', 'accountant')
              AND (profile.email IS NULL OR LOWER(profile.email) = LOWER(p_actor_email))
       ) THEN
        RAISE EXCEPTION 'Authenticated finance role required' USING ERRCODE = '42501';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_monthly_obligations(
    p_quarter_id UUID,
    p_actor_email TEXT,
    p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    period_month RECORD;
    active_student RECORD;
    monthly_fee BIGINT;
    inserted_count INTEGER := 0;
    affected_count INTEGER := 0;
BEGIN
    PERFORM public.assert_finance_actor(p_actor_id, p_actor_email);

    PERFORM 1 FROM public.quarters WHERE id = p_quarter_id FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Quarter not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT monthly_kobo INTO STRICT monthly_fee
    FROM public.fee_settings
    WHERE is_active = TRUE
    ORDER BY updated_at DESC, created_at DESC, id
    LIMIT 1;

    FOR period_month IN
        SELECT id, start_date, end_date
        FROM public.months
        WHERE quarter_id = p_quarter_id
        ORDER BY month_number
    LOOP
        FOR active_student IN
            SELECT student.id, student.family_id, student.admission_date,
                   student.financially_active_until
            FROM public.students AS student
            WHERE student.status = 'active'
              AND student.admission_date <= period_month.start_date
              AND (
                student.financially_active_until IS NULL
                OR student.financially_active_until >= period_month.start_date
              )
            ORDER BY student.id
        LOOP
            INSERT INTO public.fee_obligations (
                student_id, family_id, month_id, obligation_date, due_date, expected_kobo
            )
            SELECT
                active_student.id,
                active_student.family_id,
                period_month.id,
                period_month.start_date,
                quarter.due_date,
                COALESCE((
                    SELECT adjustment.custom_monthly_fee_kobo
                    FROM public.student_fee_adjustments AS adjustment
                    WHERE adjustment.student_id = active_student.id
                      AND adjustment.effective_from <= period_month.start_date
                      AND (
                        adjustment.effective_to IS NULL
                        OR adjustment.effective_to >= period_month.start_date
                      )
                    ORDER BY adjustment.effective_from DESC, adjustment.created_at DESC, adjustment.id
                    LIMIT 1
                ), monthly_fee)
            FROM public.quarters AS quarter
            WHERE quarter.id = p_quarter_id
            ON CONFLICT (student_id, month_id) DO NOTHING;
            GET DIAGNOSTICS affected_count = ROW_COUNT;
            inserted_count := inserted_count + affected_count;
        END LOOP;
    END LOOP;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
        p_actor_id,
        'monthly_obligations_generated',
        'quarter',
        p_quarter_id,
        jsonb_build_object('actor_email', p_actor_email, 'inserted_count', inserted_count)
    );

    RETURN jsonb_build_object('quarter_id', p_quarter_id, 'inserted_count', inserted_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_student_fee_adjustment(
    p_student_id UUID,
    p_custom_monthly_fee_kobo BIGINT,
    p_effective_from DATE,
    p_effective_to DATE,
    p_reason TEXT,
    p_notes TEXT,
    p_actor_email TEXT,
    p_actor_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    adjustment_id UUID;
BEGIN
    IF p_custom_monthly_fee_kobo <= 0 OR p_effective_from IS NULL
       OR (p_effective_to IS NOT NULL AND p_effective_to < p_effective_from)
       OR p_actor_email IS NULL OR BTRIM(p_actor_email) = '' THEN
        RAISE EXCEPTION 'Invalid fee adjustment input' USING ERRCODE = '22023';
    END IF;
    PERFORM public.assert_finance_actor(p_actor_id, p_actor_email);

    PERFORM 1 FROM public.students WHERE id = p_student_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student not found' USING ERRCODE = 'P0002';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.student_fee_adjustments AS existing
        WHERE existing.student_id = p_student_id
          AND daterange(existing.effective_from, existing.effective_to, '[]')
              && daterange(p_effective_from, p_effective_to, '[]')
    ) THEN
        RAISE EXCEPTION 'Fee adjustment dates overlap an existing adjustment' USING ERRCODE = '23514';
    END IF;

    INSERT INTO public.student_fee_adjustments (
        student_id, custom_monthly_fee_kobo, effective_from, effective_to, reason, notes, created_by
    )
    VALUES (
        p_student_id, p_custom_monthly_fee_kobo, p_effective_from, p_effective_to,
        NULLIF(BTRIM(p_reason), ''), NULLIF(BTRIM(p_notes), ''), p_actor_id
    )
    RETURNING id INTO adjustment_id;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
        p_actor_id,
        'student_fee_adjustment_created',
        'student_fee_adjustment',
        adjustment_id,
        jsonb_build_object(
            'actor_email', p_actor_email,
            'student_id', p_student_id,
            'custom_monthly_fee_kobo', p_custom_monthly_fee_kobo::TEXT,
            'effective_from', p_effective_from,
            'effective_to', p_effective_to,
            'reason', p_reason
        )
    );

    RETURN adjustment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_student_payment(
    p_student_id UUID,
    p_amount_kobo BIGINT,
    p_payment_date DATE,
    p_payment_method TEXT,
    p_reference TEXT,
    p_notes TEXT,
    p_actor_email TEXT,
    p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    student_row public.students%ROWTYPE;
    obligation_row RECORD;
    payment_id UUID;
    receipt_no TEXT;
    remaining BIGINT;
    balance BIGINT;
    amount_to_allocate BIGINT;
    allocation_order INTEGER := 0;
    allocations_json JSONB := '[]'::jsonb;
    credit_id UUID;
BEGIN
    IF p_amount_kobo <= 0
       OR p_payment_date IS NULL
       OR p_payment_method NOT IN ('bank_transfer', 'cash', 'other')
       OR p_actor_email IS NULL OR BTRIM(p_actor_email) = '' THEN
        RAISE EXCEPTION 'Invalid student payment input' USING ERRCODE = '22023';
    END IF;
    PERFORM public.assert_finance_actor(p_actor_id, p_actor_email);

    SELECT * INTO STRICT student_row FROM public.students WHERE id = p_student_id FOR UPDATE;
    remaining := p_amount_kobo;

    LOOP
        receipt_no := FORMAT(
            'DBM-%s-%s',
            EXTRACT(YEAR FROM p_payment_date)::INTEGER,
            LPAD(NEXTVAL('public.receipt_number_seq')::TEXT, 6, '0')
        );
        EXIT WHEN NOT EXISTS (
            SELECT 1 FROM public.payments WHERE receipt_number = receipt_no
            UNION ALL
            SELECT 1 FROM public.receipts WHERE receipt_number = receipt_no
        );
    END LOOP;

    INSERT INTO public.payments (
        student_id, amount_kobo, payment_date, payment_method, reference, notes,
        receipt_number, recorded_by
    )
    VALUES (
        p_student_id, p_amount_kobo, p_payment_date, p_payment_method,
        NULLIF(BTRIM(p_reference), ''), NULLIF(BTRIM(p_notes), ''),
        receipt_no, p_actor_id
    )
    RETURNING id INTO payment_id;

    FOR obligation_row IN
        SELECT id, expected_kobo, due_date
        FROM public.fee_obligations
        WHERE student_id = p_student_id
        ORDER BY due_date, obligation_date, id
        FOR UPDATE
    LOOP
        EXIT WHEN remaining = 0;

        SELECT obligation_row.expected_kobo
            - COALESCE((
                SELECT SUM(allocation.allocated_kobo)
                FROM public.payment_allocations AS allocation
                JOIN public.payments AS payment ON payment.id = allocation.payment_id
                WHERE allocation.obligation_id = obligation_row.id
                  AND payment.voided_at IS NULL
            ), 0)
            - COALESCE((
                SELECT SUM(allocation.allocated_kobo)
                FROM public.credit_allocations AS allocation
                WHERE allocation.obligation_id = obligation_row.id
                  AND allocation.reversed_at IS NULL
            ), 0)
        INTO balance;

        IF balance <= 0 THEN
            CONTINUE;
        END IF;

        amount_to_allocate := LEAST(balance, remaining);
        allocation_order := allocation_order + 1;
        INSERT INTO public.payment_allocations (payment_id, obligation_id, allocated_kobo, allocation_order)
        VALUES (payment_id, obligation_row.id, amount_to_allocate, allocation_order);
        allocations_json := allocations_json || jsonb_build_array(
            jsonb_build_object(
                'obligation_id', obligation_row.id,
                'due_date', obligation_row.due_date,
                'allocated_kobo', amount_to_allocate::TEXT
            )
        );
        remaining := remaining - amount_to_allocate;
    END LOOP;

    IF remaining > 0 THEN
        INSERT INTO public.credits (student_id, source_payment_id, amount_kobo, remaining_kobo)
        VALUES (p_student_id, payment_id, remaining, remaining)
        RETURNING id INTO credit_id;
    END IF;

    INSERT INTO public.receipts (payment_id, receipt_number, rendered_by, content_json)
    VALUES (
        payment_id,
        receipt_no,
        p_actor_id,
        jsonb_build_object(
            'institution_name', 'Dārul Bayān Madrasah',
            'student_id', p_student_id,
            'amount_kobo', p_amount_kobo::TEXT,
            'payment_date', p_payment_date,
            'payment_method', p_payment_method,
            'reference', p_reference,
            'allocations', allocations_json,
            'credit_kobo', remaining::TEXT,
            'recorded_by', p_actor_email
        )
    );

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
        p_actor_id, 'payment_recorded', 'payment', payment_id,
        jsonb_build_object(
            'actor_email', p_actor_email, 'receipt_number', receipt_no,
            'amount_kobo', p_amount_kobo::TEXT, 'allocations', allocations_json,
            'credit_kobo', remaining::TEXT
        )
    );

    RETURN jsonb_build_object(
        'payment_id', payment_id, 'receipt_number', receipt_no,
        'amount_kobo', p_amount_kobo::TEXT, 'allocations', allocations_json,
        'credit_kobo', remaining::TEXT, 'credit_id', credit_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_family_payment(
    p_family_id UUID,
    p_student_ids UUID[],
    p_amount_kobo BIGINT,
    p_payment_date DATE,
    p_payment_method TEXT,
    p_reference TEXT,
    p_notes TEXT,
    p_actor_email TEXT,
    p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    obligation_row RECORD;
    payment_id UUID;
    receipt_no TEXT;
    remaining BIGINT;
    balance BIGINT;
    amount_to_allocate BIGINT;
    allocation_order INTEGER := 0;
    allocations_json JSONB := '[]'::jsonb;
    credit_id UUID;
BEGIN
    IF p_amount_kobo <= 0
       OR p_payment_date IS NULL
       OR p_payment_method NOT IN ('bank_transfer', 'cash', 'other')
       OR p_actor_email IS NULL OR BTRIM(p_actor_email) = ''
       OR COALESCE(CARDINALITY(p_student_ids), 0) = 0 THEN
        RAISE EXCEPTION 'Invalid family payment input' USING ERRCODE = '22023';
    END IF;
    PERFORM public.assert_finance_actor(p_actor_id, p_actor_email);

    PERFORM 1 FROM public.families WHERE id = p_family_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Family not found' USING ERRCODE = 'P0002';
    END IF;

    IF CARDINALITY(p_student_ids) <> (
        SELECT COUNT(DISTINCT selected.student_id)
        FROM UNNEST(p_student_ids) AS selected(student_id)
    ) THEN
        RAISE EXCEPTION 'Selected children must be unique' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM UNNEST(p_student_ids) AS selected(student_id)
        LEFT JOIN public.students AS student
          ON student.id = selected.student_id
         AND student.family_id = p_family_id
        WHERE student.id IS NULL
    ) THEN
        RAISE EXCEPTION 'Every selected student must belong to the family' USING ERRCODE = '23514';
    END IF;

    PERFORM 1
    FROM public.students
    WHERE id = ANY(p_student_ids)
    ORDER BY id
    FOR UPDATE;

    remaining := p_amount_kobo;

    LOOP
        receipt_no := FORMAT(
            'DBM-%s-%s',
            EXTRACT(YEAR FROM p_payment_date)::INTEGER,
            LPAD(NEXTVAL('public.receipt_number_seq')::TEXT, 6, '0')
        );
        EXIT WHEN NOT EXISTS (
            SELECT 1 FROM public.payments WHERE receipt_number = receipt_no
            UNION ALL
            SELECT 1 FROM public.receipts WHERE receipt_number = receipt_no
        );
    END LOOP;

    INSERT INTO public.payments (
        family_id, amount_kobo, payment_date, payment_method, reference, notes,
        receipt_number, recorded_by
    )
    VALUES (
        p_family_id, p_amount_kobo, p_payment_date, p_payment_method,
        NULLIF(BTRIM(p_reference), ''), NULLIF(BTRIM(p_notes), ''),
        receipt_no, p_actor_id
    )
    RETURNING id INTO payment_id;

    FOR obligation_row IN
        SELECT obligation.id, obligation.expected_kobo, obligation.due_date
        FROM public.fee_obligations AS obligation
        WHERE obligation.family_id = p_family_id
          AND obligation.student_id = ANY(p_student_ids)
        ORDER BY obligation.due_date, obligation.obligation_date, obligation.id
        FOR UPDATE
    LOOP
        EXIT WHEN remaining = 0;

        SELECT obligation_row.expected_kobo
            - COALESCE((
                SELECT SUM(allocation.allocated_kobo)
                FROM public.payment_allocations AS allocation
                JOIN public.payments AS payment ON payment.id = allocation.payment_id
                WHERE allocation.obligation_id = obligation_row.id
                  AND payment.voided_at IS NULL
            ), 0)
            - COALESCE((
                SELECT SUM(allocation.allocated_kobo)
                FROM public.credit_allocations AS allocation
                WHERE allocation.obligation_id = obligation_row.id
                  AND allocation.reversed_at IS NULL
            ), 0)
        INTO balance;

        IF balance <= 0 THEN
            CONTINUE;
        END IF;

        amount_to_allocate := LEAST(balance, remaining);
        allocation_order := allocation_order + 1;
        INSERT INTO public.payment_allocations (payment_id, obligation_id, allocated_kobo, allocation_order)
        VALUES (payment_id, obligation_row.id, amount_to_allocate, allocation_order);
        allocations_json := allocations_json || jsonb_build_array(
            jsonb_build_object(
                'obligation_id', obligation_row.id,
                'due_date', obligation_row.due_date,
                'allocated_kobo', amount_to_allocate::TEXT
            )
        );
        remaining := remaining - amount_to_allocate;
    END LOOP;

    IF remaining > 0 THEN
        INSERT INTO public.credits (family_id, source_payment_id, amount_kobo, remaining_kobo)
        VALUES (p_family_id, payment_id, remaining, remaining)
        RETURNING id INTO credit_id;
    END IF;

    INSERT INTO public.receipts (payment_id, receipt_number, rendered_by, content_json)
    VALUES (
        payment_id,
        receipt_no,
        p_actor_id,
        jsonb_build_object(
            'institution_name', 'Dārul Bayān Madrasah',
            'family_id', p_family_id,
            'selected_student_ids', p_student_ids,
            'amount_kobo', p_amount_kobo::TEXT,
            'payment_date', p_payment_date,
            'payment_method', p_payment_method,
            'reference', p_reference,
            'allocations', allocations_json,
            'credit_kobo', remaining::TEXT,
            'recorded_by', p_actor_email
        )
    );

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
        p_actor_id, 'family_payment_recorded', 'payment', payment_id,
        jsonb_build_object(
            'actor_email', p_actor_email, 'receipt_number', receipt_no,
            'family_id', p_family_id, 'selected_student_ids', p_student_ids,
            'amount_kobo', p_amount_kobo::TEXT, 'allocations', allocations_json,
            'credit_kobo', remaining::TEXT
        )
    );

    RETURN jsonb_build_object(
        'payment_id', payment_id, 'receipt_number', receipt_no,
        'amount_kobo', p_amount_kobo::TEXT, 'allocations', allocations_json,
        'credit_kobo', remaining::TEXT, 'credit_id', credit_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_credit_to_student(
    p_credit_id UUID,
    p_student_id UUID,
    p_actor_email TEXT,
    p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    credit_row public.credits%ROWTYPE;
    student_row public.students%ROWTYPE;
    obligation_row RECORD;
    balance BIGINT;
    amount_to_allocate BIGINT;
    remaining BIGINT;
    allocation_order INTEGER;
    allocations_json JSONB := '[]'::jsonb;
BEGIN
    PERFORM public.assert_finance_actor(p_actor_id, p_actor_email);

    SELECT * INTO STRICT credit_row FROM public.credits WHERE id = p_credit_id FOR UPDATE;
    SELECT * INTO STRICT student_row FROM public.students WHERE id = p_student_id FOR UPDATE;

    IF credit_row.remaining_kobo <= 0 THEN
        RAISE EXCEPTION 'Credit has no remaining balance' USING ERRCODE = '23514';
    END IF;
    IF credit_row.student_id IS NOT NULL AND credit_row.student_id <> p_student_id THEN
        RAISE EXCEPTION 'Credit belongs to a different student' USING ERRCODE = '23514';
    END IF;
    IF credit_row.family_id IS NOT NULL AND credit_row.family_id <> student_row.family_id THEN
        RAISE EXCEPTION 'Student does not belong to the credit family' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.payments
        WHERE id = credit_row.source_payment_id AND voided_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Credit source payment was voided' USING ERRCODE = '23514';
    END IF;

    remaining := credit_row.remaining_kobo;
    SELECT COALESCE(MAX(allocation_order), 0) INTO allocation_order
    FROM public.credit_allocations WHERE credit_id = p_credit_id;

    FOR obligation_row IN
        SELECT id, expected_kobo, due_date
        FROM public.fee_obligations
        WHERE student_id = p_student_id
        ORDER BY due_date, obligation_date, id
        FOR UPDATE
    LOOP
        EXIT WHEN remaining = 0;

        SELECT obligation_row.expected_kobo
            - COALESCE((
                SELECT SUM(allocation.allocated_kobo)
                FROM public.payment_allocations AS allocation
                JOIN public.payments AS payment ON payment.id = allocation.payment_id
                WHERE allocation.obligation_id = obligation_row.id
                  AND payment.voided_at IS NULL
            ), 0)
            - COALESCE((
                SELECT SUM(allocation.allocated_kobo)
                FROM public.credit_allocations AS allocation
                WHERE allocation.obligation_id = obligation_row.id
                  AND allocation.reversed_at IS NULL
            ), 0)
        INTO balance;

        IF balance <= 0 THEN
            CONTINUE;
        END IF;

        amount_to_allocate := LEAST(balance, remaining);
        allocation_order := allocation_order + 1;
        INSERT INTO public.credit_allocations (
            credit_id, obligation_id, allocated_kobo, allocation_order, applied_by_email
        )
        VALUES (p_credit_id, obligation_row.id, amount_to_allocate, allocation_order, p_actor_email);
        allocations_json := allocations_json || jsonb_build_array(
            jsonb_build_object(
                'obligation_id', obligation_row.id,
                'due_date', obligation_row.due_date,
                'allocated_kobo', amount_to_allocate::TEXT
            )
        );
        remaining := remaining - amount_to_allocate;
    END LOOP;

    UPDATE public.credits
    SET remaining_kobo = remaining,
        consumed_at = CASE WHEN remaining = 0 THEN NOW() ELSE NULL END
    WHERE id = p_credit_id;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
        p_actor_id, 'credit_applied', 'credit', p_credit_id,
        jsonb_build_object(
            'actor_email', p_actor_email, 'student_id', p_student_id,
            'allocations', allocations_json, 'remaining_kobo', remaining::TEXT
        )
    );

    RETURN jsonb_build_object(
        'credit_id', p_credit_id, 'student_id', p_student_id,
        'allocations', allocations_json, 'remaining_kobo', remaining::TEXT
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_payment(
    p_payment_id UUID,
    p_reason TEXT,
    p_actor_email TEXT,
    p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    payment_row public.payments%ROWTYPE;
    reversed_credit_ids UUID[];
BEGIN
    IF p_reason IS NULL OR BTRIM(p_reason) = ''
       OR p_actor_email IS NULL OR BTRIM(p_actor_email) = '' THEN
        RAISE EXCEPTION 'A reversal reason and actor are required' USING ERRCODE = '22023';
    END IF;
    PERFORM public.assert_finance_actor(p_actor_id, p_actor_email);

    SELECT * INTO STRICT payment_row FROM public.payments WHERE id = p_payment_id FOR UPDATE;
    IF payment_row.voided_at IS NOT NULL THEN
        RAISE EXCEPTION 'Payment has already been reversed' USING ERRCODE = '23514';
    END IF;

    UPDATE public.payments
    SET voided_at = NOW(),
        void_reason = BTRIM(p_reason)
    WHERE id = p_payment_id;

    SELECT ARRAY_AGG(id) INTO reversed_credit_ids
    FROM public.credits
    WHERE source_payment_id = p_payment_id;

    UPDATE public.credit_allocations
    SET reversed_at = NOW(),
        reversed_by_email = p_actor_email,
        reversal_reason = BTRIM(p_reason)
    WHERE credit_id = ANY(COALESCE(reversed_credit_ids, ARRAY[]::UUID[]))
      AND reversed_at IS NULL;

    UPDATE public.credits
    SET remaining_kobo = 0,
        consumed_at = COALESCE(consumed_at, NOW())
    WHERE source_payment_id = p_payment_id;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
        p_actor_id, 'payment_reversed', 'payment', p_payment_id,
        jsonb_build_object(
            'actor_email', p_actor_email,
            'receipt_number', payment_row.receipt_number,
            'reason', BTRIM(p_reason),
            'restored_obligations', (
                SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT(
                    'obligation_id', allocation.obligation_id,
                    'allocated_kobo', allocation.allocated_kobo::TEXT
                )), '[]'::jsonb)
                FROM public.payment_allocations AS allocation
                WHERE allocation.payment_id = p_payment_id
            ),
            'voided_credit_ids', COALESCE(reversed_credit_ids, ARRAY[]::UUID[])
        )
    );

    RETURN jsonb_build_object(
        'payment_id', p_payment_id,
        'receipt_number', payment_row.receipt_number,
        'voided_at', NOW(),
        'reason', BTRIM(p_reason)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.family_quarter_summary(p_quarter_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    quarter_row public.quarters%ROWTYPE;
    result JSONB;
BEGIN
    SELECT * INTO STRICT quarter_row FROM public.quarters WHERE id = p_quarter_id;

    WITH eligible AS (
        SELECT student.id, student.family_id
        FROM public.students AS student
        WHERE student.status = 'active'
          AND student.admission_date <= quarter_row.end_date
          AND (
            student.financially_active_until IS NULL
            OR student.financially_active_until >= quarter_row.start_date
          )
    ),
    active_rule AS (
        SELECT minimum_family_size, discount_per_eligible_student_kobo
        FROM public.family_discount_rules
        WHERE is_active
          AND valid_from::DATE <= quarter_row.start_date
          AND (valid_to IS NULL OR valid_to::DATE >= quarter_row.end_date)
        ORDER BY valid_from DESC, created_at DESC, id
        LIMIT 1
    ),
    family_months AS (
        SELECT
            obligation.family_id,
            obligation.student_id,
            SUM(obligation.expected_kobo) AS expected_kobo,
            SUM(COALESCE((
                SELECT SUM(allocation.allocated_kobo)
                FROM public.payment_allocations AS allocation
                JOIN public.payments AS payment ON payment.id = allocation.payment_id
                WHERE allocation.obligation_id = obligation.id
                  AND payment.voided_at IS NULL
            ), 0)) AS payment_allocated_kobo,
            SUM(COALESCE((
                SELECT SUM(allocation.allocated_kobo)
                FROM public.credit_allocations AS allocation
                WHERE allocation.obligation_id = obligation.id
                  AND allocation.reversed_at IS NULL
            ), 0)) AS credit_allocated_kobo
        FROM public.fee_obligations AS obligation
        JOIN public.months AS month ON month.id = obligation.month_id
        WHERE month.quarter_id = p_quarter_id
        GROUP BY obligation.family_id, obligation.student_id
    ),
    family_sizes AS (
        SELECT family_id, COUNT(*)::INTEGER AS eligible_student_count
        FROM eligible
        GROUP BY family_id
    ),
    totals AS (
        SELECT
            family_months.family_id,
            SUM(expected_kobo) AS expected_kobo,
            SUM(payment_allocated_kobo) AS payment_allocated_kobo,
            SUM(credit_allocated_kobo) AS credit_allocated_kobo
        FROM family_months
        GROUP BY family_months.family_id
    )
    SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT(
        'family_id', family.id,
        'family_name', family.family_name,
        'eligible_student_count', COALESCE(family_sizes.eligible_student_count, 0),
        'expected_kobo', COALESCE(totals.expected_kobo, 0)::TEXT,
        'discount_kobo', CASE
            WHEN COALESCE(family_sizes.eligible_student_count, 0) >= COALESCE(active_rule.minimum_family_size, 2147483647)
            THEN (COALESCE(family_sizes.eligible_student_count, 0)::NUMERIC * COALESCE(active_rule.discount_per_eligible_student_kobo, 0)::NUMERIC)
            ELSE 0::NUMERIC
        END::TEXT,
        'net_expected_kobo', GREATEST(
            COALESCE(totals.expected_kobo, 0)
            - CASE
                WHEN COALESCE(family_sizes.eligible_student_count, 0) >= COALESCE(active_rule.minimum_family_size, 2147483647)
                THEN COALESCE(family_sizes.eligible_student_count, 0)::NUMERIC * COALESCE(active_rule.discount_per_eligible_student_kobo, 0)::NUMERIC
                ELSE 0::NUMERIC
              END,
            0
        )::TEXT,
        'paid_kobo', (COALESCE(totals.payment_allocated_kobo, 0) + COALESCE(totals.credit_allocated_kobo, 0))::TEXT,
        'outstanding_kobo', GREATEST(
            COALESCE(totals.expected_kobo, 0)
            - CASE
                WHEN COALESCE(family_sizes.eligible_student_count, 0) >= COALESCE(active_rule.minimum_family_size, 2147483647)
                THEN COALESCE(family_sizes.eligible_student_count, 0)::NUMERIC * COALESCE(active_rule.discount_per_eligible_student_kobo, 0)::NUMERIC
                ELSE 0::NUMERIC
              END
            - COALESCE(totals.payment_allocated_kobo, 0)
            - COALESCE(totals.credit_allocated_kobo, 0),
            0
        )::TEXT
    )), '[]'::jsonb)
    INTO result
    FROM public.families AS family
    LEFT JOIN family_sizes ON family_sizes.family_id = family.id
    LEFT JOIN totals ON totals.family_id = family.id
    LEFT JOIN active_rule ON TRUE;

    RETURN result;
END;
$$;

CREATE OR REPLACE VIEW public.fee_obligation_balances
WITH (security_invoker = TRUE)
AS
SELECT
    obligation.id,
    obligation.student_id,
    obligation.family_id,
    obligation.month_id,
    obligation.obligation_date,
    obligation.due_date,
    obligation.expected_kobo::TEXT AS expected_kobo,
    (COALESCE(payment_total.allocated_kobo, 0) + COALESCE(credit_total.allocated_kobo, 0))::TEXT AS paid_kobo,
    GREATEST(
        obligation.expected_kobo
        - COALESCE(payment_total.allocated_kobo, 0)
        - COALESCE(credit_total.allocated_kobo, 0),
        0
    )::TEXT AS outstanding_kobo,
    CASE
        WHEN obligation.expected_kobo <= COALESCE(payment_total.allocated_kobo, 0) + COALESCE(credit_total.allocated_kobo, 0)
            THEN 'paid'
        WHEN COALESCE(payment_total.allocated_kobo, 0) + COALESCE(credit_total.allocated_kobo, 0) > 0
            THEN 'partial'
        ELSE 'unpaid'
    END AS status
FROM public.fee_obligations AS obligation
LEFT JOIN LATERAL (
    SELECT SUM(allocation.allocated_kobo) AS allocated_kobo
    FROM public.payment_allocations AS allocation
    JOIN public.payments AS payment ON payment.id = allocation.payment_id
    WHERE allocation.obligation_id = obligation.id
      AND payment.voided_at IS NULL
) AS payment_total ON TRUE
LEFT JOIN LATERAL (
    SELECT SUM(allocation.allocated_kobo) AS allocated_kobo
    FROM public.credit_allocations AS allocation
    WHERE allocation.obligation_id = obligation.id
      AND allocation.reversed_at IS NULL
) AS credit_total ON TRUE;

CREATE OR REPLACE VIEW public.financial_payments
WITH (security_invoker = TRUE)
AS
SELECT
    id, student_id, family_id, amount_kobo::TEXT AS amount_kobo, payment_date,
    payment_method, reference, notes, receipt_number, recorded_by, created_at,
    voided_at, void_reason
FROM public.payments;

CREATE OR REPLACE VIEW public.financial_credits
WITH (security_invoker = TRUE)
AS
SELECT
    id, student_id, family_id, source_payment_id,
    amount_kobo::TEXT AS amount_kobo,
    remaining_kobo::TEXT AS remaining_kobo,
    created_at, consumed_at
FROM public.credits;

CREATE OR REPLACE VIEW public.financial_payment_allocations
WITH (security_invoker = TRUE)
AS
SELECT
    allocation.id,
    allocation.payment_id,
    allocation.obligation_id,
    allocation.allocated_kobo::TEXT AS allocated_kobo,
    payment.payment_date,
    payment.voided_at
FROM public.payment_allocations AS allocation
JOIN public.payments AS payment ON payment.id = allocation.payment_id
WHERE payment.voided_at IS NULL;

DROP POLICY IF EXISTS "write_access_accountant_admin_only_obligations" ON public.fee_obligations;
CREATE POLICY "financial_obligations_rpc_only"
    ON public.fee_obligations FOR ALL
    USING (FALSE)
    WITH CHECK (FALSE);

DROP POLICY IF EXISTS "write_access_accountant_admin_only_payments" ON public.payments;
CREATE POLICY "financial_payments_rpc_only"
    ON public.payments FOR ALL
    USING (FALSE)
    WITH CHECK (FALSE);

DROP POLICY IF EXISTS "write_access_accountant_admin_only_allocations" ON public.payment_allocations;
CREATE POLICY "financial_allocations_rpc_only"
    ON public.payment_allocations FOR ALL
    USING (FALSE)
    WITH CHECK (FALSE);

DROP POLICY IF EXISTS "write_access_accountant_admin_only_credits" ON public.credits;
CREATE POLICY "financial_credits_rpc_only"
    ON public.credits FOR ALL
    USING (FALSE)
    WITH CHECK (FALSE);

DROP POLICY IF EXISTS "write_access_accountant_admin_only_receipts" ON public.receipts;
CREATE POLICY "financial_receipts_rpc_only"
    ON public.receipts FOR ALL
    USING (FALSE)
    WITH CHECK (FALSE);

CREATE POLICY "financial_credit_allocations_rpc_only"
    ON public.credit_allocations FOR ALL
    USING (FALSE)
    WITH CHECK (FALSE);

REVOKE INSERT, UPDATE, DELETE ON public.fee_obligations, public.payments,
    public.payment_allocations, public.credits, public.credit_allocations,
    public.receipts, public.audit_logs FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.assert_finance_actor(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_monthly_obligations(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_student_fee_adjustment(UUID, BIGINT, DATE, DATE, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_student_payment(UUID, BIGINT, DATE, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_family_payment(UUID, UUID[], BIGINT, DATE, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_credit_to_student(UUID, UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reverse_payment(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_quarter_summary(UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.assert_finance_actor(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_monthly_obligations(UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_student_fee_adjustment(UUID, BIGINT, DATE, DATE, TEXT, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_student_payment(UUID, BIGINT, DATE, TEXT, TEXT, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_family_payment(UUID, UUID[], BIGINT, DATE, TEXT, TEXT, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_credit_to_student(UUID, UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.reverse_payment(UUID, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.family_quarter_summary(UUID) TO service_role;
