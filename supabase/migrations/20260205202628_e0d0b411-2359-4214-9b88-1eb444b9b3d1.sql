-- Dönem bağımsız veri kaynaklarını işaretlemek için alan ekle
ALTER TABLE public.data_sources 
ADD COLUMN IF NOT EXISTS is_period_independent BOOLEAN DEFAULT false;

-- Yorum ekle
COMMENT ON COLUMN public.data_sources.is_period_independent IS 'True ise bu veri kaynağı tüm dönemlerde aynıdır, sadece bir kez çekilir';

-- Dönem bağımsız kaynakları işaretle (kart/tanım verileri)
UPDATE public.data_sources SET is_period_independent = true 
WHERE slug IN ('cari_kart_listesi', 'Stok_listesi', 'Banka_Hesap_listesi', 'Kasa Kart Listesi', 'takvim');

-- Dönem bağımlı kaynakları açıkça işaretle (hareket verileri)
UPDATE public.data_sources SET is_period_independent = false 
WHERE slug IN ('scf_fatura_listele', 'Çek Senet Listesi', 'Sipariş Listesi', 'teklif_listesi', 'Görev Listesi', 'Cari_vade_bakiye_listele');