ALTER TABLE public.students
    ALTER COLUMN family_id DROP NOT NULL;

ALTER TABLE public.fee_obligations
    ALTER COLUMN family_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.save_student(
    p_student_id UUID,
    p_family_id UUID,
    p_class_id UUID,
    p_full_name TEXT,
    p_gender TEXT,
    p_date_of_birth DATE,
    p_parent_name TEXT,
    p_parent_phone TEXT,
    p_parent_email TEXT,
    p_admission_date DATE,
    p_status TEXT,
    p_payment_frequency TEXT,
    p_notes TEXT,
    p_actor_id UUID,
    p_actor_email TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    student_id UUID;
    existing_family_id UUID;
    action_name TEXT;
BEGIN
    PERFORM public.assert_admin_actor(p_actor_id, p_actor_email);

    IF p_full_name IS NULL OR BTRIM(p_full_name) = ''
       OR p_admission_date IS NULL
       OR p_status IS NULL OR p_status NOT IN ('active', 'inactive', 'graduated', 'withdrawn')
       OR p_payment_frequency IS NULL OR p_payment_frequency NOT IN ('monthly', 'quarterly') THEN
        RAISE EXCEPTION 'Invalid student details' USING ERRCODE = '22023';
    END IF;

    IF p_family_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.families WHERE id = p_family_id
    ) THEN
        RAISE EXCEPTION 'Selected family does not exist' USING ERRCODE = '23503';
    END IF;

    IF p_class_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.classes WHERE id = p_class_id
    ) THEN
        RAISE EXCEPTION 'Selected class does not exist' USING ERRCODE = '23503';
    END IF;

    IF p_student_id IS NULL THEN
        INSERT INTO public.students (
            family_id, class_id, full_name, gender, date_of_birth, parent_name,
            parent_phone, parent_email, admission_date, status, payment_frequency, notes
        )
        VALUES (
            p_family_id, p_class_id, BTRIM(p_full_name), NULLIF(BTRIM(p_gender), ''),
            p_date_of_birth, NULLIF(BTRIM(p_parent_name), ''), NULLIF(BTRIM(p_parent_phone), ''),
            NULLIF(BTRIM(p_parent_email), ''), p_admission_date, p_status,
            p_payment_frequency, NULLIF(BTRIM(p_notes), '')
        )
        RETURNING id INTO student_id;
        action_name := 'student_created';
    ELSE
        SELECT family_id INTO existing_family_id
        FROM public.students
        WHERE id = p_student_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Student not found' USING ERRCODE = 'P0002';
        END IF;

        IF existing_family_id IS DISTINCT FROM p_family_id AND (
            EXISTS (SELECT 1 FROM public.fee_obligations WHERE student_id = p_student_id)
            OR EXISTS (SELECT 1 FROM public.payments WHERE student_id = p_student_id)
            OR EXISTS (SELECT 1 FROM public.credits WHERE student_id = p_student_id)
        ) THEN
            RAISE EXCEPTION 'A student with financial history cannot be moved to or from a family' USING ERRCODE = '23514';
        END IF;

        UPDATE public.students
        SET family_id = p_family_id,
            class_id = p_class_id,
            full_name = BTRIM(p_full_name),
            gender = NULLIF(BTRIM(p_gender), ''),
            date_of_birth = p_date_of_birth,
            parent_name = NULLIF(BTRIM(p_parent_name), ''),
            parent_phone = NULLIF(BTRIM(p_parent_phone), ''),
            parent_email = NULLIF(BTRIM(p_parent_email), ''),
            admission_date = p_admission_date,
            status = p_status,
            payment_frequency = p_payment_frequency,
            notes = NULLIF(BTRIM(p_notes), ''),
            updated_at = NOW()
        WHERE id = p_student_id;

        student_id := p_student_id;
        action_name := 'student_updated';
    END IF;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
        p_actor_id, action_name, 'student', student_id,
        jsonb_build_object(
            'actor_email', p_actor_email,
            'family_id', p_family_id,
            'class_id', p_class_id,
            'full_name', BTRIM(p_full_name),
            'status', p_status,
            'payment_frequency', p_payment_frequency
        )
    );

    RETURN student_id;
END;
$$;
