-- Expression-based indexes for JSONB fields (no generated columns needed)
-- This approach is fully immutable and works with PostgreSQL

-- Index for date-based queries (using text comparison which works for ISO dates)
CREATE INDEX IF NOT EXISTS idx_company_data_tarih 
ON company_data_cache ((data->>'tarih'))
WHERE is_deleted = false;

-- Index for carikodu field
CREATE INDEX IF NOT EXISTS idx_company_data_carikodu
ON company_data_cache ((data->>'carikodu'))
WHERE is_deleted = false;

-- Index for turu field  
CREATE INDEX IF NOT EXISTS idx_company_data_turu
ON company_data_cache ((data->>'turu'))
WHERE is_deleted = false;

-- GIN index for deep JSONB queries
CREATE INDEX IF NOT EXISTS idx_company_data_gin 
ON company_data_cache USING GIN (data jsonb_path_ops)
WHERE is_deleted = false;

-- Composite index for common query pattern (lookup by company)
CREATE INDEX IF NOT EXISTS idx_company_data_composite
ON company_data_cache (sunucu_adi, firma_kodu, data_source_slug, donem_kodu)
WHERE is_deleted = false;

-- Combined index for slug + date queries
CREATE INDEX IF NOT EXISTS idx_company_data_slug_tarih
ON company_data_cache (data_source_slug, (data->>'tarih') DESC)
WHERE is_deleted = false;