
-- Sunucu bazlı senkronizasyon kilidi tablosu
CREATE TABLE public.sync_locks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sunucu_adi TEXT NOT NULL,
  firma_kodu TEXT NOT NULL,
  locked_by UUID NOT NULL,
  locked_by_email TEXT,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  sync_type TEXT NOT NULL DEFAULT 'full',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sunucu_adi, firma_kodu)
);

-- RLS
ALTER TABLE public.sync_locks ENABLE ROW LEVEL SECURITY;

-- Authenticated kullanıcılar okuyabilir
CREATE POLICY "Users can view sync locks for their server"
  ON public.sync_locks FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Authenticated kullanıcılar kilit oluşturabilir
CREATE POLICY "Users can create sync locks"
  ON public.sync_locks FOR INSERT
  WITH CHECK (auth.uid() = locked_by);

-- Kendi kilitleni silebilir veya süresi dolmuş kilitleri temizleyebilir
CREATE POLICY "Users can delete own or expired locks"
  ON public.sync_locks FOR DELETE
  USING (auth.uid() = locked_by OR expires_at < now());

-- Kendi kilitleni güncelleyebilir
CREATE POLICY "Users can update own locks"
  ON public.sync_locks FOR UPDATE
  USING (auth.uid() = locked_by);
