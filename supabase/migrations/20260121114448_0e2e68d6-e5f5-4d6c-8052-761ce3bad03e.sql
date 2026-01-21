-- Drop the overly permissive update policy
DROP POLICY IF EXISTS "Authenticated users can update data sources" ON public.data_sources;

-- Create more restrictive update policy: 
-- Users can update their own data sources fully
-- OR any authenticated user can update is_active field (enable/disable)
CREATE POLICY "Users can update own data sources"
ON public.data_sources
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);