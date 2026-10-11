BEGIN;

DO $$
DECLARE
    fixture_student_ids UUID[] := ARRAY[
        'cccccccc-0000-4c00-8000-000000000001',
        'cccccccc-0000-4c00-8000-000000000002',
        'cccccccc-0000-4c00-8000-000000000003',
        'cccccccc-0000-4c00-8000-000000000004',
        'cccccccc-0000-4c00-8000-000000000005',
        'cccccccc-0000-4c00-8000-000000000006',
        'cccccccc-0000-4c00-8000-000000000007',
        'cccccccc-0000-4c00-8000-000000000008',
        'cccccccc-0000-4c00-8000-000000000009',
        'cccccccc-0000-4c00-8000-000000000010',
        'cccccccc-0000-4c00-8000-000000000011'
    ];
    fixture_family_ids UUID[] := ARRAY[
        'bbbbbbbb-0000-4b00-8000-000000000001',
        'bbbbbbbb-0000-4b00-8000-000000000002',
        'bbbbbbbb-0000-4b00-8000-000000000003',
        'bbbbbbbb-0000-4b00-8000-000000000004'
    ];
    fixture_obligation_ids UUID[] := ARRAY[
        'eeeeeeee-0000-4e00-8000-000000000001',
        'eeeeeeee-0000-4e00-8000-000000000002',
        'eeeeeeee-0000-4e00-8000-000000000003',
        'eeeeeeee-0000-4e00-8000-000000000004',
        'eeeeeeee-0000-4e00-8000-000000000005',
        'eeeeeeee-0000-4e00-8000-000000000006',
        'eeeeeeee-0000-4e00-8000-000000000007',
        'eeeeeeee-0000-4e00-8000-000000000008',
        'eeeeeeee-0000-4e00-8000-000000000009',
        'eeeeeeee-0000-4e00-8000-000000000010',
        'eeeeeeee-0000-4e00-8000-000000000011',
        'eeeeeeee-0000-4e00-8000-000000000012',
        'eeeeeeee-0000-4e00-8000-000000000013'
    ];
    fixture_payment_ids UUID[] := ARRAY[
        '13131313-0000-4131-8313-000000000001',
        '13131313-0000-4131-8313-000000000002'
    ];
    fixture_credit_ids UUID[] := ARRAY[
        '14141414-0000-4141-8414-000000000001',
        '14141414-0000-4141-8414-000000000002'
    ];
    fixture_allocation_ids UUID[] := ARRAY[
        '15151515-0000-4151-8515-000000000001',
        '15151515-0000-4151-8515-000000000002',
        '15151515-0000-4151-8515-000000000003',
        '15151515-0000-4151-8515-000000000004'
    ];
    additional_student_id UUID := '0586c2cc-16e0-42c1-a80d-e8816bccb1ed';
    family_d_id UUID := 'bbbbbbbb-0000-4b00-8000-000000000004';
BEGIN
    IF EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'students'
             AND column_name = 'family_id'
             AND is_nullable <> 'YES'
       )
       OR NOT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'students'
             AND column_name = 'family_id'
             AND is_nullable = 'YES'
       ) THEN
        RAISE EXCEPTION 'Apply migration 004_optional_student_families.sql before running demo cleanup.';
    END IF;

    IF (SELECT COUNT(*) FROM public.students WHERE id = ANY(fixture_student_ids)) NOT IN (0, 11)
       OR (SELECT COUNT(*) FROM public.families WHERE id = ANY(fixture_family_ids)) > 4
       OR EXISTS (
           SELECT 1 FROM public.families
           WHERE id = ANY(fixture_family_ids)
             AND family_name <> CASE id
                 WHEN 'bbbbbbbb-0000-4b00-8000-000000000001' THEN 'Family A'
                 WHEN 'bbbbbbbb-0000-4b00-8000-000000000002' THEN 'Family B'
                 WHEN 'bbbbbbbb-0000-4b00-8000-000000000003' THEN 'Family C'
                 WHEN 'bbbbbbbb-0000-4b00-8000-000000000004' THEN 'Family D'
             END
       )
       OR (SELECT COUNT(*) FROM public.fee_obligations WHERE id = ANY(fixture_obligation_ids)) NOT IN (0, 13)
       OR (SELECT COUNT(*) FROM public.fee_obligations WHERE student_id = ANY(fixture_student_ids)) NOT IN (0, 13)
       OR (SELECT COUNT(*) FROM public.payments WHERE id = ANY(fixture_payment_ids)) NOT IN (0, 2)
       OR (SELECT COUNT(*) FROM public.payments WHERE student_id = ANY(fixture_student_ids)) NOT IN (0, 2)
       OR (SELECT COUNT(*) FROM public.credits WHERE student_id = ANY(fixture_student_ids)) NOT IN (0, 2)
       OR (SELECT COUNT(*) FROM public.payment_allocations WHERE id = ANY(fixture_allocation_ids)) NOT IN (0, 4)
       OR (SELECT COUNT(*) FROM public.payment_allocations WHERE obligation_id = ANY(fixture_obligation_ids)) NOT IN (0, 4)
       OR (SELECT COUNT(*) FROM public.receipts WHERE payment_id = ANY(fixture_payment_ids)) NOT IN (0, 2)
       OR (SELECT COUNT(*) FROM public.credits WHERE id = ANY(fixture_credit_ids)) NOT IN (0, 2)
       OR (SELECT COUNT(*) FROM public.student_fee_adjustments WHERE student_id = ANY(fixture_student_ids)) NOT IN (0, 1)
       OR (SELECT COUNT(*) FROM public.student_fee_adjustments
           WHERE id = 'dddddddd-0000-4d00-8000-000000000001'
             AND student_id = 'cccccccc-0000-4c00-8000-000000000005') NOT IN (0, 1)
       OR (SELECT COUNT(*) FROM public.students
           WHERE id = additional_student_id
             AND full_name = 'Idris Hussein'
             AND (family_id = family_d_id OR family_id IS NULL)) <> 1
       OR EXISTS (
           SELECT 1 FROM public.fee_obligations WHERE student_id = additional_student_id
       )
       OR EXISTS (
           SELECT 1 FROM public.payments WHERE student_id = additional_student_id
       )
       OR EXISTS (
           SELECT 1 FROM public.credits WHERE student_id = additional_student_id
       )
       OR EXISTS (
           SELECT 1 FROM public.student_fee_adjustments WHERE student_id = additional_student_id
       )
       OR EXISTS (
           SELECT 1 FROM public.students
           WHERE family_id = ANY(fixture_family_ids)
             AND id <> ALL(fixture_student_ids)
             AND id <> additional_student_id
       )
       OR EXISTS (
           SELECT 1 FROM public.payment_allocations
           WHERE payment_id = ANY(fixture_payment_ids)
             AND NOT (id = ANY(fixture_allocation_ids))
       )
       OR EXISTS (
           SELECT 1 FROM public.payment_allocations
           WHERE obligation_id = ANY(fixture_obligation_ids)
             AND NOT (id = ANY(fixture_allocation_ids))
       )
       OR EXISTS (
           SELECT 1 FROM public.credit_allocations
           WHERE credit_id = ANY(fixture_credit_ids)
       )
       OR EXISTS (
           SELECT 1 FROM public.payments
           WHERE family_id = ANY(fixture_family_ids)
       )
       OR EXISTS (
           SELECT 1 FROM public.credits
           WHERE family_id = ANY(fixture_family_ids)
       )
       OR EXISTS (
           SELECT 1 FROM public.audit_logs
           WHERE entity_id = ANY(fixture_student_ids)
              OR entity_id = ANY(fixture_family_ids)
              OR entity_id = ANY(fixture_obligation_ids)
              OR entity_id = ANY(fixture_payment_ids)
              OR entity_id = ANY(fixture_credit_ids)
       ) THEN
        RAISE EXCEPTION 'Demo cleanup stopped: seed data differs from the known fixtures or has additional financial history. No records were removed.';
    END IF;
END;
$$;

ALTER TABLE public.payment_allocations DISABLE TRIGGER protect_payment_allocations;
ALTER TABLE public.payments DISABLE TRIGGER protect_payments;
ALTER TABLE public.receipts DISABLE TRIGGER protect_receipts;
ALTER TABLE public.credits DISABLE TRIGGER protect_credits;
ALTER TABLE public.fee_obligations DISABLE TRIGGER protect_fee_obligations;

DELETE FROM public.payment_allocations
WHERE id IN (
    '15151515-0000-4151-8515-000000000001',
    '15151515-0000-4151-8515-000000000002',
    '15151515-0000-4151-8515-000000000003',
    '15151515-0000-4151-8515-000000000004'
);
DELETE FROM public.receipts
WHERE payment_id IN (
    '13131313-0000-4131-8313-000000000001',
    '13131313-0000-4131-8313-000000000002'
);
DELETE FROM public.credits
WHERE id IN (
    '14141414-0000-4141-8414-000000000001',
    '14141414-0000-4141-8414-000000000002'
);
DELETE FROM public.payments
WHERE id IN (
    '13131313-0000-4131-8313-000000000001',
    '13131313-0000-4131-8313-000000000002'
);
DELETE FROM public.fee_obligations
WHERE id IN (
    'eeeeeeee-0000-4e00-8000-000000000001',
    'eeeeeeee-0000-4e00-8000-000000000002',
    'eeeeeeee-0000-4e00-8000-000000000003',
    'eeeeeeee-0000-4e00-8000-000000000004',
    'eeeeeeee-0000-4e00-8000-000000000005',
    'eeeeeeee-0000-4e00-8000-000000000006',
    'eeeeeeee-0000-4e00-8000-000000000007',
    'eeeeeeee-0000-4e00-8000-000000000008',
    'eeeeeeee-0000-4e00-8000-000000000009',
    'eeeeeeee-0000-4e00-8000-000000000010',
    'eeeeeeee-0000-4e00-8000-000000000011',
    'eeeeeeee-0000-4e00-8000-000000000012',
    'eeeeeeee-0000-4e00-8000-000000000013'
);
DELETE FROM public.student_fee_adjustments
WHERE id = 'dddddddd-0000-4d00-8000-000000000001';
DELETE FROM public.students
WHERE id IN (
    'cccccccc-0000-4c00-8000-000000000001',
    'cccccccc-0000-4c00-8000-000000000002',
    'cccccccc-0000-4c00-8000-000000000003',
    'cccccccc-0000-4c00-8000-000000000004',
    'cccccccc-0000-4c00-8000-000000000005',
    'cccccccc-0000-4c00-8000-000000000006',
    'cccccccc-0000-4c00-8000-000000000007',
    'cccccccc-0000-4c00-8000-000000000008',
    'cccccccc-0000-4c00-8000-000000000009',
    'cccccccc-0000-4c00-8000-000000000010',
    'cccccccc-0000-4c00-8000-000000000011'
);

DO $$
DECLARE
    affected_rows INTEGER;
BEGIN
    UPDATE public.students
    SET family_id = NULL,
        updated_at = NOW()
    WHERE id = '0586c2cc-16e0-42c1-a80d-e8816bccb1ed'
      AND family_id = 'bbbbbbbb-0000-4b00-8000-000000000004';
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows > 1 THEN
        RAISE EXCEPTION 'Demo cleanup stopped: the separately added student could not be safely detached from placeholder Family D.';
    END IF;

    IF affected_rows = 1 THEN
        INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
        VALUES (
            NULL,
            'student_unlinked_from_demo_family',
            'student',
            '0586c2cc-16e0-42c1-a80d-e8816bccb1ed',
            jsonb_build_object(
                'previous_family_id', 'bbbbbbbb-0000-4b00-8000-000000000004',
                'family_id', NULL,
                'reason', 'Explicitly approved conversion to individual student while removing demo families'
            )
        );
    END IF;
END;
$$;

DELETE FROM public.families
WHERE id IN (
    'bbbbbbbb-0000-4b00-8000-000000000001',
    'bbbbbbbb-0000-4b00-8000-000000000002',
    'bbbbbbbb-0000-4b00-8000-000000000003',
    'bbbbbbbb-0000-4b00-8000-000000000004'
)
AND NOT EXISTS (
    SELECT 1
    FROM public.students
    WHERE students.family_id = families.id
);

ALTER TABLE public.payment_allocations ENABLE TRIGGER protect_payment_allocations;
ALTER TABLE public.payments ENABLE TRIGGER protect_payments;
ALTER TABLE public.receipts ENABLE TRIGGER protect_receipts;
ALTER TABLE public.credits ENABLE TRIGGER protect_credits;
ALTER TABLE public.fee_obligations ENABLE TRIGGER protect_fee_obligations;

INSERT INTO public.audit_logs (actor_id, action, entity_type, metadata)
VALUES (
    NULL,
    'development_seed_data_removed',
    'seed_dataset',
    jsonb_build_object(
        'dataset', '2026-development.sql',
        'expected_demo_student_count', 11,
        'expected_demo_family_count', 4,
        'unlinked_individual_student_id', '0586c2cc-16e0-42c1-a80d-e8816bccb1ed',
        'expected_test_obligation_count', 13,
        'expected_test_payment_count', 2,
        'safe_to_retry_after_demo_fixtures_have_already_been_removed', TRUE,
        'reason', 'Explicitly approved removal of known development seed fixtures'
    )
);

COMMIT;
