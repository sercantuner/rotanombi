-- Widget'lara versiyon takibi ekle
ALTER TABLE public.widgets 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS change_notes TEXT,
ADD COLUMN IF NOT EXISTS last_change_type TEXT DEFAULT 'created' CHECK (last_change_type IN ('created', 'updated'));

-- Widget değişikliklerini takip eden log tablosu
CREATE TABLE public.widget_changelog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  widget_id UUID NOT NULL REFERENCES public.widgets(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('created', 'updated')),
  change_notes TEXT,
  changed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Kullanıcının son gördüğü widget güncellemelerini takip et
CREATE TABLE public.user_widget_seen (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS
ALTER TABLE public.widget_changelog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_widget_seen ENABLE ROW LEVEL SECURITY;

-- widget_changelog policies
CREATE POLICY "Anyone can view widget changelog"
ON public.widget_changelog FOR SELECT
USING (true);

CREATE POLICY "Admins can insert changelog"
ON public.widget_changelog FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

-- user_widget_seen policies
CREATE POLICY "Users can view their own seen status"
ON public.user_widget_seen FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own seen status"
ON public.user_widget_seen FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own seen status"
ON public.user_widget_seen FOR UPDATE
USING (auth.uid() = user_id);

-- Index
CREATE INDEX idx_widget_changelog_widget_id ON public.widget_changelog(widget_id);
CREATE INDEX idx_widget_changelog_created_at ON public.widget_changelog(created_at DESC);