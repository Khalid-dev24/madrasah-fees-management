-- Academic year
INSERT INTO public.academic_years (id, label, start_date, end_date, is_current)
VALUES
  ('11111111-1111-4111-8111-111111111111', '2026', '2026-01-01', '2026-12-31', TRUE)
ON CONFLICT (label) DO NOTHING;

-- Terms
INSERT INTO public.terms (id, academic_year_id, number, name, start_date, end_date, is_current)
VALUES
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 1, 'First Term', '2026-01-01', '2026-06-30', FALSE),
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 2, 'Second Term', '2026-07-01', '2026-12-31', TRUE)
ON CONFLICT (academic_year_id, number) DO NOTHING;

-- Quarters
INSERT INTO public.quarters (id, academic_year_id, term_id, number, name, start_date, end_date, due_date, is_current)
VALUES
  ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 1, 'Q1', '2026-01-01', '2026-03-31', '2026-03-31', FALSE),
  ('55555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 2, 'Q2', '2026-04-01', '2026-06-30', '2026-06-30', FALSE),
  ('66666666-6666-4666-8666-666666666666', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 3, 'Q3', '2026-07-01', '2026-09-30', '2026-09-30', FALSE),
  ('77777777-7777-4777-8777-777777777777', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 4, 'Q4', '2026-10-01', '2026-12-31', '2026-12-31', TRUE)
ON CONFLICT (academic_year_id, term_id, number) DO NOTHING;

-- Months
INSERT INTO public.months (id, academic_year_id, quarter_id, month_number, month_name, start_date, end_date, is_current)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444', 1, 'January', '2026-01-01', '2026-01-31', FALSE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444', 2, 'February', '2026-02-01', '2026-02-28', FALSE),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444', 3, 'March', '2026-03-01', '2026-03-31', FALSE),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '11111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555555', 4, 'April', '2026-04-01', '2026-04-30', FALSE),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '11111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555555', 5, 'May', '2026-05-01', '2026-05-31', FALSE),
  ('ffffffff-ffff-4fff-8fff-fffffffffffe', '11111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555555', 6, 'June', '2026-06-01', '2026-06-30', FALSE),
  ('12121212-1212-4121-8212-121212121212', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666666', 7, 'July', '2026-07-01', '2026-07-31', FALSE),
  ('13131313-1313-4131-8313-131313131313', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666666', 8, 'August', '2026-08-01', '2026-08-31', FALSE),
  ('14141414-1414-4141-8414-141414141414', '11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666666', 9, 'September', '2026-09-01', '2026-09-30', FALSE),
  ('15151515-1515-4151-8515-151515151515', '11111111-1111-4111-8111-111111111111', '77777777-7777-4777-8777-777777777777', 10, 'October', '2026-10-01', '2026-10-31', TRUE),
  ('16161616-1616-4161-8616-161616161616', '11111111-1111-4111-8111-111111111111', '77777777-7777-4777-8777-777777777777', 11, 'November', '2026-11-01', '2026-11-30', TRUE),
  ('17171717-1717-4171-8717-171717171717', '11111111-1111-4111-8111-111111111111', '77777777-7777-4777-8777-777777777777', 12, 'December', '2026-12-01', '2026-12-31', TRUE)
ON CONFLICT (academic_year_id, quarter_id, month_number) DO NOTHING;

-- Classes
INSERT INTO public.classes (id, name, level, is_active)
VALUES
  ('aaaaaaaa-0000-4a00-8000-000000000001', 'Primary 1', 'Primary', TRUE),
  ('aaaaaaaa-0000-4a00-8000-000000000002', 'Primary 2', 'Primary', TRUE),
  ('aaaaaaaa-0000-4a00-8000-000000000003', 'Primary 3', 'Primary', TRUE),
  ('aaaaaaaa-0000-4a00-8000-000000000004', 'Secondary 1', 'Secondary', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Family structure
INSERT INTO public.families (id, family_name, primary_contact_name, phone, email, address, status)
VALUES
  ('bbbbbbbb-0000-4b00-8000-000000000001', 'Family A', 'Amina Yusuf', '08012345678', 'familya@example.com', 'No. 1 Madrasah Road', 'active'),
  ('bbbbbbbb-0000-4b00-8000-000000000002', 'Family B', 'Sulaiman Bello', '08087654321', 'familyb@example.com', 'No. 2 Madrasah Road', 'active'),
  ('bbbbbbbb-0000-4b00-8000-000000000003', 'Family C', 'Hauwa Salihu', '08013579246', 'familyc@example.com', 'No. 3 Madrasah Road', 'active'),
  ('bbbbbbbb-0000-4b00-8000-000000000004', 'Family D', 'Musa Ahmed', '08024681357', 'familyd@example.com', 'No. 4 Madrasah Road', 'active')
ON CONFLICT DO NOTHING;

-- Students
INSERT INTO public.students (id, family_id, class_id, full_name, gender, date_of_birth, parent_name, parent_phone, parent_email, admission_date, status, payment_frequency, notes)
VALUES
  ('cccccccc-0000-4c00-8000-000000000001', 'bbbbbbbb-0000-4b00-8000-000000000001', 'aaaaaaaa-0000-4a00-8000-000000000001', 'Abubakar Yusuf', 'male', '2014-01-15', 'Amina Yusuf', '08012345678', 'familya@example.com', '2021-09-10', 'active', 'monthly', 'Standard monthly fee'),
  ('cccccccc-0000-4c00-8000-000000000002', 'bbbbbbbb-0000-4b00-8000-000000000001', 'aaaaaaaa-0000-4a00-8000-000000000002', 'Maryam Yusuf', 'female', '2015-02-20', 'Amina Yusuf', '08012345678', 'familya@example.com', '2022-01-12', 'active', 'monthly', 'Standard monthly fee'),
  ('cccccccc-0000-4c00-8000-000000000003', 'bbbbbbbb-0000-4b00-8000-000000000001', 'aaaaaaaa-0000-4a00-8000-000000000003', 'Zainab Yusuf', 'female', '2016-05-05', 'Amina Yusuf', '08012345678', 'familya@example.com', '2023-01-07', 'active', 'monthly', 'Standard monthly fee'),
  ('cccccccc-0000-4c00-8000-000000000004', 'bbbbbbbb-0000-4b00-8000-000000000002', 'aaaaaaaa-0000-4a00-8000-000000000001', 'Ali Bello', 'male', '2014-11-18', 'Sulaiman Bello', '08087654321', 'familyb@example.com', '2020-09-15', 'active', 'monthly', 'Family with 1 child'),
  ('cccccccc-0000-4c00-8000-000000000005', 'bbbbbbbb-0000-4b00-8000-000000000003', 'aaaaaaaa-0000-4a00-8000-000000000002', 'Musa Salihu', 'male', '2015-09-09', 'Hauwa Salihu', '08013579246', 'familyc@example.com', '2022-02-01', 'active', 'monthly', 'Custom fee student'),
  ('cccccccc-0000-4c00-8000-000000000006', 'bbbbbbbb-0000-4b00-8000-000000000003', 'aaaaaaaa-0000-4a00-8000-000000000003', 'Fatima Salihu', 'female', '2016-07-11', 'Hauwa Salihu', '08013579246', 'familyc@example.com', '2023-04-03', 'active', 'monthly', 'Custom fee student'),
  ('cccccccc-0000-4c00-8000-000000000007', 'bbbbbbbb-0000-4b00-8000-000000000003', 'aaaaaaaa-0000-4a00-8000-000000000004', 'Umar Salihu', 'male', '2017-04-22', 'Hauwa Salihu', '08013579246', 'familyc@example.com', '2024-08-13', 'active', 'monthly', 'Custom fee student'),
  ('cccccccc-0000-4c00-8000-000000000008', 'bbbbbbbb-0000-4b00-8000-000000000004', 'aaaaaaaa-0000-4a00-8000-000000000001', 'Hassan Ahmed', 'male', '2013-10-30', 'Musa Ahmed', '08024681357', 'familyd@example.com', '2019-09-20', 'active', 'quarterly', 'Four-child family example'),
  ('cccccccc-0000-4c00-8000-000000000009', 'bbbbbbbb-0000-4b00-8000-000000000004', 'aaaaaaaa-0000-4a00-8000-000000000002', 'Aisha Ahmed', 'female', '2014-08-16', 'Musa Ahmed', '08024681357', 'familyd@example.com', '2020-09-20', 'active', 'monthly', 'Four-child family example'),
  ('cccccccc-0000-4c00-8000-000000000010', 'bbbbbbbb-0000-4b00-8000-000000000004', 'aaaaaaaa-0000-4a00-8000-000000000003', 'Yusuf Ahmed', 'male', '2016-03-12', 'Musa Ahmed', '08024681357', 'familyd@example.com', '2022-09-20', 'active', 'monthly', 'Four-child family example'),
  ('cccccccc-0000-4c00-8000-000000000011', 'bbbbbbbb-0000-4b00-8000-000000000004', 'aaaaaaaa-0000-4a00-8000-000000000004', 'Khadija Ahmed', 'female', '2017-06-14', 'Musa Ahmed', '08024681357', 'familyd@example.com', '2023-09-20', 'active', 'monthly', 'Four-child family example')
ON CONFLICT DO NOTHING;

-- Custom fee student 
INSERT INTO public.student_fee_adjustments (id, student_id, custom_monthly_fee_kobo, effective_from, effective_to, reason, notes)
VALUES
  ('dddddddd-0000-4d00-8000-000000000001', 'cccccccc-0000-4c00-8000-000000000005', 400000, '2026-10-01', NULL, 'Fee privilege', 'Student receives ₦4,000 from October onwards')
ON CONFLICT DO NOTHING;

-- Fee obligations for Q4 2026
INSERT INTO public.fee_obligations (id, student_id, family_id, month_id, obligation_date, due_date, expected_kobo)
VALUES
  ('eeeeeeee-0000-4e00-8000-000000000001', 'cccccccc-0000-4c00-8000-000000000001', 'bbbbbbbb-0000-4b00-8000-000000000001', '15151515-1515-4151-8515-151515151515', '2026-10-01', '2026-10-31', 500000),
  ('eeeeeeee-0000-4e00-8000-000000000002', 'cccccccc-0000-4c00-8000-000000000002', 'bbbbbbbb-0000-4b00-8000-000000000001', '15151515-1515-4151-8515-151515151515', '2026-10-01', '2026-10-31', 500000),
  ('eeeeeeee-0000-4e00-8000-000000000003', 'cccccccc-0000-4c00-8000-000000000003', 'bbbbbbbb-0000-4b00-8000-000000000001', '15151515-1515-4151-8515-151515151515', '2026-10-01', '2026-10-31', 500000),
  ('eeeeeeee-0000-4e00-8000-000000000004', 'cccccccc-0000-4c00-8000-000000000005', 'bbbbbbbb-0000-4b00-8000-000000000003', '15151515-1515-4151-8515-151515151515', '2026-10-01', '2026-10-31', 400000),
  ('eeeeeeee-0000-4e00-8000-000000000005', 'cccccccc-0000-4c00-8000-000000000006', 'bbbbbbbb-0000-4b00-8000-000000000003', '15151515-1515-4151-8515-151515151515', '2026-10-01', '2026-10-31', 500000),
  ('eeeeeeee-0000-4e00-8000-000000000006', 'cccccccc-0000-4c00-8000-000000000007', 'bbbbbbbb-0000-4b00-8000-000000000003', '15151515-1515-4151-8515-151515151515', '2026-10-01', '2026-10-31', 500000),
  ('eeeeeeee-0000-4e00-8000-000000000007', 'cccccccc-0000-4c00-8000-000000000008', 'bbbbbbbb-0000-4b00-8000-000000000004', '15151515-1515-4151-8515-151515151515', '2026-10-01', '2026-10-31', 500000),
  ('eeeeeeee-0000-4e00-8000-000000000011', 'cccccccc-0000-4c00-8000-000000000009', 'bbbbbbbb-0000-4b00-8000-000000000004', '15151515-1515-4151-8515-151515151515', '2026-10-01', '2026-10-31', 500000),
  ('eeeeeeee-0000-4e00-8000-000000000012', 'cccccccc-0000-4c00-8000-000000000010', 'bbbbbbbb-0000-4b00-8000-000000000004', '15151515-1515-4151-8515-151515151515', '2026-10-01', '2026-10-31', 500000),
  ('eeeeeeee-0000-4e00-8000-000000000013', 'cccccccc-0000-4c00-8000-000000000011', 'bbbbbbbb-0000-4b00-8000-000000000004', '15151515-1515-4151-8515-151515151515', '2026-10-01', '2026-10-31', 500000),
  ('eeeeeeee-0000-4e00-8000-000000000008', 'cccccccc-0000-4c00-8000-000000000001', 'bbbbbbbb-0000-4b00-8000-000000000001', '16161616-1616-4161-8616-161616161616', '2026-11-01', '2026-11-30', 500000),
  ('eeeeeeee-0000-4e00-8000-000000000009', 'cccccccc-0000-4c00-8000-000000000005', 'bbbbbbbb-0000-4b00-8000-000000000003', '16161616-1616-4161-8616-161616161616', '2026-11-01', '2026-11-30', 400000),
  ('eeeeeeee-0000-4e00-8000-000000000010', 'cccccccc-0000-4c00-8000-000000000001', 'bbbbbbbb-0000-4b00-8000-000000000001', '17171717-1717-4171-8717-171717171717', '2026-12-01', '2026-12-31', 500000)
ON CONFLICT DO NOTHING;

-- Family discount rules
INSERT INTO public.family_discount_rules (id, minimum_family_size, discount_per_eligible_student_kobo, is_active, valid_from)
VALUES
  ('ffffffff-0000-4f00-8000-000000000001', 3, 100000, TRUE, '2026-01-01')
ON CONFLICT DO NOTHING;

-- Fee settings
INSERT INTO public.fee_settings (id, monthly_kobo, quarterly_kobo, term_kobo, annual_kobo, currency, is_active)
VALUES
  ('12121212-0000-4121-8212-000000000001', 500000, 1500000, 3000000, 6000000, 'NGN', TRUE)
ON CONFLICT DO NOTHING;

-- Sample payment and credit awareness
INSERT INTO public.payments (id, student_id, family_id, amount_kobo, payment_date, payment_method, reference, notes, receipt_number, recorded_by)
VALUES
  ('13131313-0000-4131-8313-000000000001', 'cccccccc-0000-4c00-8000-000000000001', NULL, 2000000, '2026-10-20', 'bank_transfer', 'REF-1001', 'October instalment', 'DBM-2026-000001', NULL),
  ('13131313-0000-4131-8313-000000000002', 'cccccccc-0000-4c00-8000-000000000005', NULL, 500000, '2026-10-18', 'cash', 'REF-1002', 'Partial custom-fee payment', 'DBM-2026-000002', NULL)
ON CONFLICT (receipt_number) DO NOTHING;

INSERT INTO public.payment_allocations (id, payment_id, obligation_id, allocated_kobo, allocation_order)
VALUES
  ('15151515-0000-4151-8515-000000000001', '13131313-0000-4131-8313-000000000001', 'eeeeeeee-0000-4e00-8000-000000000001', 500000, 1),
  ('15151515-0000-4151-8515-000000000002', '13131313-0000-4131-8313-000000000001', 'eeeeeeee-0000-4e00-8000-000000000008', 500000, 2),
  ('15151515-0000-4151-8515-000000000003', '13131313-0000-4131-8313-000000000001', 'eeeeeeee-0000-4e00-8000-000000000010', 500000, 3),
  ('15151515-0000-4151-8515-000000000004', '13131313-0000-4131-8313-000000000002', 'eeeeeeee-0000-4e00-8000-000000000004', 400000, 1)
ON CONFLICT DO NOTHING;

INSERT INTO public.receipts (payment_id, receipt_number, content_json)
VALUES
  ('13131313-0000-4131-8313-000000000001', 'DBM-2026-000001', '{"institution_name":"Dārul Bayān Madrasah","seed":true}'::jsonb),
  ('13131313-0000-4131-8313-000000000002', 'DBM-2026-000002', '{"institution_name":"Dārul Bayān Madrasah","seed":true}'::jsonb)
ON CONFLICT (payment_id) DO NOTHING;

INSERT INTO public.credits (id, student_id, family_id, source_payment_id, amount_kobo, remaining_kobo, created_at)
VALUES
  ('14141414-0000-4141-8414-000000000001', 'cccccccc-0000-4c00-8000-000000000001', NULL, '13131313-0000-4131-8313-000000000001', 500000, 500000, NOW()),
  ('14141414-0000-4141-8414-000000000002', 'cccccccc-0000-4c00-8000-000000000005', NULL, '13131313-0000-4131-8313-000000000002', 100000, 100000, NOW())
ON CONFLICT DO NOTHING;
