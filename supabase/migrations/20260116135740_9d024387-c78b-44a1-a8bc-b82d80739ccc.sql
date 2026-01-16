-- Add DIA connection fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS dia_sunucu_adi text,
ADD COLUMN IF NOT EXISTS dia_api_key text,
ADD COLUMN IF NOT EXISTS dia_ws_kullanici text,
ADD COLUMN IF NOT EXISTS dia_ws_sifre text,
ADD COLUMN IF NOT EXISTS dia_session_id text,
ADD COLUMN IF NOT EXISTS dia_session_expires timestamp with time zone;

-- Add index for faster session lookups
CREATE INDEX IF NOT EXISTS idx_profiles_dia_session ON public.profiles(dia_session_id) WHERE dia_session_id IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.profiles.dia_sunucu_adi IS 'DIA ERP sunucu adı (örn: rotayazilim)';
COMMENT ON COLUMN public.profiles.dia_api_key IS 'DIA API anahtarı';
COMMENT ON COLUMN public.profiles.dia_ws_kullanici IS 'DIA web servis kullanıcı adı';
COMMENT ON COLUMN public.profiles.dia_ws_sifre IS 'DIA web servis şifresi (şifrelenmiş)';
COMMENT ON COLUMN public.profiles.dia_session_id IS 'Aktif DIA oturum ID';
COMMENT ON COLUMN public.profiles.dia_session_expires IS 'DIA oturum sona erme zamanı';