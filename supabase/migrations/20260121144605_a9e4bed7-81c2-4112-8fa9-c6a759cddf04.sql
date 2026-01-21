-- Şube tablosu
CREATE TABLE public.firma_branches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sunucu_adi TEXT NOT NULL,
  firma_kodu TEXT NOT NULL,
  branch_key BIGINT NOT NULL,
  branch_code TEXT NOT NULL,
  branch_name TEXT,
  is_active BOOLEAN DEFAULT true,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sunucu_adi, firma_kodu, branch_key)
);

-- Depo tablosu
CREATE TABLE public.firma_warehouses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sunucu_adi TEXT NOT NULL,
  firma_kodu TEXT NOT NULL,
  branch_key BIGINT NOT NULL,
  warehouse_key BIGINT NOT NULL,
  warehouse_code TEXT NOT NULL,
  warehouse_name TEXT,
  can_view_movement BOOLEAN DEFAULT true,
  can_operate BOOLEAN DEFAULT true,
  can_view_quantity BOOLEAN DEFAULT true,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sunucu_adi, firma_kodu, warehouse_key)
);

-- RLS aktif et
ALTER TABLE public.firma_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firma_warehouses ENABLE ROW LEVEL SECURITY;

-- Okuma politikaları
CREATE POLICY "Authenticated users can view branches"
ON public.firma_branches FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view warehouses"
ON public.firma_warehouses FOR SELECT
USING (auth.role() = 'authenticated');

-- Admin yönetim politikaları
CREATE POLICY "Admins can manage branches"
ON public.firma_branches FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage warehouses"
ON public.firma_warehouses FOR ALL
USING (is_admin(auth.uid()));