
-- Drop unused indexes on company_data_cache table
DROP INDEX IF EXISTS public.idx_company_data_gin;
DROP INDEX IF EXISTS public.idx_company_data_cache_active;
DROP INDEX IF EXISTS public.idx_company_data_cache_tarih;
DROP INDEX IF EXISTS public.idx_company_data_cache_carikodu;
DROP INDEX IF EXISTS public.idx_company_data_cache_turu;
DROP INDEX IF EXISTS public.idx_company_data_cache_katagori;
DROP INDEX IF EXISTS public.idx_company_data_cache_composite;
