-- Notifications table for critical alerts
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'info' CHECK (type IN ('critical', 'warning', 'info')),
  category VARCHAR(50), -- vade, stok, odeme, tahsilat
  is_read BOOLEAN DEFAULT FALSE,
  link TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- System can insert notifications for any user (via edge function)
CREATE POLICY "Service role can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'viewer');

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- User permissions for modules
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  module VARCHAR(50) NOT NULL, -- 'satis', 'finans', 'cari', 'ayarlar', 'admin'
  can_view BOOLEAN DEFAULT TRUE,
  can_edit BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, module)
);

-- Enable RLS on user_permissions
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- User teams - admin can manage team members
CREATE TABLE public.user_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(admin_id, member_id)
);

-- Enable RLS on user_teams
ALTER TABLE public.user_teams ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- Function to check module permission
CREATE OR REPLACE FUNCTION public.has_module_permission(_user_id uuid, _module text, _permission text DEFAULT 'view')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = _user_id 
      AND module = _module
      AND (
        (_permission = 'view' AND can_view = true) OR
        (_permission = 'edit' AND can_edit = true)
      )
  ) OR public.is_admin(_user_id)
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update roles" ON public.user_roles
  FOR UPDATE USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE USING (public.is_admin(auth.uid()));

-- RLS Policies for user_permissions
CREATE POLICY "Users can view own permissions" ON public.user_permissions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all permissions" ON public.user_permissions
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage permissions" ON public.user_permissions
  FOR ALL USING (public.is_admin(auth.uid()));

-- RLS Policies for user_teams
CREATE POLICY "Admins can view their team" ON public.user_teams
  FOR SELECT USING (admin_id = auth.uid() OR member_id = auth.uid());

CREATE POLICY "Admins can manage their team" ON public.user_teams
  FOR ALL USING (admin_id = auth.uid() OR public.is_admin(auth.uid()));

-- Trigger to update updated_at on user_permissions
CREATE TRIGGER update_user_permissions_updated_at
  BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default admin role for sercantuner (will be updated with actual user_id)
-- This will be done via edge function or manually after user signs up