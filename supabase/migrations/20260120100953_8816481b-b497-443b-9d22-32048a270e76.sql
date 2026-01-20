-- Varsayılan widget sistemi için yeni kolonlar
ALTER TABLE public.widgets ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
ALTER TABLE public.widgets ADD COLUMN IF NOT EXISTS default_sort_order INTEGER DEFAULT 0;

-- İndeks ekle
CREATE INDEX IF NOT EXISTS idx_widgets_is_default ON public.widgets(is_default) WHERE is_default = true;