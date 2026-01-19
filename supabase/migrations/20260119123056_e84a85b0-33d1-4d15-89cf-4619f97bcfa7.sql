-- Kullanıcı sayfaları tablosu
CREATE TABLE public.user_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  icon TEXT DEFAULT 'LayoutDashboard',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, slug)
);

-- Konteyner tipleri enum
CREATE TYPE public.container_type AS ENUM (
  'kpi_row_5',
  'kpi_row_4', 
  'kpi_row_3',
  'chart_full',
  'chart_half',
  'chart_third',
  'info_cards_3',
  'info_cards_2',
  'table_full',
  'list_full',
  'custom_grid'
);

-- Sayfa konteynerleri tablosu
CREATE TABLE public.page_containers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id UUID NOT NULL REFERENCES public.user_pages(id) ON DELETE CASCADE,
  container_type public.container_type NOT NULL,
  title TEXT,
  sort_order INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Konteyner widget'ları tablosu
CREATE TABLE public.container_widgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  container_id UUID NOT NULL REFERENCES public.page_containers(id) ON DELETE CASCADE,
  widget_id UUID NOT NULL REFERENCES public.widgets(id) ON DELETE CASCADE,
  slot_index INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(container_id, slot_index)
);

-- Widget yetkilendirme tablosu
CREATE TABLE public.widget_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  widget_id UUID NOT NULL REFERENCES public.widgets(id) ON DELETE CASCADE,
  can_view BOOLEAN DEFAULT true,
  can_add BOOLEAN DEFAULT true,
  granted_by UUID,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, widget_id)
);

-- RLS Etkinleştir
ALTER TABLE public.user_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.container_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.widget_permissions ENABLE ROW LEVEL SECURITY;

-- user_pages politikaları
CREATE POLICY "Users can view their own pages"
  ON public.user_pages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own pages"
  ON public.user_pages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pages"
  ON public.user_pages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pages"
  ON public.user_pages FOR DELETE
  USING (auth.uid() = user_id);

-- page_containers politikaları (sayfa sahibi üzerinden)
CREATE POLICY "Users can view containers of their pages"
  ON public.page_containers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.user_pages 
    WHERE user_pages.id = page_containers.page_id 
    AND user_pages.user_id = auth.uid()
  ));

CREATE POLICY "Users can create containers in their pages"
  ON public.page_containers FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_pages 
    WHERE user_pages.id = page_containers.page_id 
    AND user_pages.user_id = auth.uid()
  ));

CREATE POLICY "Users can update containers in their pages"
  ON public.page_containers FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.user_pages 
    WHERE user_pages.id = page_containers.page_id 
    AND user_pages.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete containers in their pages"
  ON public.page_containers FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.user_pages 
    WHERE user_pages.id = page_containers.page_id 
    AND user_pages.user_id = auth.uid()
  ));

-- container_widgets politikaları
CREATE POLICY "Users can view widgets in their containers"
  ON public.container_widgets FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.page_containers pc
    JOIN public.user_pages up ON up.id = pc.page_id
    WHERE pc.id = container_widgets.container_id 
    AND up.user_id = auth.uid()
  ));

CREATE POLICY "Users can add widgets to their containers"
  ON public.container_widgets FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.page_containers pc
    JOIN public.user_pages up ON up.id = pc.page_id
    WHERE pc.id = container_widgets.container_id 
    AND up.user_id = auth.uid()
  ));

CREATE POLICY "Users can update widgets in their containers"
  ON public.container_widgets FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.page_containers pc
    JOIN public.user_pages up ON up.id = pc.page_id
    WHERE pc.id = container_widgets.container_id 
    AND up.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete widgets from their containers"
  ON public.container_widgets FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.page_containers pc
    JOIN public.user_pages up ON up.id = pc.page_id
    WHERE pc.id = container_widgets.container_id 
    AND up.user_id = auth.uid()
  ));

-- widget_permissions politikaları
CREATE POLICY "Users can view their own widget permissions"
  ON public.widget_permissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage widget permissions"
  ON public.widget_permissions FOR ALL
  USING (public.is_admin(auth.uid()));

-- Trigger fonksiyonları
CREATE TRIGGER update_user_pages_updated_at
  BEFORE UPDATE ON public.user_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_page_containers_updated_at
  BEFORE UPDATE ON public.page_containers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_container_widgets_updated_at
  BEFORE UPDATE ON public.container_widgets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();