
-- Remove the old open claim function
DROP FUNCTION IF EXISTS public.claim_admin_if_none();

-- Clear any existing admin rows so only the designated email can hold admin
DELETE FROM public.user_roles WHERE role = 'admin';

-- Trigger function: grant admin only to the designated email
CREATE OR REPLACE FUNCTION public.grant_admin_to_designated_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'danash1611@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_admin
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.grant_admin_to_designated_email();
