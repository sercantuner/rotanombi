-- Veri kaynaklarına örnek veri kolonu ekle (filtreleme için benzersiz değer önerileri)
ALTER TABLE public.data_sources 
ADD COLUMN IF NOT EXISTS last_sample_data jsonb DEFAULT NULL;

-- Kolon açıklaması
COMMENT ON COLUMN public.data_sources.last_sample_data IS 'API testinden dönen örnek veriler - filtreleme için benzersiz değer önerileri sunmak amacıyla kullanılır';