-- Step 2: Create is_super_admin function and RLS policies

-- Create is_super_admin function
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

-- Super admins can view all profiles
CREATE POLICY "Super admins can view all profiles"
ON public.profiles
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Super admins can update all profiles (for license management)
CREATE POLICY "Super admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (is_super_admin(auth.uid()));

-- Super admins can view all user_pages (for impersonation)
CREATE POLICY "Super admins can view all user pages"
ON public.user_pages
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Super admins can view all page_containers
CREATE POLICY "Super admins can view all page containers"
ON public.page_containers
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Super admins can view all container_widgets
CREATE POLICY "Super admins can view all container widgets"
ON public.container_widgets
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Super admins can view all app_settings
CREATE POLICY "Super admins can view all app settings"
ON public.app_settings
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Super admins can view all user_roles
CREATE POLICY "Super admins can view all roles"
ON public.user_roles
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Super admins can manage all roles
CREATE POLICY "Super admins can manage all roles"
ON public.user_roles
FOR ALL
USING (is_super_admin(auth.uid()));

-- Super admins can view inactive widgets too
DROP POLICY IF EXISTS "Authenticated users can view active widgets" ON public.widgets;
CREATE POLICY "Users can view active widgets or super admins all"
ON public.widgets
FOR SELECT
USING (is_active = true OR is_super_admin(auth.uid()));

-- Set default license for existing users
UPDATE public.profiles 
SET license_type = 'standard', 
    license_expires_at = now() + interval '1 year'
WHERE license_expires_at IS NULL;