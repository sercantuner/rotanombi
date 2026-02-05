-- =====================================================
-- DIA Veri Depolama ve Senkronizasyon Sistemi
-- =====================================================

-- 1. company_data_cache - Ana Veri Tablosu
CREATE TABLE public.company_data_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sunucu_adi TEXT NOT NULL,
  firma_kodu TEXT NOT NULL,
  donem_kodu INTEGER NOT NULL,
  data_source_slug TEXT NOT NULL,
  dia_key BIGINT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  
  -- Unique constraint for upsert operations
  CONSTRAINT company_data_cache_unique_key 
    UNIQUE (sunucu_adi, firma_kodu, donem_kodu, data_source_slug, dia_key)
);

-- 2. sync_history - Senkronizasyon Geçmişi
CREATE TABLE public.sync_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sunucu_adi TEXT NOT NULL,
  firma_kodu TEXT NOT NULL,
  donem_kodu INTEGER NOT NULL,
  data_source_slug TEXT NOT NULL,
  sync_type TEXT NOT NULL DEFAULT 'full', -- 'full' or 'incremental'
  records_fetched INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_deleted INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  triggered_by UUID,
  error TEXT,
  status TEXT NOT NULL DEFAULT 'running' -- 'running', 'completed', 'failed'
);

-- 3. period_sync_status - Dönem Kilit Durumu
CREATE TABLE public.period_sync_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sunucu_adi TEXT NOT NULL,
  firma_kodu TEXT NOT NULL,
  donem_kodu INTEGER NOT NULL,
  data_source_slug TEXT NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  last_full_sync TIMESTAMPTZ,
  last_incremental_sync TIMESTAMPTZ,
  total_records INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint
  CONSTRAINT period_sync_status_unique_key 
    UNIQUE (sunucu_adi, firma_kodu, donem_kodu, data_source_slug)
);

-- =====================================================
-- İndeksler
-- =====================================================

-- company_data_cache indeksleri
CREATE INDEX idx_company_data_cache_lookup 
  ON public.company_data_cache (sunucu_adi, firma_kodu, data_source_slug);

CREATE INDEX idx_company_data_cache_updated 
  ON public.company_data_cache (data_source_slug, updated_at DESC);

CREATE INDEX idx_company_data_cache_active 
  ON public.company_data_cache (sunucu_adi, firma_kodu, data_source_slug, is_deleted) 
  WHERE is_deleted = false;

-- sync_history indeksleri
CREATE INDEX idx_sync_history_lookup 
  ON public.sync_history (sunucu_adi, firma_kodu, data_source_slug, started_at DESC);

-- period_sync_status indeksleri
CREATE INDEX idx_period_sync_status_lookup 
  ON public.period_sync_status (sunucu_adi, firma_kodu);

-- =====================================================
-- RLS Politikaları
-- =====================================================

-- company_data_cache RLS
ALTER TABLE public.company_data_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company data"
ON public.company_data_cache FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.dia_sunucu_adi = company_data_cache.sunucu_adi
      AND p.firma_kodu = company_data_cache.firma_kodu
  )
);

CREATE POLICY "Service role can manage all data"
ON public.company_data_cache FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- sync_history RLS
ALTER TABLE public.sync_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company sync history"
ON public.sync_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.dia_sunucu_adi = sync_history.sunucu_adi
      AND p.firma_kodu = sync_history.firma_kodu
  )
);

CREATE POLICY "Service role can manage sync history"
ON public.sync_history FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- period_sync_status RLS
ALTER TABLE public.period_sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company period status"
ON public.period_sync_status FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.dia_sunucu_adi = period_sync_status.sunucu_adi
      AND p.firma_kodu = period_sync_status.firma_kodu
  )
);

CREATE POLICY "Service role can manage period status"
ON public.period_sync_status FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- Trigger: updated_at otomatik güncelleme
-- =====================================================

CREATE TRIGGER update_company_data_cache_updated_at
  BEFORE UPDATE ON public.company_data_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_period_sync_status_updated_at
  BEFORE UPDATE ON public.period_sync_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();