
CREATE OR REPLACE FUNCTION public.get_used_widget_ids_for_company(
  p_sunucu_adi text,
  p_firma_kodu text
)
RETURNS TABLE(widget_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT cw.widget_id
  FROM container_widgets cw
  JOIN page_containers pc ON pc.id = cw.container_id
  JOIN user_pages up ON up.id = pc.page_id
  JOIN profiles p ON p.user_id = up.user_id
  WHERE p.dia_sunucu_adi = p_sunucu_adi
    AND p.firma_kodu = p_firma_kodu;
$$;
