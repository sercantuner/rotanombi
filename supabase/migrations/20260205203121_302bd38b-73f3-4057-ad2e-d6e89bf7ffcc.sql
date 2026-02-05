-- DIA dışı veri kaynaklarını işaretlemek için alan ekle
ALTER TABLE public.data_sources 
ADD COLUMN IF NOT EXISTS is_non_dia BOOLEAN DEFAULT false;

-- Yorum ekle
COMMENT ON COLUMN public.data_sources.is_non_dia IS 'True ise bu veri kaynağı DIA API dışı bir kaynaktır (örn: takvim, sabit tablolar)';

-- Bilinen DIA dışı kaynakları işaretle
UPDATE public.data_sources SET is_non_dia = true 
WHERE slug IN ('takvim', '_system_calendar');