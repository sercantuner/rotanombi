-- Add skip_reconcile flag for data sources with unstable/hash-based keys
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS skip_reconcile boolean DEFAULT false;

-- Set it for known hash-key sources
UPDATE public.data_sources SET skip_reconcile = true WHERE slug ILIKE '%vade_bakiye%';

-- Clean up wrongly deleted records for cari_vade_bakiye
UPDATE public.company_data_cache 
SET is_deleted = false 
WHERE data_source_slug = 'Cari_vade_bakiye_listele' AND is_deleted = true;