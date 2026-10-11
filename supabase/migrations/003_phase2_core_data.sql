CREATE OR REPLACE FUNCTION public.assert_admin_actor(p_actor_id UUID, p_actor_email TEXT)
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
              AND profile.role = 'admin'
              AND (profile.email IS NULL OR LOWER(profile.email) = LOWER(p_actor_email))
       ) THEN
        RAISE EXCEPTION 'Administrator role required' USING ERRCODE = '42501';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_fee_settings(
    p_monthly_kobo BIGINT,
    p_quarterly_kobo BIGINT,
    p_term_kobo BIGINT,
    p_annual_kobo BIGINT,
    p_actor_id UUID,
    p_actor_email TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    settings_id UUID;
BEGIN
    PERFORM public.assert_admin_actor(p_actor_id, p_actor_email);
    IF p_monthly_kobo <= 0 OR p_quarterly_kobo <= 0 OR p_term_kobo <= 0 OR p_annual_kobo <= 0 THEN
        RAISE EXCEPTION 'All fee amounts must be positive' USING ERRCODE = '22023';
    END IF;

    UPDATE public.fee_settings
    SET is_active = FALSE, updated_at = NOW()
    WHERE is_active;

    INSERT INTO public.fee_settings (
        monthly_kobo, quarterly_kobo, term_kobo, annual_kobo, currency, is_active
    )
    VALUES (p_monthly_kobo, p_quarterly_kobo, p_term_kobo, p_annual_kobo, 'NGN', TRUE)
    RETURNING id INTO settings_id;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
        p_actor_id, 'fee_settings_updated', 'fee_settings', settings_id,
        jsonb_build_object(
            'actor_email', p_actor_email,
            'monthly_kobo', p_monthly_kobo::TEXT,
            'quarterly_kobo', p_quarterly_kobo::TEXT,
            'term_kobo', p_term_kobo::TEXT,
            'annual_kobo', p_annual_kobo::TEXT
        )
    );

    RETURN settings_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_class(
    p_name TEXT,
    p_level TEXT,
    p_actor_id UUID,
    p_actor_email TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    class_id UUID;
BEGIN
    PERFORM public.assert_admin_actor(p_actor_id, p_actor_email);
    IF p_name IS NULL OR BTRIM(p_name) = '' THEN
        RAISE EXCEPTION 'Class name is required' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.classes (name, level)
    VALUES (BTRIM(p_name), NULLIF(BTRIM(p_level), ''))
    RETURNING id INTO class_id;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
        p_actor_id, 'class_created', 'class', class_id,
        jsonb_build_object('actor_email', p_actor_email, 'name', BTRIM(p_name), 'level', NULLIF(BTRIM(p_level), ''))
    );
    RETURN class_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_class_active(
    p_class_id UUID,
    p_is_active BOOLEAN,
    p_actor_id UUID,
    p_actor_email TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    PERFORM public.assert_admin_actor(p_actor_id, p_actor_email);
    UPDATE public.classes
    SET is_active = p_is_active, updated_at = NOW()
    WHERE id = p_class_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Class not found' USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
        p_actor_id, CASE WHEN p_is_active THEN 'class_activated' ELSE 'class_archived' END,
        'class', p_class_id, jsonb_build_object('actor_email', p_actor_email, 'is_active', p_is_active)
    );
END;
$$;

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
    IF p_family_id IS NULL
       OR p_full_name IS NULL OR BTRIM(p_full_name) = ''
       OR p_admission_date IS NULL
       OR p_status IS NULL OR p_status NOT IN ('active', 'inactive', 'graduated', 'withdrawn')
       OR p_payment_frequency IS NULL OR p_payment_frequency NOT IN ('monthly', 'quarterly') THEN
        RAISE EXCEPTION 'Invalid student details' USING ERRCODE = '22023';
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
        IF existing_family_id <> p_family_id AND (
            EXISTS (SELECT 1 FROM public.fee_obligations WHERE student_id = p_student_id)
            OR EXISTS (SELECT 1 FROM public.payments WHERE student_id = p_student_id)
            OR EXISTS (SELECT 1 FROM public.credits WHERE student_id = p_student_id)
        ) THEN
            RAISE EXCEPTION 'A student with financial history cannot be moved to another family' USING ERRCODE = '23514';
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
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Student not found' USING ERRCODE = 'P0002';
        END IF;
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

CREATE OR REPLACE FUNCTION public.save_family(
    p_family_id UUID,
    p_family_name TEXT,
    p_primary_contact_name TEXT,
    p_phone TEXT,
    p_email TEXT,
    p_address TEXT,
    p_status TEXT,
    p_actor_id UUID,
    p_actor_email TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    family_id UUID;
    action_name TEXT;
BEGIN
    PERFORM public.assert_admin_actor(p_actor_id, p_actor_email);
    IF p_family_name IS NULL OR BTRIM(p_family_name) = ''
       OR p_status IS NULL OR p_status NOT IN ('active', 'inactive', 'archived') THEN
        RAISE EXCEPTION 'Invalid family details' USING ERRCODE = '22023';
    END IF;

    IF p_family_id IS NULL THEN
        INSERT INTO public.families (
            family_name, primary_contact_name, phone, email, address, status
        )
        VALUES (
            BTRIM(p_family_name), NULLIF(BTRIM(p_primary_contact_name), ''),
            NULLIF(BTRIM(p_phone), ''), NULLIF(BTRIM(p_email), ''),
            NULLIF(BTRIM(p_address), ''), p_status
        )
        RETURNING id INTO family_id;
        action_name := 'family_created';
    ELSE
        UPDATE public.families
        SET family_name = BTRIM(p_family_name),
            primary_contact_name = NULLIF(BTRIM(p_primary_contact_name), ''),
            phone = NULLIF(BTRIM(p_phone), ''),
            email = NULLIF(BTRIM(p_email), ''),
            address = NULLIF(BTRIM(p_address), ''),
            status = p_status,
            updated_at = NOW()
        WHERE id = p_family_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Family not found' USING ERRCODE = 'P0002';
        END IF;
        family_id := p_family_id;
        action_name := 'family_updated';
    END IF;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (
        p_actor_id, action_name, 'family', family_id,
        jsonb_build_object('actor_email', p_actor_email, 'family_name', BTRIM(p_family_name), 'status', p_status)
    );
    RETURN family_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_admin_actor(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_fee_settings(BIGINT, BIGINT, BIGINT, BIGINT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_class(TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_class_active(UUID, BOOLEAN, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_student(UUID, UUID, UUID, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_family(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.assert_admin_actor(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_fee_settings(BIGINT, BIGINT, BIGINT, BIGINT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_class(TEXT, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_class_active(UUID, BOOLEAN, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_student(UUID, UUID, UUID, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_family(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT) TO service_role;
