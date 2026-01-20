-- Merkezi Veri Kaynakları (Data Sources) tablosu
CREATE TABLE public.data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  
  -- DIA API Konfigürasyonu
  module TEXT NOT NULL,
  method TEXT NOT NULL,
  filters JSONB DEFAULT '[]',
  sorts JSONB DEFAULT '[]',
  selected_columns TEXT[],
  limit_count INTEGER DEFAULT 0,
  
  -- Önbellek ayarları
  cache_ttl INTEGER DEFAULT 300,
  auto_refresh BOOLEAN DEFAULT false,
  refresh_schedule TEXT,
  
  -- Son çalışma bilgisi
  last_fetched_at TIMESTAMPTZ,
  last_record_count INTEGER,
  last_fields JSONB,
  
  is_active BOOLEAN DEFAULT true,
  is_shared BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, slug)
);

-- RLS aktif et
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;

-- Görüntüleme: kendi kaynaklarını veya paylaşılanları
CREATE POLICY "Users can view own or shared data sources"
ON public.data_sources FOR SELECT
USING (auth.uid() = user_id OR is_shared = true);

-- Oluşturma: sadece kendi kaynakları
CREATE POLICY "Users can create own data sources"
ON public.data_sources FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Güncelleme: sadece kendi kaynakları
CREATE POLICY "Users can update own data sources"
ON public.data_sources FOR UPDATE
USING (auth.uid() = user_id);

-- Silme: sadece kendi kaynakları
CREATE POLICY "Users can delete own data sources"
ON public.data_sources FOR DELETE
USING (auth.uid() = user_id);

-- updated_at trigger
CREATE TRIGGER update_data_sources_updated_at
BEFORE UPDATE ON public.data_sources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();