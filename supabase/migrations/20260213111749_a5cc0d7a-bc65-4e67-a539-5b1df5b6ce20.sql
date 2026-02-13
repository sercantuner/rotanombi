-- Create function to auto-create 4 default cron schedules
-- New default times: 07:00, 12:00, 17:00, 22:00 Turkey time
CREATE OR REPLACE FUNCTION public.create_default_cron_schedules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Check which table to trigger on (firma_periods seems logical)
-- This trigger will fire when a new server/company is added
CREATE TRIGGER create_default_schedules_on_firma_periods
AFTER INSERT ON public.firma_periods
FOR EACH ROW
EXECUTE FUNCTION public.create_default_cron_schedules();

-- Also create trigger for company_data_cache as a fallback (different servers might be added there first)
CREATE TRIGGER create_default_schedules_on_cache_insert
AFTER INSERT ON public.company_data_cache
FOR EACH ROW
EXECUTE FUNCTION public.create_default_cron_schedules();