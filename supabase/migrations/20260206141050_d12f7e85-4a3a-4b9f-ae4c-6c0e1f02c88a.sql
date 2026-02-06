-- RPC fonksiyonunu dönem parametresi ile güncelle
DROP FUNCTION IF EXISTS get_cache_record_counts(text, text);

CREATE OR REPLACE FUNCTION get_cache_record_counts(
  p_sunucu_adi TEXT,
  p_firma_kodu TEXT,
  p_donem_kodu INTEGER DEFAULT NULL
)
RETURNS TABLE (data_source_slug TEXT, record_count BIGINT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    company_data_cache.data_source_slug,
    COUNT(*) as record_count
  FROM company_data_cache
  WHERE sunucu_adi = p_sunucu_adi
    AND firma_kodu = p_firma_kodu
    AND is_deleted = false
    AND (p_donem_kodu IS NULL OR donem_kodu = p_donem_kodu)
  GROUP BY company_data_cache.data_source_slug;
$$;