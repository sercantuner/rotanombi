
-- 1. Super admin SELECT policy for company_data_cache
CREATE POLICY "super_admin_read_all_cache"
ON public.company_data_cache
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'super_admin'
  )
);

-- 2. Super admin DELETE policy for company_data_cache
CREATE POLICY "super_admin_delete_all_cache"
ON public.company_data_cache
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'super_admin'
  )
);

-- 3. Super admin UPDATE policy for company_data_cache
CREATE POLICY "super_admin_update_all_cache"
ON public.company_data_cache
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'super_admin'
  )
);

-- 4. RPC function for period distribution (SECURITY DEFINER bypasses RLS + no row limit)
CREATE OR REPLACE FUNCTION get_period_distribution(
  p_sunucu_adi text,
  p_firma_kodu text,
  p_data_source_slug text
)
RETURNS TABLE(donem_kodu int, record_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT donem_kodu::int, count(*)::bigint
  FROM company_data_cache
  WHERE sunucu_adi = p_sunucu_adi
    AND firma_kodu = p_firma_kodu
    AND data_source_slug = p_data_source_slug
    AND is_deleted = false
  GROUP BY donem_kodu
$$;
