
-- sercantuner1'i sercantuner'in takımına ekle
INSERT INTO public.user_teams (admin_id, member_id)
VALUES (
  '8e5108c0-8150-44bf-ba09-81688e0181e7', -- sercantuner (admin)
  '72131796-76b5-4aa8-bb4a-bea7f7d926cb'  -- sercantuner1 (member)
);

-- sercantuner1'in is_team_admin'ini false yap (takım üyesi olduğu için)
UPDATE public.profiles 
SET is_team_admin = false 
WHERE user_id = '72131796-76b5-4aa8-bb4a-bea7f7d926cb';

-- data_sources için takım üyelerinin sadece is_active değiştirebilmesi için yeni politika
-- Önce mevcut UPDATE politikasını kaldır
DROP POLICY IF EXISTS "Team admins can update data sources" ON public.data_sources;

-- Team admin için tam UPDATE yetkisi
CREATE POLICY "Team admins can fully update data sources" 
ON public.data_sources 
FOR UPDATE 
USING (
  is_team_admin(auth.uid()) AND 
  (user_id = auth.uid() OR user_id = get_user_team_admin(auth.uid()))
);

-- Team member için sadece is_active güncellemesi (kendi team admin'inin kaynaklarını pasife alabilir)
CREATE POLICY "Team members can toggle data source active status" 
ON public.data_sources 
FOR UPDATE 
USING (
  NOT is_team_admin(auth.uid()) AND 
  user_id = get_user_team_admin(auth.uid())
);

-- Widget görünürlüğü için RLS güncellemesi - takım üyeleri de görebilmeli
DROP POLICY IF EXISTS "Users can view active widgets from their team admin or public" ON public.widgets;

CREATE POLICY "Users can view active widgets from their team admin or public" 
ON public.widgets 
FOR SELECT 
USING (
  is_active = true AND (
    -- Kendi oluşturduğu
    created_by = auth.uid() OR
    -- Admin ise hepsini görebilir  
    is_admin(auth.uid()) OR
    -- Team admin'in oluşturduğu (takım üyeleri için)
    created_by = get_user_team_admin(auth.uid()) OR
    -- Sistem varsayılan widget'ları
    created_by IS NULL
  )
);
