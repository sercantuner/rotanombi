-- Step 1: Add super_admin to enum and license fields to profiles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- Add license fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS license_type text DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS license_expires_at timestamp with time zone;