-- Fix the overly permissive INSERT policy on notifications
-- Drop the old policy
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;

-- Create a more restrictive policy - only authenticated users can insert for themselves
-- or we use service_role for system notifications via edge functions
CREATE POLICY "Authenticated users can insert own notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);