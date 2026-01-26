-- Add DIA sales person and authorization fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dia_satis_elemani TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dia_yetki_kodu TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dia_auto_filters JSONB DEFAULT '[]';

-- Add filter configuration to user_pages
ALTER TABLE public.user_pages ADD COLUMN IF NOT EXISTS filter_config JSONB DEFAULT NULL;

-- Create page_filter_presets table for saving filter configurations
CREATE TABLE IF NOT EXISTS public.page_filter_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  page_id UUID REFERENCES public.user_pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on page_filter_presets
ALTER TABLE public.page_filter_presets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for page_filter_presets
CREATE POLICY "Users can view their own filter presets"
  ON public.page_filter_presets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own filter presets"
  ON public.page_filter_presets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own filter presets"
  ON public.page_filter_presets
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own filter presets"
  ON public.page_filter_presets
  FOR DELETE
  USING (auth.uid() = user_id);

-- Super admins can view all filter presets
CREATE POLICY "Super admins can view all filter presets"
  ON public.page_filter_presets
  FOR SELECT
  USING (is_super_admin(auth.uid()));

-- Add updated_at trigger
CREATE TRIGGER update_page_filter_presets_updated_at
  BEFORE UPDATE ON public.page_filter_presets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_page_filter_presets_user_page ON public.page_filter_presets(user_id, page_id);

-- Comment for documentation
COMMENT ON COLUMN public.profiles.dia_satis_elemani IS 'DIA sales person name for auto-filtering';
COMMENT ON COLUMN public.profiles.dia_yetki_kodu IS 'DIA authorization code for permission-based filtering';
COMMENT ON COLUMN public.profiles.dia_auto_filters IS 'Mandatory DIA filters applied to all queries for this user';
COMMENT ON COLUMN public.user_pages.filter_config IS 'Page-specific filter configuration (available filters, layout, defaults)';