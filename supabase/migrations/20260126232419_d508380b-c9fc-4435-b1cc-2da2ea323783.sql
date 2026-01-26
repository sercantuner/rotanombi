-- Unique constraint ekle (user_id, page_id, name kombinasyonu için)
-- page_id null olabildiği için COALESCE kullanıyoruz
CREATE UNIQUE INDEX IF NOT EXISTS page_filter_presets_user_page_name_unique 
ON public.page_filter_presets (user_id, COALESCE(page_id, '00000000-0000-0000-0000-000000000000'), name);

-- Mevcut duplicate kayıtları temizle (sadece en yenisini tut)
DELETE FROM public.page_filter_presets a
USING public.page_filter_presets b
WHERE a.id < b.id 
  AND a.user_id = b.user_id 
  AND COALESCE(a.page_id, '00000000-0000-0000-0000-000000000000') = COALESCE(b.page_id, '00000000-0000-0000-0000-000000000000')
  AND a.name = b.name;