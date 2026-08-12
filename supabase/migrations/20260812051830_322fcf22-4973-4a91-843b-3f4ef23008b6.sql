DROP POLICY "insert qms" ON public.qms_entries;
DROP POLICY "read qms" ON public.qms_entries;
CREATE POLICY "read qms" ON public.qms_entries FOR SELECT TO authenticated USING (org_id = public.current_org());
CREATE POLICY "insert qms" ON public.qms_entries FOR INSERT TO authenticated WITH CHECK (org_id = public.current_org() AND actor_id = auth.uid());