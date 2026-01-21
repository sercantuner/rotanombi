-- Drop existing restrictive policies on data_sources
DROP POLICY IF EXISTS "Users can view own or shared data sources" ON public.data_sources;
DROP POLICY IF EXISTS "Users can create own data sources" ON public.data_sources;
DROP POLICY IF EXISTS "Users can update own data sources" ON public.data_sources;
DROP POLICY IF EXISTS "Users can delete own data sources" ON public.data_sources;

-- Create new policies: All authenticated users can view all data sources
CREATE POLICY "Authenticated users can view all data sources"
ON public.data_sources
FOR SELECT
TO authenticated
USING (true);

-- All authenticated users can create data sources (must set their user_id)
CREATE POLICY "Authenticated users can create data sources"
ON public.data_sources
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- All authenticated users can update any data source (for enable/disable)
CREATE POLICY "Authenticated users can update data sources"
ON public.data_sources
FOR UPDATE
TO authenticated
USING (true);

-- Only owners can delete data sources
CREATE POLICY "Users can delete own data sources"
ON public.data_sources
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);