-- Helper function: Check if user is in the same team as another user
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _admin_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_teams
    WHERE admin_id = _admin_id AND member_id = _user_id
  ) OR _user_id = _admin_id
$$;

-- Helper function: Get the admin (company owner) for a user
-- Returns the user's own id if they are an admin, otherwise returns their admin's id
CREATE OR REPLACE FUNCTION public.get_user_team_admin(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT admin_id FROM public.user_teams WHERE member_id = _user_id LIMIT 1),
    _user_id -- If not a member, they might be an admin themselves
  )
$$;

-- Helper function: Check if user is a team admin (company owner)
CREATE OR REPLACE FUNCTION public.is_team_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_teams WHERE admin_id = _user_id
  ) OR NOT EXISTS (
    SELECT 1 FROM public.user_teams WHERE member_id = _user_id
  )
$$;

-- Helper function: Get all team member ids for an admin
CREATE OR REPLACE FUNCTION public.get_team_members(_admin_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT member_id FROM public.user_teams WHERE admin_id = _admin_id
  UNION
  SELECT _admin_id
$$;

-- Add is_team_admin column to profiles for quick checks
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_team_admin boolean DEFAULT true;

-- Update existing profiles: those who are in user_teams as member are not admins
UPDATE public.profiles 
SET is_team_admin = NOT EXISTS (
  SELECT 1 FROM public.user_teams WHERE member_id = profiles.user_id
);

-- Update widgets RLS: Team members can see widgets created by their admin
DROP POLICY IF EXISTS "Widgets are viewable by everyone" ON public.widgets;
DROP POLICY IF EXISTS "Admins can view all widgets" ON public.widgets;

CREATE POLICY "Users can view active widgets from their team admin or public"
ON public.widgets
FOR SELECT
TO authenticated
USING (
  is_active = true AND (
    -- Widget created by user's team admin
    created_by = public.get_user_team_admin(auth.uid())
    -- Or user is a system admin
    OR public.is_admin(auth.uid())
    -- Or widget has no creator (system widgets)
    OR created_by IS NULL
  )
);

-- Update data_sources RLS: Team members can see data sources from their team
DROP POLICY IF EXISTS "Authenticated users can view all data sources" ON public.data_sources;
DROP POLICY IF EXISTS "Authenticated users can create data sources" ON public.data_sources;
DROP POLICY IF EXISTS "Users can update own data sources" ON public.data_sources;
DROP POLICY IF EXISTS "Users can delete own data sources" ON public.data_sources;

CREATE POLICY "Users can view team data sources"
ON public.data_sources
FOR SELECT
TO authenticated
USING (
  -- Own data sources
  user_id = auth.uid()
  -- Or from team admin
  OR user_id = public.get_user_team_admin(auth.uid())
  -- Or shared
  OR is_shared = true
);

CREATE POLICY "Team admins can create data sources"
ON public.data_sources
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND public.is_team_admin(auth.uid())
);

CREATE POLICY "Team admins can update data sources"
ON public.data_sources
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() AND public.is_team_admin(auth.uid())
);

CREATE POLICY "Team admins can delete data sources"
ON public.data_sources
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid() AND public.is_team_admin(auth.uid())
);

-- Update profiles RLS: Team members cannot update DIA settings
-- First drop existing policies
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Recreate with restriction on DIA fields for non-admins
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Team admins can view their team members' profiles
CREATE POLICY "Team admins can view team member profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.user_teams 
    WHERE admin_id = auth.uid() AND member_id = profiles.user_id
  )
);