
-- Yanlış takım ilişkisini sil (sercantuner1, sercantuner'in takım üyesi değil)
DELETE FROM public.user_teams 
WHERE admin_id = '8e5108c0-8150-44bf-ba09-81688e0181e7' 
  AND member_id = '72131796-76b5-4aa8-bb4a-bea7f7d926cb';

-- sercantuner1'i tekrar şirket yöneticisi yap
UPDATE public.profiles 
SET is_team_admin = true 
WHERE user_id = '72131796-76b5-4aa8-bb4a-bea7f7d926cb';

-- sercantuner'a admin rolü ver (Süper Admin)
INSERT INTO public.user_roles (user_id, role)
VALUES ('8e5108c0-8150-44bf-ba09-81688e0181e7', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Widgets RLS: Süper admin oluşturur, tüm authenticated kullanıcılar görebilir
-- (Takım üyeleri için widget_permissions ile filtrelenecek - uygulama katmanında)
DROP POLICY IF EXISTS "Users can view active widgets from their team admin or public" ON public.widgets;

CREATE POLICY "Authenticated users can view active widgets" 
ON public.widgets 
FOR SELECT 
USING (
  is_active = true
);

-- Sadece admin widget ekleyebilir/düzenleyebilir (zaten mevcut)

-- Data sources RLS güncelle: Herkes görebilir, sadece admin düzenleyebilir
DROP POLICY IF EXISTS "Users can view team data sources" ON public.data_sources;
DROP POLICY IF EXISTS "Team admins can fully update data sources" ON public.data_sources;
DROP POLICY IF EXISTS "Team members can toggle data source active status" ON public.data_sources;
DROP POLICY IF EXISTS "Team admins can create data sources" ON public.data_sources;
DROP POLICY IF EXISTS "Team admins can delete data sources" ON public.data_sources;

-- Herkes aktif veri kaynaklarını görebilir
CREATE POLICY "Authenticated users can view data sources" 
ON public.data_sources 
FOR SELECT 
USING (is_active = true OR user_id = auth.uid() OR is_admin(auth.uid()));

-- Sadece admin veri kaynağı oluşturabilir
CREATE POLICY "Only admins can create data sources" 
ON public.data_sources 
FOR INSERT 
WITH CHECK (is_admin(auth.uid()));

-- Sadece admin veri kaynağı güncelleyebilir
CREATE POLICY "Only admins can update data sources" 
ON public.data_sources 
FOR UPDATE 
USING (is_admin(auth.uid()));

-- Sadece admin veri kaynağı silebilir
CREATE POLICY "Only admins can delete data sources" 
ON public.data_sources 
FOR DELETE 
USING (is_admin(auth.uid()));
