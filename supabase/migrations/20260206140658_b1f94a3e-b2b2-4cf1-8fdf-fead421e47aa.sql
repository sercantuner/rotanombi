-- Cache kayıt sayılarını hızlı çekmek için RPC fonksiyonu
CREATE OR REPLACE FUNCTION get_cache_record_counts(
  p_sunucu_adi TEXT,
  p_firma_kodu TEXT
)
RETURNS TABLE (data_source_slug TEXT, record_count BIGINT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    company_data_cache.data_source_slug,
    COUNT(*) as record_count
  FROM company_data_cache
  WHERE sunucu_adi = p_sunucu_adi
    AND firma_kodu = p_firma_kodu
    AND is_deleted = false
  GROUP BY company_data_cache.data_source_slug;
$$;