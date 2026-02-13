
-- RPC function for super admin to get cache stats across ALL servers
CREATE OR REPLACE FUNCTION public.get_all_cache_stats()
RETURNS TABLE(sunucu_adi text, record_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    company_data_cache.sunucu_adi,
    COUNT(*) as record_count
  FROM company_data_cache
  WHERE is_deleted = false
    AND public.is_super_admin(auth.uid())
  GROUP BY company_data_cache.sunucu_adi
  ORDER BY record_count DESC;
$$;
