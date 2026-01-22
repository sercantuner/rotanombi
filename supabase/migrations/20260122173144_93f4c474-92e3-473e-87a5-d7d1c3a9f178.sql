-- Super admin'ler için page_containers tablosunda INSERT yetkisi ekle
DROP POLICY IF EXISTS "Super admins can insert page containers" ON public.page_containers;
DROP POLICY IF EXISTS "Super admins can update page containers" ON public.page_containers;
DROP POLICY IF EXISTS "Super admins can delete page containers" ON public.page_containers;

-- Super admin'ler konteyner ekleyebilir
CREATE POLICY "Super admins can insert page containers" 
ON public.page_containers 
FOR INSERT 
WITH CHECK (public.is_super_admin(auth.uid()));

-- Super admin'ler konteyner güncelleyebilir  
CREATE POLICY "Super admins can update page containers" 
ON public.page_containers 
FOR UPDATE 
USING (public.is_super_admin(auth.uid()));

-- Super admin'ler konteyner silebilir
CREATE POLICY "Super admins can delete page containers" 
ON public.page_containers 
FOR DELETE 
USING (public.is_super_admin(auth.uid()));

-- container_widgets için de aynı politikaları ekle
DROP POLICY IF EXISTS "Super admins can insert container widgets" ON public.container_widgets;
DROP POLICY IF EXISTS "Super admins can update container widgets" ON public.container_widgets;
DROP POLICY IF EXISTS "Super admins can delete container widgets" ON public.container_widgets;

CREATE POLICY "Super admins can insert container widgets" 
ON public.container_widgets 
FOR INSERT 
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update container widgets" 
ON public.container_widgets 
FOR UPDATE 
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete container widgets" 
ON public.container_widgets 
FOR DELETE 
USING (public.is_super_admin(auth.uid()));