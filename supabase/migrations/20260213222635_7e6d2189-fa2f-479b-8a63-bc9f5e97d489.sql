-- Enable realtime for sync_history and cron_schedules (sync_jobs already enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cron_schedules;