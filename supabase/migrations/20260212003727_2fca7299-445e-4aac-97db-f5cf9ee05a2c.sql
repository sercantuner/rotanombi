-- Create a temporary bucket for CSV imports
INSERT INTO storage.buckets (id, name, public) 
VALUES ('temp-imports', 'temp-imports', false)
ON CONFLICT (id) DO NOTHING;

-- Allow service role full access
CREATE POLICY "Service role can manage temp imports"
ON storage.objects
FOR ALL
USING (bucket_id = 'temp-imports' AND (auth.jwt() ->> 'role') = 'service_role')
WITH CHECK (bucket_id = 'temp-imports' AND (auth.jwt() ->> 'role') = 'service_role');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload to temp imports"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'temp-imports' AND auth.role() = 'authenticated');

-- Allow authenticated users to read their uploads
CREATE POLICY "Authenticated users can read temp imports"
ON storage.objects
FOR SELECT
USING (bucket_id = 'temp-imports' AND auth.role() = 'authenticated');
