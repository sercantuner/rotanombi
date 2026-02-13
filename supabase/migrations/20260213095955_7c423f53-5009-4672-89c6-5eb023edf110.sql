
DROP FUNCTION IF EXISTS public.get_all_cache_stats();

CREATE OR REPLACE FUNCTION public.get_all_cache_stats()
RETURNS TABLE(sunucu_adi text, record_count bigint, data_bytes bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    company_data_cache.sunucu_adi,
    COUNT(*) as record_count,
    SUM(pg_column_size(data))::bigint as data_bytes
  FROM company_data_cache
  WHERE is_deleted = false
    AND public.is_super_admin(auth.uid())
  GROUP BY company_data_cache.sunucu_adi
  ORDER BY record_count DESC;
$$;
