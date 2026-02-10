
CREATE OR REPLACE FUNCTION public.get_projected_cache_data(
  p_data_source_slug text,
  p_sunucu_adi text,
  p_firma_kodu text,
  p_donem_kodu integer DEFAULT NULL,
  p_fields text[] DEFAULT NULL,
  p_limit integer DEFAULT 1000,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(data jsonb, updated_at timestamptz) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE 
      WHEN p_fields IS NOT NULL THEN
        (SELECT jsonb_object_agg(key, value)
         FROM jsonb_each(c.data)
         WHERE key = ANY(p_fields))
      ELSE c.data
    END as data,
    c.updated_at
  FROM company_data_cache c
  WHERE c.data_source_slug = p_data_source_slug
    AND c.sunucu_adi = p_sunucu_adi
    AND c.firma_kodu = p_firma_kodu
    AND c.is_deleted = false
    AND (p_donem_kodu IS NULL OR c.donem_kodu = p_donem_kodu)
  ORDER BY c.dia_key
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
