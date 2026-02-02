-- SECURITY DEFINER view'ı düzelt - SECURITY INVOKER olarak değiştir
-- Bu şekilde view, sorguyu yapan kullanıcının RLS politikalarını kullanır

DROP VIEW IF EXISTS public.profiles_safe;

CREATE VIEW public.profiles_safe
WITH (security_invoker = true)
AS
SELECT 
  id,
  user_id,
  email,
  display_name,
  avatar_url,
  license_type,
  license_expires_at,
  is_team_admin,
  firma_adi,
  donem_yili,
  is_demo_account,
  created_at,
  updated_at
  -- DIA hassas alanları DAHIL DEĞİL:
  -- dia_sunucu_adi, dia_api_key, dia_ws_kullanici, dia_ws_sifre
  -- dia_session_id, dia_session_expires, firma_kodu, donem_kodu
FROM public.profiles;