-- Widget'ın birden fazla boyutu desteklemesi için
ALTER TABLE widgets ADD COLUMN IF NOT EXISTS available_sizes TEXT[] DEFAULT ARRAY['md'];

-- Widget'ın birden fazla sayfada görünmesi için
ALTER TABLE widgets ADD COLUMN IF NOT EXISTS target_pages TEXT[] DEFAULT ARRAY['dashboard'];

-- Widget bazlı custom filter tanımları
CREATE TABLE IF NOT EXISTS widget_filter_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id UUID REFERENCES widgets(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT DEFAULT 'string',
  is_global BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS politikaları
ALTER TABLE widget_filter_fields ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir
CREATE POLICY "Widget filter fields are viewable by authenticated users"
ON widget_filter_fields FOR SELECT
TO authenticated
USING (true);

-- Super admin'ler yönetebilir
CREATE POLICY "Super admins can manage widget filter fields"
ON widget_filter_fields FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));