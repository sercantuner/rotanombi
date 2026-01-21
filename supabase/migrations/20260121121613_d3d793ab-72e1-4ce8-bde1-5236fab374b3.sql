
-- Widget categories herkes görebilsin (zaten var ama emin olalım)
DROP POLICY IF EXISTS "Widget categories are viewable by everyone" ON public.widget_categories;
CREATE POLICY "Widget categories are viewable by everyone" 
ON public.widget_categories 
FOR SELECT 
USING (true);

-- Widget permissions için RLS güncellemesi
-- Şirket yöneticileri sadece kendi takım üyelerine izin verebilir
DROP POLICY IF EXISTS "Admins can manage widget permissions" ON public.widget_permissions;
DROP POLICY IF EXISTS "Users can view their own widget permissions" ON public.widget_permissions;

-- Kullanıcı kendi izinlerini görebilir
CREATE POLICY "Users can view their own widget permissions" 
ON public.widget_permissions 
FOR SELECT 
USING (auth.uid() = user_id);

-- Şirket yöneticileri kendi takım üyelerinin izinlerini görebilir
CREATE POLICY "Team admins can view team member permissions" 
ON public.widget_permissions 
FOR SELECT 
USING (
  is_admin(auth.uid()) OR 
  EXISTS (
    SELECT 1 FROM user_teams 
    WHERE admin_id = auth.uid() AND member_id = widget_permissions.user_id
  )
);

-- Şirket yöneticileri kendi takım üyelerine izin verebilir
CREATE POLICY "Team admins can manage team member permissions" 
ON public.widget_permissions 
FOR ALL 
USING (
  is_admin(auth.uid()) OR 
  EXISTS (
    SELECT 1 FROM user_teams 
    WHERE admin_id = auth.uid() AND member_id = widget_permissions.user_id
  )
);

-- Profillere team admin view ekle (takım üyelerinin profillerini görmek için)
DROP POLICY IF EXISTS "Team admins can view team member profiles" ON public.profiles;
CREATE POLICY "Team admins can view team member profiles" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM user_teams 
    WHERE admin_id = auth.uid() AND member_id = profiles.user_id
  )
);
