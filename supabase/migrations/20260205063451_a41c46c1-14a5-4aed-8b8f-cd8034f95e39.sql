-- Power BI benzeri çapraz filtreleme için data_sources tablosuna filterable_fields kolonu ekle
-- Bu kolon, veri kaynağının hangi alanlara göre filtrelenebileceğini tanımlar

ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS filterable_fields jsonb DEFAULT '[]';

-- Örnek yapı:
-- [
--   {
--     "field": "carikarttipi",
--     "globalFilterKey": "cariKartTipi", 
--     "label": "Cari Kart Tipi",
--     "operator": "IN"
--   },
--   {
--     "field": "satiselemani",
--     "globalFilterKey": "satisTemsilcisi",
--     "label": "Satış Temsilcisi", 
--     "operator": "IN"
--   }
-- ]

COMMENT ON COLUMN data_sources.filterable_fields IS 'Power BI style filterable field definitions - maps data source fields to global filter keys';