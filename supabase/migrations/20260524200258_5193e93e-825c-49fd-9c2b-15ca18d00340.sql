
-- Admin role infrastructure
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE POLICY "Admins read roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Families
CREATE TABLE public.families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_name TEXT NOT NULL,
  access_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read families" ON public.families FOR SELECT USING (true);
CREATE POLICY "Admins manage families" ON public.families FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Prompts
CREATE TABLE public.prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  instruction TEXT NOT NULL,
  helper_text TEXT,
  required BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  location_category TEXT,
  is_bonus BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read prompts" ON public.prompts FOR SELECT USING (true);
CREATE POLICY "Admins manage prompts" ON public.prompts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Submissions
CREATE TYPE public.review_status AS ENUM ('pending','approved','rejected');

CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES public.prompts(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  review_status public.review_status NOT NULL DEFAULT 'pending',
  include_in_family_collage BOOLEAN NOT NULL DEFAULT true,
  include_in_combined_collage BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(family_id, prompt_id)
);
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read submissions" ON public.submissions FOR SELECT USING (true);
CREATE POLICY "Public can insert submissions" ON public.submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update own submissions" ON public.submissions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Admins delete submissions" ON public.submissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Collages
CREATE TABLE public.collages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES public.families(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('family','combined')),
  collage_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.collages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read collages" ON public.collages FOR SELECT USING (true);
CREATE POLICY "Admins manage collages" ON public.collages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('photos','photos', true);
CREATE POLICY "Public read photos" ON storage.objects FOR SELECT USING (bucket_id = 'photos');
CREATE POLICY "Public upload photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'photos');
CREATE POLICY "Admins delete photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'photos' AND public.has_role(auth.uid(),'admin'));
