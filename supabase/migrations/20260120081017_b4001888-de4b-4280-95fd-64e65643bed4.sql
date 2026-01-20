-- data_sources tablosuna period_config JSONB kolonu ekle
ALTER TABLE data_sources
ADD COLUMN IF NOT EXISTS period_config JSONB DEFAULT NULL;

COMMENT ON COLUMN data_sources.period_config IS 
'Dönem bağımlı sorgular için yapılandırma (enabled, periodField, fetchHistorical, historicalCount vb.)';