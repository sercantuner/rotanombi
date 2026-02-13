
-- Sync Jobs: One record per "Sync All" click
CREATE TABLE public.sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sunucu_adi TEXT NOT NULL,
  firma_kodu TEXT NOT NULL,
  triggered_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_tasks INT DEFAULT 0,
  completed_tasks INT DEFAULT 0,
  failed_tasks INT DEFAULT 0,
  skipped_tasks INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Sync Queue Tasks: Individual tasks within a job
CREATE TABLE public.sync_queue_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.sync_jobs(id) ON DELETE CASCADE,
  data_source_slug TEXT NOT NULL,
  period_no INT NOT NULL,
  task_name TEXT NOT NULL,
  sync_type TEXT DEFAULT 'full',
  status TEXT NOT NULL DEFAULT 'pending',
  sort_order INT DEFAULT 0,
  fetched INT DEFAULT 0,
  written INT DEFAULT 0,
  deleted INT DEFAULT 0,
  expected_records INT DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_sync_jobs_status ON public.sync_jobs(status);
CREATE INDEX idx_sync_jobs_server ON public.sync_jobs(sunucu_adi, firma_kodu);
CREATE INDEX idx_sync_queue_tasks_job ON public.sync_queue_tasks(job_id);
CREATE INDEX idx_sync_queue_tasks_status ON public.sync_queue_tasks(job_id, status);

-- Enable RLS
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_queue_tasks ENABLE ROW LEVEL SECURITY;

-- RLS: Super admins can do everything
CREATE POLICY "Super admins full access to sync_jobs"
ON public.sync_jobs FOR ALL
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins full access to sync_queue_tasks"
ON public.sync_queue_tasks FOR ALL
USING (public.is_super_admin(auth.uid()));

-- RLS: Users can see their own jobs
CREATE POLICY "Users can view own sync_jobs"
ON public.sync_jobs FOR SELECT
USING (triggered_by = auth.uid());

CREATE POLICY "Users can create own sync_jobs"
ON public.sync_jobs FOR INSERT
WITH CHECK (triggered_by = auth.uid());

CREATE POLICY "Users can view tasks of own jobs"
ON public.sync_queue_tasks FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.sync_jobs
  WHERE sync_jobs.id = sync_queue_tasks.job_id
  AND sync_jobs.triggered_by = auth.uid()
));

-- Updated_at triggers
CREATE TRIGGER update_sync_jobs_updated_at
BEFORE UPDATE ON public.sync_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sync_queue_tasks_updated_at
BEFORE UPDATE ON public.sync_queue_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for polling
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_queue_tasks;
