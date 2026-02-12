
-- Kullanıcının hariç tuttuğu dönemleri saklayan tablo
CREATE TABLE public.excluded_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sunucu_adi TEXT NOT NULL,
  firma_kodu TEXT NOT NULL,
  donem_kodu INTEGER NOT NULL,
  data_source_slug TEXT, -- NULL ise tüm kaynaklar için geçerli
  excluded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sunucu_adi, firma_kodu, donem_kodu, data_source_slug, excluded_by)
);

-- RLS
ALTER TABLE public.excluded_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company exclusions"
  ON public.excluded_periods FOR SELECT
  USING (
    (sunucu_adi, firma_kodu) IN (
      SELECT s.sunucu_adi, s.firma_kodu 
      FROM get_user_company_scope(auth.uid()) s
    )
  );

CREATE POLICY "Users can insert their company exclusions"
  ON public.excluded_periods FOR INSERT
  WITH CHECK (
    auth.uid() = excluded_by AND
    (sunucu_adi, firma_kodu) IN (
      SELECT s.sunucu_adi, s.firma_kodu 
      FROM get_user_company_scope(auth.uid()) s
    )
  );

CREATE POLICY "Users can delete their company exclusions"
  ON public.excluded_periods FOR DELETE
  USING (
    auth.uid() = excluded_by AND
    (sunucu_adi, firma_kodu) IN (
      SELECT s.sunucu_adi, s.firma_kodu 
      FROM get_user_company_scope(auth.uid()) s
    )
  );
