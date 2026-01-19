-- widgets tablosuna builder_config kolonu ekle (Widget Builder yapılandırması için)
ALTER TABLE public.widgets 
ADD COLUMN IF NOT EXISTS builder_config jsonb DEFAULT NULL;

-- Kolon açıklaması
COMMENT ON COLUMN public.widgets.builder_config IS 'Widget Builder ile oluşturulan widget''ların DIA API ve görselleştirme yapılandırması';