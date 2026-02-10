
-- 1. Kullanıcının şirket kapsamını döndüren SECURITY DEFINER fonksiyon
CREATE OR REPLACE FUNCTION public.get_user_company_scope(_user_id uuid)
RETURNS TABLE(sunucu_adi text, firma_kodu text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.dia_sunucu_adi, p.firma_kodu
  FROM public.profiles p
  WHERE p.user_id = _user_id
  LIMIT 1
$$;

-- 2. Eski yavaş RLS politikalarını kaldır
DROP POLICY IF EXISTS "Users can view their company data" ON public.company_data_cache;
DROP POLICY IF EXISTS "Users can insert their company data" ON public.company_data_cache;
DROP POLICY IF EXISTS "Users can update their company data" ON public.company_data_cache;
DROP POLICY IF EXISTS "Users can delete their company data" ON public.company_data_cache;
DROP POLICY IF EXISTS "Users can view company data" ON public.company_data_cache;
DROP POLICY IF EXISTS "Users can insert company data" ON public.company_data_cache;
DROP POLICY IF EXISTS "Users can update company data" ON public.company_data_cache;
DROP POLICY IF EXISTS "Users can delete company data" ON public.company_data_cache;

-- 3. Optimize edilmiş RLS politikaları (get_user_company_scope ile)
CREATE POLICY "company_data_select" ON public.company_data_cache
FOR SELECT TO authenticated
USING (
  (sunucu_adi, firma_kodu) IN (SELECT s.sunucu_adi, s.firma_kodu FROM public.get_user_company_scope(auth.uid()) s)
);

CREATE POLICY "company_data_insert" ON public.company_data_cache
FOR INSERT TO authenticated
WITH CHECK (
  (sunucu_adi, firma_kodu) IN (SELECT s.sunucu_adi, s.firma_kodu FROM public.get_user_company_scope(auth.uid()) s)
);

CREATE POLICY "company_data_update" ON public.company_data_cache
FOR UPDATE TO authenticated
USING (
  (sunucu_adi, firma_kodu) IN (SELECT s.sunucu_adi, s.firma_kodu FROM public.get_user_company_scope(auth.uid()) s)
);

CREATE POLICY "company_data_delete" ON public.company_data_cache
FOR DELETE TO authenticated
USING (
  (sunucu_adi, firma_kodu) IN (SELECT s.sunucu_adi, s.firma_kodu FROM public.get_user_company_scope(auth.uid()) s)
);

-- 4. get_projected_cache_data zaten SECURITY DEFINER - güncellemeye gerek yok

-- 5. İstatistikleri güncelle
ANALYZE public.company_data_cache;
ANALYZE public.profiles;
