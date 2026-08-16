ALTER TABLE public.guardian_student_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parents_read_own_links" ON public.guardian_student_map;
CREATE POLICY "parents_read_own_links" ON public.guardian_student_map
  FOR SELECT USING (
    parent_id IN (
      SELECT id FROM public.parents WHERE auth_user_id = auth.uid() OR id = auth.uid()
      UNION
      SELECT auth.uid()
    )
    OR parent_id = auth.uid()
  );
