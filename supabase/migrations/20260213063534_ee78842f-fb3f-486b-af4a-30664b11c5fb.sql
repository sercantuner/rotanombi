
-- Widget Snapshots: Pre-computed widget data for instant loading
CREATE TABLE public.widget_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sunucu_adi TEXT NOT NULL,
  firma_kodu TEXT NOT NULL,
  widget_id UUID NOT NULL REFERENCES public.widgets(id) ON DELETE CASCADE,
  snapshot_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_row_count INTEGER DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_trigger TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'computing',
  error TEXT,
  computation_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one snapshot per widget per company
ALTER TABLE public.widget_snapshots
  ADD CONSTRAINT widget_snapshots_unique_widget UNIQUE (sunucu_adi, firma_kodu, widget_id);

-- Index for fast lookup
CREATE INDEX idx_widget_snapshots_company_status 
  ON public.widget_snapshots (sunucu_adi, firma_kodu, status);

-- Enable RLS
ALTER TABLE public.widget_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS: Users can read snapshots for their own company
CREATE POLICY "Users can read own company snapshots"
  ON public.widget_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.dia_sunucu_adi = widget_snapshots.sunucu_adi
        AND p.firma_kodu = widget_snapshots.firma_kodu
    )
  );

-- RLS: Service role (edge functions) can manage all snapshots
CREATE POLICY "Service role can manage snapshots"
  ON public.widget_snapshots FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Trigger for updated_at
CREATE TRIGGER update_widget_snapshots_updated_at
  BEFORE UPDATE ON public.widget_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
