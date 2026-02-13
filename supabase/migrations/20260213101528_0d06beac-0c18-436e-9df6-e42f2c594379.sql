-- Optimize TOAST compression strategy for company_data_cache data column
ALTER TABLE public.company_data_cache ALTER COLUMN data SET STORAGE MAIN;

-- Reindex the table for immediate effect
REINDEX TABLE public.company_data_cache;
