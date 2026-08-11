
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.current_org()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT org_id FROM public.profiles WHERE id = auth.uid(); $$;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role); $$;

CREATE OR REPLACE FUNCTION app_private.is_manager()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT app_private.has_role(auth.uid(),'PV_MANAGER') OR app_private.has_role(auth.uid(),'ADMIN'); $$;

CREATE OR REPLACE FUNCTION app_private.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT app_private.has_role(auth.uid(),'ADMIN'); $$;

CREATE OR REPLACE FUNCTION app_private.can_see_case(_org uuid, _assigned uuid, _created uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT _org = app_private.current_org() AND (
    app_private.is_manager()
    OR (app_private.has_role(auth.uid(),'PV_COORDINATOR') AND (_assigned = auth.uid() OR _created = auth.uid()))
    OR (app_private.has_role(auth.uid(),'FIELD_ASSOCIATE') AND _created = auth.uid())
  );
$$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private TO authenticated, service_role;

-- Public wrappers become SECURITY INVOKER (no longer definer-callable surface)
CREATE OR REPLACE FUNCTION public.current_org()
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$ SELECT app_private.current_org(); $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$ SELECT app_private.has_role(_user_id, _role); $$;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$ SELECT app_private.is_manager(); $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$ SELECT app_private.is_admin(); $$;

CREATE OR REPLACE FUNCTION public.can_see_case(_org uuid, _assigned uuid, _created uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$ SELECT app_private.can_see_case(_org, _assigned, _created); $$;

GRANT USAGE, SELECT ON SEQUENCE public.case_seq TO authenticated;
CREATE OR REPLACE FUNCTION public.next_case_number()
RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path TO 'public'
AS $$ SELECT 'NG-ICSR-' || to_char(now(),'YYYY') || '-' || nextval('public.case_seq')::text; $$;

-- Case audit trail: only readable for cases the user may see
DROP POLICY IF EXISTS "read audit in org" ON public.case_audit_events;
CREATE POLICY "read audit in org" ON public.case_audit_events
FOR SELECT TO authenticated
USING (
  org_id = public.current_org() AND (
    CASE WHEN case_id IS NULL
      THEN (public.is_manager() OR actor_id = auth.uid())
      ELSE EXISTS (
        SELECT 1 FROM public.cases c
        WHERE c.id = case_audit_events.case_id
          AND public.can_see_case(c.org_id, c.assigned_to, c.created_by)
      )
    END
  )
);

-- Submissions: only readable for cases the user may see
DROP POLICY IF EXISTS "read submissions" ON public.case_submissions;
CREATE POLICY "read submissions" ON public.case_submissions
FOR SELECT TO authenticated
USING (
  org_id = public.current_org() AND EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = case_submissions.case_id
      AND public.can_see_case(c.org_id, c.assigned_to, c.created_by)
  )
);

-- Signal reviews: align with signals (field associates excluded)
DROP POLICY IF EXISTS "read signal reviews" ON public.signal_reviews;
CREATE POLICY "read signal reviews" ON public.signal_reviews
FOR SELECT TO authenticated
USING (org_id = public.current_org() AND NOT public.has_role(auth.uid(), 'FIELD_ASSOCIATE'));

-- Follow-ups: WITH CHECK mirrors USING
DROP POLICY IF EXISTS "update follow ups" ON public.case_follow_ups;
CREATE POLICY "update follow ups" ON public.case_follow_ups
FOR UPDATE TO authenticated
USING (
  org_id = public.current_org() AND EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = case_follow_ups.case_id AND (public.is_manager() OR c.assigned_to = auth.uid())
  )
)
WITH CHECK (
  org_id = public.current_org() AND EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = case_follow_ups.case_id AND (public.is_manager() OR c.assigned_to = auth.uid())
  )
);

-- WhatsApp extracts / threads: role check enforced on write too
DROP POLICY IF EXISTS "update wa extracts" ON public.whatsapp_extracts;
CREATE POLICY "update wa extracts" ON public.whatsapp_extracts
FOR UPDATE TO authenticated
USING (org_id = public.current_org() AND NOT public.has_role(auth.uid(), 'FIELD_ASSOCIATE'))
WITH CHECK (org_id = public.current_org() AND NOT public.has_role(auth.uid(), 'FIELD_ASSOCIATE'));

DROP POLICY IF EXISTS "update wa threads" ON public.whatsapp_threads;
CREATE POLICY "update wa threads" ON public.whatsapp_threads
FOR UPDATE TO authenticated
USING (org_id = public.current_org() AND NOT public.has_role(auth.uid(), 'FIELD_ASSOCIATE'))
WITH CHECK (org_id = public.current_org() AND NOT public.has_role(auth.uid(), 'FIELD_ASSOCIATE'));
