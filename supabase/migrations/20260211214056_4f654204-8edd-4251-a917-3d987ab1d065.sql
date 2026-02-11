
ALTER TABLE data_sources 
ADD COLUMN period_read_mode TEXT DEFAULT 'all_periods' 
CHECK (period_read_mode IN ('current_only', 'all_periods'));

-- Masterdata kaynakları: sadece aktif dönemden okunacak
UPDATE data_sources SET period_read_mode = 'current_only' 
WHERE slug IN (
  'Kasa Kart Listesi', 'Banka_Hesap_listesi', 'cari_kart_listesi',
  'Stok_listesi', 'kullanici_listele', 'Görev Listesi', 'sis_kayit_listele'
);
