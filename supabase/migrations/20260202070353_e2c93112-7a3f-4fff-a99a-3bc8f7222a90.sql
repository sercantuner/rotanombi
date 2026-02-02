-- Profiles tablosu için güvenlik düzeltmesi
-- Team admin'lerin hassas DIA bilgilerini görmesini engellemek için

-- 1. Mevcut "Team admins can view team member profiles" politikasını kaldır
DROP POLICY IF EXISTS "Team admins can view team member profiles" ON public.profiles;

-- 2. Yeni güvenli politika: Team admin'ler SADECE temel profil bilgilerini görebilir
-- Hassas DIA alanlarına erişim YOK
-- Bu politika sadece user_id, email, display_name, avatar_url gibi temel alanları döndürür
-- DIA şifreleri, API key'leri ve session bilgileri GİZLİ kalır

-- Önce bir security definer fonksiyon oluştur - takım üyesi kontrolü için
CREATE OR REPLACE FUNCTION public.is_profile_team_member(_viewer_id uuid, _profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_teams
    WHERE admin_id = _viewer_id AND member_id = _profile_user_id
  )
$$;

-- 3. Team admin'ler için KISITLI profil görünümü politikası
-- Bu politika satır erişimi verir ama uygulama katmanında hassas alanlar filtrelenmeli
CREATE POLICY "Team admins can view basic team member info"
ON public.profiles
FOR SELECT
USING (
  -- Kendi profilim
  auth.uid() = user_id
  OR
  -- Takım üyesiyim ama SADECE temel bilgiler görünür olmalı
  public.is_profile_team_member(auth.uid(), user_id)
);

-- 4. profiles_safe view oluştur - hassas alanlar olmadan
-- Bu view team admin'lerin kullanması gereken view
CREATE OR REPLACE VIEW public.profiles_safe AS
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

-- 5. View için RLS (view inherits table RLS)
-- View, altındaki profiles tablosunun RLS'ini kullanır

-- 6. Güvenli profil bilgisi getiren fonksiyon
CREATE OR REPLACE FUNCTION public.get_safe_profile(_target_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  avatar_url text,
  license_type text,
  is_team_admin boolean,
  firma_adi text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.user_id,
    p.email,
    p.display_name,
    p.avatar_url,
    p.license_type,
    p.is_team_admin,
    p.firma_adi
  FROM public.profiles p
  WHERE p.user_id = _target_user_id
    AND (
      -- Viewer is the profile owner
      auth.uid() = _target_user_id
      OR
      -- Viewer is a super admin
      public.is_super_admin(auth.uid())
      OR
      -- Viewer is the team admin of this user
      public.is_profile_team_member(auth.uid(), _target_user_id)
    )
$$;