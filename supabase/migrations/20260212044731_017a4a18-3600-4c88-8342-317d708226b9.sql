
-- Fatura_listele_ayrintili için selected_columns'ı optimize et
UPDATE public.data_sources
SET selected_columns = ARRAY[
  'tarih',
  'fisno',
  'toplam',
  'turu_kisa',
  'turuack',
  'iptal',
  'satiselemani',
  'toplamnethacim',
  'kartozelkodu6',
  '__sourcesubeadi',
  '__carifirma',
  'donem_kodu',
  'firma_kodu',
  '_key'
]
WHERE slug = 'Fatura_listele_ayrintili'
AND user_id = (SELECT user_id FROM profiles WHERE firma_kodu = '1' LIMIT 1);
