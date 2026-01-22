-- Super admin'ler için widgets tablosunda tam CRUD yetkisi ekle
-- Mevcut politikaları kontrol et ve gerekirse ekle

-- Önce mevcut politikaları temizle (eğer varsa)
DROP POLICY IF EXISTS "Super admins can manage all widgets" ON public.widgets;
DROP POLICY IF EXISTS "Super admins can insert widgets" ON public.widgets;
DROP POLICY IF EXISTS "Super admins can update widgets" ON public.widgets;
DROP POLICY IF EXISTS "Super admins can delete widgets" ON public.widgets;
DROP POLICY IF EXISTS "Anyone can view active widgets" ON public.widgets;
DROP POLICY IF EXISTS "Authenticated users can view widgets" ON public.widgets;

-- Herkes aktif widget'ları görebilir (okuma)
CREATE POLICY "Anyone can view active widgets" 
ON public.widgets 
FOR SELECT 
USING (is_active = true);

-- Super admin'ler tüm widget'ları görebilir
CREATE POLICY "Super admins can view all widgets" 
ON public.widgets 
FOR SELECT 
USING (public.is_super_admin(auth.uid()));

-- Super admin'ler widget oluşturabilir
CREATE POLICY "Super admins can insert widgets" 
ON public.widgets 
FOR INSERT 
WITH CHECK (public.is_super_admin(auth.uid()));

-- Super admin'ler widget güncelleyebilir
CREATE POLICY "Super admins can update widgets" 
ON public.widgets 
FOR UPDATE 
USING (public.is_super_admin(auth.uid()));

-- Super admin'ler widget silebilir
CREATE POLICY "Super admins can delete widgets" 
ON public.widgets 
FOR DELETE 
USING (public.is_super_admin(auth.uid()));