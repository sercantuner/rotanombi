-- Veri kaynakları arası ilişkiler tablosu
CREATE TABLE data_source_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  target_data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  source_field TEXT NOT NULL,
  target_field TEXT NOT NULL,
  relationship_type TEXT NOT NULL DEFAULT 'one_to_many',
  cross_filter_direction TEXT NOT NULL DEFAULT 'single',
  is_active BOOLEAN DEFAULT true,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_relationship UNIQUE (source_data_source_id, target_data_source_id, source_field, target_field)
);

-- RLS politikaları
ALTER TABLE data_source_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read relationships" 
  ON data_source_relationships FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Super admins can manage relationships"
  ON data_source_relationships FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Kart pozisyonlarını saklamak için data_sources tablosuna ekleme
ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS model_position JSONB;