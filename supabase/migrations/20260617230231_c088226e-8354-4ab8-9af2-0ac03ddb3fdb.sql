
-- 1. Drop overly-permissive public policies on families
DROP POLICY IF EXISTS "Public can read families" ON public.families;

-- 2. Drop overly-permissive public policies on submissions
DROP POLICY IF EXISTS "Public can insert submissions" ON public.submissions;
DROP POLICY IF EXISTS "Public can update own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Public can delete submissions" ON public.submissions;
-- Keep "Public can read submissions" so combined collage previews still load.

-- 3. Drop overly-permissive public storage policies on the photos bucket
DROP POLICY IF EXISTS "Public can delete photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read photos" ON storage.objects;
-- Public bucket URLs (/object/public/photos/...) still work without a SELECT policy.
-- Keep "Public upload photos" (INSERT) so uploads continue to work.

-- 4. Helper: look up a family by code without leaking the access_code column
CREATE OR REPLACE FUNCTION public.get_family_by_code(_code text)
RETURNS TABLE(id uuid, family_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, family_name FROM public.families WHERE access_code = _code
$$;

REVOKE ALL ON FUNCTION public.get_family_by_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_family_by_code(text) TO anon, authenticated;

-- 5. Create submission with code verification
CREATE OR REPLACE FUNCTION public.create_family_submission(
  _code text,
  _prompt_id uuid,
  _photo_url text,
  _caption text DEFAULT NULL
)
RETURNS public.submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fam_id uuid;
  result public.submissions;
BEGIN
  IF _code IS NULL OR length(_code) = 0 THEN RAISE EXCEPTION 'invalid_code'; END IF;
  IF _photo_url IS NULL OR length(_photo_url) = 0 THEN RAISE EXCEPTION 'invalid_photo_url'; END IF;
  SELECT id INTO fam_id FROM public.families WHERE access_code = _code;
  IF fam_id IS NULL THEN RAISE EXCEPTION 'invalid_code'; END IF;
  INSERT INTO public.submissions(family_id, prompt_id, photo_url, caption)
  VALUES (fam_id, _prompt_id, _photo_url, NULLIF(_caption, ''))
  RETURNING * INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_family_submission(text, uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_family_submission(text, uuid, text, text) TO anon, authenticated;

-- 6. Update submission with code verification (jsonb patch, allowlisted fields)
CREATE OR REPLACE FUNCTION public.update_family_submission(
  _code text,
  _submission_id uuid,
  _patch jsonb
)
RETURNS public.submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fam_id uuid;
  result public.submissions;
BEGIN
  IF _code IS NULL OR length(_code) = 0 THEN RAISE EXCEPTION 'invalid_code'; END IF;
  SELECT id INTO fam_id FROM public.families WHERE access_code = _code;
  IF fam_id IS NULL THEN RAISE EXCEPTION 'invalid_code'; END IF;

  UPDATE public.submissions SET
    caption = CASE WHEN _patch ? 'caption'
                   THEN NULLIF(_patch->>'caption', '') ELSE caption END,
    photo_url = CASE WHEN _patch ? 'photo_url'
                   THEN _patch->>'photo_url' ELSE photo_url END,
    review_status = CASE WHEN _patch ? 'review_status'
                   THEN (_patch->>'review_status')::review_status ELSE review_status END,
    include_in_family_collage = CASE WHEN _patch ? 'include_in_family_collage'
                   THEN (_patch->>'include_in_family_collage')::boolean ELSE include_in_family_collage END,
    include_in_combined_collage = CASE WHEN _patch ? 'include_in_combined_collage'
                   THEN (_patch->>'include_in_combined_collage')::boolean ELSE include_in_combined_collage END
  WHERE id = _submission_id AND family_id = fam_id
  RETURNING * INTO result;

  IF result.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.update_family_submission(text, uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.update_family_submission(text, uuid, jsonb) TO anon, authenticated;

-- 7. Delete submission with code verification, also cleans up the storage object
CREATE OR REPLACE FUNCTION public.delete_family_submission(
  _code text,
  _submission_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  fam_id uuid;
  photo text;
  obj_path text;
BEGIN
  IF _code IS NULL OR length(_code) = 0 THEN RAISE EXCEPTION 'invalid_code'; END IF;
  SELECT id INTO fam_id FROM public.families WHERE access_code = _code;
  IF fam_id IS NULL THEN RAISE EXCEPTION 'invalid_code'; END IF;

  SELECT photo_url INTO photo FROM public.submissions
   WHERE id = _submission_id AND family_id = fam_id;
  IF photo IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;

  DELETE FROM public.submissions WHERE id = _submission_id;

  -- best-effort storage cleanup
  obj_path := regexp_replace(photo, '^.*/storage/v1/object/public/photos/', '');
  IF obj_path <> photo AND length(obj_path) > 0 THEN
    DELETE FROM storage.objects WHERE bucket_id = 'photos' AND name = obj_path;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_family_submission(text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_family_submission(text, uuid) TO anon, authenticated;

-- 8. Tighten has_role: only used inside RLS policies for authenticated users.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
