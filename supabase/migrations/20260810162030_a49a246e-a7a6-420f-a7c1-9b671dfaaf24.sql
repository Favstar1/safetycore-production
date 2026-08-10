-- ENUMS
CREATE TYPE public.app_role AS ENUM ('FIELD_ASSOCIATE','PV_COORDINATOR','PV_MANAGER','ADMIN');
CREATE TYPE public.case_status AS ENUM ('Triage','Coding','Medical Review','QC','Submitted','Closed');
CREATE TYPE public.seriousness AS ENUM ('Serious','Non-serious');
CREATE TYPE public.signal_status AS ENUM ('New','Under Validation','Confirmed','Refuted');
CREATE TYPE public.wa_status AS ENUM ('New','Converted','Not Reportable');

-- ORGANIZATIONS
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER HELPERS
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_org()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'PV_MANAGER') OR public.has_role(auth.uid(),'ADMIN');
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'ADMIN');
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE POLICY "org members read org" ON public.organizations FOR SELECT TO authenticated USING (id = public.current_org());
CREATE POLICY "read profiles in org" ON public.profiles FOR SELECT TO authenticated USING (org_id = public.current_org());
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid() AND org_id = public.current_org());
CREATE POLICY "admin updates profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin() AND org_id = public.current_org()) WITH CHECK (org_id = public.current_org());
CREATE POLICY "read roles in org" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_roles.user_id AND p.org_id = public.current_org()));
GRANT INSERT, DELETE ON public.user_roles TO authenticated;
CREATE POLICY "admin grants roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.org_id = public.current_org()));
CREATE POLICY "admin revokes roles" ON public.user_roles FOR DELETE TO authenticated
  USING (public.is_admin() AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.org_id = public.current_org()));

-- PRODUCTS
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  client_name text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read products" ON public.products FOR SELECT TO authenticated USING (org_id = public.current_org());
CREATE POLICY "admin writes products" ON public.products FOR ALL TO authenticated
  USING (public.is_admin() AND org_id = public.current_org()) WITH CHECK (public.is_admin() AND org_id = public.current_org());

-- SITES
CREATE TABLE public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  location text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites TO authenticated;
GRANT ALL ON public.sites TO service_role;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read sites" ON public.sites FOR SELECT TO authenticated USING (org_id = public.current_org());
CREATE POLICY "admin writes sites" ON public.sites FOR ALL TO authenticated
  USING (public.is_admin() AND org_id = public.current_org()) WITH CHECK (public.is_admin() AND org_id = public.current_org());

-- CASES
CREATE SEQUENCE public.case_seq START 1000;
CREATE TABLE public.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_number text NOT NULL UNIQUE,
  status public.case_status NOT NULL DEFAULT 'Triage',
  channel text NOT NULL DEFAULT 'Direct Entry',
  report_type text NOT NULL DEFAULT 'Initial',
  follow_up_count int NOT NULL DEFAULT 0,
  reporter_type text,
  reporter_name text,
  reporter_contact text,
  patient_initials text,
  patient_age int,
  patient_sex text,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  batch_number text,
  meddra_term text NOT NULL,
  meddra_soc text,
  coding_complete boolean NOT NULL DEFAULT false,
  medical_review_complete boolean NOT NULL DEFAULT false,
  qc_complete boolean NOT NULL DEFAULT false,
  event_description text,
  narrative text,
  onset_date date,
  seriousness public.seriousness NOT NULL DEFAULT 'Non-serious',
  criteria_death boolean NOT NULL DEFAULT false,
  criteria_hospitalization boolean NOT NULL DEFAULT false,
  criteria_life_threatening boolean NOT NULL DEFAULT false,
  criteria_disability boolean NOT NULL DEFAULT false,
  criteria_other boolean NOT NULL DEFAULT false,
  severity text,
  outcome text,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  received_date date NOT NULL DEFAULT current_date,
  due_date date NOT NULL,
  submitted_at timestamptz,
  submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cases_org_idx ON public.cases(org_id);
CREATE INDEX cases_assigned_idx ON public.cases(assigned_to);
CREATE INDEX cases_status_idx ON public.cases(status);
CREATE INDEX cases_due_idx ON public.cases(due_date);
CREATE INDEX cases_search_idx ON public.cases USING gin (to_tsvector('english', case_number || ' ' || product_name || ' ' || meddra_term || ' ' || coalesce(narrative,'')));
CREATE TRIGGER cases_updated BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT, INSERT, UPDATE ON public.cases TO authenticated;
GRANT ALL ON public.cases TO service_role;
GRANT USAGE ON SEQUENCE public.case_seq TO authenticated, service_role;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_see_case(_org uuid, _assigned uuid, _created uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _org = public.current_org() AND (
    public.is_manager()
    OR (public.has_role(auth.uid(),'PV_COORDINATOR') AND (_assigned = auth.uid() OR _created = auth.uid()))
    OR (public.has_role(auth.uid(),'FIELD_ASSOCIATE') AND _created = auth.uid())
  );
$$;

CREATE POLICY "read permitted cases" ON public.cases FOR SELECT TO authenticated
  USING (public.can_see_case(org_id, assigned_to, created_by));
CREATE POLICY "create cases in org" ON public.cases FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org() AND created_by = auth.uid());
CREATE POLICY "update permitted cases" ON public.cases FOR UPDATE TO authenticated
  USING (org_id = public.current_org() AND (public.is_manager() OR assigned_to = auth.uid()))
  WITH CHECK (org_id = public.current_org() AND (public.is_manager() OR assigned_to = auth.uid()));

-- CASE FOLLOW UPS
CREATE TABLE public.case_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  request text NOT NULL,
  response text,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date date,
  status text NOT NULL DEFAULT 'Open',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cfu_case_idx ON public.case_follow_ups(case_id);
CREATE TRIGGER cfu_updated BEFORE UPDATE ON public.case_follow_ups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT, INSERT, UPDATE ON public.case_follow_ups TO authenticated;
GRANT ALL ON public.case_follow_ups TO service_role;
ALTER TABLE public.case_follow_ups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read follow ups" ON public.case_follow_ups FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND public.can_see_case(c.org_id, c.assigned_to, c.created_by)));
CREATE POLICY "write follow ups" ON public.case_follow_ups FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND org_id = public.current_org()
    AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND c.org_id = public.current_org() AND (public.is_manager() OR c.assigned_to = auth.uid())));
CREATE POLICY "update follow ups" ON public.case_follow_ups FOR UPDATE TO authenticated
  USING (org_id = public.current_org() AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND (public.is_manager() OR c.assigned_to = auth.uid())))
  WITH CHECK (org_id = public.current_org());

-- CASE CODINGS (history)
CREATE TABLE public.case_codings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  meddra_term text NOT NULL,
  meddra_soc text,
  dictionary_version text NOT NULL DEFAULT 'INTERNAL-DEMO',
  coded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cc_case_idx ON public.case_codings(case_id);
GRANT SELECT, INSERT ON public.case_codings TO authenticated;
GRANT ALL ON public.case_codings TO service_role;
ALTER TABLE public.case_codings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read codings" ON public.case_codings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND public.can_see_case(c.org_id, c.assigned_to, c.created_by)));
CREATE POLICY "insert codings" ON public.case_codings FOR INSERT TO authenticated
  WITH CHECK (coded_by = auth.uid() AND org_id = public.current_org()
    AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND (public.is_manager() OR c.assigned_to = auth.uid())));

-- AUDIT EVENTS (append only)
CREATE TABLE public.case_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
  entity text NOT NULL DEFAULT 'case',
  entity_id uuid,
  action text NOT NULL,
  actor_id uuid NOT NULL,
  actor_name text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cae_case_idx ON public.case_audit_events(case_id);
CREATE INDEX cae_org_idx ON public.case_audit_events(org_id, created_at DESC);
GRANT SELECT, INSERT ON public.case_audit_events TO authenticated;
GRANT ALL ON public.case_audit_events TO service_role;
ALTER TABLE public.case_audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read audit in org" ON public.case_audit_events FOR SELECT TO authenticated USING (org_id = public.current_org());
CREATE POLICY "append audit" ON public.case_audit_events FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() AND org_id = public.current_org());

-- CASE SUBMISSIONS
CREATE TABLE public.case_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  destination text NOT NULL DEFAULT 'NAFDAC (manual export)',
  message_type text NOT NULL DEFAULT 'E2B(R3)',
  state text NOT NULL DEFAULT 'Exported',
  attested_by uuid NOT NULL,
  attestation_text text NOT NULL,
  payload_preview text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.case_submissions TO authenticated;
GRANT ALL ON public.case_submissions TO service_role;
ALTER TABLE public.case_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read submissions" ON public.case_submissions FOR SELECT TO authenticated USING (org_id = public.current_org());
CREATE POLICY "insert submissions" ON public.case_submissions FOR INSERT TO authenticated
  WITH CHECK (attested_by = auth.uid() AND org_id = public.current_org()
    AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND (public.is_manager() OR c.assigned_to = auth.uid())));

-- WHATSAPP
CREATE TABLE public.whatsapp_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  thread_ref text NOT NULL,
  contact text NOT NULL,
  contact_name text NOT NULL,
  reporter_type text,
  status public.wa_status NOT NULL DEFAULT 'New',
  consent boolean NOT NULL DEFAULT false,
  criteria_reporter boolean NOT NULL DEFAULT false,
  criteria_patient boolean NOT NULL DEFAULT false,
  criteria_product boolean NOT NULL DEFAULT false,
  criteria_event boolean NOT NULL DEFAULT false,
  linked_case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, thread_ref)
);
CREATE TRIGGER wa_updated BEFORE UPDATE ON public.whatsapp_threads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_threads TO authenticated;
GRANT ALL ON public.whatsapp_threads TO service_role;
ALTER TABLE public.whatsapp_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read wa threads" ON public.whatsapp_threads FOR SELECT TO authenticated
  USING (org_id = public.current_org() AND NOT public.has_role(auth.uid(),'FIELD_ASSOCIATE'));
CREATE POLICY "write wa threads" ON public.whatsapp_threads FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org() AND NOT public.has_role(auth.uid(),'FIELD_ASSOCIATE'));
CREATE POLICY "update wa threads" ON public.whatsapp_threads FOR UPDATE TO authenticated
  USING (org_id = public.current_org() AND NOT public.has_role(auth.uid(),'FIELD_ASSOCIATE'))
  WITH CHECK (org_id = public.current_org());

CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.whatsapp_threads(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  direction text NOT NULL,
  body text NOT NULL,
  sender text,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wam_thread_idx ON public.whatsapp_messages(thread_id, sent_at);
GRANT SELECT, INSERT ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read wa messages" ON public.whatsapp_messages FOR SELECT TO authenticated
  USING (org_id = public.current_org() AND NOT public.has_role(auth.uid(),'FIELD_ASSOCIATE'));
CREATE POLICY "insert wa messages" ON public.whatsapp_messages FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org() AND NOT public.has_role(auth.uid(),'FIELD_ASSOCIATE'));

CREATE TABLE public.whatsapp_extracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.whatsapp_threads(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_name text,
  meddra_term text,
  serious_flag boolean NOT NULL DEFAULT false,
  narrative text,
  confirmed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (thread_id)
);
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_extracts TO authenticated;
GRANT ALL ON public.whatsapp_extracts TO service_role;
ALTER TABLE public.whatsapp_extracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read wa extracts" ON public.whatsapp_extracts FOR SELECT TO authenticated
  USING (org_id = public.current_org() AND NOT public.has_role(auth.uid(),'FIELD_ASSOCIATE'));
CREATE POLICY "write wa extracts" ON public.whatsapp_extracts FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org() AND NOT public.has_role(auth.uid(),'FIELD_ASSOCIATE'));
CREATE POLICY "update wa extracts" ON public.whatsapp_extracts FOR UPDATE TO authenticated
  USING (org_id = public.current_org() AND NOT public.has_role(auth.uid(),'FIELD_ASSOCIATE'))
  WITH CHECK (org_id = public.current_org());

-- SIGNALS
CREATE TABLE public.signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  signal_ref text NOT NULL,
  product_name text NOT NULL,
  meddra_term text NOT NULL,
  case_count int NOT NULL DEFAULT 0,
  period_start date,
  period_end date,
  status public.signal_status NOT NULL DEFAULT 'New',
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_decision text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, product_name, meddra_term)
);
CREATE TRIGGER signals_updated BEFORE UPDATE ON public.signals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT, INSERT, UPDATE ON public.signals TO authenticated;
GRANT ALL ON public.signals TO service_role;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read signals" ON public.signals FOR SELECT TO authenticated
  USING (org_id = public.current_org() AND NOT public.has_role(auth.uid(),'FIELD_ASSOCIATE'));
CREATE POLICY "insert signals" ON public.signals FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org() AND NOT public.has_role(auth.uid(),'FIELD_ASSOCIATE'));
CREATE POLICY "coordinator flags signal" ON public.signals FOR UPDATE TO authenticated
  USING (org_id = public.current_org() AND NOT public.has_role(auth.uid(),'FIELD_ASSOCIATE'))
  WITH CHECK (org_id = public.current_org() AND (public.is_manager() OR status IN ('New','Under Validation')));

CREATE TABLE public.signal_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id uuid NOT NULL REFERENCES public.signals(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  decision text NOT NULL,
  notes text,
  reviewer_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.signal_reviews TO authenticated;
GRANT ALL ON public.signal_reviews TO service_role;
ALTER TABLE public.signal_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read signal reviews" ON public.signal_reviews FOR SELECT TO authenticated USING (org_id = public.current_org());
CREATE POLICY "manager reviews signals" ON public.signal_reviews FOR INSERT TO authenticated
  WITH CHECK (public.is_manager() AND org_id = public.current_org() AND reviewer_id = auth.uid());

-- AGGREGATE REPORTS
CREATE TABLE public.aggregate_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_type text NOT NULL,
  product_name text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  case_count int NOT NULL DEFAULT 0,
  serious_count int NOT NULL DEFAULT 0,
  summary text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'Draft',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.aggregate_reports TO authenticated;
GRANT ALL ON public.aggregate_reports TO service_role;
ALTER TABLE public.aggregate_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read reports" ON public.aggregate_reports FOR SELECT TO authenticated
  USING (org_id = public.current_org() AND NOT public.has_role(auth.uid(),'FIELD_ASSOCIATE'));
CREATE POLICY "manager creates reports" ON public.aggregate_reports FOR INSERT TO authenticated
  WITH CHECK (public.is_manager() AND org_id = public.current_org() AND created_by = auth.uid());

-- QMS
CREATE TABLE public.qms_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entry_type text NOT NULL DEFAULT 'Manual',
  event text NOT NULL,
  description text,
  reference text,
  status text NOT NULL DEFAULT 'Logged',
  actor_id uuid NOT NULL,
  actor_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX qms_org_idx ON public.qms_entries(org_id, created_at DESC);
GRANT SELECT, INSERT ON public.qms_entries TO authenticated;
GRANT ALL ON public.qms_entries TO service_role;
ALTER TABLE public.qms_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read qms" ON public.qms_entries FOR SELECT TO authenticated
  USING (org_id = public.current_org() AND NOT public.has_role(auth.uid(),'FIELD_ASSOCIATE'));
CREATE POLICY "insert qms" ON public.qms_entries FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org() AND actor_id = auth.uid() AND NOT public.has_role(auth.uid(),'FIELD_ASSOCIATE'));

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  type text NOT NULL,
  message text NOT NULL,
  entity text,
  entity_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notif_user_idx ON public.notifications(user_id, read, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "create notifications in org" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org());
CREATE POLICY "update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ATTACHMENTS
CREATE TABLE public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read attachments" ON public.attachments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id AND public.can_see_case(c.org_id, c.assigned_to, c.created_by)));
CREATE POLICY "insert attachments" ON public.attachments FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND org_id = public.current_org());
CREATE POLICY "delete own attachments" ON public.attachments FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() AND org_id = public.current_org());

-- CASE NUMBER GENERATOR
CREATE OR REPLACE FUNCTION public.next_case_number()
RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'NG-ICSR-' || to_char(now(),'YYYY') || '-' || nextval('public.case_seq')::text;
$$;
GRANT EXECUTE ON FUNCTION public.next_case_number() TO authenticated;

-- SEED ORG + PRODUCTS + SITES
INSERT INTO public.organizations (id, name) VALUES ('11111111-1111-1111-1111-111111111111','MedNova Pharmacovigilance');
INSERT INTO public.products (org_id, name, client_name) VALUES
  ('11111111-1111-1111-1111-111111111111','Amoxiclav 625','Client A'),
  ('11111111-1111-1111-1111-111111111111','Metformin XR 500','Client B'),
  ('11111111-1111-1111-1111-111111111111','Artemether-Lumefantrine','Client C'),
  ('11111111-1111-1111-1111-111111111111','Losartan 50mg','Client A'),
  ('11111111-1111-1111-1111-111111111111','Cefuroxime 500','Client D');
INSERT INTO public.sites (org_id, name, location) VALUES
  ('11111111-1111-1111-1111-111111111111','Lagos Head Office','Lagos'),
  ('11111111-1111-1111-1111-111111111111','Abuja Field Office','Abuja'),
  ('11111111-1111-1111-1111-111111111111','LUTH Partner Site','Lagos');