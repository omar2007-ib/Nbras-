-- ATHAR: safely promote an already-created Auth user to the initial owner.
-- Run ONLY in Supabase SQL Editor (trusted admin context).
-- 1) Create the intended user in Supabase Dashboard > Authentication > Users first.
-- 2) Replace BOTH occurrences of YOUR_EMAIL@example.com below with that exact account email.
-- 3) Run this script. It does not create users and fails if the email is missing.
DO $$
DECLARE
  target_email text := lower(trim('YOUR_EMAIL@example.com'));
  target_user_id uuid;
BEGIN
  IF target_email = '' OR target_email = 'your_email@example.com' THEN
    RAISE EXCEPTION 'Replace YOUR_EMAIL@example.com with the exact email of the Auth user before running this script.';
  END IF;

  SELECT id
    INTO target_user_id
    FROM auth.users
   WHERE lower(email) = target_email
   LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No Supabase Auth user exists for %. Create that user in Authentication > Users first.', target_email;
  END IF;

  INSERT INTO public.profiles (id, display_name, role, updated_at)
  VALUES (target_user_id, 'مالك أثَر', 'owner', now())
  ON CONFLICT (id) DO UPDATE
    SET role = 'owner',
        updated_at = now();
END
$$;

-- Verification: replace the email here too; this must return one row with role = owner.
SELECT u.email, p.id, p.role
FROM auth.users AS u
JOIN public.profiles AS p ON p.id = u.id
WHERE lower(u.email) = lower(trim('YOUR_EMAIL@example.com'));
