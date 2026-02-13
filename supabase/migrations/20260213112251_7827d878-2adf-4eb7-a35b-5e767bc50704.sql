-- Create trigger function for automatic default cron schedules
CREATE OR REPLACE FUNCTION public.create_default_cron_schedules()
RETURNS trigger AS $$
DECLARE
  v_defaults json[] := ARRAY[
    json_build_object('hour', 7, 'minute', 0, 'label', '07:00', 'name', 'sync-1'),
    json_build_object('hour', 12, 'minute', 0, 'label', '12:00', 'name', 'sync-2'),
    json_build_object('hour', 17, 'minute', 0, 'label', '17:00', 'name', 'sync-3'),
    json_build_object('hour', 22, 'minute', 0, 'label', '22:00', 'name', 'sync-4')
  ];
  v_default json;
  v_cron_expr text;
  v_utc_hour int;
BEGIN
  -- Only create if this is a new server pair (insertion event)
  IF TG_OP = 'INSERT' THEN
    -- Check if schedules already exist for this server
    IF NOT EXISTS (
      SELECT 1 FROM public.cron_schedules 
      WHERE sunucu_adi = NEW.sunucu_adi AND firma_kodu = NEW.firma_kodu
    ) THEN
      -- Create 4 default schedules
      FOREACH v_default IN ARRAY v_defaults LOOP
        -- Convert TR hour to UTC hour: UTC = (TR - 3 + 24) % 24
        v_utc_hour := ((v_default->>'hour')::int - 3 + 24) % 24;
        v_cron_expr := (v_default->>'minute')::text || ' ' || v_utc_hour::text || ' * * *';
        
        INSERT INTO public.cron_schedules (
          sunucu_adi, 
          firma_kodu, 
          schedule_name, 
          cron_expression, 
          turkey_time_label, 
          is_enabled
        ) VALUES (
          NEW.sunucu_adi,
          NEW.firma_kodu,
          v_default->>'name',
          v_cron_expr,
          v_default->>'label',
          true
        )
        ON CONFLICT (sunucu_adi, firma_kodu, schedule_name) DO NOTHING;
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Attach trigger to firma_periods (when new period is added for a server)
DROP TRIGGER IF EXISTS create_default_cron_on_firma_periods ON public.firma_periods;
CREATE TRIGGER create_default_cron_on_firma_periods
AFTER INSERT ON public.firma_periods
FOR EACH ROW
EXECUTE FUNCTION public.create_default_cron_schedules();

-- Attach trigger to company_data_cache (when new server data is cached)
DROP TRIGGER IF EXISTS create_default_cron_on_company_data ON public.company_data_cache;
CREATE TRIGGER create_default_cron_on_company_data
AFTER INSERT ON public.company_data_cache
FOR EACH ROW
EXECUTE FUNCTION public.create_default_cron_schedules();