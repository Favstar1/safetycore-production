DROP POLICY IF EXISTS "read wa threads" ON public.whatsapp_threads;
DROP POLICY IF EXISTS "write wa threads" ON public.whatsapp_threads;
DROP POLICY IF EXISTS "update wa threads" ON public.whatsapp_threads;
CREATE POLICY "read wa threads" ON public.whatsapp_threads FOR SELECT TO authenticated USING (org_id = public.current_org());
CREATE POLICY "write wa threads" ON public.whatsapp_threads FOR INSERT TO authenticated WITH CHECK (org_id = public.current_org());
CREATE POLICY "update wa threads" ON public.whatsapp_threads FOR UPDATE TO authenticated USING (org_id = public.current_org()) WITH CHECK (org_id = public.current_org());

DROP POLICY IF EXISTS "read wa messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "insert wa messages" ON public.whatsapp_messages;
CREATE POLICY "read wa messages" ON public.whatsapp_messages FOR SELECT TO authenticated USING (org_id = public.current_org());
CREATE POLICY "insert wa messages" ON public.whatsapp_messages FOR INSERT TO authenticated WITH CHECK (org_id = public.current_org());

DROP POLICY IF EXISTS "read wa extracts" ON public.whatsapp_extracts;
DROP POLICY IF EXISTS "write wa extracts" ON public.whatsapp_extracts;
DROP POLICY IF EXISTS "update wa extracts" ON public.whatsapp_extracts;
CREATE POLICY "read wa extracts" ON public.whatsapp_extracts FOR SELECT TO authenticated USING (org_id = public.current_org());
CREATE POLICY "write wa extracts" ON public.whatsapp_extracts FOR INSERT TO authenticated WITH CHECK (org_id = public.current_org());
CREATE POLICY "update wa extracts" ON public.whatsapp_extracts FOR UPDATE TO authenticated USING (org_id = public.current_org()) WITH CHECK (org_id = public.current_org());