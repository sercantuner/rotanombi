-- Widget Tags tablosu (Many-to-Many ilişki)
CREATE TABLE public.widget_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id UUID NOT NULL REFERENCES public.widgets(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.widget_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(widget_id, category_id)
);

-- RLS politikaları
ALTER TABLE public.widget_tags ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir
CREATE POLICY "widget_tags_select_all" ON public.widget_tags 
FOR SELECT USING (true);

-- Super admin insert/update/delete yapabilir
CREATE POLICY "widget_tags_insert_super_admin" ON public.widget_tags 
FOR INSERT WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "widget_tags_update_super_admin" ON public.widget_tags 
FOR UPDATE USING (public.is_super_admin(auth.uid()));

CREATE POLICY "widget_tags_delete_super_admin" ON public.widget_tags 
FOR DELETE USING (public.is_super_admin(auth.uid()));

-- Mevcut category değerlerini widget_tags'e aktar
INSERT INTO public.widget_tags (widget_id, category_id)
SELECT w.id, wc.id
FROM public.widgets w
JOIN public.widget_categories wc ON wc.slug = w.category
WHERE w.category IS NOT NULL AND w.category != '';