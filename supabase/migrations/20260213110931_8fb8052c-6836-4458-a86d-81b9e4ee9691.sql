
-- Cron Schedules table
CREATE TABLE public.cron_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sunucu_adi text NOT NULL,
  firma_kodu text NOT NULL,
  schedule_name text NOT NULL,
  cron_expression text NOT NULL,
  turkey_time_label text,
  is_enabled boolean DEFAULT true,
  pg_cron_jobid bigint,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(sunucu_adi, firma_kodu, schedule_name)
);

-- RLS
ALTER TABLE public.cron_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_manage_cron_schedules"
ON public.cron_schedules
FOR ALL
USING (public.is_super_admin(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_cron_schedules_updated_at
BEFORE UPDATE ON public.cron_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RPC: Get cron run history from cron schema
CREATE OR REPLACE FUNCTION public.get_cron_run_history(p_limit integer DEFAULT 20)
RETURNS TABLE(
  jobid bigint,
  job_name text,
  status text,
  start_time timestamptz,
  end_time timestamptz,
  return_message text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    d.jobid,
    j.jobname as job_name,
    d.status,
    d.start_time,
    d.end_time,
    d.return_message
  FROM cron.job_run_details d
  JOIN cron.job j ON j.jobid = d.jobid
  WHERE j.jobname LIKE 'dia-sync-%'
  ORDER BY d.start_time DESC
  LIMIT p_limit;
$$;
