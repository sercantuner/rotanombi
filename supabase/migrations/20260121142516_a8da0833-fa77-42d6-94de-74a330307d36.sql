-- firma_periods tablosu: Sunucu+Firma bazlı dönem bilgilerini saklar
CREATE TABLE public.firma_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sunucu_adi TEXT NOT NULL,
  firma_kodu TEXT NOT NULL,
  period_no INTEGER NOT NULL,
  period_name TEXT,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint: Her sunucu+firma+dönem kombinasyonu tek olmalı
  CONSTRAINT unique_server_firm_period UNIQUE (sunucu_adi, firma_kodu, period_no)
);

-- Enable RLS
ALTER TABLE public.firma_periods ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view periods
CREATE POLICY "Authenticated users can view periods"
ON public.firma_periods
FOR SELECT
USING (auth.role() = 'authenticated');

-- Admins can manage periods
CREATE POLICY "Admins can manage periods"
ON public.firma_periods
FOR ALL
USING (is_admin(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_firma_periods_updated_at
BEFORE UPDATE ON public.firma_periods
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX idx_firma_periods_server_firm ON public.firma_periods(sunucu_adi, firma_kodu);