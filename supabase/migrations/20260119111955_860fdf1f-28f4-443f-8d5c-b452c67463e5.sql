-- Create enum for widget categories
CREATE TYPE public.widget_category AS ENUM ('dashboard', 'satis', 'finans', 'cari');

-- Create user dashboard settings table
CREATE TABLE public.user_dashboard_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  page VARCHAR(50) NOT NULL,
  layout JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, page)
);

-- Create user widget filters table
CREATE TABLE public.user_widget_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  widget_id VARCHAR(100) NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, widget_id)
);

-- Add demo mode columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_demo_account BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS use_mock_data BOOLEAN DEFAULT FALSE;

-- Enable RLS on new tables
ALTER TABLE public.user_dashboard_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_widget_filters ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_dashboard_settings
CREATE POLICY "Users can view their own dashboard settings"
ON public.user_dashboard_settings
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own dashboard settings"
ON public.user_dashboard_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dashboard settings"
ON public.user_dashboard_settings
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dashboard settings"
ON public.user_dashboard_settings
FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for user_widget_filters
CREATE POLICY "Users can view their own widget filters"
ON public.user_widget_filters
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own widget filters"
ON public.user_widget_filters
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own widget filters"
ON public.user_widget_filters
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own widget filters"
ON public.user_widget_filters
FOR DELETE
USING (auth.uid() = user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_user_dashboard_settings_updated_at
BEFORE UPDATE ON public.user_dashboard_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_widget_filters_updated_at
BEFORE UPDATE ON public.user_widget_filters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();