-- Kullanıcı filtre tercihleri tablosu
CREATE TABLE public.user_filter_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  visible_filters TEXT[] DEFAULT ARRAY['satisTemsilcisi', 'cariKartTipi'],
  filter_order TEXT[] DEFAULT ARRAY['tarihAraligi', 'satisTemsilcisi', 'cariKartTipi'],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- RLS'yi aktifleştir
ALTER TABLE public.user_filter_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own filter preferences"
ON public.user_filter_preferences FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own filter preferences"
ON public.user_filter_preferences FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own filter preferences"
ON public.user_filter_preferences FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own filter preferences"
ON public.user_filter_preferences FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Updated at trigger
CREATE TRIGGER update_user_filter_preferences_updated_at
BEFORE UPDATE ON public.user_filter_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();