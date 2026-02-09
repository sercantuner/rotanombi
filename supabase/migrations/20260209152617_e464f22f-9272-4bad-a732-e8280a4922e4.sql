
CREATE OR REPLACE FUNCTION public.get_landing_stats()
RETURNS TABLE(user_count bigint, widget_count bigint, ai_widget_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (SELECT count(*) FROM profiles) as user_count,
    (SELECT count(*) FROM widgets WHERE is_active = true) as widget_count,
    (SELECT count(*) FROM widgets WHERE builder_config IS NOT NULL) as ai_widget_count;
$$;
